import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {IntlShape} from 'react-intl';
import {useLocation, useNavigate} from 'react-router';
import {IndiInfo} from 'topola';
import {DataSourceEnum, SourceSelection} from '../datasource/data_source';
import {EmbeddedSourceSpec} from '../datasource/embedded';
import {
  GoogleDriveAuthError,
  GoogleDriveSourceSpec,
} from '../datasource/google_drive';
import {isGoogleDriveConfigured} from '../datasource/google_drive_service';
import {
  embeddedDataSource,
  gedcomUrlDataSource,
  googleDriveDataSource,
  uploadedDataSource,
} from '../datasource/instances';
import {
  getSelection,
  revokeObjectUrls,
  UploadSourceSpec,
  UrlSourceSpec,
} from '../datasource/load_data';
import {
  loadWikiTree,
  WikiTreeDataSource,
  WikiTreeSourceSpec,
} from '../datasource/wikitree';
import {AppState} from '../pages/view_page';
import {getI18nMessage} from '../util/error_i18n';
import {TopolaData} from '../util/gedcom_util';
import {DataSourceSpec, getArguments} from '../util/url_args';

/**
 * Custom React hook that orchestrates loading genealogy data from various sources
 * (Uploaded files, Google Drive, WikiTree API, URL params, or Embedded data).
 * It manages the async lifecycle, error boundary popups, and incremental WikiTree loading.
 */
export function useGenealogyLoader(options: {
  intl: IntlShape;
  urlSelection?: IndiInfo;
  urlDetail?: string;
  /** Callback triggered when a Google Drive authorization error occurs. */
  onAuthError: (fileId: string) => void;
}) {
  const {intl, urlSelection, urlDetail, onAuthError} = options;
  const navigate = useNavigate();
  const location = useLocation();

  const [state, setState] = useState<AppState>(AppState.INITIAL);
  const [loadingStatus, setLoadingStatus] = useState('Loading…');
  const [data, setData] = useState<TopolaData>();
  const [error, setError] = useState<string>();
  const [showErrorPopup, setShowErrorPopup] = useState(false);
  const [sourceSpec, setSourceSpec] = useState<DataSourceSpec>();

  const isMountedRef = useRef(true);
  const fetchIdRef = useRef(0);
  const loadedSelectionRef = useRef<IndiInfo>();

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const wikiTreeDataSource = useMemo(
    () => new WikiTreeDataSource(intl),
    [intl],
  );

  const isNewData = useCallback(
    (newSourceSpec: DataSourceSpec, newSelection?: IndiInfo) => {
      if (!sourceSpec || sourceSpec.source !== newSourceSpec.source) {
        return true;
      }
      const newSource = {spec: newSourceSpec, selection: newSelection};
      const oldSource = {
        spec: sourceSpec,
        selection: loadedSelectionRef.current,
      };
      switch (newSource.spec.source) {
        case DataSourceEnum.UPLOADED:
          return uploadedDataSource.isNewData(
            newSource as unknown as SourceSelection<UploadSourceSpec>,
            oldSource as unknown as SourceSelection<UploadSourceSpec>,
            data,
          );
        case DataSourceEnum.GEDCOM_URL:
          return gedcomUrlDataSource.isNewData(
            newSource as unknown as SourceSelection<UrlSourceSpec>,
            oldSource as unknown as SourceSelection<UrlSourceSpec>,
            data,
          );
        case DataSourceEnum.WIKITREE:
          return wikiTreeDataSource.isNewData(
            newSource as unknown as SourceSelection<WikiTreeSourceSpec>,
            oldSource as unknown as SourceSelection<WikiTreeSourceSpec>,
            data,
          );
        case DataSourceEnum.EMBEDDED:
          return embeddedDataSource.isNewData(
            newSource as unknown as SourceSelection<EmbeddedSourceSpec>,
            oldSource as unknown as SourceSelection<EmbeddedSourceSpec>,
            data,
          );
        case DataSourceEnum.GOOGLE_DRIVE:
          return googleDriveDataSource.isNewData(
            newSource as unknown as SourceSelection<GoogleDriveSourceSpec>,
            oldSource as unknown as SourceSelection<GoogleDriveSourceSpec>,
            data,
          );
        default:
          return false;
      }
    },
    [sourceSpec, data, wikiTreeDataSource],
  );

  const loadData = useCallback(
    (
      newSourceSpec: DataSourceSpec,
      newSelection?: IndiInfo,
      onProgress?: (status: string) => void,
    ) => {
      switch (newSourceSpec.source) {
        case DataSourceEnum.UPLOADED:
          return uploadedDataSource.loadData(
            {
              spec: newSourceSpec as UploadSourceSpec,
              selection: newSelection,
            },
            onProgress,
          );
        case DataSourceEnum.GEDCOM_URL:
          return gedcomUrlDataSource.loadData(
            {spec: newSourceSpec as UrlSourceSpec, selection: newSelection},
            onProgress,
          );
        case DataSourceEnum.WIKITREE:
          return wikiTreeDataSource.loadData(
            {
              spec: newSourceSpec as WikiTreeSourceSpec,
              selection: newSelection,
            },
            onProgress,
          );
        case DataSourceEnum.EMBEDDED:
          return embeddedDataSource.loadData(
            {
              spec: newSourceSpec as EmbeddedSourceSpec,
              selection: newSelection,
            },
            onProgress,
          );
        case DataSourceEnum.GOOGLE_DRIVE:
          if (!isGoogleDriveConfigured()) {
            throw new Error('Google Drive integration is not configured.');
          }
          return googleDriveDataSource.loadData(
            {
              spec: newSourceSpec as GoogleDriveSourceSpec,
              selection: newSelection,
            },
            onProgress,
          );
        default:
          throw new Error('Unsupported data source');
      }
    },
    [wikiTreeDataSource],
  );

  const setErrorMessage = useCallback((message: string) => {
    setError(message);
    setState(AppState.ERROR);
  }, []);

  const displayErrorPopup = useCallback((message: string) => {
    setShowErrorPopup(true);
    setError(message);
  }, []);

  const onDismissErrorPopup = useCallback(() => {
    setShowErrorPopup(false);
  }, []);

  const resetLoader = useCallback(() => {
    setState(AppState.INITIAL);
  }, []);

  const clearData = useCallback(() => {
    setData(undefined);
    loadedSelectionRef.current = undefined;
  }, []);

  const shouldTriggerNewLoad = useCallback(
    (newSourceSpec: DataSourceSpec, newSelection?: IndiInfo) => {
      return (
        (state === AppState.INITIAL ||
          isNewData(newSourceSpec, newSelection)) &&
        state !== AppState.LOADING &&
        state !== AppState.LOADING_MORE
      );
    },
    [state, isNewData],
  );

  const triggerNewLoad = useCallback(
    async (newSourceSpec: DataSourceSpec, newSelection?: IndiInfo) => {
      setState(AppState.LOADING);
      setSourceSpec(newSourceSpec);
      loadedSelectionRef.current = newSelection;
      const currentFetchId = ++fetchIdRef.current;
      setLoadingStatus('Loading…');
      try {
        const data = await loadData(newSourceSpec, newSelection, (status) => {
          if (isMountedRef.current) setLoadingStatus(status);
        });
        if (!isMountedRef.current || fetchIdRef.current !== currentFetchId) {
          return;
        }
        setLoadingStatus(
          `Rendering chart (${data.chartData.indis.length.toLocaleString()} people)…`,
        );
        setData(data);
        loadedSelectionRef.current = getSelection(data.chartData, newSelection);
        setState(AppState.SHOWING_CHART);
      } catch (error: unknown) {
        if (!isMountedRef.current || fetchIdRef.current !== currentFetchId) {
          return;
        }
        if (error instanceof GoogleDriveAuthError) {
          if (newSourceSpec.source === DataSourceEnum.GOOGLE_DRIVE) {
            onAuthError((newSourceSpec as GoogleDriveSourceSpec).fileId);
          }
        } else {
          setErrorMessage(getI18nMessage(error as Error, intl));
        }
      }
    },
    [intl, loadData, onAuthError, setErrorMessage],
  );

  const shouldTriggerWikiTreeLoadMore = useCallback(
    (newSourceSpec: DataSourceSpec, newSelection?: IndiInfo) => {
      if (state !== AppState.SHOWING_CHART && state !== AppState.LOADING_MORE) {
        return false;
      }
      return (
        newSourceSpec.source === DataSourceEnum.WIKITREE &&
        !!newSelection &&
        (!loadedSelectionRef.current ||
          loadedSelectionRef.current.id !== newSelection.id)
      );
    },
    [state],
  );

  const triggerWikiTreeLoadMore = useCallback(
    async (selection: IndiInfo) => {
      setState(AppState.LOADING_MORE);
      const currentFetchId = ++fetchIdRef.current;
      try {
        const data = await loadWikiTree(selection.id, intl);
        if (!isMountedRef.current || fetchIdRef.current !== currentFetchId) {
          return;
        }
        const newSelection = getSelection(data.chartData, selection);
        setData(data);
        loadedSelectionRef.current = newSelection;
        setState(AppState.SHOWING_CHART);
      } catch (error: unknown) {
        if (!isMountedRef.current || fetchIdRef.current !== currentFetchId) {
          return;
        }
        setState(AppState.SHOWING_CHART);
        displayErrorPopup(
          intl.formatMessage(
            {
              id: 'error.failed_wikitree_load_more',
              defaultMessage: 'Failed to load data from WikiTree. {error}',
            },
            {error: (error as Error).message || String(error)},
          ),
        );
      }
    },
    [intl, displayErrorPopup],
  );

  // Main data loading and updating side-effect
  useEffect(() => {
    if (location.pathname !== '/view') {
      if (state !== AppState.INITIAL) {
        setState(AppState.INITIAL);
      }
      setData(undefined);
      return;
    }

    const args = getArguments(location);
    if (!args.sourceSpec) {
      navigate({pathname: '/'}, {replace: true});
      return;
    }

    if (shouldTriggerNewLoad(args.sourceSpec, args.selection)) {
      triggerNewLoad(args.sourceSpec, args.selection);
    } else if (
      shouldTriggerWikiTreeLoadMore(args.sourceSpec, args.selection) &&
      args.selection
    ) {
      triggerWikiTreeLoadMore(args.selection);
    } else if (state === AppState.LOADING_MORE) {
      setState(AppState.SHOWING_CHART);
    }
  }, [
    location,
    state,
    navigate,
    shouldTriggerNewLoad,
    triggerNewLoad,
    shouldTriggerWikiTreeLoadMore,
    triggerWikiTreeLoadMore,
  ]);

  // Clean up object URLs created for uploaded images/files when the dataset
  // changes or the app unmounts to prevent memory leaks.
  useEffect(() => {
    return () => {
      revokeObjectUrls(data?.images);
    };
  }, [data]);

  const updatedSelection = useMemo(() => {
    return data ? getSelection(data.chartData, urlSelection) : undefined;
  }, [data, urlSelection]);

  const detailIndi = urlDetail || updatedSelection?.id;

  return {
    state,
    loadingStatus,
    data,
    error,
    showErrorPopup,
    sourceSpec,
    updatedSelection,
    detailIndi,
    loadedSelectionRef,
    onDismissErrorPopup,
    resetLoader,
    clearData,
    setLoadingStatus,
    displayErrorPopup,
  };
}
