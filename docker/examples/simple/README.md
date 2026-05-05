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
