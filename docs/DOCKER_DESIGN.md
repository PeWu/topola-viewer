# Topola Viewer: Docker Packaging & Deployment Design

## 1. Problem Description

Topola Viewer is a modern, client-side web application designed for exploring and visualizing genealogy data from GEDCOM files. Currently, running a custom instance with a pre-loaded family tree and photos requires manual local development builds or setting up complex web hosting environments. This project aims to package Topola Viewer inside an ultra-lightweight, secure, and production-ready Docker container. This container will allow users to instantly deploy a vanilla viewer or easily serve their own private, self-contained family trees with zero local compilation or build-tool dependencies.

## 2. Major Components & How They Interact

At a high level, the containerized Topola Viewer consists of three primary components working together to serve and display family trees:

1. **The User's Web Browser (The App)**: This is where Topola Viewer actually runs. Since it is a single-page React application, the browser downloads the application files once and executes all the logic, chart rendering, and user interactions locally on the user's computer.
2. **The Caddy Web Server (The Helper)**: This is a lightweight, secure, and fast background server running inside the Docker container. Its job is to serve the application files (HTML, CSS, JavaScript) and the family tree package when the browser requests them. Additionally, Caddy dynamically updates the main HTML page on-the-fly when it is loaded, injecting the path or address of the family tree file specified by the container's configuration.
3. **The Genealogy Data (The Data)**: This is the family tree description file. Depending on whether you have local photo assets:
   * **Unzipped File (`.ged`)**: If you do not have local photos, you can serve your standard, plain-text `.ged` file directly.
   * **Zipped Archive (`.gdz` or `.zip`)**: If you want to bundle family photos, you compress the `.ged` file and the photos together into a single archive. Topola Viewer will automatically unzip and map the photos to the tree.
   Serving this as a single file (either `.ged` or `.gdz`) keeps the container setup simple and highly portable.

## 3. Alternative Designs Considered & Rejected

To ensure future development does not regress or re-argue established choices, this section documents the architectural patterns that were thoroughly evaluated but ultimately rejected.

### Option A: Build-Time Variable Injection (`VITE_STATIC_URL`)

* **Design Proposal**: Build custom container images by setting `VITE_STATIC_URL` during the Vite production build step (`npm run build`) inside the Dockerfile.
* **Why Rejected**:
  * **Heavy & Slow Builds**: Recompiling a modern React SPA inside Docker requires a full Node.js runtime, downloading `node_modules`, and compiling TypeScript. This takes minutes, consumes significant system resources, and makes building a custom image locally a highly friction-filled developer experience.
  * **No Runtime Dynamism**: Since the static URL is hardcoded into minified JS assets during compiling, users cannot change their genealogy file path dynamically when running the container. A simple task like pointing the container to a new GEDCOM file would require a full image rebuild, rather than a simple environment variable or volume mount adjustment.

### Option B: Client-Side Config Fetching (`fetch('/config.json')`)

* **Design Proposal**: At React application startup, trigger an asynchronous HTTP request (`fetch('/config.json')`) to retrieve the configuration and target tree location.
* **Why Rejected**:
  * **Unnecessary Startup Latency**: Every asynchronous network call in a client-side SPA blocks the React application mount lifecycle. Even on high-performance servers, fetching `/config.json` introduces an extra network roundtrip at boot time.

### Option C: Shell-Based Template Rendering (Nginx Alpine + `envsubst`)

* **Design Proposal**: Run the static application on an Nginx Alpine base container, using a startup shell script and the `envsubst` tool to substitute environment variables inside `index.html` before launching the web server.
* **Why Rejected**:
  * **Vulnerability Attack Surface**: Standard Linux and Alpine base images contain shell environments (`/bin/sh`), package managers (`apk`), and standard operating system utilities. These represent a non-zero container attack surface, leading to vulnerability alerts (CVEs) in enterprise environments.

### Option D: Custom Compiled Go Static Server

* **Design Proposal**: Compile a custom, lightweight 35-line Go static web server program that handles SPA routing and dynamically injects environment variables directly into the `index.html` served from memory.
* **Why Rejected**:
  * **Maintenance Complexity Overhead**: Although highly performant and lightweight (~10MB total container size), introducing custom compiled server source code adds to repository maintenance. Developers would have to test, audit, and maintain custom Go HTTP routing logic alongside their main React/TypeScript codebase. Using an off-the-shelf server (Caddy) eliminates this maintenance entirely.

### Option E: Multi-Architecture Image Support (`linux/arm64`)

* **Design Proposal**: Package and publish multi-architecture container images targeting both standard x86_64 (`linux/amd64`) and ARM64 (`linux/arm64`) platforms.
* **Why Rejected**:
  * **Pipeline Emulation Latency**: Building multi-architecture images on standard AMD64 GitHub Actions runners requires virtualized instruction emulation via QEMU. Emulating the TypeScript build and Go compiler inside a QEMU virtual environment increases container compilation cycles by up to 10x to 20x, significantly bloating release delays.
  * **No Server-Side Execution Penalty**: Topola Viewer is a pure, client-side React single-page application (SPA). The browser executes all chart rendering and data logic on the end-user's computer (whether it runs on x86_64, ARM64/Apple Silicon, or mobile platforms). The container's internal web server (Caddy) simply serves static HTML/JS assets. Running the `linux/amd64` image under standard Docker architecture translation (e.g., Rosetta 2 or Docker Desktop VM) on ARM64/M-series hosts has absolutely zero visible performance penalty.
  * **Workflow Stability**: Focusing exclusively on `linux/amd64` standardizes our GitHub Actions runner steps, completely removes complex third-party dependencies like `setup-qemu-action`, and ensures build cycles remain blazingly fast, secure, and reliable.

## 4. Detailed Implementation Plan

This section outlines the complete, step-by-step implementation plan. It lists every file that will be modified or created, the exact code modifications or configurations required, and the explicit engineering rationale for each.

### Step 1: Add Global Config Injection Target to HTML

* **Target File**: [index.html](../index.html) (Modify)
* **Action**: Add a `<meta>` tag containing the dynamic injection placeholder inside the `<head>` tag:
  ```html
  <meta name="topola-static-url" content="{{ env `STATIC_URL` | html }}">
  ```
* **Rationale**:
  * Storing the configuration safely inside a `<meta>` tag content attribute ensures it is parsed strictly as data rather than executable code, preventing Reflected Cross-Site Scripting (XSS) or script injection vulnerabilities.
  * **HTML Parsing Protection**: Enclosing the template expression in backticks (`` `STATIC_URL` ``) prevents syntactically broken nested double quotes in the HTML `content` attribute, which would otherwise break standard browser HTML tag parsing.
  * The Caddy `| html` filter guarantees that the environment variable is fully HTML-entity-escaped before injection.
  * The placeholder syntax `{{ env `STATIC_URL` | html }}` is evaluated dynamically by Caddy when serving the page, adding zero network latency.

### Step 2: Update Application Boot Logic to Handle Global Config
* **Target File**: [src/app.tsx](../src/app.tsx) (Modify)
* **Action**: Update the application boot logic to handle dynamic config via the `<meta>` tag or Vite static URL, override standalone/CORS properties, and adjust route settings:
  * **Config Resolution**: Retrieve the statically-served GEDCOM/GDZ URL.
  * **Arguments Setup**: Disable standalone mode and bypass CORS handling when a static URL is provided.
  * **Conditional Routing**: Force routing directly to `/view` (bypassing the standard intro landing page) when `staticUrl` is set.
  ```typescript
  // 1. Global Config Resolution
  function getStaticUrl(): string | undefined {
    const envUrl = import.meta.env.VITE_STATIC_URL;
    if (envUrl) return envUrl;

    const metaTag = document.querySelector('meta[name="topola-static-url"]');
    const metaUrl = metaTag?.getAttribute('content');
    // Safely ignore if it is empty, the raw caddy template expression, or Vite's raw template placeholder
    if (
      metaUrl &&
      !metaUrl.startsWith("__") &&
      !metaUrl.includes("{{ env")
    ) {
      return metaUrl;
    }

    return undefined;
  }

  const staticUrl = getStaticUrl();

  // 2. Arguments and Source Spec Override
  if (staticUrl) {
    sourceSpec = {
      source: DataSourceEnum.GEDCOM_URL,
      url: staticUrl,
      handleCors: false,
    };
  }
  ...
  standalone: getParam('standalone') !== 'false' && !embedded && !staticUrl,

  // 3. Conditional Routing in JSX Return
  {staticUrl ? (
    <Routes>
      <Route path="/view" element={renderMainArea()} />
      <Route path="*" element={<Navigate to="/view" replace />} />
    </Routes>
  ) : (
    <Routes>
      <Route path="/" element={<Intro />} />
      <Route path="/view" element={renderMainArea()} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )}
  ```
* **Rationale**:
  * **Security & Safety**: Retrieving configuration via the DOM's `<meta>` element ensures we parse data context safely rather than relying on direct executable script template injection.
  * **UX Modularity (Zero-Friction Mode)**: Bypassing the Intro page and disabling the standard "open file" menus (`standalone: false`) transforms the general-purpose viewer into a streamlined, dedicated instance for the preloaded tree.
  * **Backward Compatibility**: Keeps standard dev runs (`npm start`) and static deployments (GitHub Pages/WikiTree) working out-of-the-box because the template string `{{ env "STATIC_URL" }}` is safely ignored when it hasn't been evaluated by Caddy.

### Step 3: Create Caddy Server Configuration
* **Target File**: `docker/Caddyfile` (New File in dedicated directory)
* **Action**: Add Caddy serving rules to handle robust security headers, optimized caching, SPA routing, and active template evaluation:
  ```caddy
  {
      # Disable administrative API to prevent permission errors in read-only environments
      admin off
  }

  :8080 {
      root * /app/public
      
      # Compress static assets (HTML, JS, CSS, GEDCOM text files)
      encode gzip zstd
      
      file_server

      # Robust Security Headers
      header {
          X-Frame-Options "SAMEORIGIN"
          X-Content-Type-Options "nosniff"
          Referrer-Policy "strict-origin-when-cross-origin"
          Permissions-Policy "geolocation=(), microphone=(), camera=()"
      }

      # Cache Control: Long-lived cache ONLY for immutable hashed build assets
      @immutable_assets {
          path /assets/*
      }
      header @immutable_assets Cache-Control "public, max-age=31536000, immutable"

      # Cache Control: Immediate revalidation for all mutable assets (HTML, mounted dynamic family trees/photos)
      @mutable_assets {
          not {
              path /assets/*
          }
      }
      header @mutable_assets Cache-Control "public, max-age=0, must-revalidate"

      templates {
          mime text/html
      }

      try_files {path} /index.html
  }
  ```
* **Rationale**:
  * **Security Headers**: Protects production deployments against clickjacking, MIME-sniffing, and referrer leaks through standard secure response headers.
  * **Disable Admin Endpoint**: Setting `admin off` prevents Caddy from attempting to bind administrative sockets or write auto-saved configuration files (`caddy_autosave.json`) to its working directory, avoiding fatal startup failures in rootless containers and secure read-only filesystems.
  * **Asset Compression**: Adding `encode gzip zstd` ensures that large client-side JS bundles and plain-text GEDCOM files are compressed, dramatically reducing load-time latency and server bandwidth costs.
  * **Precise Caching Rules**: Restructures caching to only apply `immutable` tags to assets in `/assets/*` (which contains Vite's hashed JS/CSS files). This ensures user-supplied dynamic family trees (`.ged`, `.gdz`) and mounted photos do not get cached permanently, allowing instant runtime updates.
  * **HTML Templating**: Caddy dynamically processes variables (like `{{ env `STATIC_URL` | html }}`) for HTML documents, avoiding performance overhead on other resources.
  * **Non-Root Port**: Serving from port `8080` permits the container to run as an unprivileged user without root capabilities.

---

### Step 4: Create Multi-Stage Dockerfile
* **Target File**: `docker/Dockerfile` (New File in dedicated directory)
* **Action**: Write the multi-stage compilation and assembly pipeline using a pre-compiled Caddy binary and Google's library-free Distroless Static base image running as nonroot:
  ```dockerfile
  # Stage 1: Compile the React/TypeScript bundle
  FROM node:20-alpine AS react-builder
  WORKDIR /app
  COPY package*.json ./
  RUN npm ci
  COPY . .
  RUN npm run build

  # Stage 2: Package static assets & Caddy binary on Distroless Static
  FROM gcr.io/distroless/static-debian12
  USER nonroot:nonroot
  WORKDIR /app

  # Copy static Caddy binary from the official Caddy image
  COPY --from=caddy:2.7.6-alpine /usr/bin/caddy /usr/bin/caddy

  # Copy Caddy server config with nonroot ownership
  COPY --chown=nonroot:nonroot docker/Caddyfile ./

  # Copy React build outputs with nonroot ownership to support strict read-only filesystem deployments
  COPY --chown=nonroot:nonroot --from=react-builder /app/dist ./public

  EXPOSE 8080
  ENTRYPOINT ["/usr/bin/caddy", "run", "--config", "./Caddyfile", "--adapter", "caddyfile"]
  ```
* **Rationale**:
  * **Clean Compilation Separation**: Restructures compilation using a multi-stage build where the heavy Node.js and TypeScript compiler packages are restricted entirely to the builder stage, keeping the final runner image extremely lightweight and free of development tools.
  * **Static Caddy Binary**: Copying the pre-compiled, statically linked Caddy binary directly from the official `caddy` Alpine image. Since the official Caddy binary is a pure, library-independent Go executable built without CGO, it runs flawlessly on top of a Google Distroless Static image, completely bypassing the need to compile Caddy from source and reducing build times by several minutes.
  * **Distroless Static Base**: Standardizing on `distroless/static-debian12` removes *all* dynamic libraries, shells, and packages from the runtime container. This cuts container image size to under ~25MB and eliminates runtime vulnerability scan alerts (CVEs) completely.
  * **Non-Root Execution**: Switching to `USER nonroot:nonroot` inside the production stage ensures the application runs with minimum privileges, satisfying strict enterprise and Kubernetes execution policies.
  * **Explicit File Ownership**: Using `COPY --chown=nonroot:nonroot` guarantees that all files in the runtime container are owned by the runtime non-root user, bypassing permissions conflicts.

### Step 5: Create Docker Ignore File
* **Target File**: `.dockerignore` (New File at root)
* **Action**: Exclude local development folders and build environments from entering the Docker context:
  ```text
  node_modules
  dist
  .git
  .github
  cypress
  .vscode
  README.md
  ```
* **Rationale**:
  * Speeds up local `docker build` times by preventing megabytes of local folders (like `node_modules` and local `dist` directories) from uploading to the Docker daemon build context.

### Step 6: Create GitHub Actions Container Deployment Workflow
* **Target File**: `.github/workflows/deploy-docker.yml` (New File)
* **Action**: Setup a GitHub Actions workflow to compile, tag, and publish the container images to GHCR, handling lowercase names and safe tagging:
  ```yaml
  name: Build and Publish Docker Image

  on:
    workflow_dispatch:
    workflow_call:

  jobs:
    build-and-push:
      runs-on: ubuntu-latest
      permissions:
        contents: read
        packages: write

      steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Convert Repository Name to Lowercase
        run: |
          echo "GHCR_IMAGE_NAME=$(echo "ghcr.io/${{ github.repository }}" | tr '[:upper:]' '[:lower:]')" >> $GITHUB_ENV

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.GHCR_IMAGE_NAME }}
          tags: |
            type=sha
            type=raw,value=latest,enable=${{ github.ref == 'refs/heads/master' }}

      - name: Build and push Docker image
        uses: docker/build-push-action@v6
        with:
          context: .
          file: docker/Dockerfile
          platforms: linux/amd64
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
  ```
* **Rationale**:
  * **Strict Lowercase Registry Names**: Registry image names must be strictly lowercase. Converting the repository path to lowercase prevents Docker push failures due to uppercase organization or repository names (e.g. `PeWu`).
  * **Safe Production Tagging**: Restricts pushing the `latest` tag to master branch runs only, preventing development branches or forks from accidentally overwriting the stable master production image.
  * **No QEMU Dependency**: Because the image targets standard `linux/amd64` servers directly, we bypass slow CPU instruction emulation completely. This eliminates the `setup-qemu-action` dependency, protecting the workflow against virtualizer crashes and speeding up build initialization.
  * **Git SHA Tagging**: Generates git SHA tags automatically, allowing precise auditing and rolling back of deployments.
  * **Modern Actions Standard**: Upgrades all critical deployment actions to their latest major releases to optimize runner speeds, secure security improvements, and align with Node 20/22 GitHub Action standard runner specifications.
  * **Active GitHub Caching**: Leverages standard action build cache stores to reuse layers and accelerate build cycles.

### Step 7: Couple Docker Publication to existing Main Deployment Pipeline
* **Target File**: [.github/workflows/deploy-everywhere.yml](deploy-everywhere.yml) (Modify)
* **Action**: Integrate the newly created Docker workflow as a concurrent job:
  ```yaml
  name: Deploy everywhere

  on: workflow_dispatch

  jobs:
    deploy-gh-pages:
      uses: ./.github/workflows/deploy-gh-pages.yml

    deploy-wikitree-apps:
      uses: ./.github/workflows/deploy-wikitree-apps.yml
      secrets: inherit

    deploy-docker:
      uses: ./.github/workflows/deploy-docker.yml
      secrets: inherit
  ```
* **Rationale**:
  * Integrates the container deployment pipeline seamlessly into the main release trigger (`deploy-everywhere`), ensuring that Docker, GH Pages, and WikiTree versions are always updated in lockstep.

### Step 8: Document Container Usage in Main README
* **Target File**: `README.md` (Modify)
* **Action**: Add a dedicated "Docker Container Deployment" section with clear run, build, mount, and standalone template instructions:
  ```markdown
  ## Docker Container Deployment

  Topola Viewer can be run locally or deployed to standard cloud environments using Docker.

  ### Running Topola Viewer
  To pull and run Topola Viewer:
  ```bash
  docker run -d -p 8080:8080 ghcr.io/pewu/topola-viewer:latest
  ```
  Open your web browser and go to `http://localhost:8080` to upload your family tree files locally.

  ### Running with Your Own Data (Zero-Build Run)
  You can serve a standalone, pre-loaded family tree with zero compilation by mounting your family tree data (a `.ged` file or a zipped `.gdz` archive containing photos) directly into the running container:
  ```bash
  docker run -d -p 8080:8080 \
    -e STATIC_URL=my_family.gdz \
    -v ./my_family.gdz:/app/public/my_family.gdz \
    ghcr.io/pewu/topola-viewer:latest
  ```
  
  ### Building the Base Image Locally
  To build the base image from source:
  ```bash
  docker build -t topola-viewer -f docker/Dockerfile .
  ```

  ### Ready-To-Use Standalone Templates
  For creating completely self-contained Docker images that bundle your genealogy data and serve it instantly, see these pre-configured examples:

  1. **[Simple Standalone Tree](docker/examples/simple/)**: Demonstrates how to package and pre-load a `.ged` file directly inside a custom image.
  2. **[Standalone Tree with Photos](docker/examples/photos/)**: Packages your family tree and a `photos/` folder into a valid `.gdz` archive on-the-fly.
  ```
* **Rationale**:
  * Ensures the new Docker feature has first-class visibility, clear instructions, and easy references to packaged standalone templates for end users, enabling both basic runs, volume-mounted local data serving, and built-in custom imagery.

### Step 9: Provide Custom Image Templates (Simple & Zipped on the Fly)
* **Target Files**:
  * `docker/examples/simple/Dockerfile` (New File)
  * `docker/examples/simple/README.md` (New File)
  * `docker/examples/simple/family.ged` (New simple, valid example GEDCOM file)
  * `docker/examples/photos/Dockerfile` (New File)
  * `docker/examples/photos/README.md` (New File)
  * `docker/examples/photos/family.ged` (New simple, valid example GEDCOM file)
  * `docker/examples/photos/photos/I1.jpg` (New simple, valid example photo asset)
  * `docker/examples/photos/photos/I2.jpg` (New simple, valid example photo asset)
* **Action**: Create two dedicated subdirectories containing turnkey templates. To make these examples instantly runnable out-of-the-box, we provide simple, valid example files (`family.ged`, `I1.jpg`, and `I2.jpg`) inside the repository so users can immediately run `docker build` and test the container features without having to prepare their own private files first.

#### 1. Simple GEDCOM Template (`docker/examples/simple`)
  * **`docker/examples/simple/Dockerfile`**:
    ```dockerfile
    # Start from the official compiled container
    FROM ghcr.io/pewu/topola-viewer:latest

    # Copy the unzipped GEDCOM file directly into public folder
    COPY family.ged /app/public/family.ged

    # Configure server to pre-load this raw GEDCOM file
    ENV STATIC_URL=family.ged
    ```
  * **`docker/examples/simple/README.md`**:
    ```markdown
    # Standalone GEDCOM Container Example

    This example builds a self-contained image that hosts a single `.ged` file directly (no photos).

    ## Instructions

    1. Put your GEDCOM file in this directory and name it `family.ged`.
    2. Build your custom container:
       ```bash
       docker build -t my-simple-tree .
       ```
    3. Run your container:
       ```bash
       docker run -d -p 8080:8080 my-simple-tree
       ```
    ```

#### 2. Zipped Media Template (`docker/examples/photos`)
  * **`docker/examples/photos/Dockerfile`**:
    ```dockerfile
    # Stage 1: Multi-stage helper to zip GEDCOM & photos together preserving directory structure
    FROM alpine:latest AS zipper
    RUN apk add --no-cache zip
    WORKDIR /build
    COPY family.ged ./
    COPY photos/ ./photos/
    # Zip contents relative to build root to preserve directories as referenced in GEDCOM
    RUN zip -r family.gdz family.ged photos/

    # Stage 2: Load the zip file into the official container
    FROM ghcr.io/pewu/topola-viewer:latest
    COPY --from=zipper /build/family.gdz /app/public/family.gdz
    ENV STATIC_URL=family.gdz
    ```
  * **`docker/examples/photos/README.md`**:
    ```markdown
    # Standalone Zipped Family Tree Container with Photos

    This example leverages a multi-stage Docker build to automatically compress your `.ged` file and `photos/` folder into a secure `.gdz` archive on-the-fly, preserving your image directory path structures.

    ## Structure
    * Place your `family.ged` file here.
    * Place your photos also in this directory, or inside a `photos/` folder in this directory. If you put the photos in the `photos/` directory, make sure your GEDCOM file contains file references containing the `photos/` prefix. See the sample [family.ged](family.ged).

    ## Instructions

    1. Build your custom container:
       ```bash
       docker build -t my-photo-tree .
       ```
    2. Run your container:
       ```bash
       docker run -d -p 8080:8080 my-photo-tree
       ```
    ```
* **Rationale**:
  * **Simple Template**: Demonstrates the standard, zero-friction path for users who just have a raw `.ged` file.
  * **Photos Template (On-The-Fly Zipper)**: Solves the problem of executing commands in a shell-less, commandless distroless container. By spinning up a lightweight Alpine zipper image to execute the native `zip` tool, and copying *only* the finished `.gdz` artifact into the final stage, we achieve a completely self-contained, secure target image.
  * **Preserved Path Zip File Structure**: Packaging photos by zipping from the build root (`zip -r family.gdz family.ged photos/`) preserves the exact folder hierarchy relative to the GEDCOM. This guarantees that any complex or structured media folders (e.g., `photos/1990s/wedding.jpg`) match the exact file references declared inside the GEDCOM file, avoiding broken images from flattened zip scopes.
