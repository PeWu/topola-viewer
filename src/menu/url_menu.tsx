import * as queryString from 'query-string';
import {analyticsEvent} from '../util/analytics';
import {Button, Form, Header, Icon, Input, Modal} from 'semantic-ui-react';
import {FormattedMessage} from 'react-intl';
import {MenuItem, MenuType} from './menu_item';
import {useEffect, useRef, useState} from 'react';
import {useHistory} from 'react-router';

interface Props {
  menuType: MenuType;
}

/** Displays and handles the "Open URL" menu. */
export function UrlMenu(props: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [url, setUrl] = useState('');
  const inputRef = useRef<Input>(null);
  const history = useHistory();

  useEffect(() => {
    if (dialogOpen) {
      setUrl('');
      inputRef.current!.focus();
    }
  }, [dialogOpen]);

  /** Load button clicked in the "Load from URL" dialog. */
  function handleLoad() {
    setDialogOpen(false);
    if (url) {
      analyticsEvent('url_selected');
      history.push({
        pathname: '/view',
        search: queryString.stringify({url}),
      });
    }
  }

  function loadFromUrlModal() {
    return (
      <Modal
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        centered={false}
      >
        <Header>
          <Icon name="cloud download" />
          <FormattedMessage
            id="load_from_url.title"
            defaultMessage="Load from URL"
          />
        </Header>
        <Modal.Content>
          <Form onSubmit={handleLoad}>
            <Input
              placeholder="https://"
              fluid
              value={url}
              onChange={(_, data) => setUrl(data.value)}
              ref={inputRef}
            />
            <p>
              <FormattedMessage
                id="load_from_url.comment"
                defaultMessage={
                  'Data from the URL will be loaded through {link} to avoid CORS issues.'
                }
                values={{
                  link: (
                    <a href="https://topola-cors.herokuapp.com/">
                      topola-cors.herokuapp.com
                    </a>
                  ),
                }}
              />
            </p>
          </Form>
        </Modal.Content>
        <Modal.Actions>
          <Button secondary onClick={() => setDialogOpen(false)}>
            <FormattedMessage
              id="load_from_url.cancel"
              defaultMessage="Cancel"
            />
          </Button>
          <Button primary onClick={handleLoad}>
            <FormattedMessage id="load_from_url.load" defaultMessage="Load" />
          </Button>
        </Modal.Actions>
      </Modal>
    );
  }

  return (
    <>
      <MenuItem onClick={() => setDialogOpen(true)} menuType={props.menuType}>
        <Icon name="cloud download" />
        <FormattedMessage
          id="menu.load_from_url"
          defaultMessage="Load from URL"
        />
      </MenuItem>
      {loadFromUrlModal()}
    </>
  );
}
