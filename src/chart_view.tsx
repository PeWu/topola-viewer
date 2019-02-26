import * as queryString from 'query-string';
import * as React from 'react';
import {Chart} from './chart';
import {IndiInfo, JsonGedcomData} from 'topola';
import {Loader, Message} from 'semantic-ui-react';
import {RouteComponentProps} from 'react-router-dom';
import {getSelection, loadFromUrl, loadGedcom} from './load_data';

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
  data?: JsonGedcomData;
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
}

/** The main area of the application dedicated for rendering the family chart. */
export class ChartView extends React.Component<RouteComponentProps, State> {
  state: State = {loading: false};
  chartRef: Chart | null = null;

  /**
   * Called when the user clicks an individual box in the chart.
   * Updates the browser URL.
   */
  onSelection = (selection: IndiInfo) => {
    const location = this.props.location;
    const search = queryString.parse(location.search);
    search.indi = selection.id;
    search.gen = String(selection.generation);
    location.search = queryString.stringify(search);
    this.props.history.push(location);
  };

  isNewData(hash: string | undefined, url: string | undefined): boolean {
    return (
      !!(hash && hash !== this.state.hash) || !!(url && this.state.url !== url)
    );
  }

  componentDidMount() {
    this.componentDidUpdate();
  }

  componentDidUpdate() {
    const gedcom = this.props.location.state && this.props.location.state.data;
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
    const handleCors = getParam('handleCors') !== 'false';

    if (!url && !hash) {
      this.props.history.replace({pathname: '/'});
    } else if (this.isNewData(hash, url)) {
      const loadedData = hash
        ? loadGedcom(hash, gedcom)
        : loadFromUrl(url!, handleCors);
      loadedData.then(
        (data) => {
          // Set state with data.
          this.setState(
            Object.assign({}, this.state, {
              data,
              hash,
              selection: getSelection(data, indi, generation),
              error: undefined,
              loading: false,
              url,
            }),
          );
        },
        (error) => {
          // Set error state.
          this.setState(
            Object.assign({}, this.state, {
              error: error.message,
              loading: false,
            }),
          );
        },
      );
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
    } else if (this.state.data && this.state.selection) {
      // Update selection if it has changed in the URL.
      const selection = getSelection(this.state.data, indi, generation);
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

  render() {
    if (this.state.data && this.state.selection) {
      return (
        <Chart
          data={this.state.data}
          onSelection={this.onSelection}
          selection={this.state.selection}
          ref={(ref) => (this.chartRef = ref)}
        />
      );
    }
    if (this.state.error) {
      return <ErrorMessage message={this.state.error!} />;
    }
    return <Loader active size="large" />;
  }

  /** Shows the print dialog to print the currently displayed chart. */
  print() {
    if (this.chartRef) {
      this.chartRef.print();
    }
  }

  downloadSvg() {
    if (this.chartRef) {
      this.chartRef.downloadSvg();
    }
  }

  downloadPng() {
    if (this.chartRef) {
      this.chartRef.downloadPng();
    }
  }
}
