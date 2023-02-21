# Topola Genealogy Viewer

[![Node.js CI](https://github.com/PeWu/topola-viewer/actions/workflows/node.js.yml/badge.svg)](https://github.com/PeWu/topola-viewer/actions/workflows/node.js.yml)

View your genealogy data using an interactive chart.

Website: https://pewu.github.io/topola-viewer

<p align="center">
  <a href="https://pewu.github.io/topola-viewer/#/view?url=http%3A%2F%2Fgenpol.com%2Fmodule-Downloads-prep_hand_out-lid-32.html">
    <img src="screenshot.png" width="320" alt="screenshot">
  </a>
</p>

## Features
* Hourglass chart
* All relatives chart
* Click on a person to focus
* Open standard GEDCOM files you can export from any genealogy application
* Load from URL (just point to a GEDCOM file on the Web)
* Privacy – your files do not leave your computer
* Print the whole genealogy tree
* Export to PDF, PNG, SVG
* Side panel with details
* Configuration options
* Permalinks when loading from URL
* Cool transition animations

[Changelog](CHANGELOG.md)

## Examples

Here is an example from the Web:

* [Shakespeare](https://pewu.github.io/topola-viewer/#/view?url=https%3A%2F%2Fwebtreeprint.com%2Ftp_downloader.php%3Fpath%3Dfamous_gedcoms%2Fshakespeare.ged) (from [webtreeprint.com](https://webtreeprint.com/tp_famous_gedcoms.php))
* [Marie Skłodowska-Curie](https://pewu.github.io/topola-viewer/#/view?indi=Sk%C5%82odowska-2&source=wikitree) (from [WikiTree](https://www.wikitree.com/wiki/Sk%C5%82odowska-2))

If you have data in a genealogy database, you can export your data in GEDCOM format and load it using the "Load from file" menu.

## Integrations

Topola Genealogy Viewer is being integrated into more and more Web and desktop applications.
Here are the current integrations:

### Gramps

To view your [Gramps](https://gramps-project.org/) data in Topola Genealogy Viewer,
install [*Interactive Family Tree*](https://gramps-project.org/wiki/index.php/Interactive_Family_Tree)
plugin from the Gramps plugin manager. The plugin will add a
*Tools->Analysis and Exploration->Interactive Family Tree* menu item to Gramps.

Source code: https://github.com/gramps-project/addons-source/tree/master/Topola

### Webtrees

Embed Topola Genealogy Viewer in your [Webtrees](https://www.webtrees.net/) installation with the
[Topola interactive tree addon](https://webtrees.net/download/modules#simple-auto-login---by-fanningert---20---website).

Source code: https://github.com/PeWu/topola-webtrees

### WikiTree

You can browse the [WikiTree](https://www.wikitree.com/) genealogy tree using Topola Genealogy Viewer.
On a WikiTree profile page go to the *Family Tree & Tools* tab and click the *Dynamic Tree by Topola* link.

Example:
[Stephen Hawking](https://apps.wikitree.com/apps/wiech13/topola-viewer/#/view?source=wikitree&standalone=false&indi=Hawking-7)

Topola Genealogy Viewer is hosted on [apps.wikitree.com](https://apps.wikitree.com/apps/wiech13/topola-viewer)
to benefit from the ability of being logged in to the WikiTree API.

## Running locally

```
npm install
npm start
```

## Self-hosting

You can host Topola Genealogy Viewer on your own server. There are no specific requirements for the hosting server. There is no code that is executed on the server side. The server only hosts the application files and whole application runs in the browser.

You can build Topola Genealogy Viewer from source code or take a ready-to-deploy package.

### Bulid your own

Here are the commands to build the application:
```
git clone https://github.com/PeWu/topola-viewer.git
cd topola-viewer
npm install
npm run build
```
Now, take the contents of the `build/` folder and host it on your own server.

### Use an existing package

Download the following file, unpack it and upload the contents to your server:
https://github.com/PeWu/topola-viewer/archive/refs/heads/gh-pages.zip

These are the exact files that are hosted on GitHub pages.

### Alternative build

The [topola-webpack](https://github.com/develancer/topola-webpack) tool can build a Topola Genealogy Viewer package bundled together with a GEDCOM file.

## Additional options

### `handleCors`

Add `&handleCors=false` to the URL to avoid using the CORS proxy

### `embedded`

Add `&embedded=true` to the URL. This option removes the options to open a different file. It is an option that was intended to be used when Topola Genealogy Viewer is in an iframe.

## Hosting a GEDCOM file

One of the common ways to host a GEDCOM file which can be used in Topola Genealogy Viewer is using [Google Drive](https://drive.google.com). Here are the steps you can follow:

1. Upload the GEDCOM file to Google Drive
2. Right-click the file in Google Drive and choose "Get link"
3. In the "General access" section change "Restricted" to "Anyone with the link" with "Viewer" permissions.
4. Click "Copy link" to get the link to the GEDCOM file.
5. Open [Topola Genealogy Viewer](https://pewu.github.io/topola-viewer).
6. Click "Open URL"
7. Paste the copied URL and click "Open"
8. Once the tree opens, copy the current URL.

You can now share the copied URL with someone.

Note that the URL you just copied is not discoverable. Only people who have the link will be able to see your data. It's similar to an "Unlisted" YouTube video – you can see it only if you know the link.
