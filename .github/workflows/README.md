# GitHub Workflows

This directory contains GitHub Actions workflow files that automate various tasks for the project, such as continuous integration (CI), security analysis, and deployment.

## Files

- [codeql-analysis.yml](file:///home/pwiech/personal/github/topola-viewer/.github/workflows/codeql-analysis.yml): Performs CodeQL security analysis on the codebase to identify potential vulnerabilities.
- [deploy-everywhere.yml](file:///home/pwiech/personal/github/topola-viewer/.github/workflows/deploy-everywhere.yml): A manually triggered workflow that initiates deployment to both GitHub Pages and WikiTree Apps by calling their respective workflow files.
- [deploy-gh-pages.yml](file:///home/pwiech/personal/github/topola-viewer/.github/workflows/deploy-gh-pages.yml): Handles the deployment of the application to GitHub Pages.
- [deploy-wikitree-apps.yml](file:///home/pwiech/personal/github/topola-viewer/.github/workflows/deploy-wikitree-apps.yml): Manages the deployment of the application to WikiTree Apps using SFTP.
- [node.js.yml](file:///home/pwiech/personal/github/topola-viewer/.github/workflows/node.js.yml): The main Continuous Integration (CI) workflow. It installs dependencies, checks formatting, lints, builds, and runs tests across multiple Node.js versions.
