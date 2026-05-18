# Topola Viewer Feature Designs

This directory contains technical design documents for some of the new features and architectural updates of the Topola Viewer.

These documents are inspired by the design methodology described in the blog post [Elephants, Goldfish and the New Golden Age of Software Engineering](https://drensin.medium.com/elephants-goldfish-and-the-new-golden-age-of-software-engineering-c33641a48874) by Dave Rensin. 

While new features *may* follow this methodology to ensure robust design validation and context safety before writing code, doing so is optional.

## Design Documents Registry

* **[DOCKER_DESIGN.md](DOCKER_DESIGN.md)**: Docker container packaging, lightweight Caddy web server configuration, and GitHub Actions publishing pipelines.
* **[IMMEDIATE_FAMILY_SECTION_DESIGN.md](IMMEDIATE_FAMILY_SECTION_DESIGN.md)**: Side panel block consolidating parents, spouses, and children for efficient off-screen tree navigation.
* **[PLAYWRIGHT_DESIGN.md](PLAYWRIGHT_DESIGN.md)**: Playwright E2E testing architecture, Vite development/preview server lifecycle integration, tracking blocker interceptors, and embedded iframe communication.
* **[SCREENSHOT_TESTS_DESIGN.md](SCREENSHOT_TESTS_DESIGN.md)**: Pixel-perfect visual regression testing infrastructure, animation stabilization, sandbox environment/DOM sanitization, and isolated Playwright projects.
* **[WEBMCP_DESIGN.md](WEBMCP_DESIGN.md)**: Model Context Protocol (MCP) bridge and TS tool registration for AI agent interaction.
