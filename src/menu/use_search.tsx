import {useCallback, useEffect, useRef, useState} from 'react';
import {IndiInfo, JsonGedcomData} from 'topola';
import {analyticsEvent} from '../util/analytics';
import {buildSearchIndex, SearchIndex, SearchResult} from './search_index';
import {useSearchShortcut} from './use_search_shortcut';

/**
 * Schedules a task to run during browser idle time, falling back to setTimeout.
 * @returns A function that cancels the scheduled task.
 */
function scheduleIdleTask(callback: () => void, timeout = 5000): () => void {
  if (typeof requestIdleCallback !== 'undefined') {
    const handle = requestIdleCallback(callback, {timeout});
    return () => cancelIdleCallback(handle);
  }
  const handle = setTimeout(callback, 200);
  return () => clearTimeout(handle);
}

interface UseSearchProps {
  /** Data used for the search index. */
  data?: JsonGedcomData;
  /** Callback triggered when a search result is selected. */
  onSelection?: (indiInfo: IndiInfo) => void;
}

interface UseSearchResult {
  /** The list of search results matching the current query. */
  searchResults: SearchResult[];
  /** The current search query string. */
  searchString: string;
  /** Sets the search query string. */
  setSearchString: (value: string) => void;
  /** Callback triggered when a search result is selected. */
  handleResultSelect: (id: string) => void;
}

/**
 * Encapsulates search index building, debounced querying, result selection,
 * and global keyboard shortcut registration for the TopBar.
 * @returns An object containing search results, search string state, and callbacks.
 */
export function useSearch({
  data,
  onSelection,
}: UseSearchProps): UseSearchResult {
  useSearchShortcut();

  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchString, setSearchString] = useState('');
  const searchIndex = useRef<SearchIndex | undefined>(undefined);
  const latestDataRef = useRef(data);
  latestDataRef.current = data;

  // Build search index once for both desktop and mobile search bars
  useEffect(() => {
    searchIndex.current = undefined;
    if (!data) {
      return;
    }
    const currentData = data;
    const build = () => {
      if (!searchIndex.current) {
        searchIndex.current = buildSearchIndex(currentData);
      }
    };
    return scheduleIdleTask(build);
  }, [data]);

  // Debounced search effect
  useEffect(() => {
    if (!searchString) {
      setSearchResults((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    const handle = setTimeout(() => {
      const currentData = latestDataRef.current;
      if (!currentData) {
        return;
      }
      if (!searchIndex.current) {
        searchIndex.current = buildSearchIndex(currentData);
      }
      const index = searchIndex.current;
      const results = index.search(searchString);
      setSearchResults(results);
    }, 200);
    return () => clearTimeout(handle);
  }, [searchString]);

  const handleResultSelect = useCallback(
    (id: string) => {
      analyticsEvent('search_result_selected');
      onSelection?.({id, generation: 0});
      setSearchString('');
      setSearchResults([]);
    },
    [onSelection],
  );

  return {
    searchResults,
    searchString,
    setSearchString,
    handleResultSelect,
  };
}
