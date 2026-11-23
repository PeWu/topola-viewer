import {Alert, Card, Modal, Skeleton, Text} from '@mantine/core';
import {IconAlertCircle, IconPhotoFilled} from '@tabler/icons-react';
import {SyntheticEvent, useState} from 'react';
import {FormattedMessage} from 'react-intl';
import {isBrowserLoadable} from '../../util/gedcom_util';

interface Props {
  url: string;
  filename: string;
  title?: string;
}

export function WrappedImage(props: Props) {
  const [imageOpen, setImageOpen] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [imageSrc, setImageSrc] = useState('');

  if (!isBrowserLoadable(props.url)) {
    return (
      <Card
        withBorder={false}
        padding={14}
        radius={4}
        style={{
          width: '100%',
          maxWidth: '290px',
          margin: '0 auto',
          textAlign: 'center',
          backgroundColor: '#f9f9f9',
          boxShadow: '0px 1px 3px 0px #d4d4d5, 0px 0px 0px 1px #d4d4d5',
        }}
      >
        <IconPhotoFilled
          size={56}
          color="#767676"
          style={{margin: '0 auto 10px', opacity: 0.6}}
        />
        <Text
          fw={700}
          style={{
            fontSize: '14px',
            lineHeight: 1.2857,
            color: 'rgba(0, 0, 0, 0.85)',
            wordBreak: 'break-all',
          }}
        >
          {props.title || props.filename}
        </Text>
        <Text
          fs="italic"
          style={{
            fontSize: '14px',
            lineHeight: 1.2,
            color: 'rgba(0, 0, 0, 0.4)',
            marginTop: 5,
          }}
        >
          <FormattedMessage
            id="media.not_uploaded"
            defaultMessage="File not uploaded"
          />
        </Text>
      </Card>
    );
  }

  if (imageLoaded && imageSrc !== props.url) {
    setImageLoaded(false);
  }
  return (
    <>
      <img
        className={imageLoaded ? 'loaded-image-thumbnail' : 'hidden-image'}
        onClick={() => setImageOpen(true)}
        onLoad={() => {
          setImageLoaded(true);
          setImageSrc(props.url);
          setImageFailed(false);
        }}
        onError={(e: SyntheticEvent<HTMLImageElement, Event>) => {
          setImageLoaded(true);
          setImageSrc(props.url);
          setImageFailed(true);
          e.currentTarget.alt = '';
        }}
        src={props.url}
        alt={props.title || props.filename}
        style={{
          display: imageLoaded ? 'block' : 'none',
          margin: '0 auto',
          maxWidth: '100%',
        }}
      />
      {!imageLoaded && (
        <Skeleton height={200} width={200} style={{margin: '0 auto'}} />
      )}
      {imageFailed && (
        <Alert
          color="red"
          icon={<IconAlertCircle size={16} />}
          title={
            <FormattedMessage
              id="error.failed_to_load_image"
              defaultMessage="Failed to load image file"
            />
          }
          style={{maxWidth: 290, margin: '8px auto'}}
        />
      )}
      <Modal
        opened={imageOpen}
        onClose={() => setImageOpen(false)}
        title={props.title}
        size="xl"
        centered={false}
        styles={{
          content: {
            backgroundColor: 'transparent',
            boxShadow: 'none',
            color: '#ffffff',
          },
          header: {
            backgroundColor: 'transparent',
            color: '#ffffff',
            borderBottom: '1px solid rgba(255, 255, 255, 0.15)',
          },
          title: {
            fontSize: '20px',
            fontWeight: 700,
            color: '#ffffff',
          },
          close: {
            color: '#db2828',
          },
        }}
      >
        <div
          style={{
            display: 'table',
            margin: '0 auto',
          }}
        >
          <img
            className="modal-image"
            src={props.url}
            alt={props.title || props.filename}
            style={{
              maxWidth: '100%',
              maxHeight: '75vh',
              objectFit: 'contain',
              display: 'block',
            }}
          />
          <div
            style={{
              backgroundColor: '#e8e8e8',
              color: 'rgba(0, 0, 0, 0.6)',
              fontWeight: 700,
              fontSize: '12px',
              padding: '7px 14px',
              borderRadius: '0 0 4px 4px',
              width: '100%',
            }}
          >
            {props.filename}
          </div>
        </div>
      </Modal>
    </>
  );
}
