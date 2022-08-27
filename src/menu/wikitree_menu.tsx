import * as queryString from 'query-string';
import wikitreeLogo from './wikitree.png';
import {analyticsEvent} from '../util/analytics';
import {Button, Form, Header, Input, Modal} from 'semantic-ui-react';
import {FormattedMessage, useIntl} from 'react-intl';
import {MenuItem, MenuType} from './menu_item';
import {useEffect, useRef, useState} from 'react';
import {useHistory, useLocation} from 'react-router';
import {getLoggedInUserName, navigateToLoginPage} from 'wikitree-js';

interface Props {
  menuType: MenuType;
}

/** Displays and handles the "Select WikiTree ID" menu. */
export function WikiTreeMenu(props: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [wikiTreeId, setWikiTreeId] = useState('');
  const inputRef = useRef<Input>(null);
  const history = useHistory();
  const location = useLocation();

  useEffect(() => {
    if (dialogOpen) {
      setWikiTreeId('');
      inputRef.current!.focus();
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
    history.push({
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
    inputRef.current!.focus();
  }

  function wikiTreeIdModal() {
    return (
      <Modal
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        centered={false}
      >
        <Header>
          <img
            src={wikitreeLogo}
            alt="WikiTree logo"
            style={{width: '32px', height: '32px'}}
          />
          <FormattedMessage
            id="select_wikitree_id.title"
            defaultMessage="Select WikiTree ID"
          />
        </Header>
        <Modal.Content>
          <Form onSubmit={handleSelectId}>
            <p>
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
            <Input
              fluid
              value={wikiTreeId}
              onChange={(_, data) => setWikiTreeId(data.value)}
              ref={inputRef}
            />
          </Form>
        </Modal.Content>
        <Modal.Actions>
          <Button secondary onClick={() => setDialogOpen(false)}>
            <FormattedMessage
              id="select_wikitree_id.cancel"
              defaultMessage="Cancel"
            />
          </Button>
          <Button primary onClick={handleSelectId}>
            <FormattedMessage
              id="select_wikitree_id.load"
              defaultMessage="Load"
            />
          </Button>
        </Modal.Actions>
      </Modal>
    );
  }

  return (
    <>
      <MenuItem menuType={props.menuType} onClick={() => setDialogOpen(true)}>
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
    const wikiTreeTopolaUrl =
      'https://apps.wikitree.com/apps/wiech13/topola-viewer';
    // TODO: remove authcode if it is in the current URL.
    const returnUrl = `${wikiTreeTopolaUrl}${window.location.hash}`;
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
