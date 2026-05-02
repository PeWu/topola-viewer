# Data Sources

This directory contains the implementation of various data sources supported by Topola Viewer. It handles loading genealogical data from different origins and transforming it into a unified format used by the application.

## Purpose

The main purpose of this directory is to abstract away the details of where the genealogical data comes from. Whether it is a file uploaded by the user, a URL pointing to a GEDCOM file, data fetched from the WikiTree API, or data received from a parent window in embedded mode, this directory provides a consistent interface ([DataSource](data_source.ts#L19)) to the rest of the application.

## Files

- [data_source.ts](data_source.ts): Defines the core abstractions for data sources, including the [DataSourceEnum](data_source.ts#L5) and the [DataSource](data_source.ts#L19) interface.
- [load_data.ts](load_data.ts): Contains helper functions for loading data from files and URLs, handling zip files (GEDZIP), and implements [UploadedDataSource](load_data.ts#L155) and [GedcomUrlDataSource](load_data.ts#L195).
- [embedded.ts](embedded.ts): Implements [EmbeddedDataSource](embedded.ts#L34) for cases where the viewer is embedded in an iframe and receives GEDCOM data via window messages.
- [gedcom_generator.ts](gedcom_generator.ts): Used to create a GEDCOM structure from internal JSON data. This is primarily used to generate a GEDCOM representation for data sources that do not natively provide it (like WikiTree), which is needed for the details panel.
- [wikitree.ts](wikitree.ts): Implements [WikiTreeDataSource](wikitree.ts#L62) and serves as the main entry point for loading data from WikiTree.
- [wikitree_api.ts](wikitree_api.ts): Handles the actual communication with the WikiTree API using the `wikitree-js` library, including caching and handling private profiles.
- [wikitree_transformer.ts](wikitree_transformer.ts): Transforms data fetched from the WikiTree API into Topola's internal data format.
- [load_data.spec.ts](load_data.spec.ts): Unit tests for the data loading functions in `load_data.ts`.
- `testdata/`: A directory containing test files used by the unit tests.
