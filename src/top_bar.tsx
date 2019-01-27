import * as md5 from 'md5';
import * as queryString from 'query-string';
import * as React from 'react';
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
        <Header icon="cloud download" content="Load from URL" />
        <Modal.Content>
          <Form onSubmit={() => this.handleLoad()}>
            <Input
              placeholder="https://"
              fluid
              onChange={(e) => this.handleUrlChange(e)}
              ref={(ref) => (this.inputRef = ref!)}
            />
            <p className="comment">
              Data from the URL will be loaded through{' '}
              <a href="https://cors-anywhere.herokuapp.com/">
                cors-anywhere.herokuapp.com
              </a>{' '}
              to avoid CORS issues.
            </p>
          </Form>
        </Modal.Content>
        <Modal.Actions>
          <Button
            secondary
            content="Cancel"
            onClick={() => this.handleClose()}
          />
          <Button primary content="Load" onClick={() => this.handleLoad()} />
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
          Load from URL
        </Menu.Item>
        <input
          className="hidden"
          type="file"
          id="fileInput"
          onChange={(e) => this.handleUpload(e)}
        />
        <label htmlFor="fileInput">
          <Menu.Item as="a">
            <Icon name="folder open" />
            Load from file
          </Menu.Item>
        </label>
        <Menu.Item
          as="a"
          href="https://github.com/PeWu/topola-viewer"
          position="right"
        >
          Source on GitHub
        </Menu.Item>
        {loadFromUrlModal}
      </Menu>
    );
  }
}
