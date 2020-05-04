import * as React from 'react';
import debounce from 'debounce';
import {analyticsEvent} from '../util/analytics';
import {buildSearchIndex, SearchIndex, SearchResult} from './search_index';
import {formatDateOrRange} from '../util/date_util';
import {IndiInfo, JsonGedcomData} from 'topola';
import {intlShape} from 'react-intl';
import {JsonIndi} from 'topola';
import {RouteComponentProps} from 'react-router-dom';
import {Search, SearchProps, SearchResultProps} from 'semantic-ui-react';

function getNameLine(result: SearchResult) {
  const name = [result.indi.firstName, result.indi.lastName].join(' ').trim();
  if (result.id.length > 8) {
    return name;
  }
  return (
    <>
      {name} <i>({result.id})</i>
    </>
  );
}

interface Props {
  /** Data used for the search index. */
  data: JsonGedcomData;
  onSelection: (indiInfo: IndiInfo) => void;
}

interface State {
  searchResults: SearchResultProps[];
}

/** Displays and handles the search box in the top bar. */
export class SearchBar extends React.Component<
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

  private getDescriptionLine(indi: JsonIndi) {
    const birthDate = formatDateOrRange(indi.birth, this.context.intl);
    const deathDate = formatDateOrRange(indi.death, this.context.intl);
    if (!deathDate) {
      return birthDate;
    }
    return `${birthDate} – ${deathDate}`;
  }

  /** Produces an object that is displayed in the Semantic UI Search results. */
  private displaySearchResult(result: SearchResult) {
    return {
      id: result.id,
      key: result.id,
      title: getNameLine(result),
      description: this.getDescriptionLine(result.indi),
    };
  }

  /** On search input change. */
  private handleSearch(input: string | undefined) {
    if (!input) {
      return;
    }
    const results = this.searchIndex!.search(input).map((result) =>
      this.displaySearchResult(result),
    );
    this.setState(Object.assign({}, this.state, {searchResults: results}));
  }

  /** On search result selected. */
  private handleResultSelect(id: string) {
    analyticsEvent('search_result_selected');
    this.props.onSelection({id, generation: 0});
    this.searchRef!.setValue('');
  }

  private initializeSearchIndex() {
    this.searchIndex = buildSearchIndex(this.props.data);
  }

  componentDidMount() {
    this.initializeSearchIndex();
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.data !== this.props.data) {
      this.initializeSearchIndex();
    }
  }

  render() {
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
}
