import {Button, Group, Modal, Stack, TextInput} from '@mantine/core';
import {IconCloudDownload} from '@tabler/icons-react';
import queryString from 'query-string';
import {useEffect, useRef, useState} from 'react';
import {FormattedMessage} from 'react-intl';
import {useNavigate} from 'react-router';
import {analyticsEvent} from '../util/analytics';
import {MenuItem, MenuType} from './menu_item';

interface Props {
  menuType: MenuType;
}

/** Displays and handles the "Open URL" menu. */
export function UrlMenu(props: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [url, setUrl] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (dialogOpen) {
      setUrl('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [dialogOpen]);

  /** Load button clicked in the "Load from URL" dialog. */
  function handleLoad() {
    setDialogOpen(false);
    if (url) {
      analyticsEvent('url_selected');
      navigate({
        pathname: '/view',
        search: queryString.stringify({url}),
      });
    }
  }

  function loadFromUrlModal() {
    return (
      <Modal
        opened={dialogOpen}
        onClose={() => setDialogOpen(false)}
        centered={false}
        size="lg"
        withCloseButton={false}
        title={
          <Group gap="xs">
            <IconCloudDownload size={22} />
            <FormattedMessage
              id="load_from_url.title"
              defaultMessage="Load from URL"
            />
          </Group>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleLoad();
          }}
        >
          <Stack gap="md">
            <TextInput
              placeholder="https://"
              value={url}
              onChange={(e) => setUrl(e.currentTarget.value)}
              ref={inputRef}
              data-autofocus
            />
            <p style={{margin: 0}}>
              <FormattedMessage
                id="load_from_url.comment"
                defaultMessage={
                  'Data from the URL will be loaded through {link} to avoid CORS issues.'
                }
                values={{
                  link: (
                    <a
                      href="https://topolaproxy.bieda.it/"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      topolaproxy.bieda.it (cors-anywhere proxy)
                    </a>
                  ),
                }}
              />
            </p>
            <Group justify="flex-end" gap="xs">
              <Button variant="default" onClick={() => setDialogOpen(false)}>
                <FormattedMessage
                  id="load_from_url.cancel"
                  defaultMessage="Cancel"
                />
              </Button>
              <Button type="submit">
                <FormattedMessage
                  id="load_from_url.load"
                  defaultMessage="Load"
                />
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    );
  }

  return (
    <>
      <MenuItem
        onClick={() => setDialogOpen(true)}
        menuType={props.menuType}
        closeMenuOnClick={false}
      >
        <IconCloudDownload
          size={18}
          style={{marginRight: 6, verticalAlign: 'middle'}}
        />
        <FormattedMessage
          id="menu.load_from_url"
          defaultMessage="Load from URL"
        />
      </MenuItem>
      {loadFromUrlModal()}
    </>
  );
}
