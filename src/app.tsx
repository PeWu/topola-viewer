import * as H from 'history';
import * as queryString from 'query-string';
import * as React from 'react';
import {analyticsEvent} from './util/analytics';
import {Chart, ChartType} from './chart';
import {Details} from './details';
import {FormattedMessage, InjectedIntl} from 'react-intl';
import {getSelection, loadFromUrl, loadGedcom} from './datasource/load_data';
import {getSoftware, TopolaData} from './util/gedcom_util';
import {IndiInfo} from 'topola';
import {intlShape} from 'react-intl';
import {Intro} from './intro';
import {Loader, Message, Portal, Responsive} from 'semantic-ui-react';
import {loadWikiTree, PRIVATE_ID_PREFIX} from './datasource/wikitree';
import {Redirect, Route, RouteComponentProps, Switch} from 'react-router-dom';
import {TopBar} from './menu/top_bar';

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

enum AppState {
  INITIAL,
  LOADING,
  ERROR,
  SHOWING_CHART,
  LOADING_MORE,
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

/** Supported data sources. */
enum DataSourceEnum {
  UPLOADED,
  GEDCOM_URL,
  WIKITREE,
}

interface UploadSourceSpec {
  source: DataSourceEnum.UPLOADED;
  gedcom?: string;
  /** Hash of the GEDCOM contents. */
  hash: string;
  images?: Map<string, string>;
}

interface UrlSourceSpec {
  source: DataSourceEnum.GEDCOM_URL;
  /** URL of the data that is loaded or is being loaded. */
  url: string;
  handleCors: boolean;
}

interface WikiTreeSourceSpec {
  source: DataSourceEnum.WIKITREE;
  authcode?: string;
}

type DataSourceSpec = UrlSourceSpec | UploadSourceSpec | WikiTreeSourceSpec;

/** Source specification together with individual selection. */
interface SourceSelection<SourceSpecT> {
  spec: SourceSpecT;
  selection?: IndiInfo;
}

/** Interface encapsulating functions specific for a data source. */
interface DataSource<SourceSpecT> {
  /**
   * Returns true if the application is now loading a completely new data set
   * and the existing one should be wiped.
   */
  isNewData(
    newSource: SourceSelection<SourceSpecT>,
    oldSource: SourceSelection<SourceSpecT>,
    data?: TopolaData,
  ): boolean;
  /** Loads data from the data source. */
  loadData(spec: SourceSelection<SourceSpecT>): Promise<TopolaData>;
}

/** Files opened from the local computer. */
class UploadedDataSource implements DataSource<UploadSourceSpec> {
  // isNewData(args: Arguments, state: State): boolean {
  isNewData(
    newSource: SourceSelection<UploadSourceSpec>,
    oldSource: SourceSelection<UploadSourceSpec>,
    data?: TopolaData,
  ): boolean {
    return newSource.spec.hash !== oldSource.spec.hash;
  }

  async loadData(
    source: SourceSelection<UploadSourceSpec>,
  ): Promise<TopolaData> {
    try {
      const data = await loadGedcom(
        source.spec.hash,
        source.spec.gedcom,
        source.spec.images,
      );
      const software = getSoftware(data.gedcom.head);
      analyticsEvent('upload_file_loaded', {
        event_label: software,
        event_value: (source.spec.images && source.spec.images.size) || 0,
      });
      return data;
    } catch (error) {
      analyticsEvent('upload_file_error');
      throw error;
    }
  }
}

/** GEDCOM file loaded by pointing to a URL. */
class GedcomUrlDataSource implements DataSource<UrlSourceSpec> {
  isNewData(
    newSource: SourceSelection<UrlSourceSpec>,
    oldSource: SourceSelection<UrlSourceSpec>,
    data?: TopolaData,
  ): boolean {
    return newSource.spec.url !== oldSource.spec.url;
  }

  async loadData(source: SourceSelection<UrlSourceSpec>): Promise<TopolaData> {
    try {
      const data = await loadFromUrl(source.spec.url, source.spec.handleCors);
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
class WikiTreeDataSource implements DataSource<WikiTreeSourceSpec> {
  constructor(private intl: InjectedIntl) {}

  isNewData(
    newSource: SourceSelection<WikiTreeSourceSpec>,
    oldSource: SourceSelection<WikiTreeSourceSpec>,
    data?: TopolaData,
  ): boolean {
    if (!newSource.selection) {
      return false;
    }
    if (oldSource.selection?.id === newSource.selection.id) {
      // Selection unchanged -> don't reload.
      return false;
    }
    if (
      data &&
      data.chartData.indis.some((indi) => indi.id === newSource.selection?.id)
    ) {
      // New selection exists in current view -> animate instead of reloading.
      return false;
    }
    return true;
  }

  async loadData(
    source: SourceSelection<WikiTreeSourceSpec>,
  ): Promise<TopolaData> {
    if (!source.selection) {
      throw new Error('WikiTree id needs to be provided');
    }
    try {
      const data = await loadWikiTree(
        source.selection.id,
        this.intl,
        source.spec.authcode,
      );
      analyticsEvent('wikitree_loaded');
      return data;
    } catch (error) {
      analyticsEvent('wikitree_error');
      throw error;
    }
  }
}

/** Arguments passed to the application, primarily through URL parameters. */
interface Arguments {
  sourceSpec?: DataSourceSpec;
  selection?: IndiInfo;
  chartType: ChartType;
  embedded: boolean;
  standalone: boolean;
  freezeAnimation?: boolean;
  showSidePanel: boolean;
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

  const view = getParam('view');
  const chartTypes = new Map<string | undefined, ChartType>([
    ['relatives', ChartType.Relatives],
    ['fancy', ChartType.Fancy],
  ]);

  const hash = getParam('file');
  const url = getParam('url');
  var sourceSpec: DataSourceSpec | undefined = undefined;
  if (getParam('source') === 'wikitree') {
    sourceSpec = {
      source: DataSourceEnum.WIKITREE,
      authcode: getParam('?authcode'),
    };
  } else if (hash) {
    sourceSpec = {
      source: DataSourceEnum.UPLOADED,
      hash,
      gedcom: location.state && location.state.data,
      images: location.state && location.state.images,
    };
  } else if (url) {
    sourceSpec = {
      source: DataSourceEnum.GEDCOM_URL,
      url,
      handleCors: getParam('handleCors') !== 'false', // True by default.
    };
  }

  const indi = getParam('indi');
  const parsedGen = Number(getParam('gen'));
  const selection = indi
    ? {id: indi, generation: !isNaN(parsedGen) ? parsedGen : 0}
    : undefined;

  return {
    sourceSpec,
    selection,
    // Hourglass is the default view.
    chartType: chartTypes.get(view) || ChartType.Hourglass,

    showSidePanel: getParam('sidePanel') !== 'false', // True by default.
    embedded: getParam('embedded') === 'true', // False by default.
    standalone: getParam('standalone') !== 'false', // True by default.
    freezeAnimation: getParam('freeze') === 'true', // False by default
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
  /** State of the application. */
  state: AppState;
  /** Loaded data. */
  data?: TopolaData;
  /** Selected individual. */
  selection?: IndiInfo;
  /** Error to display. */
  error?: string;
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
  /** Specification of the source of the data. */
  sourceSpec?: DataSourceSpec;
  /** Freeze animations after initial chart render. */
  freezeAnimation?: boolean;
}

export class App extends React.Component<RouteComponentProps, {}> {
  state: State = {
    state: AppState.INITIAL,
    embedded: false,
    standalone: true,
    chartType: ChartType.Hourglass,
    showErrorPopup: false,
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
        state: AppState.ERROR,
        error,
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
            state: AppState.SHOWING_CHART,
            data,
            selection: getSelection(data.chartData),
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

  private readonly uploadedDataSource = new UploadedDataSource();
  private readonly gedcomUrlDataSource = new GedcomUrlDataSource();
  private readonly wikiTreeDataSource = new WikiTreeDataSource(
    this.context.intl,
  );

  private isNewData(sourceSpec: DataSourceSpec, selection?: IndiInfo) {
    if (
      !this.state.sourceSpec ||
      this.state.sourceSpec.source !== sourceSpec.source
    ) {
      // New data source means new data.
      return true;
    }
    const newSource = {spec: sourceSpec, selection};
    const oldSouce = {
      spec: this.state.sourceSpec,
      selection: this.state.selection,
    };
    switch (newSource.spec.source) {
      case DataSourceEnum.UPLOADED:
        return this.uploadedDataSource.isNewData(
          newSource as SourceSelection<UploadSourceSpec>,
          oldSouce as SourceSelection<UploadSourceSpec>,
          this.state.data,
        );
      case DataSourceEnum.GEDCOM_URL:
        return this.gedcomUrlDataSource.isNewData(
          newSource as SourceSelection<UrlSourceSpec>,
          oldSouce as SourceSelection<UrlSourceSpec>,
          this.state.data,
        );
      case DataSourceEnum.WIKITREE:
        return this.wikiTreeDataSource.isNewData(
          newSource as SourceSelection<WikiTreeSourceSpec>,
          oldSouce as SourceSelection<WikiTreeSourceSpec>,
          this.state.data,
        );
    }
  }

  private loadData(sourceSpec: DataSourceSpec, selection?: IndiInfo) {
    switch (sourceSpec.source) {
      case DataSourceEnum.UPLOADED:
        return this.uploadedDataSource.loadData({spec: sourceSpec, selection});
      case DataSourceEnum.GEDCOM_URL:
        return this.gedcomUrlDataSource.loadData({spec: sourceSpec, selection});
      case DataSourceEnum.WIKITREE:
        return this.wikiTreeDataSource.loadData({spec: sourceSpec, selection});
    }
  }

  async componentDidUpdate() {
    if (this.props.location.pathname !== '/view') {
      if (this.state.state !== AppState.INITIAL) {
        this.setState(Object.assign({}, this.state, {state: AppState.INITIAL}));
      }
      return;
    }

    const args = getArguments(this.props.location);

    if (args.embedded && !this.state.embedded) {
      // Enter embedded mode.
      this.setState(
        Object.assign({}, this.state, {
          state: AppState.LOADING,
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

    if (!args.sourceSpec) {
      this.props.history.replace({pathname: '/'});
    } else if (
      this.state.state === AppState.INITIAL ||
      this.isNewData(args.sourceSpec, args.selection)
    ) {
      // Set loading state.
      this.setState(
        Object.assign({}, this.state, {
          state: AppState.LOADING,
          sourceSpec: args.sourceSpec,
          selection: args.selection,
          standalone: args.standalone,
          chartType: args.chartType,
        }),
      );
      try {
        const data = await this.loadData(args.sourceSpec, args.selection);
        // Set state with data.
        this.setState(
          Object.assign({}, this.state, {
            state: AppState.SHOWING_CHART,
            data,
            selection: getSelection(data.chartData, args.selection),
          }),
        );
      } catch (error) {
        this.setError(error.message);
      }
    } else if (
      this.state.state === AppState.SHOWING_CHART ||
      this.state.state === AppState.LOADING_MORE
    ) {
      // Update selection if it has changed in the URL.
      const selection = getSelection(
        this.state.data!.chartData,
        args.selection,
      );
      const loadMoreFromWikitree =
        args.sourceSpec.source === DataSourceEnum.WIKITREE &&
        (!this.state.selection || this.state.selection.id !== selection.id);
      this.updateDisplay(selection, {
        chartType: args.chartType,
        state: loadMoreFromWikitree
          ? AppState.LOADING_MORE
          : AppState.SHOWING_CHART,
      });
      if (loadMoreFromWikitree) {
        try {
          const data = await loadWikiTree(
            args.selection!.id,
            this.context.intl,
          );
          const selection = getSelection(data.chartData, args.selection);
          this.setState(
            Object.assign({}, this.state, {
              state: AppState.SHOWING_CHART,
              data,
              selection,
            }),
          );
        } catch (error) {
          this.showErrorPopup(
            this.context.intl.formatMessage(
              {
                id: 'error.failed_wikitree_load_more',
                defaultMessage: 'Failed to load data from WikiTree. {error}',
              },
              {error},
            ),
            {state: AppState.SHOWING_CHART},
          );
        }
      }
    }
  }

  /**
   * Called when the user clicks an individual box in the chart.
   * Updates the browser URL.
   */
  private onSelection = (selection: IndiInfo) => {
    // Don't allow selecting WikiTree private profiles.
    if (selection.id.startsWith(PRIVATE_ID_PREFIX)) {
      return;
    }
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

  private showErrorPopup(message: string, otherStateChanges?: Partial<State>) {
    this.setState(
      Object.assign(
        {},
        this.state,
        {
          showErrorPopup: true,
          error: message,
        },
        otherStateChanges,
      ),
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

  private onDismissErrorPopup = () => {
    this.setState(
      Object.assign({}, this.state, {
        showErrorPopup: false,
      }),
    );
  };

  private renderMainArea = () => {
    switch (this.state.state) {
      case AppState.SHOWING_CHART:
      case AppState.LOADING_MORE:
        return (
          <div id="content">
            <ErrorPopup
              open={this.state.showErrorPopup}
              message={this.state.error}
              onDismiss={this.onDismissErrorPopup}
            />
            {this.state.state === AppState.LOADING_MORE ? (
              <Loader active size="small" className="loading-more" />
            ) : null}
            <Chart
              data={this.state.data!.chartData}
              selection={this.state.selection!}
              chartType={this.state.chartType}
              onSelection={this.onSelection}
              freezeAnimation={this.state.freezeAnimation}
              ref={(ref) => (this.chartRef = ref)}
            />
            {this.state.showSidePanel ? (
              <Responsive minWidth={768} id="sidePanel">
                <Details
                  gedcom={this.state.data!.gedcom}
                  indi={this.state.selection!.id}
                />
              </Responsive>
            ) : null}
          </div>
        );

      case AppState.ERROR:
        return <ErrorMessage message={this.state.error!} />;

      case AppState.INITIAL:
      case AppState.LOADING:
        return <Loader active size="large" />;
    }
  };

  render() {
    return (
      <>
        <Route
          render={(props: RouteComponentProps) => (
            <TopBar
              {...props}
              data={this.state.data && this.state.data.chartData}
              allowAllRelativesChart={
                this.state.sourceSpec?.source !== DataSourceEnum.WIKITREE
              }
              showingChart={
                this.props.history.location.pathname === '/view' &&
                (this.state.state === AppState.SHOWING_CHART ||
                  this.state.state === AppState.LOADING_MORE)
              }
              standalone={this.state.standalone}
              eventHandlers={{
                onSelection: this.onSelection,
                onPrint: this.onPrint,
                onDownloadPdf: this.onDownloadPdf,
                onDownloadPng: this.onDownloadPng,
                onDownloadSvg: this.onDownloadSvg,
              }}
              showWikiTreeMenus={
                this.state.sourceSpec?.source === DataSourceEnum.WIKITREE
              }
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
