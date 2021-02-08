import * as queryString from 'query-string';
import * as React from 'react';
import {analyticsEvent} from '../util/analytics';
import {Button, Form, Header, Icon, Input, Modal} from 'semantic-ui-react';
import {FormattedMessage} from 'react-intl';
import {MenuItem, MenuType} from './menu_item';
import {RouteComponentProps} from 'react-router-dom';

interface Props {
  menuType: MenuType;
}

interface State {
  dialogOpen: boolean;
  url?: string;
}

/** Displays and handles the "Open URL" menu. */
export class UrlMenu extends React.Component<
  RouteComponentProps & Props,
  State
> {
  state: State = {dialogOpen: false};

  inputRef: React.RefObject<Input> = React.createRef();

  /** Opens the "Load from URL" dialog. */
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

  /** Load button clicked in the "Load from URL" dialog. */
  private handleLoad() {
    this.setState(
      Object.assign({}, this.state, {
        dialogOpen: false,
      }),
    );
    if (this.state.url) {
      analyticsEvent('url_selected');
      this.props.history.push({
        pathname: '/view',
        search: queryString.stringify({url: this.state.url}),
      });
    }
  }

  /** Called when the URL input is typed into. */
  private handleUrlChange(value: string) {
    this.setState(
      Object.assign({}, this.state, {
        url: value,
      }),
    );
  }

  private loadFromUrlModal() {
    return (
      <Modal
        open={this.state.dialogOpen}
        onClose={() => this.handleClose()}
        centered={false}
      >
        <Header>
          <Icon name="cloud download" />
          <FormattedMessage
            id="load_from_url.title"
            defaultMessage="Load from URL"
            children={(txt) => txt}
          />
        </Header>
        <Modal.Content>
          <Form onSubmit={() => this.handleLoad()}>
            <Input
              placeholder="https://"
              fluid
              onChange={(e, data) => this.handleUrlChange(data.value)}
              ref={this.inputRef}
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
          <Button secondary onClick={() => this.handleClose()}>
            <FormattedMessage
              id="load_from_url.cancel"
              defaultMessage="Cancel"
            />
          </Button>
          <Button primary onClick={() => this.handleLoad()}>
            <FormattedMessage id="load_from_url.load" defaultMessage="Load" />
          </Button>
        </Modal.Actions>
      </Modal>
    );
  }

  render() {
    return (
      <>
        <MenuItem
          onClick={() => this.openDialog()}
          menuType={this.props.menuType}
        >
          <Icon name="cloud download" />
          <FormattedMessage
            id="menu.load_from_url"
            defaultMessage="Load from URL"
          />
        </MenuItem>
        {this.loadFromUrlModal()}
      </>
    );
  }
}
