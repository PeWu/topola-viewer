import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useIntl} from 'react-intl';
import {useLocation, useNavigate} from 'react-router';
import {Loader, SidebarPushable, SidebarPusher} from 'semantic-ui-react';
import {IndiInfo} from 'topola';
import {
  Chart,
  ChartType,
  downloadPdf,
  downloadPng,
  downloadSvg,
  printChart,
} from '../chart';
import {ErrorMessage, ErrorPopup} from '../components/error_display';
import {ProgressPill} from '../components/progress_pill';
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
import {DonatsoChart} from '../donatso-chart';
import {useGoogleDriveAuthFlow} from '../hooks/use_google_drive_auth_flow';
import {useUrlState} from '../hooks/use_url_state';
import {useWebMcpBridge} from '../hooks/use_webmcp_bridge';
import {GoogleAuthModal} from '../menu/google_auth_modal';
import {TopBar} from '../menu/top_bar';
import {Config, Ids, Sex} from '../sidepanel/config/config';
import {SidePanel} from '../sidepanel/side-panel';
import {analyticsEvent} from '../util/analytics';
import {TopolaError} from '../util/error';
import {getI18nMessage} from '../util/error_i18n';
import {idToIndiMap, TopolaData} from '../util/gedcom_util';
import {DataSourceSpec, getArguments} from '../util/url_args';

export enum AppState {
  INITIAL,
  LOADING,
  ERROR,
  SHOWING_CHART,
  LOADING_MORE,
}

/**
 * ViewPage is the page component that orchestrates the genealogy chart workspace.
 * It manages asynchronous data loading, configuration parameters derived from the URL,
 * chart rendering (both D3 and Donatso), side panel settings, and Google Drive auth workflows.
 */
export function ViewPage() {
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

  // Manage Google Drive auth and session flows
  const {
    showAuthModal,
    failedFileId,
    hasGoogleToken,
    setHasGoogleToken,
    onGoogleSignOut,
    triggerAuthError,
    onAuthSuccess,
    onCancel,
  } = useGoogleDriveAuthFlow({
    onSignOut: useCallback(() => {
      setData(undefined);
      loadedSelectionRef.current = undefined;
    }, []),
    onAuthSuccess: useCallback(() => {
      setState(AppState.INITIAL);
    }, []),
  });

  const {
    chartType,
    standalone,
    showWikiTreeMenus,
    freezeAnimation,
    showSidePanel,
    config,
    selection: urlSelection,
    detail: urlDetail,
    onSelection,
    onDetailSelection,
    onToggleSidePanel,
    onConfigChange,
  } = useUrlState();

  const intl = useIntl();
  const navigate = useNavigate();
  const location = useLocation();

  useMemo(() => {
    updateChartWithConfig(config, data);
  }, [config, data]);

  /** The currently selected individual. Fallback to default individual from loaded data if not specified. */
  const updatedSelection = useMemo(() => {
    return data ? getSelection(data.chartData, urlSelection) : undefined;
  }, [data, urlSelection]);

  /** The individual displayed in the details pane. */
  const detailIndi = urlDetail || updatedSelection?.id;

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

  /** Sets error message after data load failure. */

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
      const oldSource = {
        spec: sourceSpec,
        selection: loadedSelectionRef.current,
      };
      switch (newSource.spec.source) {
        case DataSourceEnum.UPLOADED:
          return uploadedDataSource.isNewData(
            newSource as SourceSelection<UploadSourceSpec>,
            oldSource as SourceSelection<UploadSourceSpec>,
            data,
          );
        case DataSourceEnum.GEDCOM_URL:
          return gedcomUrlDataSource.isNewData(
            newSource as SourceSelection<UrlSourceSpec>,
            oldSource as SourceSelection<UrlSourceSpec>,
            data,
          );
        case DataSourceEnum.WIKITREE:
          return wikiTreeDataSource.isNewData(
            newSource as SourceSelection<WikiTreeSourceSpec>,
            oldSource as SourceSelection<WikiTreeSourceSpec>,
            data,
          );
        case DataSourceEnum.EMBEDDED:
          return embeddedDataSource.isNewData(
            newSource as SourceSelection<EmbeddedSourceSpec>,
            oldSource as SourceSelection<EmbeddedSourceSpec>,
            data,
          );
        case DataSourceEnum.GOOGLE_DRIVE:
          return googleDriveDataSource.isNewData(
            newSource as SourceSelection<GoogleDriveSourceSpec>,
            oldSource as SourceSelection<GoogleDriveSourceSpec>,
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
        (state === AppState.INITIAL ||
          isNewData(args.sourceSpec, args.selection)) &&
        state !== AppState.LOADING &&
        state !== AppState.LOADING_MORE
      ) {
        // Set loading state.
        setState(AppState.LOADING);
        // Set state from URL parameters.
        setSourceSpec(args.sourceSpec);
        loadedSelectionRef.current = args.selection;
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
              triggerAuthError(args.sourceSpec.fileId);
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
          !!args.selection &&
          (!loadedSelectionRef.current ||
            loadedSelectionRef.current.id !== args.selection.id);
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
  }, [
    location,
    state,
    data,
    navigate,
    intl,
    isNewData,
    loadData,
    triggerAuthError,
  ]);

  // Clean up object URLs created for uploaded images/files when the dataset
  // changes or the app unmounts to prevent memory leaks.
  useEffect(() => {
    return () => {
      revokeObjectUrls(data?.images);
    };
  }, [data]);

  useWebMcpBridge(data, detailIndi, onSelection);

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
                onConfigChange={onConfigChange}
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

  return (
    <>
      <ProgressPill loadingStatus={loadingStatus} state={state} />
      <TopBar
        data={data?.chartData}
        allowAllRelativesChart={sourceSpec?.source !== DataSourceEnum.WIKITREE}
        allowPrintAndDownload={chartType !== ChartType.Donatso}
        showingChart={
          state === AppState.SHOWING_CHART || state === AppState.LOADING_MORE
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
      {renderMainArea()}
      {showAuthModal && failedFileId && (
        <GoogleAuthModal
          failedFileId={failedFileId}
          onAuthSuccess={onAuthSuccess}
          onCancel={onCancel}
        />
      )}
    </>
  );
}
