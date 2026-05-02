# Menu Directory

This directory contains React components that make up the top navigation bar and its associated menus and dialogs in Topola Viewer. It handles loading data from various sources, searching for individuals, and changing chart views.

## Files

- [menu_item.tsx](menu_item.tsx): A utility component that renders as either a `Menu.Item` or a `Dropdown.Item` from `semantic-ui-react`, allowing menu items to be shared between desktop and mobile layouts.
- [search.tsx](search.tsx): The `SearchBar` component displayed in the top bar. It handles user input and displays search results.
- [search_index.ts](search_index.ts): Implements the search index using the `lunr` library. It creates a searchable index of individuals from the loaded genealogy data, supporting multilingual search and character normalization.
- [top_bar.tsx](top_bar.tsx): The main component for the application's top navigation bar. It handles responsive design for small and large screens and aggregates all the menus and the search bar.
- [upload_menu.tsx](upload_menu.tsx): The "Open file" menu item. It allows users to upload local GEDCOM files and images.
- [url_menu.tsx](url_menu.tsx): The "Load from URL" menu item and modal dialog. It allows users to load data from a URL, using a proxy to avoid CORS issues.
- [wikitree_menu.tsx](wikitree_menu.tsx): Menu items and modal dialogs for WikiTree integration, including loading by WikiTree ID and logging in.
- [wikitree.png](wikitree.png): Image asset for the WikiTree logo used in the menus.
