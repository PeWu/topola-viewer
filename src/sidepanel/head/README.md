# Head Directory

This directory contains components responsible for displaying information from the header of the loaded GEDCOM file in the side panel.

## Files

### [head.tsx](head.tsx)

Defines the `SourceHead` component. This component displays metadata about the data source, extracted from the GEDCOM header (`HEAD` record). It includes information such as:
- The software name that generated the file (`SOUR`)
- File creation date (`DATE`)
- Original file name (`FILE`)
- Submitter's name and contact details (phone, email, address) (`SUBM`)
- Copyright information (`COPR`)

The component conditionally renders these details only if they are present in the data.
