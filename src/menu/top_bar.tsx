import * as queryString from 'query-string';
import * as React from 'react';
import debounce from 'debounce';
import {analyticsEvent} from '../util/analytics';
import {buildSearchIndex, SearchIndex} from './search_index';
import {displaySearchResult} from './search_util';
import {FormattedMessage, intlShape} from 'react-intl';
import {IndiInfo, JsonGedcomData} from 'topola';
import {Link} from 'react-router-dom';
import {MenuType} from './menu_item';
import {RouteComponentProps} from 'react-router-dom';
import {UploadMenu} from './upload_menu';
import {UrlMenu} from './url_menu';
import {WikiTreeLoginMenu, WikiTreeMenu} from './wikitree_menu';
import {
  Icon,
  Menu,
  Dropdown,
  Search,
  SearchProps,
  SearchResultProps,
  Responsive,
} from 'semantic-ui-react';

enum ScreenSize {
  LARGE,
  SMALL,
}

/** Menus and dialogs state. */
interface State {
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

export class TopBar extends React.Component<
  RouteComponentProps & Props,
  State
> {
  state: State = {
    searchResults: [],
  };
  /** Make intl appear in this.context. */
  static contextTypes = {
    intl: intlShape,
  };

  searchRef?: {setValue(value: string): void};
  searchIndex?: SearchIndex;

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

  private changeView(view: string) {
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
    if (prevProps.data !== this.props.data) {
      this.initializeSearchIndex();
    }
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
    // In standalone WikiTree mode, show only the "Select WikiTree ID" menu.
    if (!this.props.standalone && this.props.showWikiTreeMenus) {
      switch (screenSize) {
        case ScreenSize.LARGE:
          return <WikiTreeMenu menuType={MenuType.Menu} {...this.props} />;
        case ScreenSize.SMALL:
          return (
            <>
              <WikiTreeMenu menuType={MenuType.Dropdown} {...this.props} />
              <Dropdown.Divider />
            </>
          );
      }
    }

    // Don't show "open" menus in non-standalone mode.
    if (!this.props.standalone) {
      return null;
    }

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
              <UploadMenu menuType={MenuType.Dropdown} {...this.props} />
              <UrlMenu menuType={MenuType.Dropdown} {...this.props} />
              <WikiTreeMenu menuType={MenuType.Dropdown} {...this.props} />
            </Dropdown.Menu>
          </Dropdown>
        ) : (
          <>
            <UploadMenu menuType={MenuType.Menu} {...this.props} />
            <UrlMenu menuType={MenuType.Menu} {...this.props} />
            <WikiTreeMenu menuType={MenuType.Menu} {...this.props} />
          </>
        );
        return menus;

      case ScreenSize.SMALL:
        return (
          <>
            <UploadMenu menuType={MenuType.Dropdown} {...this.props} />
            <UrlMenu menuType={MenuType.Dropdown} {...this.props} />
            <WikiTreeMenu menuType={MenuType.Dropdown} {...this.props} />
            <Dropdown.Divider />
          </>
        );
    }
  }

  private wikiTreeLoginMenu(screenSize: ScreenSize) {
    if (!this.props.showWikiTreeMenus) {
      return null;
    }
    return (
      <>
        <WikiTreeLoginMenu
          menuType={
            screenSize === ScreenSize.SMALL ? MenuType.Dropdown : MenuType.Menu
          }
          {...this.props}
        />
        {screenSize === ScreenSize.SMALL ? <Dropdown.Divider /> : null}
      </>
    );
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
