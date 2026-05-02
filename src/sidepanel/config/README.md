# Chart Configuration

This directory contains the logic and UI for configuring the display of the genealogical chart.

## Purpose

The purpose of this directory is to manage the user-configurable settings for the chart visualization. This includes:
- **Colors**: How individuals in the chart are colored (none, by generation, or by sex).
- **IDs**: Whether to show or hide person IDs.
- **Sex**: Whether to show or hide indicators for sex.

It provides the data structures for the configuration, default values, functions to serialize/deserialize the configuration to/from URL query parameters, and the UI component for the side panel.

## Files

- [config.tsx](config.tsx): The main file containing:
  - `ChartColors`, `Ids`, and `Sex` enums defining the available options.
  - `Config` interface defining the configuration state.
  - `argsToConfig` and `configToArgs` functions for mapping the configuration to and from URL query arguments.
  - `ConfigPanel` React component providing the UI controls (radio buttons) for these settings in the side panel.
