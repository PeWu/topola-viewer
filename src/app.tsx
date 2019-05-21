import * as queryString from 'query-string';
import * as React from 'react';
import {analyticsEvent} from './analytics';
import {Chart, ChartType} from './chart';
import {Details} from './details';
import {getSelection, loadFromUrl, loadGedcom} from './load_data';
import {IndiInfo} from 'topola';
import {Intro} from './intro';
import {Loader, Message, Responsive} from 'semantic-ui-react';
import {Redirect, Route, RouteComponentProps, Switch} from 'react-router-dom';
import {TopBar} from './top_bar';
import {TopolaData, getSoftware} from './gedcom_util';

/** Shows an error message. */
export function ErrorMessage(props: {message: string}) {
  return (
    <Message negative className="error">
      <Message.Header>Failed to load file</Message.Header>
      <p>{props.message}</p>
    </Message>
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
}

export class App extends React.Component<RouteComponentProps, {}> {
  state: State = {
    loading: false,
    embedded: false,
    standalone: true,
    chartType: ChartType.Hourglass,
  };
  chartRef: Chart | null = null;

  private isNewData(
    hash: string | undefined,
    url: string | undefined,
    gedcom: string | undefined,
  ): boolean {
    return (
      !!(hash && hash !== this.state.hash) ||
      !!(url && this.state.url !== url) ||
      (!!gedcom && !this.state.loading && !this.state.data)
    );
  }

  /** Sets the state with a new individual selection and chart type. */
  private updateDisplay(selection: IndiInfo, chartType?: ChartType) {
    if (
      !this.state.selection ||
      this.state.selection.id !== selection.id ||
      this.state.selection!.generation !== selection.generation ||
      (chartType !== undefined && chartType !== this.state.chartType)
    ) {
      this.setState(
        Object.assign({}, this.state, {
          selection,
          chartType: chartType !== undefined ? chartType : this.state.chartType,
        }),
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

    const search = queryString.parse(this.props.location.search);
    const getParam = (name: string) => {
      const value = search[name];
      return typeof value === 'string' ? value : undefined;
    };

    const showSidePanel = getParam('sidePanel') !== 'false'; // True by default.
    const embedded = getParam('embedded') === 'true'; // False by default.

    if (embedded && !this.state.embedded) {
      this.setState(
        Object.assign({}, this.state, {
          embedded: true,
          standalone: false,
          showSidePanel,
        }),
      );
      // Notify the parent window that we are ready.
      window.parent.postMessage('ready', '*');
      window.addEventListener('message', (data) => this.onMessage(data.data));
    }
    if (embedded) {
      // If the app is embedded, do not run the normal loading code.
      return;
    }

    const url = getParam('url');
    const indi = getParam('indi');
    const parsedGen = Number(getParam('gen'));
    const generation = !isNaN(parsedGen) ? parsedGen : undefined;
    const hash = getParam('file');
    const handleCors = getParam('handleCors') !== 'false'; // True by default.
    const standalone = getParam('standalone') !== 'false'; // True by default.
    const view = getParam('view');
    // Hourglass is the default view.
    const chartType =
      view === 'relatives' ? ChartType.Relatives : ChartType.Hourglass;

    const gedcom = this.props.location.state && this.props.location.state.data;
    const images =
      this.props.location.state && this.props.location.state.images;

    if (!url && !hash) {
      this.props.history.replace({pathname: '/'});
    } else if (this.isNewData(hash, url, gedcom)) {
      try {
        // Set loading state.
        this.setState(
          Object.assign({}, this.state, {
            data: undefined,
            selection: undefined,
            hash,
            error: undefined,
            loading: true,
            url,
            standalone,
            chartType,
          }),
        );
        const data = hash
          ? await loadGedcom(hash, gedcom, images)
          : await loadFromUrl(url!, handleCors);

        const software = getSoftware(data.gedcom.head);
        analyticsEvent(hash ? 'upload_file_loaded' : 'url_file_loaded', {
          event_label: software,
          event_value: (images && images.size) || 0,
        });

        // Set state with data.
        this.setState(
          Object.assign({}, this.state, {
            data,
            hash,
            selection: getSelection(data.chartData, indi, generation),
            error: undefined,
            loading: false,
            url,
            showSidePanel,
            standalone,
            chartType,
          }),
        );
      } catch (error) {
        analyticsEvent(hash ? 'upload_file_error' : 'url_file_error');
        this.setError(error.message);
      }
    } else if (this.state.data && this.state.selection) {
      // Update selection if it has changed in the URL.
      const selection = getSelection(
        this.state.data.chartData,
        indi,
        generation,
      );
      this.updateDisplay(selection, chartType);
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

  private onDownloadPdf = () => {
    analyticsEvent('download_pdf');
    this.chartRef && this.chartRef.downloadPdf();
  };

  private onDownloadPng = () => {
    analyticsEvent('download_png');
    this.chartRef && this.chartRef.downloadPng();
  };

  private onDownloadSvg = () => {
    analyticsEvent('download_svg');
    this.chartRef && this.chartRef.downloadSvg();
  };

  private renderMainArea = () => {
    if (this.state.data && this.state.selection) {
      return (
        <div id="content">
          <Chart
            data={this.state.data.chartData}
            selection={this.state.selection}
            chartType={this.state.chartType}
            onSelection={this.onSelection}
            ref={(ref) => (this.chartRef = ref)}
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
