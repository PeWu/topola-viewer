import {Button, Group, Modal, Stack, TextInput} from '@mantine/core';
import queryString from 'query-string';
import {useEffect, useRef, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useLocation, useNavigate} from 'react-router';
import {getLoggedInUserName, navigateToLoginPage} from 'wikitree-js';
import {analyticsEvent} from '../util/analytics';
import {WIKITREE_TOPOLA_URL} from '../util/wikitree_util';
import {MenuItem, MenuType} from './menu_item';
import wikitreeLogo from './wikitree.png';

interface Props {
  menuType: MenuType;
}

/** Displays and handles the "Select WikiTree ID" menu. */
export function WikiTreeMenu(props: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [wikiTreeId, setWikiTreeId] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (dialogOpen) {
      setWikiTreeId('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [dialogOpen]);

  /** Select button clicked in the "Select WikiTree ID" dialog. */
  function handleSelectId() {
    setDialogOpen(false);
    if (!wikiTreeId) {
      return;
    }
    analyticsEvent('wikitree_id_selected');
    const search = queryString.parse(location.search);
    const standalone =
      search.standalone !== undefined ? search.standalone : true;
    navigate({
      pathname: '/view',
      search: queryString.stringify({
        indi: wikiTreeId,
        source: 'wikitree',
        standalone,
      }),
    });
  }

  function enterId(event: React.MouseEvent, id: string) {
    event.preventDefault(); // Do not follow link in href.
    setWikiTreeId(id);
    inputRef.current?.focus();
  }

  function wikiTreeIdModal() {
    return (
      <Modal
        opened={dialogOpen}
        onClose={() => setDialogOpen(false)}
        centered={false}
        size="lg"
        withCloseButton={false}
        title={
          <Group gap="xs">
            <img
              src={wikitreeLogo}
              alt="WikiTree logo"
              style={{width: '32px', height: '32px'}}
            />
            <FormattedMessage
              id="select_wikitree_id.title"
              defaultMessage="Select WikiTree ID"
            />
          </Group>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSelectId();
          }}
        >
          <Stack gap="md">
            <p style={{margin: 0}}>
              <FormattedMessage
                id="select_wikitree_id.comment"
                defaultMessage={
                  'Enter a {wikiTreeLink} profile ID. Examples: {example1}, {example2}.'
                }
                values={{
                  wikiTreeLink: (
                    <a
                      href="https://wikitree.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      WikiTree
                    </a>
                  ),
                  example1: (
                    <span
                      onClick={(e) => enterId(e, 'Wojtyla-13')}
                      className="link-span"
                    >
                      Wojtyla-13
                    </span>
                  ),
                  example2: (
                    <span
                      onClick={(e) => enterId(e, 'Skłodowska-2')}
                      className="link-span"
                    >
                      Skłodowska-2
                    </span>
                  ),
                }}
              />
            </p>
            <TextInput
              value={wikiTreeId}
              onChange={(e) => setWikiTreeId(e.currentTarget.value)}
              ref={inputRef}
              data-autofocus
            />
            <Group justify="flex-end" gap="xs">
              <Button variant="default" onClick={() => setDialogOpen(false)}>
                <FormattedMessage
                  id="select_wikitree_id.cancel"
                  defaultMessage="Cancel"
                />
              </Button>
              <Button type="submit">
                <FormattedMessage
                  id="select_wikitree_id.load"
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
        menuType={props.menuType}
        onClick={() => setDialogOpen(true)}
        closeMenuOnClick={false}
      >
        <img src={wikitreeLogo} alt="WikiTree logo" className="menu-icon" />
        <FormattedMessage
          id="menu.select_wikitree_id"
          defaultMessage="Select WikiTree ID"
        />
      </MenuItem>
      {wikiTreeIdModal()}
    </>
  );
}

/** Displays and handles the "Log in to WikiTree" menu. */
export function WikiTreeLoginMenu(props: Props) {
  const intl = useIntl();

  /**
   * Redirect to the WikiTree Apps login page with a return URL pointing to
   * Topola Viewer hosted on apps.wikitree.com.
   */
  function login() {
    // TODO: remove authcode if it is in the current URL.
    const returnUrl = `${WIKITREE_TOPOLA_URL}${window.location.hash}`;
    navigateToLoginPage(returnUrl);
  }

  const username = getLoggedInUserName();
  if (!username) {
    return (
      <>
        <MenuItem menuType={props.menuType} onClick={login}>
          <img src={wikitreeLogo} alt="WikiTree logo" className="menu-icon" />
          <FormattedMessage
            id="menu.wikitree_login"
            defaultMessage="Log in to WikiTree"
          />
        </MenuItem>
      </>
    );
  }
  const tooltip = intl.formatMessage(
    {
      id: 'menu.wikitree_popup_username',
      defaultMessage: 'Logged in to WikiTree as {username}',
    },
    {username},
  );
  return (
    <MenuItem menuType={props.menuType} title={tooltip}>
      <img src={wikitreeLogo} alt="WikiTree logo" className="menu-icon" />
      <FormattedMessage
        id="menu.wikitree_logged_in"
        defaultMessage="Logged in"
      />
    </MenuItem>
  );
}
