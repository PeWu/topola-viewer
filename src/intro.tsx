import * as queryString from 'query-string';
import {useEffect, useState} from 'react';
import logo from './topola.jpg';
import {Card, Grid, Image} from 'semantic-ui-react';
import {FormattedMessage} from 'react-intl';
import {Link} from 'react-router-dom';
import {Media} from './util/media';
import {getChangelog, updateSeenVersion} from './changelog';

/** Link that loads a view. */
function ViewLink(props: {params: {[key: string]: string}; text: string}) {
  return (
    <Link to={{pathname: '/view', search: queryString.stringify(props.params)}}>
      {props.text}
    </Link>
  );
}

function formatBuildDate(dateString: string) {
  return dateString?.slice(0, 16) || '';
}

function Contents() {
  const [changelog, setChangelog] = useState('');
  useEffect(() => {
    (async () => {
      setChangelog(await getChangelog(1));
      updateSeenVersion();
    })();
  });

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
              url:
                'https://chronoplexsoftware.com/myfamilytree/samples/The%20Kennedy%20Family.gdz',
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
              url:
                'https://webtreeprint.com/tp_downloader.php?path=famous_gedcoms/shakespeare.ged&file=shakespeare.ged',
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
          <ViewLink
            params={{
              indi:
                'Skłodowska-2', source: 'wikitree'
            }}
            text="Maria Skłodowska-Curie"
          />{' '}
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
          link: <a href="https://topolaproxy.bieda.it/">cors-anywhere</a>,
        }}
      />

      <p className="ui right aligned version">
        version: {formatBuildDate(process.env.REACT_APP_GIT_TIME!)} (
        <a
          href={`https://github.com/PeWu/topola-viewer/commit/${process.env.REACT_APP_GIT_SHA}`}
        >
          {process.env.REACT_APP_GIT_SHA}
        </a>
        )
      </p>
    </>
  );
}

/** The intro page. */
export function Intro() {
  return (
    <div id="content">
      <div className="backgroundImage" />
      <Card className="intro">
        <Card.Content as={Media} greaterThanOrEqual="large">
          <Card.Header>
            <FormattedMessage
              id="intro.title"
              defaultMessage="Topola Genealogy Viewer"
            />
          </Card.Header>
        </Card.Content>
        <Card.Content>
          <Grid as={Media} greaterThanOrEqual="large">
            <Grid.Row>
              <Grid.Column width={5}>
                <Image src={logo} alt="Topola logo" />
              </Grid.Column>
              <Grid.Column width={11}>
                <Contents />
              </Grid.Column>
            </Grid.Row>
          </Grid>
          <Media at="small">
            <Image
              src={logo}
              alt="Topola logo"
              centered={true}
              size="tiny"
              className="blockImage"
            />
            <Contents />
          </Media>
        </Card.Content>
      </Card>
    </div>
  );
}

