import * as queryString from 'query-string';
import * as React from 'react';
import debounce from 'debounce';
import md5 from 'md5';
import {analyticsEvent} from './analytics';
import {buildSearchIndex, SearchIndex} from './search_index';
import {displaySearchResult} from './search_util';
import {FormattedMessage, intlShape} from 'react-intl';
import {GedcomData} from './gedcom_util';
import {IndiInfo} from 'topola';
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
  Dropdown,
  Search,
  SearchProps,
  SearchResultProps,
} from 'semantic-ui-react';

/** Menus and dialogs state. */
interface State {
  loadUrlDialogOpen: boolean;
  url?: string;
  searchResults: SearchResultProps[];
}

interface EventHandlers {
  onSelection: (indiInfo: IndiInfo) => void;
  onPrint: () => void;
  onDownloadPdf: () => void;
  onDownloadPng: () => void;
  onDownloadSvg: () => void;
}

interface Props {
  /** True if the application is currently showing a chart. */
  showingChart: boolean;
  /** Data used for the search index. */
  gedcom?: GedcomData;
  standalone: boolean;
  /** Whether to show the "All relatives" chart type in the menu. */
  allowAllRelativesChart: boolean;
  eventHandlers: EventHandlers;
}

function loadFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (evt: ProgressEvent) => {
      resolve((evt.target as FileReader).result as string);
    };
    reader.readAsText(file);
  });
}

function isImageFileName(fileName: string) {
  const lower = fileName.toLowerCase();
  return lower.endsWith('.jpg') || lower.endsWith('.png');
}

export class TopBar extends React.Component<
  RouteComponentProps & Props,
  State
> {
  state: State = {
    loadUrlDialogOpen: false,
    searchResults: [],
  };
  inputRef?: Input;
  searchRef?: {setValue(value: string): void};
  searchIndex?: SearchIndex;

  /** Handles the "Upload file" button. */
  async handleUpload(event: React.SyntheticEvent<HTMLInputElement>) {
    const files = (event.target as HTMLInputElement).files;
    if (!files || !files.length) {
      return;
    }
    const filesArray = Array.from(files);
    (event.target as HTMLInputElement).value = ''; // Reset the file input.
    analyticsEvent('upload_files_selected', {
      event_value: files.length,
    });

    const gedcomFile =
      filesArray.length === 1
        ? filesArray[0]
        : filesArray.find((file) => file.name.toLowerCase().endsWith('.ged')) ||
          filesArray[0];

    // Convert uploaded images to object URLs.
    const images = filesArray
      .filter(
        (file) => file.name !== gedcomFile.name && isImageFileName(file.name),
      )
      .map((file) => ({
        name: file.name,
        url: URL.createObjectURL(file),
      }));
    const imageMap = new Map(
      images.map((entry) => [entry.name, entry.url] as [string, string]),
    );

    const data = await loadFileAsText(gedcomFile);
    const imageFileNames = images
      .map((image) => image.name)
      .sort()
      .join('|');
    // Hash GEDCOM contents with uploaded image file names.
    const hash = md5(md5(data) + imageFileNames);

    // Use history.replace() when reuploading the same file and history.push() when loading
    // a new file.
    const search = queryString.parse(this.props.location.search);
    const historyPush =
      search.file === hash
        ? this.props.history.replace
        : this.props.history.push;

    historyPush({
      pathname: '/view',
      search: queryString.stringify({file: hash}),
      state: {data, images: imageMap},
    });
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
      analyticsEvent('url_selected');
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

  /** On search input change. */
  handleSearch(input: string | undefined) {
    if (!input) {
      return;
    }
    const results = this.searchIndex!.search(input).map((result) =>
      displaySearchResult(result, this.context.intl),
    );
    this.setState(Object.assign({}, this.state, {searchResults: results}));
  }

  /** On search result selected. */
  handleResultSelect(id: string) {
    analyticsEvent('search_result_selected');
    this.props.eventHandlers.onSelection({id, generation: 0});
    this.searchRef!.setValue('');
  }

  initializeSearchIndex() {
    if (this.props.gedcom) {
      this.searchIndex = buildSearchIndex(this.props.gedcom);
    }
  }

  changeView(view: string) {
    const location = this.props.location;
    const search = queryString.parse(location.search);
    if (search.view !== view) {
      search.view = view;
      location.search = queryString.stringify(search);
      this.props.history.push(location);
    }
  }

  componentDidMount() {
    this.initializeSearchIndex();
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.gedcom !== this.props.gedcom) {
      this.initializeSearchIndex();
    }
  }

  /** Make intl appear in this.context. */
  static contextTypes = {
    intl: intlShape,
  };

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

    const chartMenus = this.props.showingChart ? (
      <>
        <Menu.Item as="a" onClick={() => this.props.eventHandlers.onPrint()}>
          <Icon name="print" />
          <FormattedMessage id="menu.print" defaultMessage="Print" />
        </Menu.Item>

        <Dropdown
          trigger={
            <div>
              <Icon name="download" />
              <FormattedMessage id="menu.download" defaultMessage="Download" />
            </div>
          }
          className="item"
        >
          <Dropdown.Menu>
            <Dropdown.Item
              onClick={() => this.props.eventHandlers.onDownloadPdf()}
            >
              <FormattedMessage id="menu.pdf_file" defaultMessage="PDF file" />
            </Dropdown.Item>
            <Dropdown.Item
              onClick={() => this.props.eventHandlers.onDownloadPng()}
            >
              <FormattedMessage id="menu.png_file" defaultMessage="PNG file" />
            </Dropdown.Item>
            <Dropdown.Item
              onClick={() => this.props.eventHandlers.onDownloadSvg()}
            >
              <FormattedMessage id="menu.svg_file" defaultMessage="SVG file" />
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>

        <Dropdown
          trigger={
            <div>
              <Icon name="eye" />
              <FormattedMessage id="menu.view" defaultMessage="View" />
            </div>
          }
          className="item"
        >
          <Dropdown.Menu>
            <Dropdown.Item onClick={() => this.changeView('hourglass')}>
              <Icon name="hourglass" />
              <FormattedMessage
                id="menu.hourglass"
                defaultMessage="Hourglass chart"
              />
            </Dropdown.Item>
            {this.props.allowAllRelativesChart ? (
              <Dropdown.Item onClick={() => this.changeView('relatives')}>
                <Icon name="users" />
                <FormattedMessage
                  id="menu.relatives"
                  defaultMessage="All relatives"
                />
              </Dropdown.Item>
            ) : null}
            <Dropdown.Item onClick={() => this.changeView('fancy')}>
              <Icon name="users" />
              <FormattedMessage
                id="menu.fancy"
                defaultMessage="Fancy tree (experimental)"
              />
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>

        <Search
          onSearchChange={debounce(
            (_: React.MouseEvent<HTMLElement>, data: SearchProps) =>
              this.handleSearch(data.value),
            200,
          )}
          onResultSelect={(_, data) => this.handleResultSelect(data.result.id)}
          results={this.state.searchResults}
          noResultsMessage={this.context.intl.formatMessage({
            id: 'menu.search.no_results',
            defaultMessage: 'No results found',
          })}
          placeholder={this.context.intl.formatMessage({
            id: 'menu.search.placeholder',
            defaultMessage: 'Search for people',
          })}
          selectFirstResult={true}
          ref={(ref) =>
            (this.searchRef = (ref as unknown) as {
              setValue(value: string): void;
            })
          }
        />
      </>
    ) : null;

    const fileMenus = this.props.standalone ? (
      <>
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
          accept=".ged,image/*"
          id="fileInput"
          multiple
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
      </>
    ) : null;

    const sourceLink = this.props.standalone ? (
      <>
        <Menu.Item
          as="a"
          href="https://github.com/PeWu/topola-viewer"
          position="right"
          target="_blank"
        >
          <FormattedMessage
            id="menu.github"
            defaultMessage="Source on GitHub"
          />
        </Menu.Item>
      </>
    ) : (
      <>
        <Menu.Item
          as="a"
          href="https://pewu.github.com/topola-viewer"
          position="right"
          target="_blank"
        >
          <FormattedMessage
            id="menu.powered_by"
            defaultMessage="Powered by Topola"
          />
        </Menu.Item>
      </>
    );

    return (
      <Menu attached="top" inverted color="blue" size="large">
        {fileMenus}
        {chartMenus}
        {sourceLink}
        {loadFromUrlModal}
      </Menu>
    );
  }
}
