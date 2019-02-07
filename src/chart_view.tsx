import * as queryString from 'query-string';
import * as React from 'react';
import md5 from 'md5';
import {Chart} from './chart';
import {convertGedcom} from './gedcom_util';
import {IndiInfo, JsonGedcomData} from 'topola';
import {Loader, Message} from 'semantic-ui-react';
import {RouteComponentProps} from 'react-router-dom';

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
 * Returns a valid IndiInfo object, either with the given indi and generation
 * or with an individual taken from the data and generation 0.
 */
function getSelection(
  data: JsonGedcomData,
  indi?: string,
  generation?: number,
): IndiInfo {
  return {
    id: indi || data.indis[0].id,
    generation: generation || 0,
  };
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
  loadedUrl?: string;
}

/** The main area of the application dedicated for rendering the family chart. */
export class ChartView extends React.Component<RouteComponentProps, State> {
  state: State = {loading: false};

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

  /** Loads a GEDCOM file from the given URL. */
  loadFromUrl(
    url: string,
    options: {
      handleCors?: boolean;
      indi?: string;
      generation?: number;
    } = {},
  ) {
    const cachedData = sessionStorage.getItem(url);
    if (cachedData) {
      const data = JSON.parse(cachedData);
      this.setState(
        Object.assign({}, this.state, {
          data,
          selection: getSelection(data, options.indi, options.generation),
          loadedUrl: url,
          loading: false,
          error: undefined,
          hash: undefined,
        }),
      );
      return;
    }

    this.setState(
      Object.assign({}, this.state, {
        loading: true,
        loadedUrl: url,
        data: undefined,
        error: undefined,
      }),
    );

    const urlToFetch = options.handleCors
      ? 'https://cors-anywhere.herokuapp.com/' + url
      : url;

    window.fetch(urlToFetch)
      .then((response) => {
        if (response.status !== 200) {
          return Promise.reject(new Error(response.statusText));
        }
        return response.text();
      })
      .then((data) =>
        this.setGedcom({
          gedcom: data,
          url,
          indi: options.indi,
          generation: options.generation,
        }),
      )
      .catch((e: Error) =>
        this.setState(
          Object.assign({}, this.state, {error: e.message, loading: false}),
        ),
      );
  }

  /**
   * Converts GEDCOM contents and sets the data in the state.
   * In case of an error reading the file, sets an error.
   */
  setGedcom(input: {
    gedcom: string;
    url?: string;
    indi?: string;
    generation?: number;
  }) {
    const hash = md5(input.gedcom);
    try {
      const data = convertGedcom(input.gedcom);
      const serializedData = JSON.stringify(data);
      sessionStorage.setItem(input.url || hash, serializedData);
      this.setState(
        Object.assign({}, this.state, {
          data,
          selection: getSelection(data, input.indi, input.generation),
          hash,
          loading: false,
          loadedUrl: input.url,
          error: undefined,
        }),
      );
    } catch (e) {
      this.setState(
        Object.assign({}, this.state, {
          data: undefined,
          selection: undefined,
          hash,
          loading: false,
          error: 'Failed to read GEDCOM file',
          loadedUrl: input.url,
        }),
      );
    }
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

    if (hash && hash !== this.state.hash) {
      // New "load from file" data.
      if (gedcom) {
        this.setGedcom({gedcom, indi, generation});
      } else {
        // Data is not present. Try loading from cache.
        const cachedData = sessionStorage.getItem(hash);
        if (cachedData) {
          const data = JSON.parse(cachedData);
          this.setState(
            Object.assign({}, this.state, {
              data,
              hash,
              selection: getSelection(data, indi, generation),
              error: undefined,
              loading: false,
              loadedUrl: undefined,
            }),
          );
        } else {
          // No data available. Redirect to main page.
          this.props.history.replace({pathname: '/'});
        }
      }
    } else if (!this.state.loading && url && this.state.loadedUrl !== url) {
      // New URL to load data from.
      this.loadFromUrl(url, {
        indi,
        generation,
        handleCors: url.startsWith('http'),
      });
    } else if (!url && !gedcom && hash !== this.state.hash) {
      this.props.history.replace({pathname: '/'});
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
        />
      );
    }
    if (this.state.error) {
      return <ErrorMessage message={this.state.error!} />;
    }
    return <Loader active size="large" />;
  }
}
