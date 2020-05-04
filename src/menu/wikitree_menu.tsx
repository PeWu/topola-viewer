import * as queryString from 'query-string';
import * as React from 'react';
import wikitreeLogo from './wikitree.png';
import {analyticsEvent} from '../util/analytics';
import {FormattedMessage, intlShape} from 'react-intl';
import {getLoggedInUserName} from '../datasource/wikitree';
import {MenuItem, MenuType} from './menu_item';
import {RouteComponentProps} from 'react-router-dom';
import {Header, Button, Modal, Input, Form} from 'semantic-ui-react';

enum WikiTreeLoginState {
  UNKNOWN,
  NOT_LOGGED_IN,
  LOGGED_IN,
}

interface Props {
  menuType: MenuType;
}

interface State {
  dialogOpen: boolean;
  wikiTreeId?: string;
}

/** Displays and handles the "Select WikiTree ID" menu. */
export class WikiTreeMenu extends React.Component<
  RouteComponentProps & Props,
  State
> {
  state: State = {
    dialogOpen: false,
  };

  inputRef: React.RefObject<Input> = React.createRef();

  private openDialog() {
    this.setState(Object.assign({}, this.state, {dialogOpen: true}), () =>
      this.inputRef.current!.focus(),
    );
  }

  /** Cancels any of the open dialogs. */
  private handleClose() {
    this.setState(
      Object.assign({}, this.state, {
        dialogOpen: false,
      }),
    );
  }

  /** Select button clicked in the "Select WikiTree ID" dialog. */
  private handleSelectId() {
    this.setState(
      Object.assign({}, this.state, {
        dialogOpen: false,
      }),
    );
    if (this.state.wikiTreeId) {
      analyticsEvent('wikitree_id_selected');
      const search = queryString.parse(this.props.location.search);
      const standalone =
        search.standalone !== undefined ? search.standalone : true;
      this.props.history.push({
        pathname: '/view',
        search: queryString.stringify({
          indi: this.state.wikiTreeId,
          source: 'wikitree',
          standalone,
        }),
      });
    }
  }

  /** Called when the WikiTree ID input is typed into. */
  private handleIdChange(value: string) {
    this.setState(
      Object.assign({}, this.state, {
        wikiTreeId: value,
      }),
    );
  }

  private enterId(event: React.MouseEvent, id: string) {
    event.preventDefault(); // Do not follow link in href.
    ((this.inputRef.current as unknown) as {
      inputRef: HTMLInputElement;
    }).inputRef.value = id;
    this.handleIdChange(id);
    this.inputRef.current!.focus();
  }

  private wikiTreeIdModal() {
    return (
      <Modal
        open={this.state.dialogOpen}
        onClose={() => this.handleClose()}
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
            children={(txt) => txt}
          />
        </Header>
        <Modal.Content>
          <Form onSubmit={() => this.handleSelectId()}>
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
                      onClick={(e) => this.enterId(e, 'Wojtyla-13')}
                      className="link-span"
                    >
                      Wojtyla-13
                    </span>
                  ),
                  example2: (
                    <span
                      onClick={(e) => this.enterId(e, 'Skłodowska-2')}
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
              onChange={(e, data) => this.handleIdChange(data.value)}
              ref={this.inputRef}
            />
          </Form>
        </Modal.Content>
        <Modal.Actions>
          <Button secondary onClick={() => this.handleClose()}>
            <FormattedMessage
              id="select_wikitree_id.cancel"
              defaultMessage="Cancel"
            />
          </Button>
          <Button primary onClick={() => this.handleSelectId()}>
            <FormattedMessage
              id="select_wikitree_id.load"
              defaultMessage="Load"
            />
          </Button>
        </Modal.Actions>
      </Modal>
    );
  }

  render() {
    return (
      <>
        <MenuItem
          menuType={this.props.menuType}
          onClick={() => this.openDialog()}
        >
          <img src={wikitreeLogo} alt="WikiTree logo" className="menu-icon" />
          <FormattedMessage
            id="menu.select_wikitree_id"
            defaultMessage="Select WikiTree ID"
          />
        </MenuItem>
        {this.wikiTreeIdModal()}
      </>
    );
  }
}

interface LoginState {
  wikiTreeLoginState: WikiTreeLoginState;
  wikiTreeLoginUsername?: string;
}

/** Displays and handles the "Log in to WikiTree" menu. */
export class WikiTreeLoginMenu extends React.Component<
  RouteComponentProps & Props,
  LoginState
> {
  state: LoginState = {
    wikiTreeLoginState: WikiTreeLoginState.UNKNOWN,
  };
  /** Make intl appear in this.context. */
  static contextTypes = {
    intl: intlShape,
  };

  wikiTreeLoginFormRef: React.RefObject<HTMLFormElement> = React.createRef();
  wikiTreeReturnUrlRef: React.RefObject<HTMLInputElement> = React.createRef();

  /**
   * Redirect to the WikiTree Apps login page with a return URL pointing to
   * Topola Viewer hosted on apps.wikitree.com.
   */
  private wikiTreeLogin() {
    const wikiTreeTopolaUrl =
      'https://apps.wikitree.com/apps/wiech13/topola-viewer';
    // Append '&' because the login page appends '?authcode=...' to this URL.
    // TODO: remove ?authcode if it is in the current URL.
    const returnUrl = `${wikiTreeTopolaUrl}${window.location.hash}&`;
    this.wikiTreeReturnUrlRef.current!.value = returnUrl;
    this.wikiTreeLoginFormRef.current!.submit();
  }

  private checkWikiTreeLoginState() {
    const wikiTreeLoginUsername = getLoggedInUserName();
    const wikiTreeLoginState = wikiTreeLoginUsername
      ? WikiTreeLoginState.LOGGED_IN
      : WikiTreeLoginState.NOT_LOGGED_IN;
    if (this.state.wikiTreeLoginState !== wikiTreeLoginState) {
      this.setState(
        Object.assign({}, this.state, {
          wikiTreeLoginState,
          wikiTreeLoginUsername,
        }),
      );
    }
  }

  componentDidMount() {
    this.checkWikiTreeLoginState();
  }

  componentDidUpdate() {
    this.checkWikiTreeLoginState();
  }

  render() {
    switch (this.state.wikiTreeLoginState) {
      case WikiTreeLoginState.NOT_LOGGED_IN:
        return (
          <>
            <MenuItem
              menuType={this.props.menuType}
              onClick={() => this.wikiTreeLogin()}
            >
              <img
                src={wikitreeLogo}
                alt="WikiTree logo"
                className="menu-icon"
              />
              <FormattedMessage
                id="menu.wikitree_login"
                defaultMessage="Log in to WikiTree"
              />
            </MenuItem>
            <form
              action="https://api.wikitree.com/api.php"
              method="POST"
              style={{display: 'hidden'}}
              ref={this.wikiTreeLoginFormRef}
            >
              <input type="hidden" name="action" value="clientLogin" />
              <input
                type="hidden"
                name="returnURL"
                ref={this.wikiTreeReturnUrlRef}
              />
            </form>
          </>
        );

      case WikiTreeLoginState.LOGGED_IN:
        const tooltip = this.state.wikiTreeLoginUsername
          ? this.context.intl.formatMessage(
              {
                id: 'menu.wikitree_popup_username',
                defaultMessage: 'Logged in to WikiTree as {username}',
              },
              {username: this.state.wikiTreeLoginUsername},
            )
          : this.context.intl.formatMessage({
              id: 'menu.wikitree_popup',
              defaultMessage: 'Logged in to WikiTree',
            });
        return (
          <MenuItem menuType={this.props.menuType} title={tooltip}>
            <img src={wikitreeLogo} alt="WikiTree logo" className="menu-icon" />
            <FormattedMessage
              id="menu.wikitree_logged_in"
              defaultMessage="Logged in"
            />
          </MenuItem>
        );
    }
    return null;
  }
}
