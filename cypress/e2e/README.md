# Cypress E2E Tests

This directory contains End-to-End (E2E) tests for the Topola Viewer application, using the Cypress testing framework. The purpose of these tests is to verify the application's behavior from a user's perspective by simulating interactions in a real browser environment.

## Test Files

- [chart_view.cy.js](file:///home/pwiech/personal/github/topola-viewer/cypress/e2e/chart_view.cy.js)
  Tests the core functionality of the chart view. It verifies that data can be loaded from a remote URL, that the chart can be interacted with (e.g., expanding nodes to show more people), and that the side panel displays correct information.

- [embedded.cy.js](file:///home/pwiech/personal/github/topola-viewer/cypress/e2e/embedded.cy.js)
  Tests the application in embedded mode. It verifies that Topola can be successfully loaded and run within an iframe, which is how it might be used when embedded in other websites.

- [intro.cy.js](file:///home/pwiech/personal/github/topola-viewer/cypress/e2e/intro.cy.js)
  Tests the application's landing page (intro page). It ensures that the introductory text is visible and that the main menu actions (like opening a file or loading from a URL) are present.

- [search.cy.js](file:///home/pwiech/personal/github/topola-viewer/cypress/e2e/search.cy.js)
  Tests the search functionality within the application. It verifies that users can search for individuals and that selecting a result correctly highlights or displays that person in the view.
