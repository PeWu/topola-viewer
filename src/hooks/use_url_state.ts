import {useCallback, useMemo, useRef} from 'react';
import {useLocation, useNavigate} from 'react-router';
import {PRIVATE_ID_PREFIX} from '../datasource/wikitree';
import {Config, configToArgs} from '../sidepanel/config/config';
import {analyticsEvent} from '../util/analytics';
import {IndiInfo} from '../util/gedcom_util';
import {getArguments, getUrlForArgs} from '../util/url_args';

type LocationLike = {pathname: string; search: string; hash: string};

function locationKey(loc: LocationLike): string {
  return `${loc.pathname}${loc.search}${loc.hash}`;
}

/**
 * Custom React hook to manage and synchronize URL routing and query parameter state
 * for the genealogy chart workspace.
 */
export function useUrlState() {
  const location = useLocation();
  const navigate = useNavigate();

  // Tracks in-flight navigations dispatched before React Router commits a
  // transition, so rapid back-to-back updates (e.g. clicking multiple settings)
  // compose on top of each other instead of clobbering earlier changes.
  const pendingNavRef = useRef<{
    baseKey: string;
    intermediateKeys: Set<string>;
    latest: LocationLike;
  } | null>(null);

  // Parse all URL arguments memoized on location changes.
  const args = useMemo(() => getArguments(location), [location]);

  const getBaseLocation = useCallback((): LocationLike => {
    const locKey = locationKey(location);
    const pending = pendingNavRef.current;
    if (
      pending &&
      (locKey === pending.baseKey || pending.intermediateKeys.has(locKey))
    ) {
      return pending.latest;
    }
    pendingNavRef.current = null;
    return location;
  }, [location]);

  /**
   * Helper to update the browser URL query parameters.
   */
  const updateUrl = useCallback(
    (
      newArgs: Record<string, string | (string | null)[] | null | undefined>,
      options?: {replace?: boolean},
    ) => {
      const locKey = locationKey(location);
      const base = getBaseLocation();
      const next = getUrlForArgs(base, newArgs);
      const nextKey = locationKey(next);
      if (nextKey === locKey) {
        pendingNavRef.current = null;
      } else {
        const prevPending = pendingNavRef.current;
        const intermediateKeys = prevPending
          ? prevPending.intermediateKeys
          : new Set<string>();
        intermediateKeys.add(locationKey(base));
        pendingNavRef.current = {
          baseKey: prevPending ? prevPending.baseKey : locKey,
          intermediateKeys,
          latest: next,
        };
      }
      navigate(next, options);
    },
    [getBaseLocation, location, navigate],
  );

  /**
   * Called when the user clicks an individual box in the chart.
   * Updates the browser URL with the new primary individual selection.
   */
  const onSelection = useCallback(
    (selection: IndiInfo) => {
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
    },
    [updateUrl],
  );

  /**
   * Called when the user shift+clicks an individual box in the chart.
   * Shows the individual in the details pane.
   */
  const onDetailSelection = useCallback(
    (selection: IndiInfo) => {
      updateUrl({
        detail: selection.id,
      });
    },
    [updateUrl],
  );

  /**
   * Toggles the side panel expansion state.
   */
  const onToggleSidePanel = useCallback(() => {
    const newShowSidePanel = !args.showSidePanel;
    updateUrl(
      {
        sidePanel: newShowSidePanel ? 'true' : 'false',
      },
      {replace: true},
    );
  }, [args.showSidePanel, updateUrl]);

  /**
   * Updates the URL parameters based on configuration updates.
   */
  const onConfigChange = useCallback(
    (patch: Partial<Config>) => {
      const currentConfig = getArguments(getBaseLocation()).config;
      updateUrl(configToArgs({...currentConfig, ...patch}), {replace: true});
    },
    [getBaseLocation, updateUrl],
  );

  return {
    args,
    chartType: args.chartType,
    standalone: args.standalone,
    showWikiTreeMenus: args.showWikiTreeMenus,
    freezeAnimation: args.freezeAnimation,
    showSidePanel: args.showSidePanel,
    config: args.config,
    sourceSpec: args.sourceSpec,
    selection: args.selection,
    detail: args.detail,
    updateUrl,
    onSelection,
    onDetailSelection,
    onToggleSidePanel,
    onConfigChange,
  };
}
