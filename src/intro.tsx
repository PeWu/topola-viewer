import * as queryString from 'query-string';
import * as React from 'react';
import {Card} from 'semantic-ui-react';
import {FormattedMessage} from 'react-intl';
import {Link} from 'react-router-dom';

/** Link that loads a GEDCOM file from URL. */
function GedcomLink(props: {url: string; text: string}) {
  return (
    <Link
      to={{pathname: '/view', search: queryString.stringify({url: props.url})}}
    >
      {props.text}
    </Link>
  );
}

/** The intro page. */
export function Intro() {
  return (
    <Card className="intro">
      <Card.Content>
        <Card.Header>
          <FormattedMessage
            id="intro.title"
            defaultMessage="Topola Genealogy Viewer"
          />
        </Card.Header>
      </Card.Content>
      <Card.Content>
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
              'Use the LOAD FROM URL or LOAD FROM FILE buttons above to load' +
              ' a GEDCOM file. You can export a GEDCOM file from most of the' +
              ' existing genealogy programs and web sites.'
            }
          />
        </p>
        <p>
          <FormattedMessage
            id="intro.examples"
            defaultMessage={
              'Here are some examples from the web that you can view:'
            }
          />
        </p>
        <ul>
          <li>
            <GedcomLink
              url="http://genpol.com/module-Downloads-prep_hand_out-lid-32.html"
              text="Karol Wojtyła"
            />{' '}
            (<FormattedMessage id="intro.from" defaultMessage="from" />{' '}
            <a href="http://genpol.com/module-Downloads-display-lid-32.html">
              GENPOL
            </a>
            )
          </li>
          <li>
            <GedcomLink
              url="https://webtreeprint.com/tp_downloader.php?path=famous_gedcoms/shakespeare.ged"
              text="Shakespeare"
            />{' '}
            (<FormattedMessage id="intro.from" defaultMessage="from" />{' '}
            <a href="https://webtreeprint.com/tp_famous_gedcoms.php">
              webtreeprint.com
            </a>
            )
          </li>
          <li>
            <GedcomLink
              url="http://genealogyoflife.com/tng/gedcom/HarryPotter.ged"
              text="Harry Potter"
            />{' '}
            (<FormattedMessage id="intro.from" defaultMessage="from" />{' '}
            <a href="http://famousfamilytrees.blogspot.com/">
              Famous Family Trees
            </a>
            )
          </li>
        </ul>
        <p>
          <b>
            <FormattedMessage id="intro.privacy" defaultMessage="Privacy" />
          </b>
          :
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
                <a href="https://cors-anywhere.herokuapp.com/">cors-anywhere</a>
              ),
            }}
          />
        </p>
      </Card.Content>
    </Card>
  );
}
