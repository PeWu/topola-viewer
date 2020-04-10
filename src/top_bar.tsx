import * as queryString from 'query-string';
import * as React from 'react';
import Cookies from 'js-cookie';
import debounce from 'debounce';
import md5 from 'md5';
import {analyticsEvent} from './analytics';
import {buildSearchIndex, SearchIndex} from './search_index';
import {displaySearchResult} from './search_util';
import {FormattedMessage, intlShape} from 'react-intl';
import {IndiInfo, JsonGedcomData} from 'topola';
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
  Responsive,
} from 'semantic-ui-react';

const WIKITREE_LOGO_URL =
  'https://www.wikitree.com/photo.php/a/a5/WikiTree_Images.png';

enum WikiTreeLoginState {
  UNKNOWN,
  NOT_LOGGED_IN,
  LOGGED_IN,
}

enum ScreenSize {
  LARGE,
  SMALL,
}

/** Menus and dialogs state. */
interface State {
  loadUrlDialogOpen: boolean;
  wikiTreeIdDialogOpen: boolean;
  url?: string;
  wikiTreeId?: string;
  wikiTreeLoginState: WikiTreeLoginState;
  wikiTreeLoginUsername?: string;
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
  data?: JsonGedcomData;
  standalone: boolean;
  /** Whether to show the "All relatives" chart type in the menu. */
  allowAllRelativesChart: boolean;
  eventHandlers: EventHandlers;
  /** Whether to show additional WikiTree menus. */
  showWikiTreeMenus: boolean;
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
    wikiTreeIdDialogOpen: false,
    searchResults: [],
    wikiTreeLoginState: WikiTreeLoginState.UNKNOWN,
  };
  /** Make intl appear in this.context. */
  static contextTypes = {
    intl: intlShape,
  };

  urlInputRef: React.RefObject<Input> = React.createRef();
  wikiTreeIdInputRef: React.RefObject<Input> = React.createRef();
  wikiTreeLoginFormRef: React.RefObject<HTMLFormElement> = React.createRef();
  wikiTreeReturnUrlRef: React.RefObject<HTMLInputElement> = React.createRef();
  searchRef?: {setValue(value: string): void};
  searchIndex?: SearchIndex;

  /** Handles the "Upload file" button. */
  private async handleUpload(event: React.SyntheticEvent<HTMLInputElement>) {
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
  private openLoadUrlDialog() {
    this.setState(
      Object.assign({}, this.state, {loadUrlDialogOpen: true}),
      () => this.urlInputRef.current!.focus(),
    );
  }

  private openWikiTreeIdDialog() {
    this.setState(
      Object.assign({}, this.state, {wikiTreeIdDialogOpen: true}),
      () => this.wikiTreeIdInputRef.current!.focus(),
    );
  }

  /** Cancels any of the open dialogs. */
  private handleClose() {
    this.setState(
      Object.assign({}, this.state, {
        loadUrlDialogOpen: false,
        wikiTreeIdDialogOpen: false,
      }),
    );
  }

  /** Load button clicked in the "Load from URL" dialog. */
  private handleLoad() {
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

  /** Select button clicked in the "Select WikiTree ID" dialog. */
  private handleSelectWikiTreeId() {
    this.setState(
      Object.assign({}, this.state, {
        wikiTreeIdDialogOpen: false,
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

  /** Called when the URL input is typed into. */
  private handleUrlChange(value: string) {
    this.setState(
      Object.assign({}, this.state, {
        url: value,
      }),
    );
  }

  /** Called when the URL input is typed into. */
  private handleWikiTreeIdChange(value: string) {
    this.setState(
      Object.assign({}, this.state, {
        wikiTreeId: value,
      }),
    );
  }

  /** On search input change. */
  private handleSearch(input: string | undefined) {
    if (!input) {
      return;
    }
    const results = this.searchIndex!.search(input).map((result) =>
      displaySearchResult(result, this.context.intl),
    );
    this.setState(Object.assign({}, this.state, {searchResults: results}));
  }

  /** On search result selected. */
  private handleResultSelect(id: string) {
    analyticsEvent('search_result_selected');
    this.props.eventHandlers.onSelection({id, generation: 0});
    this.searchRef!.setValue('');
  }

  private initializeSearchIndex() {
    if (this.props.data) {
      this.searchIndex = buildSearchIndex(this.props.data);
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
    const wikiTreeLoginState =
      Cookies.get('wikidb_wtb_UserID') !== undefined
        ? WikiTreeLoginState.LOGGED_IN
        : WikiTreeLoginState.NOT_LOGGED_IN;
    if (this.state.wikiTreeLoginState !== wikiTreeLoginState) {
      const wikiTreeLoginUsername = Cookies.get('wikidb_wtb_UserName');
      this.setState(
        Object.assign({}, this.state, {
          wikiTreeLoginState,
          wikiTreeLoginUsername,
        }),
      );
    }
  }

  async componentDidMount() {
    this.checkWikiTreeLoginState();
    this.initializeSearchIndex();
  }

  componentDidUpdate(prevProps: Props) {
    this.checkWikiTreeLoginState();
    if (prevProps.data !== this.props.data) {
      this.initializeSearchIndex();
    }
  }

  private loadFromUrlModal() {
    return (
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
              onChange={(e, data) => this.handleUrlChange(data.value)}
              ref={this.urlInputRef}
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
  }

  private enterWikiTreeId(event: React.MouseEvent, id: string) {
    event.preventDefault(); // Do not follow link in href.
    ((this.wikiTreeIdInputRef.current as unknown) as {
      inputRef: HTMLInputElement;
    }).inputRef.value = id;
    this.handleWikiTreeIdChange(id);
    this.wikiTreeIdInputRef.current!.focus();
  }

  private wikiTreeIdModal() {
    return (
      <Modal
        open={this.state.wikiTreeIdDialogOpen}
        onClose={() => this.handleClose()}
        centered={false}
      >
        <Header>
          <img
            src={WIKITREE_LOGO_URL}
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
          <Form onSubmit={() => this.handleSelectWikiTreeId()}>
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
                      onClick={(e) => this.enterWikiTreeId(e, 'Wojtyla-13')}
                      className="link-span"
                    >
                      Wojtyla-13
                    </span>
                  ),
                  example2: (
                    <span
                      onClick={(e) => this.enterWikiTreeId(e, 'Skłodowska-2')}
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
              onChange={(e, data) => this.handleWikiTreeIdChange(data.value)}
              ref={this.wikiTreeIdInputRef}
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
          <Button primary onClick={() => this.handleSelectWikiTreeId()}>
            <FormattedMessage
              id="select_wikitree_id.load"
              defaultMessage="Load"
            />
          </Button>
        </Modal.Actions>
      </Modal>
    );
  }

  private search() {
    return (
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
        id="search"
      />
    );
  }

  private chartMenus(screenSize: ScreenSize) {
    if (!this.props.showingChart) {
      return null;
    }
    const chartTypeItems = (
      <>
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
      </>
    );
    switch (screenSize) {
      case ScreenSize.LARGE:
        return (
          <>
            <Menu.Item onClick={() => this.props.eventHandlers.onPrint()}>
              <Icon name="print" />
              <FormattedMessage id="menu.print" defaultMessage="Print" />
            </Menu.Item>

            <Dropdown
              trigger={
                <div>
                  <Icon name="download" />
                  <FormattedMessage
                    id="menu.download"
                    defaultMessage="Download"
                  />
                </div>
              }
              className="item"
            >
              <Dropdown.Menu>
                <Dropdown.Item
                  onClick={() => this.props.eventHandlers.onDownloadPdf()}
                >
                  <FormattedMessage
                    id="menu.pdf_file"
                    defaultMessage="PDF file"
                  />
                </Dropdown.Item>
                <Dropdown.Item
                  onClick={() => this.props.eventHandlers.onDownloadPng()}
                >
                  <FormattedMessage
                    id="menu.png_file"
                    defaultMessage="PNG file"
                  />
                </Dropdown.Item>
                <Dropdown.Item
                  onClick={() => this.props.eventHandlers.onDownloadSvg()}
                >
                  <FormattedMessage
                    id="menu.svg_file"
                    defaultMessage="SVG file"
                  />
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
              <Dropdown.Menu>{chartTypeItems}</Dropdown.Menu>
            </Dropdown>
            {this.search()}
          </>
        );

      case ScreenSize.SMALL:
        return (
          <>
            <Dropdown.Item onClick={() => this.props.eventHandlers.onPrint()}>
              <Icon name="print" />
              <FormattedMessage id="menu.print" defaultMessage="Print" />
            </Dropdown.Item>

            <Dropdown.Divider />

            <Dropdown.Item
              onClick={() => this.props.eventHandlers.onDownloadPdf()}
            >
              <Icon name="download" />
              <FormattedMessage
                id="menu.download_pdf"
                defaultMessage="Downlod PDF"
              />
            </Dropdown.Item>
            <Dropdown.Item
              onClick={() => this.props.eventHandlers.onDownloadPng()}
            >
              <Icon name="download" />
              <FormattedMessage
                id="menu.download_png"
                defaultMessage="Download PNG"
              />
            </Dropdown.Item>
            <Dropdown.Item
              onClick={() => this.props.eventHandlers.onDownloadSvg()}
            >
              <Icon name="download" />
              <FormattedMessage
                id="menu.download_svg"
                defaultMessage="Download SVG"
              />
            </Dropdown.Item>

            <Dropdown.Divider />
            {chartTypeItems}
            <Dropdown.Divider />
          </>
        );
    }
  }

  private title() {
    return (
      <Menu.Item>
        <b>Topola Genealogy</b>
      </Menu.Item>
    );
  }

  private fileMenus(screenSize: ScreenSize) {
    const loadWikiTreeItem = (
      <>
        <img
          src={WIKITREE_LOGO_URL}
          alt="WikiTree logo"
          className="menu-icon"
          />
        <FormattedMessage
          id="menu.select_wikitree_id"
          defaultMessage="Select WikiTree ID"
        />
      </>
    );

    // In standalone WikiTree mode, show only the "Select WikiTree ID" menu.
    if (!this.props.standalone && this.props.showWikiTreeMenus) {
      switch (screenSize) {
        case ScreenSize.LARGE:
          return (
            <>
              <Menu.Item onClick={() => this.openWikiTreeIdDialog()}>
                {loadWikiTreeItem}
              </Menu.Item>
              {this.wikiTreeIdModal()}
            </>
          );
        case ScreenSize.SMALL:
          return (
            <>
              <Dropdown.Item onClick={() => this.openWikiTreeIdDialog()}>
                {loadWikiTreeItem}
              </Dropdown.Item>
              <Dropdown.Divider />
              {this.wikiTreeIdModal()}
            </>
          );
      }
    }

    // Don't show "open" menus in non-standalone mode.
    if (!this.props.standalone) {
      return null;
    }

    const openFileItem = (
      <>
        <Icon name="folder open" />
        <FormattedMessage id="menu.open_file" defaultMessage="Open file" />
      </>
    );
    const loadUrlItem = (
      <>
        <Icon name="cloud download" />
        <FormattedMessage
          id="menu.load_from_url"
          defaultMessage="Load from URL"
        />
      </>
    );
    const commonElements = (
      <>
        {this.loadFromUrlModal()}
        {this.wikiTreeIdModal()}
        <input
          className="hidden"
          type="file"
          accept=".ged,image/*"
          id="fileInput"
          multiple
          onChange={(e) => this.handleUpload(e)}
        />
      </>
    );
    switch (screenSize) {
      case ScreenSize.LARGE:
        // Show dropdown if chart is shown, otherwise show individual menu
        // items.
        const menus = this.props.showingChart ? (
          <Dropdown
            trigger={
              <div>
                <Icon name="folder open" />
                <FormattedMessage id="menu.open" defaultMessage="Open" />
              </div>
            }
            className="item"
          >
            <Dropdown.Menu>
              <Dropdown.Item as="label" htmlFor="fileInput">
                {openFileItem}
              </Dropdown.Item>
              <Dropdown.Item onClick={() => this.openLoadUrlDialog()}>
                {loadUrlItem}
              </Dropdown.Item>
              <Dropdown.Item onClick={() => this.openWikiTreeIdDialog()}>
                {loadWikiTreeItem}
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
        ) : (
          <>
            <label htmlFor="fileInput">
              <Menu.Item as="a">{openFileItem}</Menu.Item>
            </label>
            <Menu.Item onClick={() => this.openLoadUrlDialog()}>
              {loadUrlItem}
            </Menu.Item>
            <Menu.Item onClick={() => this.openWikiTreeIdDialog()}>
              {loadWikiTreeItem}
            </Menu.Item>
          </>
        );
        return (
          <>
            {menus}
            {commonElements}
          </>
        );

      case ScreenSize.SMALL:
        return (
          <>
            <Dropdown.Item as="label" htmlFor="fileInput">
              {openFileItem}
            </Dropdown.Item>
            <Dropdown.Item onClick={() => this.openLoadUrlDialog()}>
              {loadUrlItem}
            </Dropdown.Item>
            <Dropdown.Item onClick={() => this.openWikiTreeIdDialog()}>
              {loadWikiTreeItem}
            </Dropdown.Item>
            <Dropdown.Divider />
            {commonElements}
          </>
        );
    }
  }

  private wikiTreeLoginMenu(screenSize: ScreenSize) {
    if (!this.props.showWikiTreeMenus) {
      return null;
    }
    switch (this.state.wikiTreeLoginState) {
      case WikiTreeLoginState.NOT_LOGGED_IN:
        const loginForm = (
          <form
            action="https://apps.wikitree.com/api.php"
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
        );
        switch (screenSize) {
          case ScreenSize.LARGE:
            return (
              <Menu.Item onClick={() => this.wikiTreeLogin()}>
                <img
                  src={WIKITREE_LOGO_URL}
                  alt="WikiTree logo"
                  className="menu-icon"
                />
                <FormattedMessage
                  id="menu.wikitree_login"
                  defaultMessage="Log in to WikiTree"
                />
                {loginForm}
              </Menu.Item>
            );

          case ScreenSize.SMALL:
            return (
              <>
                <Dropdown.Item onClick={() => this.wikiTreeLogin()}>
                  <img
                    src={WIKITREE_LOGO_URL}
                    alt="WikiTree logo"
                    className="menu-icon"
                    />
                  <FormattedMessage
                    id="menu.wikitree_login"
                    defaultMessage="Log in to WikiTree"
                  />
                  {loginForm}
                </Dropdown.Item>
                <Dropdown.Divider />
              </>
            );
        }
        break;

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
        switch (screenSize) {
          case ScreenSize.LARGE:
            return (
              <Menu.Item title={tooltip}>
                <img
                  src={WIKITREE_LOGO_URL}
                  alt="WikiTree logo"
                  className="menu-icon"
                />
                <FormattedMessage
                  id="menu.wikitree_logged_in"
                  defaultMessage="Logged in"
                />
              </Menu.Item>
            );

          case ScreenSize.SMALL:
            return (
              <>
                <Menu.Item title={tooltip}>
                  <img
                    src={WIKITREE_LOGO_URL}
                    alt="WikiTree logo"
                    className="menu-icon"
                    />
                  <FormattedMessage
                    id="menu.wikitree_logged_in"
                    defaultMessage="Logged in"
                  />
                </Menu.Item>
                <Dropdown.Divider />
              </>
            );

          default:
            return null;
        }
    }
  }

  private mobileMenus() {
    return (
      <>
        <Dropdown
          trigger={
            <div>
              <Icon name="sidebar" />
            </div>
          }
          className="item"
          icon={null}
        >
          <Dropdown.Menu>
            {this.fileMenus(ScreenSize.SMALL)}
            {this.chartMenus(ScreenSize.SMALL)}
            {this.wikiTreeLoginMenu(ScreenSize.SMALL)}

            <Dropdown.Item
              href="https://github.com/PeWu/topola-viewer"
              target="_blank"
              rel="noopener noreferrer"
            >
              <FormattedMessage
                id="menu.github"
                defaultMessage="Source on GitHub"
              />
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>
        {this.props.standalone ? (
          <Link to="/">{this.title()}</Link>
        ) : (
          this.title()
        )}
      </>
    );
  }

  private desktopMenus() {
    return (
      <>
        {this.props.standalone ? <Link to="/">{this.title()}</Link> : null}
        {this.fileMenus(ScreenSize.LARGE)}
        {this.chartMenus(ScreenSize.LARGE)}
        <Menu.Menu position="right">
          {this.wikiTreeLoginMenu(ScreenSize.LARGE)}
          <Menu.Item
            href="https://github.com/PeWu/topola-viewer"
            target="_blank"
            rel="noopener noreferrer"
          >
            <FormattedMessage
              id="menu.github"
              defaultMessage="GitHub project"
            />
          </Menu.Item>
        </Menu.Menu>
      </>
    );
  }

  render() {
    return (
      <>
        <Responsive
          as={Menu}
          attached="top"
          inverted
          color="blue"
          size="large"
          minWidth={768}
        >
          {this.desktopMenus()}
        </Responsive>
        <Responsive
          as={Menu}
          attached="top"
          inverted
          color="blue"
          size="large"
          maxWidth={767}
        >
          {this.mobileMenus()}
        </Responsive>
      </>
    );
  }
}
