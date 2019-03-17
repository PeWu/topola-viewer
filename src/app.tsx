import * as queryString from 'query-string';
import * as React from 'react';
import {analyticsEvent} from './analytics';
import {Chart} from './chart';
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

interface State {
  /** Loaded data. */
  data?: TopolaData;
  /** Selected individual. */
  selection?: IndiInfo;
  /** Hash of the GEDCOM contents. */
  hash?: string;
  /** Error to display. */
  error?: string;
  /** True if currently loading. */
  loading: boolean;
  /** URL of the data that is loaded or is being loaded. */
  url?: string;
  /** Whether the side panel is shoen. */
  showSidePanel?: boolean;
}

export class App extends React.Component<RouteComponentProps, {}> {
  state: State = {loading: false};
  chartRef: Chart | null = null;

  private isNewData(
    hash: string | undefined,
    url: string | undefined,
  ): boolean {
    return (
      !!(hash && hash !== this.state.hash) || !!(url && this.state.url !== url)
    );
  }

  componentDidMount() {
    this.componentDidUpdate();
  }

  async componentDidUpdate() {
    if (this.props.location.pathname !== '/view') {
      return;
    }
    const gedcom = this.props.location.state && this.props.location.state.data;
    const images =
      this.props.location.state && this.props.location.state.images;
    const search = queryString.parse(this.props.location.search);
    const getParam = (name: string) => {
      const value = search[name];
      return typeof value === 'string' ? value : undefined;
    };
    const url = getParam('url');
    const indi = getParam('indi');
    const parsedGen = Number(getParam('gen'));
    const generation = !isNaN(parsedGen) ? parsedGen : undefined;
    const hash = getParam('file');
    const handleCors = getParam('handleCors') !== 'false'; // True by default.
    const showSidePanel = getParam('sidePanel') !== 'false'; // True by default.

    if (!url && !hash) {
      this.props.history.replace({pathname: '/'});
    } else if (this.isNewData(hash, url)) {
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
          }),
        );
        const data = hash
          ? await loadGedcom(hash, gedcom, images)
          : await loadFromUrl(url!, handleCors);
        analyticsEvent(hash ? 'upload_file_loaded' : 'url_file_loaded');
        if (images && images.size) {
          analyticsEvent('images_uploaded');
        }
        const software = getSoftware(data.gedcom.head);
        if (software) {
          analyticsEvent('gedcom_software', {event_label: software});
        }

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
          }),
        );
      } catch (error) {
        analyticsEvent(hash ? 'upload_file_error' : 'url_file_error');
        // Set error state.
        this.setState(
          Object.assign({}, this.state, {
            error: error.message,
            loading: false,
          }),
        );
      }
    } else if (this.state.data && this.state.selection) {
      // Update selection if it has changed in the URL.
      const selection = getSelection(
        this.state.data.chartData,
        indi,
        generation,
      );
      if (
        this.state.selection.id !== selection.id ||
        this.state.selection.generation !== selection.generation
      ) {
        this.setState(
          Object.assign({}, this.state, {
            selection,
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
    const location = this.props.location;
    const search = queryString.parse(location.search);
    search.indi = selection.id;
    search.gen = String(selection.generation);
    location.search = queryString.stringify(search);
    this.props.history.push(location);
  };

  private renderMainArea = () => {
    if (this.state.data && this.state.selection) {
      return (
        <div id="content">
          <Chart
            data={this.state.data.chartData}
            onSelection={this.onSelection}
            selection={this.state.selection}
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
              showingChart={
                !!(
                  this.props.history.location.pathname === '/view' &&
                  this.state.data &&
                  this.state.selection
                )
              }
              onPrint={() => {
                analyticsEvent('print');
                this.chartRef && this.chartRef.print();
              }}
              onDownloadPdf={() => {
                analyticsEvent('download_pdf');
                this.chartRef && this.chartRef.downloadPdf();
              }}
              onDownloadPng={() => {
                analyticsEvent('download_png');
                this.chartRef && this.chartRef.downloadPng();
              }}
              onDownloadSvg={() => {
                analyticsEvent('download_svg');
                this.chartRef && this.chartRef.downloadSvg();
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
