import queryString from 'query-string';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useIntl} from 'react-intl';
import {Navigate, Route, Routes, useLocation, useNavigate} from 'react-router';
import {Loader, SidebarPushable, SidebarPusher} from 'semantic-ui-react';
import {IndiInfo} from 'topola';
import {
  Chart,
  ChartType,
  downloadPdf,
  downloadPng,
  downloadSvg,
  printChart,
} from './chart';
import {ErrorMessage, ErrorPopup} from './components/error_display';
import {DataSourceEnum, SourceSelection} from './datasource/data_source';
import {EmbeddedSourceSpec} from './datasource/embedded';
import {
  GoogleDriveAuthError,
  GoogleDriveSourceSpec,
} from './datasource/google_drive';
import {
  clearGoogleDriveCache,
  googleDriveService,
  isGoogleDriveConfigured,
} from './datasource/google_drive_service';
import {
  embeddedDataSource,
  gedcomUrlDataSource,
  googleDriveDataSource,
  uploadedDataSource,
} from './datasource/instances';
import {
  getSelection,
  revokeObjectUrls,
  UploadSourceSpec,
  UrlSourceSpec,
} from './datasource/load_data';
import {
  loadWikiTree,
  PRIVATE_ID_PREFIX,
  WikiTreeDataSource,
  WikiTreeSourceSpec,
} from './datasource/wikitree';
import {DonatsoChart} from './donatso-chart';
import {useGoogleAuth} from './hooks/use_google_auth';
import {useWebMcpBridge} from './hooks/use_webmcp_bridge';
import {Intro} from './intro';
import {GoogleAuthModal} from './menu/google_auth_modal';
import {TopBar} from './menu/top_bar';
import {Config, configToArgs, Ids, Sex} from './sidepanel/config/config';
import {SidePanel} from './sidepanel/side-panel';
import {analyticsEvent} from './util/analytics';
import {TopolaError} from './util/error';
import {getI18nMessage} from './util/error_i18n';
import {idToIndiMap, TopolaData} from './util/gedcom_util';
import {
  DataSourceSpec,
  getArguments,
  getStaticUrl,
  getUrlForArgs,
} from './util/url_args';

const staticUrl = getStaticUrl();

enum AppState {
  INITIAL,
  LOADING,
  ERROR,
  SHOWING_CHART,
  LOADING_MORE,
}

export function App() {
  /** State of the application. */
  const [state, setState] = useState<AppState>(AppState.INITIAL);
  /** Progress message shown during LOADING and initial chart render. */
  const [loadingStatus, setLoadingStatus] = useState('Loading…');
  /** Loaded data. */
  const [data, setData] = useState<TopolaData>();

  /** Error to display. */
  const [error, setError] = useState<string>();

  /** Whether to show the error popup. */
  const [showErrorPopup, setShowErrorPopup] = useState(false);
  /** Specification of the source of the data. */
  const [sourceSpec, setSourceSpec] = useState<DataSourceSpec>();

  /** Controls the visibility of the Google Drive OAuth permission modal. */
  const [showAuthModal, setShowAuthModal] = useState(false);
  /** Stores the file ID that failed to load from Google Drive due to authorization errors. */
  const [failedFileId, setFailedFileId] = useState<string>();
  /** Tracks whether the user has a valid cached Google Drive OAuth access token and provides a state setter. */
  const {hasGoogleToken, setHasGoogleToken} = useGoogleAuth();

  const intl = useIntl();
  const navigate = useNavigate();
  const location = useLocation();

  const args = useMemo(() => getArguments(location), [location]);
  /** Type of displayed chart. */
  const chartType = args.chartType;
  /** Whether the app is in standalone mode, i.e. showing 'open file' menus. */
  const standalone = args.standalone;
  /**
   * Whether the app should display WikiTree-specific menus when showing data
   * from WikiTree.
   */
  const showWikiTreeMenus = args.showWikiTreeMenus;
  /** Freeze animations after initial chart render. */
  const freezeAnimation = args.freezeAnimation;
  /** Whether the side panel is shown. */
  const showSidePanel = args.showSidePanel;
  /** Configuration settings for chart display options (e.g. colors, hiding IDs). */
  const config = args.config;

  useMemo(() => {
    updateChartWithConfig(config, data);
  }, [config, data]);
  /** The currently selected individual. Fallback to default individual from loaded data if not specified. */
  const updatedSelection = useMemo(() => {
    return data ? getSelection(data.chartData, args.selection) : undefined;
  }, [data, args.selection]);
  /** The individual displayed in the details pane. */
  const detailIndi = args.detail || updatedSelection?.id;

  /** Prevents the Google Drive "Open with" state from being processed more than once. */
  const stateProcessed = useRef(false);
  /** Tracks whether the component is currently mounted to prevent state updates after unmount. */
  const isMountedRef = useRef(true);
  /** Incremented with each load request to ensure only the latest asynchronous load result is applied. */
  const fetchIdRef = useRef(0);
  /** Tracks the currently loaded selection to check if new data needs to be fetched. */
  const loadedSelectionRef = useRef<IndiInfo>();

  /** Manages the mount lifecycle ref to avoid setting state on unmounted components. */
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  function updateChartWithConfig(config: Config, data: TopolaData | undefined) {
    if (data === undefined) {
      return;
    }
    const shouldHideIds = config.id === Ids.HIDE;
    const shouldHideSex = config.sex === Sex.HIDE;
    const indiMap = idToIndiMap(data.chartData);
    indiMap.forEach((indi) => {
      indi.hideId = shouldHideIds;
      indi.hideSex = shouldHideSex;
    });
  }

  function onToggleSidePanel() {
    const newShowSidePanel = !showSidePanel;
    updateUrl(
      {
        sidePanel: newShowSidePanel ? 'true' : 'false',
      },
      {replace: true},
    );
  }

  /** Sets error message after data load failure. */
  function setErrorMessage(message: string) {
    setError(message);
    setState(AppState.ERROR);
  }

  const wikiTreeDataSource = useMemo(
    () => new WikiTreeDataSource(intl),
    [intl],
  );

  const isNewData = useCallback(
    (newSourceSpec: DataSourceSpec, newSelection?: IndiInfo) => {
      if (!sourceSpec || sourceSpec.source !== newSourceSpec.source) {
        // New data source means new data.
        return true;
      }
      const newSource = {spec: newSourceSpec, selection: newSelection};
      const oldSouce = {
        spec: sourceSpec,
        selection: loadedSelectionRef.current,
      };
      switch (newSource.spec.source) {
        case DataSourceEnum.UPLOADED:
          return uploadedDataSource.isNewData(
            newSource as SourceSelection<UploadSourceSpec>,
            oldSouce as SourceSelection<UploadSourceSpec>,
            data,
          );
        case DataSourceEnum.GEDCOM_URL:
          return gedcomUrlDataSource.isNewData(
            newSource as SourceSelection<UrlSourceSpec>,
            oldSouce as SourceSelection<UrlSourceSpec>,
            data,
          );
        case DataSourceEnum.WIKITREE:
          return wikiTreeDataSource.isNewData(
            newSource as SourceSelection<WikiTreeSourceSpec>,
            oldSouce as SourceSelection<WikiTreeSourceSpec>,
            data,
          );
        case DataSourceEnum.EMBEDDED:
          return embeddedDataSource.isNewData(
            newSource as SourceSelection<EmbeddedSourceSpec>,
            oldSouce as SourceSelection<EmbeddedSourceSpec>,
            data,
          );
        case DataSourceEnum.GOOGLE_DRIVE:
          return googleDriveDataSource.isNewData(
            newSource as SourceSelection<GoogleDriveSourceSpec>,
            oldSouce as SourceSelection<GoogleDriveSourceSpec>,
            data,
          );
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
            {spec: newSourceSpec, selection: newSelection},
            onProgress,
          );
        case DataSourceEnum.GEDCOM_URL:
          return gedcomUrlDataSource.loadData(
            {spec: newSourceSpec, selection: newSelection},
            onProgress,
          );
        case DataSourceEnum.WIKITREE:
          return wikiTreeDataSource.loadData(
            {spec: newSourceSpec, selection: newSelection},
            onProgress,
          );
        case DataSourceEnum.EMBEDDED:
          return embeddedDataSource.loadData(
            {spec: newSourceSpec, selection: newSelection},
            onProgress,
          );
        case DataSourceEnum.GOOGLE_DRIVE:
          if (!isGoogleDriveConfigured()) {
            throw new TopolaError(
              'GOOGLE_DRIVE_NOT_CONFIGURED',
              'Google Drive integration is not configured.',
            );
          }
          return googleDriveDataSource.loadData(
            {
              spec: newSourceSpec as GoogleDriveSourceSpec,
              selection: newSelection,
            },
            onProgress,
          );
      }
    },
    [wikiTreeDataSource],
  );

  // Google Drive "Open with" flow state checking.
  useEffect(() => {
    const search = queryString.parse(location.search);
    const stateParam = search.state;
    if (typeof stateParam === 'string' && !stateProcessed.current) {
      try {
        const parsedState = JSON.parse(stateParam);
        if (
          parsedState &&
          parsedState.action === 'open' &&
          Array.isArray(parsedState.ids) &&
          parsedState.ids.length > 0
        ) {
          stateProcessed.current = true;
          const fileId = parsedState.ids[0];
          // Soft redirect to view file
          navigate(
            {
              pathname: '/view',
              search: queryString.stringify({
                source: 'google-drive',
                fileId,
              }),
            },
            {replace: true},
          );
        }
      } catch (err) {
        // Silently catch JSON parsing errors for state parameters not meant for us (e.g. from other auth tools)
        console.warn(
          'Google Drive state query parameter JSON parsing failed or action mismatch:',
          err,
        );
      }
    }
  }, [navigate, location.search]);

  async function onGoogleSignOut() {
    await googleDriveService.signOut();
    setHasGoogleToken(false);
    setData(undefined);
    loadedSelectionRef.current = undefined;
    // Purge sessionStorage keys starting with "google-drive:"
    clearGoogleDriveCache();
    navigate({pathname: '/'}, {replace: true});
  }

  useEffect(() => {
    (async () => {
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

      if (
        state === AppState.INITIAL ||
        isNewData(args.sourceSpec, args.selection)
      ) {
        // Set loading state.
        setState(AppState.LOADING);
        // Set state from URL parameters.
        setSourceSpec(args.sourceSpec);
        const currentFetchId = ++fetchIdRef.current;
        setLoadingStatus('Loading…');
        try {
          const data = await loadData(
            args.sourceSpec,
            args.selection,
            (status) => {
              if (isMountedRef.current) setLoadingStatus(status);
            },
          );
          if (!isMountedRef.current || fetchIdRef.current !== currentFetchId) {
            return;
          }
          // Show "Rendering chart…" while the initial D3 layout runs (which
          // happens in the Chart useEffect after SHOWING_CHART is set).
          setLoadingStatus(
            `Rendering chart (${data.chartData.indis.length.toLocaleString()} people)…`,
          );
          setData(data);
          loadedSelectionRef.current = getSelection(
            data.chartData,
            args.selection,
          );
          setState(AppState.SHOWING_CHART);
        } catch (error: unknown) {
          if (!isMountedRef.current || fetchIdRef.current !== currentFetchId) {
            return;
          }
          if (error instanceof GoogleDriveAuthError) {
            if (args.sourceSpec.source === DataSourceEnum.GOOGLE_DRIVE) {
              setFailedFileId(args.sourceSpec.fileId);
              setShowAuthModal(true);
            }
          } else {
            setErrorMessage(getI18nMessage(error as Error, intl));
          }
        }
      } else if (
        state === AppState.SHOWING_CHART ||
        state === AppState.LOADING_MORE
      ) {
        // Update selection if it has changed in the URL.
        const loadMoreFromWikitree =
          args.sourceSpec.source === DataSourceEnum.WIKITREE &&
          (!loadedSelectionRef.current ||
            loadedSelectionRef.current.id !== args.selection?.id);
        setState(
          loadMoreFromWikitree ? AppState.LOADING_MORE : AppState.SHOWING_CHART,
        );
        if (loadMoreFromWikitree) {
          const currentFetchId = ++fetchIdRef.current;
          try {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const data = await loadWikiTree(args.selection!.id, intl);
            if (
              !isMountedRef.current ||
              fetchIdRef.current !== currentFetchId
            ) {
              return;
            }
            const newSelection = getSelection(data.chartData, args.selection);
            setData(data);
            loadedSelectionRef.current = newSelection;
            setState(AppState.SHOWING_CHART);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } catch (error: any) {
            if (
              !isMountedRef.current ||
              fetchIdRef.current !== currentFetchId
            ) {
              return;
            }
            setState(AppState.SHOWING_CHART);
            displayErrorPopup(
              intl.formatMessage(
                {
                  id: 'error.failed_wikitree_load_more',
                  defaultMessage: 'Failed to load data from WikiTree. {error}',
                },
                {error},
              ),
            );
          }
        }
      }
    })();
  }, [location, state, data, navigate, intl, isNewData, loadData]);

  // Clean up object URLs created for uploaded images/files when the dataset
  // changes or the app unmounts to prevent memory leaks.
  useEffect(() => {
    return () => {
      revokeObjectUrls(data?.images);
    };
  }, [data]);

  useWebMcpBridge(data, detailIndi, onSelection);

  function updateUrl(
    args: Record<string, string | (string | null)[] | null | undefined>,
    options?: {replace?: boolean},
  ) {
    navigate(getUrlForArgs(location, args), options);
  }

  /**
   * Called when the user clicks an individual box in the chart.
   * Updates the browser URL.
   */
  function onSelection(selection: IndiInfo) {
    // Don't allow selecting WikiTree private profiles.
    if (selection.id.startsWith(PRIVATE_ID_PREFIX)) {
      return;
    }
    analyticsEvent('selection_changed');
    updateUrl({
      indi: selection.id,
      gen: String(selection.generation),
      detail: null,
    });
  }
  /**
   * Called when the user shift+clicks an individual box in the chart.
   * Shows the individual in the details pane.
   */
  function onDetailSelection(selection: IndiInfo) {
    updateUrl({
      detail: selection.id,
    });
  }

  function onPrint() {
    analyticsEvent('print');
    printChart();
  }

  function displayErrorPopup(message: string) {
    setShowErrorPopup(true);
    setError(message);
  }

  async function onDownloadPdf() {
    analyticsEvent('download_pdf');
    try {
      await downloadPdf();
    } catch (e) {
      displayErrorPopup(
        intl.formatMessage({
          id: 'error.failed_pdf',
          defaultMessage:
            'Failed to generate PDF file.' +
            ' Please try with a smaller diagram or download an SVG file.',
        }),
      );
    }
  }

  async function onDownloadPng() {
    analyticsEvent('download_png');
    try {
      await downloadPng();
    } catch (e) {
      displayErrorPopup(
        intl.formatMessage({
          id: 'error.failed_png',
          defaultMessage:
            'Failed to generate PNG file.' +
            ' Please try with a smaller diagram or download an SVG file.',
        }),
      );
    }
  }

  function onDownloadSvg() {
    analyticsEvent('download_svg');
    downloadSvg();
  }

  function onDismissErrorPopup() {
    setShowErrorPopup(false);
  }

  function renderChart(selection: IndiInfo) {
    if (!data) {
      return null;
    }
    if (chartType === ChartType.Donatso) {
      return (
        <DonatsoChart
          data={data.chartData}
          selection={selection}
          onSelection={onSelection}
          onFirstRender={() => setLoadingStatus('')}
        />
      );
    }
    return (
      <Chart
        data={data.chartData}
        selection={selection}
        chartType={chartType}
        onSelection={onSelection}
        onDetailSelection={onDetailSelection}
        freezeAnimation={freezeAnimation}
        colors={config.color}
        hideIds={config.id}
        hideSex={config.sex}
        placeDisplay={config.place}
        placeCount={config.placeCount}
        onFirstRender={() => setLoadingStatus('')}
      />
    );
  }

  function renderMainArea() {
    switch (state) {
      case AppState.SHOWING_CHART:
      case AppState.LOADING_MORE: {
        if (!data || !updatedSelection) {
          return null;
        }
        const selection = updatedSelection;
        return (
          <div id="content">
            <ErrorPopup
              open={showErrorPopup}
              message={error}
              onDismiss={onDismissErrorPopup}
            />
            {state === AppState.LOADING_MORE ? (
              <Loader active size="small" className="loading-more" />
            ) : null}
            <SidebarPushable>
              <SidePanel
                data={data}
                selectedIndiId={detailIndi || selection.id}
                config={config}
                expanded={showSidePanel}
                onToggle={onToggleSidePanel}
                onConfigChange={(config) => {
                  updateUrl(configToArgs(config), {replace: true});
                }}
              />
              <SidebarPusher>{renderChart(selection)}</SidebarPusher>
            </SidebarPushable>
          </div>
        );
      }

      case AppState.ERROR:
        return <ErrorMessage message={error || 'Unknown error'} />;

      case AppState.INITIAL:
      case AppState.LOADING:
        return <Loader active size="large" />;
    }
  }

  const progressPill =
    loadingStatus &&
    (state === AppState.LOADING || state === AppState.SHOWING_CHART) ? (
      <div
        style={{
          position: 'fixed',
          bottom: 16,
          left: 16,
          background: 'rgba(0,0,0,0.7)',
          color: '#fff',
          padding: '6px 12px',
          borderRadius: 4,
          fontFamily: 'monospace',
          fontSize: 12,
          zIndex: 9999,
          pointerEvents: 'none',
        }}
      >
        {loadingStatus}
      </div>
    ) : null;

  return (
    <>
      {progressPill}
      <TopBar
        data={data?.chartData}
        allowAllRelativesChart={sourceSpec?.source !== DataSourceEnum.WIKITREE}
        allowPrintAndDownload={chartType !== ChartType.Donatso}
        showingChart={
          location.pathname === '/view' &&
          (state === AppState.SHOWING_CHART || state === AppState.LOADING_MORE)
        }
        standalone={standalone}
        eventHandlers={{
          onSelection,
          onPrint,
          onDownloadPdf,
          onDownloadPng,
          onDownloadSvg,
        }}
        showWikiTreeMenus={
          sourceSpec?.source === DataSourceEnum.WIKITREE && showWikiTreeMenus
        }
        hasGoogleToken={hasGoogleToken}
        onGoogleSignOut={onGoogleSignOut}
        onGoogleTokenAcquired={() => setHasGoogleToken(true)}
      />
      {staticUrl ? (
        <Routes>
          <Route path="/view" element={renderMainArea()} />
          <Route path="*" element={<Navigate to="/view" replace />} />
        </Routes>
      ) : (
        <Routes>
          <Route path="/" element={<Intro />} />
          <Route path="/view" element={renderMainArea()} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      )}
      {showAuthModal && failedFileId && (
        <GoogleAuthModal
          failedFileId={failedFileId}
          onAuthSuccess={(fileId) => {
            setShowAuthModal(false);
            setHasGoogleToken(true);
            if (fileId === failedFileId) {
              setState(AppState.INITIAL);
            } else {
              navigate(
                {
                  pathname: '/view',
                  search: queryString.stringify({
                    source: 'google-drive',
                    fileId,
                  }),
                },
                {replace: true},
              );
            }
          }}
          onCancel={() => {
            setShowAuthModal(false);
            navigate({pathname: '/'}, {replace: true});
          }}
        />
      )}
    </>
  );
}
