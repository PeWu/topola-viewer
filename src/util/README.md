# Utilities (`src/util`)

This directory contains various utility functions, hooks, and classes used across the application. These utilities handle date calculations, GEDCOM data processing, internationalization of errors, analytics, and responsive design setup.

## Files

- **[age_util.ts](age_util.ts)**: Utilities for calculating and formatting age based on birth and death dates. It handles exact dates, ranges, and qualifiers, and supports localization.
- **[age_util.spec.ts](age_util.spec.ts)**: Unit tests for `age_util.ts`.
- **[analytics.ts](analytics.ts)**: Provides the `analyticsEvent` function to send events to Google Analytics using `gtag`.
- **[analytics_noop.ts](analytics_noop.ts)**: A no-op implementation of `analyticsEvent`, used when analytics are disabled.
- **[date_util.ts](date_util.ts)**: Utilities for formatting and comparing dates, handling `DateOrRange` objects from the `topola` library, and supporting localization.
- **[error.ts](error.ts)**: Defines the `TopolaError` class, extending `Error` to include an error code and arguments used for internationalized error messages.
- **[error_i18n.ts](error_i18n.ts)**: Provides `getI18nMessage` to return translated messages for `TopolaError` instances.
- **[gedcom_util.ts](gedcom_util.ts)**: A comprehensive utility file for handling GEDCOM data. It includes functions for parsing and converting GEDCOM files, normalizing data (sorting children and spouses), dereferencing entries, and extracting specific data like names and sources.
- **[gedcom_util.spec.ts](gedcom_util.spec.ts)**: Unit tests for `gedcom_util.ts`.
- **[media.ts](media.ts)**: Sets up responsive design breakpoints (small and large) using the `@artsy/fresnel` library.
- **[previous-hook.ts](previous-hook.ts)**: A custom React hook (`usePrevious`) that returns the value of a variable from the previous render.
