import * as queryString from 'query-string';
import * as React from 'react';
import md5 from 'md5';
import {FormattedMessage} from 'react-intl';
import {Link} from 'react-router-dom';
import {RouteComponentProps} from 'react-router-dom';
import {
  Header,
  Button,
  Icon,
  Menu,
  Modal,
  Input,
  Form,
} from 'semantic-ui-react';

/** Menus and dialogs state. */
interface State {
  loadUrlDialogOpen: boolean;
  url?: string;
}

export class TopBar extends React.Component<RouteComponentProps, State> {
  state: State = {loadUrlDialogOpen: false};
  inputRef?: Input;

  /** Handles the "Upload file" button. */
  handleUpload(event: React.SyntheticEvent<HTMLInputElement>) {
    const files = (event.target as HTMLInputElement).files;
    if (!files || !files.length) {
      return;
    }
    const reader = new FileReader();
    reader.onload = (evt: ProgressEvent) => {
      const data = (evt.target as FileReader).result;
      const hash = md5(data as string);
      this.props.history.push({
        pathname: '/view',
        search: queryString.stringify({file: hash}),
        state: {data},
      });
    };
    reader.readAsText(files[0]);
  }

  /** Opens the "Load from URL" dialog. */
  handleLoadFromUrl() {
    this.setState(
      Object.assign({}, this.state, {loadUrlDialogOpen: true}),
      () => this.inputRef!.focus(),
    );
  }

  /** Cancels the "Load from URL" dialog. */
  handleClose() {
    this.setState(Object.assign({}, this.state, {loadUrlDialogOpen: false}));
  }

  /** Upload button clicked in the "Load from URL" dialog. */
  handleLoad() {
    this.setState(
      Object.assign({}, this.state, {
        loadUrlDialogOpen: false,
      }),
    );
    if (this.state.url) {
      this.props.history.push({
        pathname: '/view',
        search: queryString.stringify({url: this.state.url}),
      });
    }
  }

  /** Called when the URL input is typed into. */
  handleUrlChange(event: React.SyntheticEvent) {
    this.setState(
      Object.assign({}, this.state, {
        url: (event.target as HTMLInputElement).value,
      }),
    );
  }

  render() {
    const loadFromUrlModal = (
      <Modal
        open={this.state.loadUrlDialogOpen}
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
              onChange={(e) => this.handleUrlChange(e)}
              ref={(ref) => (this.inputRef = ref!)}
            />
            <p>
              <FormattedMessage
                id="load_from_url.comment"
                defaultMessage={
                  'Data from the URL will be loaded through {link} to avoid CORS issues.'
                }
                values={{
                  link: (
                    <a href="https://cors-anywhere.herokuapp.com/">
                      cors-anywhere.herokuapp.com
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

    return (
      <Menu attached="top" inverted color="blue" size="large">
        <Link to="/">
          <Menu.Item>
            <b>Topola Genealogy</b>
          </Menu.Item>
        </Link>
        <Menu.Item as="a" onClick={() => this.handleLoadFromUrl()}>
          <Icon name="cloud download" />
          <FormattedMessage
            id="menu.load_from_url"
            defaultMessage="Load from URL"
          />
        </Menu.Item>
        <input
          className="hidden"
          type="file"
          accept=".ged"
          id="fileInput"
          onChange={(e) => this.handleUpload(e)}
        />
        <label htmlFor="fileInput">
          <Menu.Item as="a">
            <Icon name="folder open" />
            <FormattedMessage
              id="menu.load_from_file"
              defaultMessage="Load from file"
            />
          </Menu.Item>
        </label>
        <Menu.Item
          as="a"
          href="https://github.com/PeWu/topola-viewer"
          position="right"
        >
          <FormattedMessage
            id="menu.github"
            defaultMessage="Source on GitHub"
          />
        </Menu.Item>
        {loadFromUrlModal}
      </Menu>
    );
  }
}
