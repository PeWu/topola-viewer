import {useState} from 'react';
import {FormattedMessage} from 'react-intl';
import {
  Icon,
  Item,
  List,
  Menu,
  MenuItemProps,
  Popup,
  Tab,
} from 'semantic-ui-react';
import {Source} from '../util/gedcom_util';
import {AdditionalFiles, FileEntry} from './additional-files';
import {MultilineText} from './multiline-text';
import {Sources} from './sources';
import {WrappedImage} from './wrapped-image';

export interface Image {
  url: string;
  filename: string;
  title?: string;
}

interface Props {
  images?: Image[];
  notes?: string[][];
  sources?: Source[];
  indi: string;
  files?: FileEntry[];
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

export function EventExtras(props: Props) {
  const [activeIndex, setActiveIndex] = useState(-1);
  const [indi, setIndi] = useState('');

  if (!indi || indi !== props.indi) {
    setActiveIndex(-1);
    setIndi(props.indi);
  }

  function handleTabOnClick(
    _event: React.MouseEvent<HTMLAnchorElement>,
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
    render: () => (
      <Tab.Pane>
        <Sources sources={props.sources} />
      </Tab.Pane>
    ),
  };

  const filesTab = props.files?.length && {
    menuItem: (
      <Menu.Item fitted key="files" onClick={handleTabOnClick}>
        <Popup
          content={
            <FormattedMessage
              id="extras.files"
              defaultMessage="Additonal files"
            />
          }
          size="mini"
          position="bottom center"
          trigger={<Icon circular name="file alternate outline" />}
        />
      </Menu.Item>
    ),
    render: () => (
      <Tab.Pane>
        <AdditionalFiles files={props.files} />
      </Tab.Pane>
    ),
  };

  const panes = [imageTab, noteTab, sourceTab, filesTab].flatMap((tab) =>
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
