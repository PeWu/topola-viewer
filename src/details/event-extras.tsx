import {FormattedMessage, IntlShape, useIntl} from 'react-intl';
import {
  Icon,
  Item,
  List,
  Menu,
  MenuItemProps,
  Popup,
  Tab,
} from 'semantic-ui-react';
import {useState} from 'react';
import {WrappedImage} from './wrapped-image';
import * as React from 'react';
import {MultilineText} from './multiline-text';
import {DateOrRange} from 'topola';
import {formatDateOrRange} from '../util/date_util';
import Linkify from 'react-linkify';

export interface Image {
  url: string;
  filename: string;
  title?: string;
}

export interface Source {
  title?: string;
  author?: string;
  page?: string;
  date?: DateOrRange;
  publicationInfo?: string;
}

interface Props {
  images?: Image[];
  notes?: string[][];
  sources?: Source[];
  indi: string;
}

function eventImages(images: Image[] | undefined) {
  return (
    !!images &&
    images.map((image, index) => (
      <List key={index}>
        <List.Item>
          <WrappedImage
            url={image.url}
            filename={image.filename}
            title={image.title}
          />
        </List.Item>
      </List>
    ))
  );
}

function eventNotes(notes: string[][] | undefined) {
  return (
    !!notes?.length &&
    notes.map((note, index) => (
      <div key={index}>
        <MultilineText
          lines={note.map((line, index) => (
            <i key={index}>{line}</i>
          ))}
        />
      </div>
    ))
  );
}

function eventSources(sources: Source[] | undefined, intl: IntlShape) {
  return (
    !!sources?.length && (
      <List>
        {sources.map((source, index) => (
          <List.Item key={index}>
            <List.Icon verticalAlign="middle" name="circle" size="tiny" />
            <List.Content>
              <List.Header>
                <Linkify properties={{target: '_blank'}}>
                  {[source.author, source.title, source.publicationInfo]
                    .filter((sourceElement) => sourceElement)
                    .join(', ')}
                </Linkify>
              </List.Header>
              <List.Description>
                <Linkify properties={{target: '_blank'}}>{source.page}</Linkify>
                {source.date
                  ? ' [' + formatDateOrRange(source.date, intl) + ']'
                  : null}
              </List.Description>
            </List.Content>
          </List.Item>
        ))}
      </List>
    )
  );
}

export function EventExtras(props: Props) {
  const intl = useIntl();
  const [activeIndex, setActiveIndex] = useState(-1);
  const [indi, setIndi] = useState('');

  if (!indi || indi !== props.indi) {
    setActiveIndex(-1);
    setIndi(props.indi);
  }

  function handleTabOnClick(
    event: React.MouseEvent<HTMLAnchorElement>,
    menuItemProps: MenuItemProps,
  ) {
    menuItemProps.index !== undefined && activeIndex !== menuItemProps.index
      ? setActiveIndex(menuItemProps.index)
      : setActiveIndex(-1);
  }

  const imageTab = props.images?.length && {
    menuItem: (
      <Menu.Item fitted key="images" onClick={handleTabOnClick}>
        <Popup
          content={
            <FormattedMessage id="extras.images" defaultMessage="Images" />
          }
          size="mini"
          position="bottom center"
          trigger={<Icon circular name="camera" />}
        />
      </Menu.Item>
    ),
    render: () => <Tab.Pane>{eventImages(props.images)}</Tab.Pane>,
  };

  const noteTab = props.notes?.length && {
    menuItem: (
      <Menu.Item fitted key="notes" onClick={handleTabOnClick}>
        <Popup
          content={
            <FormattedMessage id="extras.notes" defaultMessage="Notes" />
          }
          size="mini"
          position="bottom center"
          trigger={<Icon circular name="sticky note outline" />}
        />
      </Menu.Item>
    ),
    render: () => <Tab.Pane>{eventNotes(props.notes)}</Tab.Pane>,
  };

  const sourceTab = props.sources?.length && {
    menuItem: (
      <Menu.Item fitted key="sources" onClick={handleTabOnClick}>
        <Popup
          content={
            <FormattedMessage id="extras.sources" defaultMessage="Sources" />
          }
          size="mini"
          position="bottom center"
          trigger={<Icon circular name="quote right" />}
        />
      </Menu.Item>
    ),
    render: () => <Tab.Pane>{eventSources(props.sources, intl)}</Tab.Pane>,
  };

  const panes = [imageTab, noteTab, sourceTab].flatMap((tab) =>
    tab ? [tab] : [],
  );

  if (panes.length) {
    return (
      <Item.Description>
        <Tab
          className="event-extras"
          activeIndex={activeIndex}
          renderActiveOnly={true}
          menu={{
            tabular: true,
            attached: true,
            compact: true,
            borderless: true,
          }}
          panes={panes}
        />
      </Item.Description>
    );
  }
  return null;
}
