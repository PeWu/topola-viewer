# Side Panel Directory

This directory contains components and logic for the side panel of the Topola Viewer application. The side panel is used to display detailed information about a selected individual and to configure chart settings.

## Purpose

The purpose of this directory is to provide a collapsible side panel that offers:
1.  **Detailed Information**: Displays comprehensive data about a selected person, including their name, images, events, facts, notes, and sources, extracted from the loaded GEDCOM file.
2.  **Chart Configuration**: Provides controls for users to customize the appearance of the genealogical chart (e.g., color schemes, showing/hiding IDs, and sex indicators).

This directory acts as a container for these features, organizing them into specific subdirectories:
- **[config](config/)**: Contains the UI and logic for managing chart display settings.
- **[details](details/)**: Contains components for rendering the detailed view of an individual's data.
- **[head](head/)**: Contains components to display metadata from the GEDCOM file header.

## Files in this Directory

- [side-panel.tsx](side-panel.tsx): The main React component that implements the side panel. It manages the layout, switching between expanded and collapsed states. When expanded, it displays a tabbed interface with "Info" (details) and "Settings" (configuration) panes. When collapsed in a mobile view, it shows a minimal view of the selected person's name. It also includes the button to toggle the panel's expanded state.
