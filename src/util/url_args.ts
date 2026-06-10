import * as H from 'history';
import type {ParsedQuery} from 'query-string';
import {IndiInfo} from 'topola';
import {ChartType} from '../chart';
import {DataSourceEnum} from '../datasource/data_source';
import {EmbeddedSourceSpec} from '../datasource/embedded';
import {GoogleDriveSourceSpec} from '../datasource/google_drive';
import {UploadSourceSpec, UrlSourceSpec} from '../datasource/load_data';
import {WikiTreeSourceSpec} from '../datasource/wikitree';
import {argsToConfig, Config} from '../sidepanel/config/config';

export type DataSourceSpec =
  | UrlSourceSpec
  | UploadSourceSpec
  | WikiTreeSourceSpec
  | EmbeddedSourceSpec
  | GoogleDriveSourceSpec;

/**
 * Arguments passed to the application, primarily through URL parameters.
 * Non-optional arguments get populated with default values.
 */
export interface Arguments {
  sourceSpec?: DataSourceSpec;
  selection?: IndiInfo;
  detail?: string;
  chartType: ChartType;
  standalone: boolean;
  showWikiTreeMenus: boolean;
  freezeAnimation: boolean;
  showSidePanel: boolean;
  config: Config;
}

/**
 * Parses a query string using URLSearchParams.
 */
function parseQuery(search: string): ParsedQuery {
  const params = new URLSearchParams(search);
  const result: ParsedQuery = {};
  params.forEach((value, key) => {
    const existing = result[key];
    if (existing !== undefined) {
      if (Array.isArray(existing)) {
        existing.push(value);
      } else {
        result[key] = [existing as string, value];
      }
    } else {
      result[key] = value;
    }
  });
  return result;
}

/**
 * Stringifies a query object using URLSearchParams.
 */
function stringifyQuery(query: ParsedQuery): string {
  const params = new URLSearchParams();
  for (const key in query) {
    const val = query[key];
    if (val !== undefined && val !== null) {
      if (Array.isArray(val)) {
        val.forEach((v) => {
          if (v !== null && v !== undefined) {
            params.append(key, v);
          }
        });
      } else {
        params.set(key, val);
      }
    }
  }
  const str = params.toString();
  return str ? `?${str}` : '';
}

/**
 * Load GEDCOM URL from environment variable (Vite VITE_STATIC_URL or dynamically
 * injected via a meta tag from Caddy server).
 *
 * If this static URL is provided, the viewer is switched to
 * single-tree mode without the option to load other data.
 */
export function getStaticUrl(): string | undefined {
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

export function getParamFromSearch(name: string, search: ParsedQuery) {
  const value = search[name];
  return typeof value === 'string' ? value : undefined;
}

/**
 * Retrieve arguments passed into the application through the URL and uploaded
 * data.
 */
export function getArguments(location: H.Location): Arguments {
  const search = parseQuery(location.search);
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
  const staticUrl = getStaticUrl();
  let sourceSpec: DataSourceSpec | undefined = undefined;
  if (staticUrl) {
    sourceSpec = {
      source: DataSourceEnum.GEDCOM_URL,
      url: staticUrl,
      handleCors: false,
    };
  } else if (getParam('source') === 'wikitree') {
    const windowSearch =
      typeof window !== 'undefined' ? parseQuery(window.location.search) : {};
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

  const detail = getParam('detail');

  /**
   * Determines whether the side panel should be shown taking into account the
   * URL parameter and the viewport size.
   *
   * On mobile devices (max-width: 767px), the side panel is hidden by default.
   * On tablet and desktop, the side panel is shown by default.
   */
  function getShowSidePanel() {
    if (
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(max-width: 767px)').matches
    ) {
      // On mobile, hide the side panel by default.
      return getParam('sidePanel') === 'true';
    }
    // On tablet and desktop, show the side panel by default.
    return getParam('sidePanel') !== 'false';
  }

  return {
    sourceSpec,
    selection,
    detail,
    // Hourglass is the default view.
    chartType: chartTypes.get(view) || ChartType.Hourglass,

    showSidePanel: getShowSidePanel(),
    standalone: getParam('standalone') !== 'false' && !embedded && !staticUrl,
    showWikiTreeMenus: getParam('showWikiTreeMenus') !== 'false', // True by default.
    freezeAnimation: getParam('freeze') === 'true', // False by default
    config: argsToConfig(search),
  };
}

/**
 * Returns a path/query object suitable for passing to React Router's `navigate` function
 * with new values added or removed from the current URL.
 */
export function getUrlForArgs(
  location: H.Location,
  newArgs: Record<string, string | (string | null)[] | null | undefined>,
): {pathname: string; search: string; hash: string} {
  const search = parseQuery(location.search);
  for (const key in newArgs) {
    const val = newArgs[key];
    if (val === undefined || val === null) {
      delete search[key];
    } else if (Array.isArray(val)) {
      search[key] = val.filter(
        (v): v is string => v !== null && v !== undefined,
      );
    } else {
      search[key] = val;
    }
  }
  return {
    pathname: location.pathname,
    search: stringifyQuery(search),
    hash: location.hash,
  };
}
