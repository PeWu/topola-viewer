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
