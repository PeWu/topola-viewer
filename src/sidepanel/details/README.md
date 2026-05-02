# Details Directory

This directory contains React components for displaying detailed information about a selected individual (person) in the side panel of the Topola Viewer application. The details are extracted from a parsed GEDCOM file.

## Files

- [additional-files.tsx](additional-files.tsx): Displays a list of links to non-image files associated with an entry.
- [collapsed-details.tsx](collapsed-details.tsx): Displays a minimal, vertical view of details (person's name) when the side panel is collapsed.
- [details.tsx](details.tsx): The main component that orchestrates the display of all details for an individual, including name, images, events, facts, notes, and sources.
- [event-extras.tsx](event-extras.tsx): Displays additional content for events (images, notes, sources, files) in a tabbed interface.
- [events.tsx](events.tsx): Handles the logic and display for all events related to an individual, sorting them by date and grouping them by life stages.
- [linkify-new-tab.tsx](linkify-new-tab.tsx): A helper component that wraps content and makes URLs clickable, opening them in a new tab.
- [multiline-text.tsx](multiline-text.tsx): Helper component to display multi-line text with linkified URLs.
- [sources.tsx](sources.tsx): Displays a list of sources cited for an entry.
- [translated-tag.tsx](translated-tag.tsx): Component to translate GEDCOM tags into human-readable labels.
- [wrapped-image.tsx](wrapped-image.tsx): Component to display images with loading placeholders, error fallback, and a click-to-enlarge modal.
