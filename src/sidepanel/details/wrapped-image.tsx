import {SyntheticEvent, useState} from 'react';
import {FormattedMessage} from 'react-intl';
import {
  Card,
  Container,
  Icon,
  Image,
  Label,
  Message,
  Modal,
  Placeholder,
} from 'semantic-ui-react';
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
        centered
        style={{width: '100%', maxWidth: '290px', margin: '0 auto 14px'}}
      >
        <Card.Content textAlign="center" style={{backgroundColor: '#f9f9f9'}}>
          <Icon
            name="image"
            size="huge"
            color="grey"
            style={{marginBottom: '10px', opacity: 0.6}}
          />
          <Card.Header style={{fontSize: '14px', wordBreak: 'break-all'}}>
            {props.title || props.filename}
          </Card.Header>
          <Card.Meta style={{marginTop: '5px', fontStyle: 'italic'}}>
            <FormattedMessage
              id="media.not_uploaded"
              defaultMessage="File not uploaded"
            />
          </Card.Meta>
        </Card.Content>
      </Card>
    );
  }

  if (imageLoaded && imageSrc !== props.url) {
    setImageLoaded(false);
  }
  return (
    <>
      <Image
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
        centered={true}
      />
      <Placeholder
        className={!imageLoaded ? 'image-placeholder' : 'hidden-image'}
      >
        <Placeholder.Image square />
      </Placeholder>
      {imageFailed && (
        <Container fluid textAlign="center">
          <Message negative compact>
            <Message.Header>
              <FormattedMessage
                id="error.failed_to_load_image"
                defaultMessage={'Failed to load image file'}
              />
            </Message.Header>
          </Message>
        </Container>
      )}
      <Modal
        basic
        size="large"
        closeIcon={<Icon name="close" color="red" />}
        open={imageOpen}
        onClose={() => setImageOpen(false)}
        onOpen={() => setImageOpen(true)}
        centered={false}
      >
        <Modal.Header>{props.title}</Modal.Header>
        <Modal.Content image>
          <Image
            className="modal-image"
            src={props.url}
            alt={props.title || props.filename}
            label={<Label attached="bottom" content={props.filename} />}
            wrapped
          />
        </Modal.Content>
      </Modal>
    </>
  );
}
