# Translations

This directory contains translation files for the Topola Viewer application. These files are used to support multiple languages in the user interface.

## Files

Each file in this directory corresponds to a specific language and contains a JSON object with translation keys and their corresponding localized strings.

*   [bg.json](bg.json): Bulgarian translations.
*   [cs.json](cs.json): Czech translations.
*   [de.json](de.json): German translations.
*   [fr.json](fr.json): French translations.
*   [it.json](it.json): Italian translations.
*   [pl.json](pl.json): Polish translations.
*   [ru.json](ru.json): Russian translations.

## Usage

These files are loaded by the internationalization (i18n) framework used in the project to display the UI in the user's preferred language. English strings are used as defaults directly in the source code. The translation json files are loaded in [../index.tsx](src/index.tsx).
