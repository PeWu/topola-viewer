import {Card, Image, Title} from '@mantine/core';
import queryString from 'query-string';
import {useEffect, useState} from 'react';
import {FormattedMessage} from 'react-intl';
import {Link} from 'react-router';
import {getChangelog, updateSeenVersion} from './changelog';
import logo from './topola.jpg';
import {Media} from './util/media';
import {isOnWikitreeDomain, WIKITREE_TOPOLA_URL} from './util/wikitree_util';

/** Link that loads a view. */
function ViewLink(props: {params: {[key: string]: string}; text: string}) {
  return (
    <Link to={{pathname: '/view', search: queryString.stringify(props.params)}}>
      {props.text}
    </Link>
  );
}

function formatBuildDate(dateString: string | undefined) {
  return dateString?.slice(0, 16) || '';
}

function Contents() {
  const [changelog, setChangelog] = useState('');
  useEffect(() => {
    (async () => {
      setChangelog(await getChangelog(1));
      updateSeenVersion();
    })();
  }, []);

  return (
    <>
      <p>
        <FormattedMessage
          id="intro.description"
          defaultMessage={
            'Topola Genealogy is a genealogy tree viewer that lets you' +
            ' browse the structure of the family.'
          }
        />
      </p>
      <p>
        <FormattedMessage
          id="intro.instructions"
          defaultMessage={
            'Use the OPEN FILE or LOAD FROM URL buttons above to load' +
            ' a GEDCOM file. You can export a GEDCOM file from most of the' +
            ' existing genealogy programs and web sites.'
          }
        />
      </p>

      <h3>
        <FormattedMessage id="intro.examples" defaultMessage="Examples" />
      </h3>
      <ul>
        <li>
          <ViewLink
            params={{
              url: 'https://chronoplexsoftware.com/myfamilytree/samples/The%20Kennedy%20Family.gdz',
            }}
            text="J. F. Kennedy"
          />{' '}
          (<FormattedMessage id="intro.from" defaultMessage="from" />{' '}
          <a href="https://chronoplexsoftware.com/myfamilytree/samples/">
            chronoplexsoftware.com
          </a>
          )
        </li>
        <li>
          <ViewLink
            params={{
              url: 'https://webtreeprint.com/tp_downloader.php?path=famous_gedcoms/shakespeare.ged&file=shakespeare.ged',
            }}
            text="Shakespeare"
          />{' '}
          (<FormattedMessage id="intro.from" defaultMessage="from" />{' '}
          <a href="https://webtreeprint.com/tp_famous_gedcoms.php">
            webtreeprint.com
          </a>
          )
        </li>
        <li>
          {isOnWikitreeDomain() ? (
            <ViewLink
              params={{
                indi: 'Skłodowska-2',
                source: 'wikitree',
              }}
              text="Maria Skłodowska-Curie"
            />
          ) : (
            <a
              href={`${WIKITREE_TOPOLA_URL}/#/view?source=wikitree&indi=Sk%C5%82odowska-2`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Maria Skłodowska-Curie ↗
            </a>
          )}{' '}
          (<FormattedMessage id="intro.from" defaultMessage="from" />{' '}
          <a href="https://www.wikitree.com/wiki/Sk%C5%82odowska-2">
            wikitree.com
          </a>
          )
        </li>
      </ul>

      <h3>
        <FormattedMessage id="intro.whats_new" defaultMessage="What's new" />
      </h3>
      <span dangerouslySetInnerHTML={{__html: changelog}} />
      <a href="https://github.com/PeWu/topola-viewer/blob/master/CHANGELOG.md">
        <FormattedMessage
          id="intro.full_changelog"
          defaultMessage="See full changelog"
        />
      </a>

      <h3>
        <FormattedMessage id="intro.privacy" defaultMessage="Privacy" />
      </h3>
      <FormattedMessage
        id="intro.privacy_note"
        defaultMessage={
          'When using the "load from file" option, this site does not' +
          ' send your data anywhere and files loaded from disk do not' +
          ' leave your computer. When using "load from URL", data is' +
          ' passed through the {link} service to deal with an issue with' +
          ' cross-site file loading in the browser (CORS).'
        }
        values={{
          link: (
            <a key="proxy-link" href="https://topolaproxy.bieda.it/">
              cors-anywhere
            </a>
          ),
        }}
      />

      <p className="version" style={{textAlign: 'right'}}>
        version: {formatBuildDate(import.meta.env.VITE_GIT_TIME)} (
        <a
          href={`https://github.com/PeWu/topola-viewer/commit/${import.meta.env.VITE_GIT_SHA}`}
        >
          {import.meta.env.VITE_GIT_SHA}
        </a>
        )
      </p>
    </>
  );
}

/** The intro page. */
export function Intro() {
  return (
    <div id="introContent">
      <div className="backgroundImage" />
      <Card
        className="intro"
        padding={0}
        radius="sm"
        shadow="sm"
        withBorder
        style={{
          width: 770,
          maxWidth: '95vw',
          margin: 'auto',
          maxHeight: 'calc(100vh - 50px)',
          overflowY: 'auto',
        }}
      >
        <Media greaterThanOrEqual="large">
          <div
            style={{
              padding: '14px',
              borderBottom: '1px solid rgba(34, 36, 38, 0.1)',
            }}
          >
            <Title
              order={2}
              style={{
                fontSize: '18px',
                fontWeight: 700,
                lineHeight: 1.2857,
                color: 'rgba(0, 0, 0, 0.85)',
                margin: 0,
              }}
            >
              <FormattedMessage
                id="intro.title"
                defaultMessage="Topola Genealogy Viewer"
              />
            </Title>
          </div>
          <div style={{display: 'flex', padding: '14px 0'}}>
            <div style={{flex: '0 0 31.25%', padding: '0 14px'}}>
              <Image src={logo} alt="Topola logo" radius={0} />
            </div>
            <div style={{flex: '0 0 68.75%', padding: '0 14px'}}>
              <Contents />
            </div>
          </div>
        </Media>
        <Media at="small">
          <div style={{padding: '14px'}}>
            <Image
              src={logo}
              alt="Topola logo"
              radius={0}
              w={80}
              mx="auto"
              mb="md"
              className="blockImage"
            />
            <Contents />
          </div>
        </Media>
      </Card>
    </div>
  );
}
