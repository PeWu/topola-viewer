import {useCallback, useMemo} from 'react';
import {useIntl} from 'react-intl';
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
import {DataSourceEnum} from '../datasource/data_source';
import {DonatsoChart} from '../donatso-chart';
import {useGenealogyLoader} from '../hooks/use_genealogy_loader';
import {useGoogleDriveAuthFlow} from '../hooks/use_google_drive_auth_flow';
import {useUrlState} from '../hooks/use_url_state';
import {useWebMcpBridge} from '../hooks/use_webmcp_bridge';
import {GoogleAuthModal} from '../menu/google_auth_modal';
import {TopBar} from '../menu/top_bar';
import {Config, Ids, Sex} from '../sidepanel/config/config';
import {SidePanel} from '../sidepanel/side-panel';
import {analyticsEvent} from '../util/analytics';
import {idToIndiMap, TopolaData} from '../util/gedcom_util';

export enum AppState {
  INITIAL,
  LOADING,
  ERROR,
  SHOWING_CHART,
  LOADING_MORE,
}

/**
 * Updates the chart data nodes with custom display parameters (such as hiding IDs or genders)
 * in place prior to rendering D3 canvas.
 */
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

/**
 * ViewPage is the page component that orchestrates the genealogy chart workspace.
 * It manages asynchronous data loading, configuration parameters derived from the URL,
 * chart rendering (both D3 and Donatso), side panel settings, and Google Drive auth workflows.
 */
export function ViewPage() {
  const intl = useIntl();

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

  const {
    state,
    loadingStatus,
    data,
    error,
    showErrorPopup,
    sourceSpec,
    updatedSelection,
    detailIndi,
    onDismissErrorPopup,
    resetLoader,
    clearData,
    setLoadingStatus,
    displayErrorPopup,
  } = useGenealogyLoader({
    intl,
    urlSelection,
    urlDetail,
    onAuthError: useCallback((fileId) => {
      triggerAuthError(fileId);
    }, []),
  });

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
    onSignOut: clearData,
    onAuthSuccess: resetLoader,
  });

  useMemo(() => {
    updateChartWithConfig(config, data);
  }, [config, data]);

  useWebMcpBridge(data, detailIndi, onSelection);

  function onPrint() {
    analyticsEvent('print');
    printChart();
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
