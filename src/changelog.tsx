import rehypeStringify from 'rehype-stringify';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import {Button, Header, Modal} from 'semantic-ui-react';
import {unified} from 'unified';
import {useEffect, useState} from 'react';
import {FormattedMessage} from 'react-intl';

const LAST_SEEN_VERSION_KEY = 'last_seen_version';

/**
 * Returns changelog as raw HTML.
 *
 * @param maxVersions Max number of versions to include in changelog
 * @param seenVersion Last seen app version
 */
export async function getChangelog(maxVersions: number, seenVersion?: string) {
  const seenVersionDate = seenVersion
    ? Date.parse(seenVersion.slice(0, 10))
    : 0;

  const changes =
    process.env.REACT_APP_CHANGELOG?.split('##')
      .slice(1, maxVersions + 1)
      .map((notes) => {
        const date = Date.parse(notes.split('\n')[0].trim());
        return {date, notes: '####' + notes};
      })
      .filter((release) => release.date > seenVersionDate)
      .map((release) => release.notes)
      .join('\n') || '';

  const parsedChanges = await unified()
    .use(remarkParse)
    .use(remarkRehype)
    .use(rehypeStringify)
    .process(changes);
  return String(parsedChanges);
}

/** Stores in local storage the current app version as the last seen version. */
export function updateSeenVersion() {
  localStorage.setItem(LAST_SEEN_VERSION_KEY, process.env.REACT_APP_GIT_TIME!);
}

/**
 * Shows changelog entries if the user has seen an older version of
 * Topola Viewer and is now seeing a newer one.
 */
export function Changelog() {
  const [open, setOpen] = useState(false);
  const [changelog, setChangelog] = useState('');

  useEffect(() => {
    (async () => {
      const seenVersion = localStorage.getItem(LAST_SEEN_VERSION_KEY);
      const currentVersion = process.env.REACT_APP_GIT_TIME!;
      if (!seenVersion || seenVersion === currentVersion) {
        return;
      }

      const changes = await getChangelog(3, seenVersion);
      setChangelog(changes);
      setOpen(!!changes);
      updateSeenVersion();
    })();
  });

  return (
    <Modal open={open} centered={false}>
      <Header>
        <FormattedMessage
          id="whats_new.title"
          defaultMessage="What's new in this version?"
        />
      </Header>
      <Modal.Content className="limit-height">
        <span dangerouslySetInnerHTML={{__html: changelog}} />
        <a href="https://github.com/PeWu/topola-viewer/blob/master/CHANGELOG.md">
          <FormattedMessage
            id="intro.full_changelog"
            defaultMessage="See full changelog"
          />
        </a>
      </Modal.Content>
      <Modal.Actions>
        <Button primary onClick={() => setOpen(false)}>
          Close
        </Button>
      </Modal.Actions>
    </Modal>
  );
}
