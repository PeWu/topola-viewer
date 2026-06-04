import * as H from 'history';
import queryString from 'query-string';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {Navigate, Route, Routes, useLocation, useNavigate} from 'react-router';
import {
  Loader,
  Message,
  Portal,
  SidebarPushable,
  SidebarPusher,
} from 'semantic-ui-react';
import {IndiInfo} from 'topola';
import {
  Chart,
  ChartType,
  downloadPdf,
  downloadPng,
  downloadSvg,
  printChart,
} from './chart';
import {DataSourceEnum, SourceSelection} from './datasource/data_source';
import {EmbeddedDataSource, EmbeddedSourceSpec} from './datasource/embedded';
import {
  GoogleDriveAuthError,
  GoogleDriveDataSource,
  GoogleDriveSourceSpec,
} from './datasource/google_drive';
import {
  clearGoogleDriveCache,
  googleDriveService,
  isGoogleDriveConfigured,
} from './datasource/google_drive_service';
import {
  GedcomUrlDataSource,
  getSelection,
  revokeObjectUrls,
  UploadedDataSource,
  UploadLocationState,
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
import {Intro} from './intro';
import {GoogleAuthModal} from './menu/google_auth_modal';
import {TopBar} from './menu/top_bar';
import {
  argsToConfig,
  Config,
  configToArgs,
  DEFALUT_CONFIG,
  Ids,
  Sex,
} from './sidepanel/config/config';
import {SidePanel} from './sidepanel/side-panel';
import {analyticsEvent} from './util/analytics';
import {TopolaError} from './util/error';
import {getI18nMessage} from './util/error_i18n';
import {idToIndiMap, TopolaData} from './util/gedcom_util';
import {WebMcpBridge} from './webmcp';

/**
 * Load GEDCOM URL from environment variable (Vite VITE_STATIC_URL or dynamically
 * injected via a meta tag from Caddy server).
 *
 * If this static URL is provided, the viewer is switched to
 * single-tree mode without the option to load other data.
 */
function getStaticUrl(): string | undefined {
  const envUrl = import.meta.env.VITE_STATIC_URL;
  if (envUrl) return envUrl;

  const metaTag = document.querySelector('meta[name="topola-static-url"]');
  const metaUrl = metaTag?.getAttribute('content');
  // Safely ignore if it is empty, the raw caddy template expression, or Vite's raw template placeholder
  if (metaUrl && !metaUrl.startsWith('__') && !metaUrl.includes('{{ env')) {
    return metaUrl;
  }

  return undefined;
}

const staticUrl = getStaticUrl();

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

type DataSourceSpec =
  | UrlSourceSpec
  | UploadSourceSpec
  | WikiTreeSourceSpec
  | EmbeddedSourceSpec
  | GoogleDriveSourceSpec;

/**
 * Arguments passed to the application, primarily through URL parameters.
 * Non-optional arguments get populated with default values.
 */
interface Arguments {
  sourceSpec?: DataSourceSpec;
  selection?: IndiInfo;
  chartType: ChartType;
  standalone: boolean;
  showWikiTreeMenus: boolean;
  freezeAnimation: boolean;
  showSidePanel: boolean;
  config: Config;
}

function getParamFromSearch(name: string, search: queryString.ParsedQuery) {
  const value = search[name];
  return typeof value === 'string' ? value : undefined;
}

/**
 * Retrieve arguments passed into the application through the URL and uploaded
 * data.
 */
function getArguments(location: H.Location<UploadLocationState>): Arguments {
  const search = queryString.parse(location.search);
  const getParam = (name: string) => getParamFromSearch(name, search);

  const view = getParam('view');
  const chartTypes = new Map<string | undefined, ChartType>([
    ['relatives', ChartType.Relatives],
    ['fancy', ChartType.Fancy],
    ['donatso', ChartType.Donatso],
  ]);

  const hash = getParam('file');
  const url = getParam('url');
  const embedded = getParam('embedded') === 'true'; // False by default.
  let sourceSpec: DataSourceSpec | undefined = undefined;
  if (staticUrl) {
    sourceSpec = {
      source: DataSourceEnum.GEDCOM_URL,
      url: staticUrl,
      handleCors: false,
    };
  } else if (getParam('source') === 'wikitree') {
    const windowSearch = queryString.parse(window.location.search);
    sourceSpec = {
      source: DataSourceEnum.WIKITREE,
      authcode:
        getParam('authcode') || getParamFromSearch('authcode', windowSearch),
    };
  } else if (getParam('source') === 'google-drive') {
    const fileId = getParam('fileId');
    if (fileId) {
      sourceSpec = {
        source: DataSourceEnum.GOOGLE_DRIVE,
        fileId,
      };
    }
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
  } else if (embedded) {
    sourceSpec = {source: DataSourceEnum.EMBEDDED};
  }

  const indi = getParam('indi');
  const parsedGen = Number(getParam('gen'));
  const selection = indi
    ? {id: indi, generation: !isNaN(parsedGen) ? parsedGen : 0}
    : undefined;

  /**
   * Determines whether the side panel should be shown taking into account the
   * URL parameter and the viewport size.
   *
   * On mobile devices (max-width: 767px), the side panel is hidden by default.
   * On tablet and desktop, the side panel is shown by default.
   */
  function getShowSidePanel() {
    if (window.matchMedia('(max-width: 767px)').matches) {
      // On mobile, hide the side panel by default.
      return getParam('sidePanel') === 'true';
    }
    // On tablet and desktop, show the side panel by default.
    return getParam('sidePanel') !== 'false';
  }

  return {
    sourceSpec,
    selection,
    // Hourglass is the default view.
    chartType: chartTypes.get(view) || ChartType.Hourglass,

    showSidePanel: getShowSidePanel(),
    standalone: getParam('standalone') !== 'false' && !embedded && !staticUrl,
    showWikiTreeMenus: getParam('showWikiTreeMenus') !== 'false', // True by default.
    freezeAnimation: getParam('freeze') === 'true', // False by default
    config: argsToConfig(search),
  };
}

const uploadedDataSource = new UploadedDataSource();
const gedcomUrlDataSource = new GedcomUrlDataSource();
const embeddedDataSource = new EmbeddedDataSource();
const googleDriveDataSource = new GoogleDriveDataSource();

export function App() {
  /** State of the application. */
  const [state, setState] = useState<AppState>(AppState.INITIAL);
  /** Loaded data. */
  const [data, setData] = useState<TopolaData>();
  /** Selected individual. */
  const [selection, setSelection] = useState<IndiInfo>();
  /** Selected individual which should be displayed in the details pane. */
  const [detailIndi, setDetailIndi] = useState<string>();
  /** Error to display. */
  const [error, setError] = useState<string>();
  /** Whether the side panel is shown. */
  const [showSidePanel, setShowSidePanel] = useState(false);
  /** Whether the app is in standalone mode, i.e. showing 'open file' menus. */
  const [standalone, setStandalone] = useState(true);
  /**
   * Whether the app should display WikiTree-specific menus when showing data
   * from WikiTree.
   */
  const [showWikiTreeMenus, setShowWikiTreeMenus] = useState(true);
  /** Type of displayed chart. */
  const [chartType, setChartType] = useState<ChartType>(ChartType.Hourglass);
  /** Whether to show the error popup. */
  const [showErrorPopup, setShowErrorPopup] = useState(false);
  /** Specification of the source of the data. */
  const [sourceSpec, setSourceSpec] = useState<DataSourceSpec>();
  /** Freeze animations after initial chart render. */
  const [freezeAnimation, setFreezeAnimation] = useState(false);
  /** Configuration settings for chart display options (e.g. colors, hiding IDs). */
  const [config, setConfig] = useState(DEFALUT_CONFIG);
  /** MCP bridge to communicate with external tools or servers (Model Context Protocol). */
  const [mcpBridge] = useState(() => new WebMcpBridge());
  /** Controls the visibility of the Google Drive OAuth permission modal. */
  const [showAuthModal, setShowAuthModal] = useState(false);
  /** Stores the file ID that failed to load from Google Drive due to authorization errors. */
  const [failedFileId, setFailedFileId] = useState<string>();
  /** Tracks whether the user has a valid cached Google Drive OAuth access token. */
  const [hasGoogleToken, setHasGoogleToken] = useState(
    () => !!googleDriveService.getAccessToken(),
  );

  const intl = useIntl();
  const navigate = useNavigate();
  const location = useLocation();

  /** Prevents the Google Drive "Open with" state from being processed more than once. */
  const stateProcessed = useRef(false);
  /** Tracks whether the component is currently mounted to prevent state updates after unmount. */
  const isMountedRef = useRef(true);
  /** Incremented with each load request to ensure only the latest asynchronous load result is applied. */
  const fetchIdRef = useRef(0);

  /** Manages the mount lifecycle ref to avoid setting state on unmounted components. */
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const updateDisplay = useCallback(
    (newSelection: IndiInfo) => {
      if (
        !selection ||
        selection.id !== newSelection.id ||
        selection.generation !== newSelection.generation
      ) {
        setSelection(newSelection);
        setDetailIndi(newSelection.id);
      }
    },
    [selection],
  );

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
    setShowSidePanel(newShowSidePanel);
    updateUrl({
      sidePanel: newShowSidePanel ? 'true' : 'false',
    });
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
        selection: selection,
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
    [sourceSpec, selection, data, wikiTreeDataSource],
  );

  const loadData = useCallback(
    (newSourceSpec: DataSourceSpec, newSelection?: IndiInfo) => {
      switch (newSourceSpec.source) {
        case DataSourceEnum.UPLOADED:
          return uploadedDataSource.loadData({
            spec: newSourceSpec,
            selection: newSelection,
          });
        case DataSourceEnum.GEDCOM_URL:
          return gedcomUrlDataSource.loadData({
            spec: newSourceSpec,
            selection: newSelection,
          });
        case DataSourceEnum.WIKITREE:
          return wikiTreeDataSource.loadData({
            spec: newSourceSpec,
            selection: newSelection,
          });
        case DataSourceEnum.EMBEDDED:
          return embeddedDataSource.loadData({
            spec: newSourceSpec,
            selection: newSelection,
          });
        case DataSourceEnum.GOOGLE_DRIVE:
          if (!isGoogleDriveConfigured()) {
            throw new TopolaError(
              'GOOGLE_DRIVE_NOT_CONFIGURED',
              'Google Drive integration is not configured.',
            );
          }
          return googleDriveDataSource.loadData({
            spec: newSourceSpec as GoogleDriveSourceSpec,
            selection: newSelection,
          });
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
    setSelection(undefined);
    setDetailIndi(undefined);
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
        setSelection(args.selection);
        setDetailIndi(args.selection?.id);
        setStandalone(args.standalone);
        setShowWikiTreeMenus(args.showWikiTreeMenus);
        setChartType(args.chartType);
        setFreezeAnimation(args.freezeAnimation);
        setConfig(args.config);
        const currentFetchId = ++fetchIdRef.current;
        try {
          const data = await loadData(args.sourceSpec, args.selection);
          if (!isMountedRef.current || fetchIdRef.current !== currentFetchId) {
            return;
          }
          // Set state with data.
          setData(data);
          updateChartWithConfig(args.config, data);
          setShowSidePanel(args.showSidePanel);
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
          (!selection || selection.id !== args.selection?.id);
        setChartType(args.chartType);
        setState(
          loadMoreFromWikitree ? AppState.LOADING_MORE : AppState.SHOWING_CHART,
        );
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        updateDisplay(getSelection(data!.chartData, args.selection));
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
            setSelection(newSelection);
            setDetailIndi(newSelection.id);
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
  }, [
    location,
    state,
    selection,
    data,
    navigate,
    intl,
    isNewData,
    loadData,
    updateDisplay,
  ]);

  useEffect(() => {
    mcpBridge.registerTools();
    return () => {
      mcpBridge.unregisterTools();
    };
  }, [mcpBridge]);

  // Clean up object URLs created for uploaded images/files when the dataset
  // changes or the app unmounts to prevent memory leaks.
  useEffect(() => {
    return () => {
      revokeObjectUrls(data?.images);
    };
  }, [data]);

  useEffect(() => {
    mcpBridge.setData(data || null);
  }, [data, mcpBridge]);

  useEffect(() => {
    mcpBridge.setDetailIndi(detailIndi || null);
  }, [detailIndi, mcpBridge]);

  useEffect(() => {
    mcpBridge.setSetSelectionCallback((id: string) => {
      onSelection({id, generation: 0});
    });
  }, [mcpBridge, location]);

  function updateUrl(args: queryString.ParsedQuery<string>) {
    const search = queryString.parse(location.search);
    for (const key in args) {
      search[key] = args[key];
    }
    location.search = queryString.stringify(search);
    navigate(location);
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
    });
  }
  /**
   * Called when the user shift+clicks an individual box in the chart.
   * Shows the individual in the details pane.
   */
  function onDetailSelection(selection: IndiInfo) {
    setDetailIndi(selection.id);
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
      />
    );
  }

  function renderMainArea() {
    switch (state) {
      case AppState.SHOWING_CHART:
      case AppState.LOADING_MORE: {
        if (!data) {
          return null;
        }
        const updatedSelection = getSelection(data.chartData, selection);
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
                selectedIndiId={detailIndi || updatedSelection.id}
                config={config}
                expanded={showSidePanel}
                onToggle={onToggleSidePanel}
                onConfigChange={(config) => {
                  setConfig(config);
                  updateChartWithConfig(config, data);
                  updateUrl(configToArgs(config));
                }}
              />
              <SidebarPusher>{renderChart(updatedSelection)}</SidebarPusher>
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

  return (
    <>
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
