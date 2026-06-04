import debounce from 'debounce';
import {useEffect, useRef, useState} from 'react';
import {useIntl} from 'react-intl';
import {Search, SearchResultProps} from 'semantic-ui-react';
import {IndiInfo, JsonGedcomData, JsonIndi} from 'topola';
import {analyticsEvent} from '../util/analytics';
import {formatDateOrRange} from '../util/date_util';
import {buildSearchIndex, SearchIndex, SearchResult} from './search_index';

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

/** Displays and handles the search box in the top bar. */
export function SearchBar(props: Props) {
  const [searchResults, setSearchResults] = useState<SearchResultProps[]>([]);
  const [searchString, setSearchString] = useState('');
  const searchIndex = useRef<SearchIndex | undefined>(undefined);
  const intl = useIntl();

  function getDescriptionLine(indi: JsonIndi) {
    const birthDate = formatDateOrRange(indi.birth, intl);
    const deathDate = formatDateOrRange(indi.death, intl);
    if (!deathDate) {
      return birthDate;
    }
    return `${birthDate} – ${deathDate}`;
  }

  /** Produces an object that is displayed in the Semantic UI Search results. */
  function displaySearchResult(result: SearchResult): SearchResultProps {
    return {
      id: result.id,
      key: result.id,
      title: getNameLine(result),
      description: getDescriptionLine(result.indi),
    } as SearchResultProps;
  }

  /** Returns the index, building it on first use to avoid blocking the initial render. */
  function getOrBuildIndex(): SearchIndex {
    if (!searchIndex.current) {
      searchIndex.current = buildSearchIndex(props.data);
    }
    return searchIndex.current;
  }

  /** On search input change. */
  function handleSearch(input: string | undefined) {
    if (!input) {
      return;
    }
    const results = getOrBuildIndex()
      .search(input)
      .map((result) => displaySearchResult(result));
    setSearchResults(results);
  }
  const debouncedHandleSearch = useRef(debounce(handleSearch, 200));

  /** On search result selected. */
  function handleResultSelect(id: string) {
    analyticsEvent('search_result_selected');
    props.onSelection({id, generation: 0});
    setSearchString('');
  }

  /** On search string changed. */
  function onChange(value: string | undefined) {
    debouncedHandleSearch.current(value);
    setSearchString(value || '');
  }

  // When data changes, reset the index and schedule a background rebuild so
  // the first keystroke doesn't block the UI. Falls back to a 200ms timeout
  // if requestIdleCallback is unavailable (e.g. Firefox 115, Safari 16).
  useEffect(() => {
    searchIndex.current = undefined;
    const build = () => {
      searchIndex.current = buildSearchIndex(props.data);
    };
    if (typeof requestIdleCallback !== 'undefined') {
      const handle = requestIdleCallback(build, {timeout: 5000});
      return () => cancelIdleCallback(handle);
    }
    const handle = setTimeout(build, 200);
    return () => clearTimeout(handle);
  }, [props.data]);

  return (
    <Search
      onSearchChange={(_, data) => onChange(data.value)}
      onResultSelect={(_, data) => handleResultSelect(data.result.id)}
      results={searchResults}
      noResultsMessage={intl.formatMessage({
        id: 'menu.search.no_results',
        defaultMessage: 'No results found',
      })}
      placeholder={intl.formatMessage({
        id: 'menu.search.placeholder',
        defaultMessage: 'Search for people',
      })}
      selectFirstResult={true}
      value={searchString}
      id="search"
    />
  );
}
