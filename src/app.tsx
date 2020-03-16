import * as H from 'history';
import * as queryString from 'query-string';
import * as React from 'react';
import {analyticsEvent} from './analytics';
import {Chart, ChartType} from './chart';
import {Details} from './details';
import {FormattedMessage} from 'react-intl';
import {getSelection, loadFromUrl, loadGedcom} from './load_data';
import {getSoftware, TopolaData} from './gedcom_util';
import {IndiInfo} from 'topola';
import {intlShape} from 'react-intl';
import {Intro} from './intro';
import {Loader, Message, Portal, Responsive} from 'semantic-ui-react';
import {loadWikiTree} from './wikitree';
import {Redirect, Route, RouteComponentProps, Switch} from 'react-router-dom';
import {TopBar} from './top_bar';

/** Shows an error message in the middle of the screen. */
function ErrorMessage(props: {message?: string}) {
  return (
    <Message negative className="error">
      <Message.Header>
        <FormattedMessage
          id="error.failed_to_load_file"
          defaultMessage={'Failed to load file'}
        />
      </Message.Header>
      <p>{props.message}</p>
    </Message>
  );
}

interface ErrorPopupProps {
  message?: string;
  open: boolean;
  onDismiss: () => void;
}

/**
 * Shows a dismissable error message in the bottom left corner of the screen.
 */
function ErrorPopup(props: ErrorPopupProps) {
  return (
    <Portal open={props.open} onClose={props.onDismiss}>
      <Message negative className="errorPopup" onDismiss={props.onDismiss}>
        <Message.Header>
          <FormattedMessage id="error.error" defaultMessage={'Error'} />
        </Message.Header>
        <p>{props.message}</p>
      </Message>
    </Portal>
  );
}

/**
 * Message types used in embedded mode.
 * When the parent is ready to receive messages, it sends PARENT_READY.
 * When the child (this app) is ready to receive messages, it sends READY.
 * When the child receives PARENT_READY, it sends READY.
 * When the parent receives READY, it sends data in a GEDCOM message.
 */
enum EmbeddedMessageType {
  GEDCOM = 'gedcom',
  READY = 'ready',
  PARENT_READY = 'parent_ready',
}

/** Message sent to parent or received from parent in embedded mode. */
interface EmbeddedMessage {
  message: EmbeddedMessageType;
}

interface GedcomMessage extends EmbeddedMessage {
  message: EmbeddedMessageType.GEDCOM;
  gedcom?: string;
}

/** Interface encapsulating functions specific for a data source. */
interface DataSource {
  /**
   * Returns true if the application is now loading a completely new data set
   * and the existing one should be wiped.
   */
  isNewData(args: Arguments, state: State): boolean;
  /** Loads data from the data source. */
  loadData(args: Arguments): Promise<TopolaData>;
}

/** Files opened from the local computer. */
class UploadedDataSource implements DataSource {
  isNewData(args: Arguments, state: State): boolean {
    return (
      args.hash !== state.hash ||
      !!(args.gedcom && !state.loading && !state.data)
    );
  }

  async loadData(args: Arguments): Promise<TopolaData> {
    try {
      const data = await loadGedcom(args.hash!, args.gedcom, args.images);
      const software = getSoftware(data.gedcom.head);
      analyticsEvent('upload_file_loaded', {
        event_label: software,
        event_value: (args.images && args.images.size) || 0,
      });
      return data;
    } catch (error) {
      analyticsEvent('upload_file_error');
      throw error;
    }
  }
}

/** GEDCOM file loaded by pointing to a URL. */
class GedcomUrlDataSource implements DataSource {
  isNewData(args: Arguments, state: State): boolean {
    return args.url !== state.url;
  }

  async loadData(args: Arguments): Promise<TopolaData> {
    try {
      const data = await loadFromUrl(args.url!, args.handleCors);
      const software = getSoftware(data.gedcom.head);
      analyticsEvent('upload_file_loaded', {event_label: software});
      return data;
    } catch (error) {
      analyticsEvent('url_file_error');
      throw error;
    }
  }
}

/** Loading data from the WikiTree API. */
class WikiTreeDataSource implements DataSource {
  isNewData(args: Arguments, state: State): boolean {
    // WikiTree is always a single data source.
    return false;
  }

  async loadData(args: Arguments): Promise<TopolaData> {
    try {
      const data = await loadWikiTree(args.indi!, args.authcode);
      analyticsEvent('wikitree_loaded');
      return data;
    } catch (error) {
      analyticsEvent('wikitree_error');
      throw error;
    }
  }
}

/** Supported data sources. */
enum DataSourceEnum {
  UPLOADED,
  GEDCOM_URL,
  WIKITREE,
}

/** Mapping from data source identifier to data source handler functions. */
const DATA_SOURCES = new Map([
  [DataSourceEnum.UPLOADED, new UploadedDataSource()],
  [DataSourceEnum.GEDCOM_URL, new GedcomUrlDataSource()],
  [DataSourceEnum.WIKITREE, new WikiTreeDataSource()],
]);

/** Arguments passed to the application, primarily through URL parameters. */
interface Arguments {
  showSidePanel: boolean;
  embedded: boolean;
  url?: string;
  indi?: string;
  generation?: number;
  hash?: string;
  handleCors: boolean;
  standalone: boolean;
  source?: DataSourceEnum;
  authcode?: string;
  chartType: ChartType;
  gedcom?: string;
  images?: Map<string, string>;
  enableZoom: boolean;
}

/**
 * Retrieve arguments passed into the application through the URL and uploaded
 * data.
 */
function getArguments(location: H.Location<any>): Arguments {
  const search = queryString.parse(location.search);
  const getParam = (name: string) => {
    const value = search[name];
    return typeof value === 'string' ? value : undefined;
  };

  const parsedGen = Number(getParam('gen'));
  const view = getParam('view');
  const chartTypes = new Map<string | undefined, ChartType>([
    ['relatives', ChartType.Relatives],
    ['fancy', ChartType.Fancy],
  ]);
  const hash = getParam('file');
  const url = getParam('url');
  const source =
    getParam('source') === 'wikitree'
      ? DataSourceEnum.WIKITREE
      : hash
      ? DataSourceEnum.UPLOADED
      : url
      ? DataSourceEnum.GEDCOM_URL
      : undefined;
  return {
    showSidePanel: getParam('sidePanel') !== 'false', // True by default.
    embedded: getParam('embedded') === 'true', // False by default.
    url,
    indi: getParam('indi'),
    generation: !isNaN(parsedGen) ? parsedGen : undefined,
    hash,
    handleCors: getParam('handleCors') !== 'false', // True by default.
    standalone: getParam('standalone') !== 'false', // True by default.
    source,
    authcode: getParam('?authcode'),

    // Hourglass is the default view.
    chartType: chartTypes.get(view) || ChartType.Hourglass,

    gedcom: location.state && location.state.data,
    images: location.state && location.state.images,
    enableZoom: getParam('enableZoom') === 'true', // False by default.
  };
}

/** Returs true if the changes object has values that are different than those in state. */
function hasUpdatedValues<T>(state: T, changes: Partial<T> | undefined) {
  if (!changes) {
    return false;
  }
  return Object.entries(changes).some(
    ([key, value]) => value !== undefined && state[key] !== value,
  );
}

interface State {
  /** Loaded data. */
  data?: TopolaData;
  /** Selected individual. */
  selection?: IndiInfo;
  /** Hash of the GEDCOM contents. */
  hash?: string;
  /** Error to display. */
  error?: string;
  /** True if data is currently being loaded. */
  loading: boolean;
  /** URL of the data that is loaded or is being loaded. */
  url?: string;
  /** Whether the side panel is shown. */
  showSidePanel?: boolean;
  /** Whether the app is in embedded mode, i.e. embedded in an iframe. */
  embedded: boolean;
  /** Whether the app is in standalone mode, i.e. showing 'open file' menus. */
  standalone: boolean;
  /** Type of displayed chart. */
  chartType: ChartType;
  /** Whether to show the error popup. */
  showErrorPopup: boolean;
  /** Source of the data. */
  source?: DataSourceEnum;
  loadingMore?: boolean;
  /** Whether the zoom functionality is enabled. */
  enableZoom: boolean;
}

export class App extends React.Component<RouteComponentProps, {}> {
  state: State = {
    loading: false,
    embedded: false,
    standalone: true,
    chartType: ChartType.Hourglass,
    showErrorPopup: false,
    enableZoom: false,
  };
  chartRef: Chart | null = null;

  /** Make intl appear in this.context. */
  static contextTypes = {
    intl: intlShape,
  };

  /** Sets the state with a new individual selection and chart type. */
  private updateDisplay(
    selection: IndiInfo,
    otherStateChanges?: Partial<State>,
  ) {
    if (
      !this.state.selection ||
      this.state.selection.id !== selection.id ||
      this.state.selection!.generation !== selection.generation ||
      hasUpdatedValues(this.state, otherStateChanges)
    ) {
      this.setState(
        Object.assign({}, this.state, {selection}, otherStateChanges),
      );
    }
  }

  /** Sets error message after data load failure. */
  private setError(error: string) {
    this.setState(
      Object.assign({}, this.state, {
        error: error,
        loading: false,
      }),
    );
  }

  private async onMessage(message: EmbeddedMessage) {
    if (message.message === EmbeddedMessageType.PARENT_READY) {
      // Parent didn't receive the first 'ready' message, so we need to send it again.
      window.parent.postMessage({message: EmbeddedMessageType.READY}, '*');
    } else if (message.message === EmbeddedMessageType.GEDCOM) {
      const gedcom = (message as GedcomMessage).gedcom;
      if (!gedcom) {
        return;
      }
      try {
        const data = await loadGedcom('', gedcom);
        const software = getSoftware(data.gedcom.head);
        analyticsEvent('embedded_file_loaded', {
          event_label: software,
        });
        // Set state with data.
        this.setState(
          Object.assign({}, this.state, {
            data,
            selection: getSelection(data.chartData),
            error: undefined,
            loading: false,
          }),
        );
      } catch (error) {
        analyticsEvent('embedded_file_error');
        this.setError(error.message);
      }
    }
  }

  componentDidMount() {
    this.componentDidUpdate();
  }

  async componentDidUpdate() {
    if (this.props.location.pathname !== '/view') {
      return;
    }

    const args = getArguments(this.props.location);

    if (args.embedded && !this.state.embedded) {
      this.setState(
        Object.assign({}, this.state, {
          embedded: true,
          standalone: false,
          showSidePanel: args.showSidePanel,
        }),
      );
      // Notify the parent window that we are ready.
      window.parent.postMessage('ready', '*');
      window.addEventListener('message', (data) => this.onMessage(data.data));
    }
    if (args.embedded) {
      // If the app is embedded, do not run the normal loading code.
      return;
    }

    const dataSource = DATA_SOURCES.get(args.source!);

    if (!dataSource) {
      this.props.history.replace({pathname: '/'});
    } else if (
      (!this.state.loading && !this.state.data && !this.state.error) ||
      args.source !== this.state.source ||
      dataSource.isNewData(args, this.state)
    ) {
      // Set loading state.
      this.setState(
        Object.assign({}, this.state, {
          data: undefined,
          selection: undefined,
          hash: args.hash,
          error: undefined,
          loading: true,
          url: args.url,
          standalone: args.standalone,
          chartType: args.chartType,
          source: args.source,
          enableZoom: args.enableZoom,
        }),
      );
      try {
        const data = await dataSource.loadData(args);

        // Set state with data.
        this.setState(
          Object.assign({}, this.state, {
            data,
            hash: args.hash,
            selection: getSelection(data.chartData, args.indi, args.generation),
            error: undefined,
            loading: false,
            url: args.url,
            showSidePanel: args.showSidePanel,
            standalone: args.standalone,
            chartType: args.chartType,
            source: args.source,
            enableZoom: args.enableZoom,
          }),
        );
      } catch (error) {
        this.setError(error.message);
      }
    } else if (this.state.data && this.state.selection) {
      // Update selection if it has changed in the URL.
      const selection = getSelection(
        this.state.data.chartData,
        args.indi,
        args.generation,
      );
      const loadMoreFromWikitree =
        args.source === DataSourceEnum.WIKITREE &&
        (!this.state.selection || this.state.selection.id !== selection.id);
      this.updateDisplay(selection, {
        chartType: args.chartType,
        loadingMore: loadMoreFromWikitree || undefined,
      });
      if (loadMoreFromWikitree) {
        const data = await loadWikiTree(args.indi!);
        this.setState(
          Object.assign({}, this.state, {
            data,
            hash: args.hash,
            selection: getSelection(data.chartData, args.indi, args.generation),
            error: undefined,
            loading: false,
            url: args.url,
            showSidePanel: args.showSidePanel,
            standalone: args.standalone,
            chartType: args.chartType,
            source: args.source,
            enableZoom: args.enableZoom,
            loadingMore: false,
          }),
        );
      }
    }
  }

  /**
   * Called when the user clicks an individual box in the chart.
   * Updates the browser URL.
   */
  private onSelection = (selection: IndiInfo) => {
    analyticsEvent('selection_changed');
    if (this.state.embedded) {
      // In embedded mode the URL doesn't change.
      this.updateDisplay(selection);
      return;
    }
    const location = this.props.location;
    const search = queryString.parse(location.search);
    search.indi = selection.id;
    search.gen = String(selection.generation);
    location.search = queryString.stringify(search);
    this.props.history.push(location);
  };

  private onPrint = () => {
    analyticsEvent('print');
    this.chartRef && this.chartRef.print();
  };

  private showErrorPopup(message: string) {
    this.setState(
      Object.assign({}, this.state, {
        showErrorPopup: true,
        error: message,
      }),
    );
  }

  private onDownloadPdf = async () => {
    analyticsEvent('download_pdf');
    try {
      this.chartRef && (await this.chartRef.downloadPdf());
    } catch (e) {
      this.showErrorPopup(
        this.context.intl.formatMessage({
          id: 'error.failed_pdf',
          defaultMessage:
            'Failed to generate PDF file.' +
            ' Please try with a smaller diagram or download an SVG file.',
        }),
      );
    }
  };

  private onDownloadPng = async () => {
    analyticsEvent('download_png');
    try {
      this.chartRef && (await this.chartRef.downloadPng());
    } catch (e) {
      this.showErrorPopup(
        this.context.intl.formatMessage({
          id: 'error.failed_png',
          defaultMessage:
            'Failed to generate PNG file.' +
            ' Please try with a smaller diagram or download an SVG file.',
        }),
      );
    }
  };

  private onDownloadSvg = () => {
    analyticsEvent('download_svg');
    this.chartRef && this.chartRef.downloadSvg();
  };

  onDismissErrorPopup = () => {
    this.setState(
      Object.assign({}, this.state, {
        showErrorPopup: false,
      }),
    );
  };

  private renderMainArea = () => {
    if (this.state.data && this.state.selection) {
      return (
        <div id="content">
          <ErrorPopup
            open={this.state.showErrorPopup}
            message={this.state.error}
            onDismiss={this.onDismissErrorPopup}
          />
          {this.state.loadingMore ? (
            <Loader active size="small" className="loading-more" />
          ) : null}
          <Chart
            data={this.state.data.chartData}
            selection={this.state.selection}
            chartType={this.state.chartType}
            onSelection={this.onSelection}
            ref={(ref) => (this.chartRef = ref)}
            enableZoom={this.state.enableZoom}
          />
          {this.state.showSidePanel ? (
            <Responsive minWidth={768} id="sidePanel">
              <Details
                gedcom={this.state.data.gedcom}
                indi={this.state.selection.id}
              />
            </Responsive>
          ) : null}
        </div>
      );
    }
    if (this.state.error) {
      return <ErrorMessage message={this.state.error!} />;
    }
    return <Loader active size="large" />;
  };

  render() {
    return (
      <>
        <Route
          render={(props: RouteComponentProps) => (
            <TopBar
              {...props}
              gedcom={this.state.data && this.state.data.gedcom}
              allowAllRelativesChart={
                this.state.source !== DataSourceEnum.WIKITREE
              }
              showingChart={
                !!(
                  this.props.history.location.pathname === '/view' &&
                  this.state.data &&
                  this.state.selection
                )
              }
              standalone={this.state.standalone}
              eventHandlers={{
                onSelection: this.onSelection,
                onPrint: this.onPrint,
                onDownloadPdf: this.onDownloadPdf,
                onDownloadPng: this.onDownloadPng,
                onDownloadSvg: this.onDownloadSvg,
              }}
              showWikiTreeLogin={this.state.source === DataSourceEnum.WIKITREE}
            />
          )}
        />
        <Switch>
          <Route exact path="/" component={Intro} />
          <Route exact path="/view" render={this.renderMainArea} />
          <Redirect to={'/'} />
        </Switch>
      </>
    );
  }
}
