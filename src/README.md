# Source Directory (`src`)

This directory contains the main source code for the Topola Viewer application. It includes the application entry point, main layout components, chart rendering logic, data source adapters, menus, side panel, translations, and utilities.

## Subdirectories

*   **[datasource](datasource)**: Implements data sources for loading GEDCOM files, URLs, WikiTree API data, and embedded data.
*   **[menu](menu)**: Contains components for the top navigation bar, search bar, and various menus (upload, URL, WikiTree).
*   **[sidepanel](sidepanel)**: Contains components for the side panel, which shows individual details and chart configuration settings.
*   **[translations](translations)**: Contains JSON files with translations for supported languages.
*   **[util](util)**: Contains utility functions for dates, GEDCOM data, analytics, and responsive design.

## Files

*   **[app.tsx](app.tsx)**: The main application component that manages state, routing, data loading orchestration, and high-level layout.
*   **[changelog.tsx](changelog.tsx)**: Component that fetches and displays the recent changes in a modal dialog when the app is updated.
*   **[chart.tsx](chart.tsx)**: The primary chart rendering component using D3 and the `topola` library. It handles zoom, pan, and export actions.
*   **[donatso-chart.tsx](donatso-chart.tsx)**: An alternative chart view utilizing the `family-chart` library.
*   **[index.tsx](index.tsx)**: The entry point of the application. It sets up polyfills, internationalization, and renders the app root.
*   **[intro.tsx](intro.tsx)**: The landing page component shown when no data is loaded. It provides instructions, examples, and privacy information.
*   **[webmcp.ts](webmcp.ts)**: Model Context Protocol (MCP) implementation to expose viewer state and action handlers for dynamic AI model interactions and tool definitions.
*   **[webmcp_definitions.ts](webmcp_definitions.ts)**: Defines custom schemas and descriptions for various registration tools (such as person search, ancestry detail fetch, navigation triggers, etc.) exposed through the WebMCP protocol.
*   **[webmcp_types.ts](webmcp_types.ts)**: Common TypeScript type annotations and structures used within the WebMCP engine layer.

## Assets

*   **[index.css](index.css)**: Global CSS styles for the application.
*   **[topola.jpg](topola.jpg)**: Image asset for the Topola logo.

## Type Definitions

*   **[family-chart.d.ts](family-chart.d.ts)**: Type definitions for the `family-chart` library.
*   **[imports.d.ts](imports.d.ts)**: Type definitions for non-code assets (e.g., CSS imports).
*   **[javascript-natural-sort.d.ts](javascript-natural-sort.d.ts)**: Type definitions for the `javascript-natural-sort` library.
*   **[lunr-languages.d.ts](lunr-languages.d.ts)**: Type definitions for `lunr-languages` plugins.
*   **[parse-gedcom.d.ts](parse-gedcom.d.ts)**: Type definitions for the `parse-gedcom` library.
*   **[react-app-env.d.ts](react-app-env.d.ts)**: Type definitions for React application environment.
*   **[react-linkify.d.ts](react-linkify.d.ts)**: Type definitions for the `react-linkify` library.
*   **[vite-env.d.ts](vite-env.d.ts)**: Type definitions for Vite environment variables.
