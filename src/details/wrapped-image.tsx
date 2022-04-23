import {Icon, Image, Label, Modal, Placeholder} from 'semantic-ui-react';
import {useState} from 'react';

interface Props {
  url: string;
  filename: string;
  title?: string;
}

export function WrappedImage(props: Props) {
  const [imageOpen, setImageOpen] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  return (
    <>
      <Image
        className={imageLoaded ? 'loaded-image-thumbnail' : 'hidden-image'}
        onClick={() => setImageOpen(true)}
        onLoad={() => setImageLoaded(true)}
        src={props.url}
        alt={props.title || props.filename}
        centered={true}
      />
      <Placeholder
        className={!imageLoaded ? 'image-placeholder' : 'hidden-image'}
      >
        <Placeholder.Image square />
      </Placeholder>
      <Modal
        basic
        size="large"
        closeIcon={<Icon name="close" color="red" />}
        open={imageOpen}
        onClose={() => setImageOpen(false)}
        onOpen={() => setImageOpen(true)}
        centered={false}
      >
        <Modal.Header className="center">{props.title}</Modal.Header>
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
