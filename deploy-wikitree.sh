#!/bin/bash
set -e

echo Copying files...
lftp -d sftp://wiech13:${LFTP_PASSWORD}@apps.wikitree.com << EOF
  mkdir www/topola-viewer.new
  mirror -R -p build/ www/topola-viewer.new/
  rm -r www/topola-viewer.old
  mv www/topola-viewer www/topola-viewer.old
  mv www/topola-viewer.new www/topola-viewer
EOF
echo Done.
