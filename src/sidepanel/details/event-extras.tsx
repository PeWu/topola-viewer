import {ActionIcon, Group, Tooltip} from '@mantine/core';
import {
  IconCameraFilled,
  IconFileText,
  IconNote,
  IconQuoteFilled,
} from '@tabler/icons-react';
import {useState} from 'react';
import {FormattedMessage} from 'react-intl';
import {Source} from '../../util/gedcom_util';
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
      <div key={index} style={{marginBottom: 8}}>
        <WrappedImage
          url={image.url}
          filename={image.filename}
          title={image.title}
        />
      </div>
    ))
  );
}

function eventNotes(notes: string[][] | undefined) {
  return (
    !!notes?.length &&
    notes.map((note, index) => (
      <div key={index}>
        <MultilineText
          lines={note.map((line, idx) => (
            <i key={idx}>{line}</i>
          ))}
        />
      </div>
    ))
  );
}

export function EventExtras(props: Props) {
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [indi, setIndi] = useState('');

  if (!indi || indi !== props.indi) {
    setActiveTab(null);
    setIndi(props.indi);
  }

  const hasImages = !!props.images?.length;
  const hasNotes = !!props.notes?.length;
  const hasSources = !!props.sources?.length;
  const hasFiles = !!props.files?.length;

  if (!hasImages && !hasNotes && !hasSources && !hasFiles) {
    return null;
  }

  const getButtonStyle = (isActive: boolean): React.CSSProperties => ({
    width: 28,
    height: 28,
    minWidth: 28,
    minHeight: 28,
    borderRadius: '500em',
    boxShadow: isActive ? 'none' : '0em 0em 0em 0.1em rgba(0, 0, 0, 0.1) inset',
    backgroundColor: isActive ? '#1b1c1d' : 'transparent',
    color: isActive ? '#ffffff' : 'rgba(0, 0, 0, 0.87)',
    border: 'none',
  });

  return (
    <div className="event-extras" style={{marginTop: 8}}>
      <Group gap={7}>
        {hasImages && (
          <Tooltip
            label={
              <FormattedMessage id="extras.images" defaultMessage="Images" />
            }
            position="bottom"
          >
            <ActionIcon
              variant="transparent"
              size={28}
              radius="xl"
              style={getButtonStyle(activeTab === 'images')}
              onClick={() =>
                setActiveTab(activeTab === 'images' ? null : 'images')
              }
              aria-label="Images"
            >
              <IconCameraFilled size={15} />
            </ActionIcon>
          </Tooltip>
        )}

        {hasNotes && (
          <Tooltip
            label={
              <FormattedMessage id="extras.notes" defaultMessage="Notes" />
            }
            position="bottom"
          >
            <ActionIcon
              variant="transparent"
              size={28}
              radius="xl"
              style={getButtonStyle(activeTab === 'notes')}
              onClick={() =>
                setActiveTab(activeTab === 'notes' ? null : 'notes')
              }
              aria-label="Notes"
            >
              <IconNote size={15} stroke={2} />
            </ActionIcon>
          </Tooltip>
        )}

        {hasSources && (
          <Tooltip
            label={
              <FormattedMessage id="extras.sources" defaultMessage="Sources" />
            }
            position="bottom"
          >
            <ActionIcon
              variant="transparent"
              size={28}
              radius="xl"
              style={getButtonStyle(activeTab === 'sources')}
              onClick={() =>
                setActiveTab(activeTab === 'sources' ? null : 'sources')
              }
              aria-label="Sources"
            >
              <IconQuoteFilled size={15} />
            </ActionIcon>
          </Tooltip>
        )}

        {hasFiles && (
          <Tooltip
            label={
              <FormattedMessage
                id="extras.files"
                defaultMessage="Additional files"
              />
            }
            position="bottom"
          >
            <ActionIcon
              variant="transparent"
              size={28}
              radius="xl"
              style={getButtonStyle(activeTab === 'files')}
              onClick={() =>
                setActiveTab(activeTab === 'files' ? null : 'files')
              }
              aria-label="Additional files"
            >
              <IconFileText size={15} stroke={2} />
            </ActionIcon>
          </Tooltip>
        )}
      </Group>

      {activeTab && (
        <div
          style={{
            wordBreak: 'normal',
            overflowWrap: 'anywhere',
            maxWidth: 289,
            paddingTop: 10,
          }}
        >
          {activeTab === 'images' && eventImages(props.images)}
          {activeTab === 'notes' && eventNotes(props.notes)}
          {activeTab === 'sources' && props.sources && (
            <Sources sources={props.sources} />
          )}
          {activeTab === 'files' && props.files && (
            <AdditionalFiles files={props.files} />
          )}
        </div>
      )}
    </div>
  );
}
