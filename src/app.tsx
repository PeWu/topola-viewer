import queryString from 'query-string';
import {useMemo} from 'react';
import {Navigate, Route, Routes, useLocation} from 'react-router';
import {
  GOOGLE_DRIVE_REDIRECT_KEYS,
  handleGoogleDriveRedirect,
} from './datasource/google_drive';
import {
  handleWikiTreeRedirect,
  WIKITREE_REDIRECT_KEYS,
} from './datasource/wikitree';
import {IntroPage} from './pages/intro_page';
import {ViewPage} from './pages/view_page';
import {getStaticUrl} from './util/url_args';

const staticUrl = getStaticUrl();

/**
 * Root App component that orchestrates top-level routing, Google Drive "Open with"
 * payload interception, and WikiTree auth code redirection.
 */
export function App() {
  const location = useLocation();

  // Synchronously parse and evaluate redirect query parameters from both external window and router searches.
  const redirectTarget = useMemo(() => {
    if (typeof window === 'undefined') {
      return null;
    }

    const windowSearch = queryString.parse(window.location.search);
    const routerSearch = queryString.parse(location.search);

    let redirectPath: string | null = null;
    const mergedParams = {...routerSearch, ...windowSearch};
    let paramsModified = false;

    // 1. Handle Google Drive "Open with" action
    const gdResult = handleGoogleDriveRedirect(mergedParams);
    if (gdResult) {
      redirectPath = gdResult.redirectPath;
      mergedParams.source = 'google-drive';
      mergedParams.fileId = gdResult.fileId;
      delete mergedParams.state;
      paramsModified = true;
    }

    // 2. Handle WikiTree authcode presence
    const wtResult = handleWikiTreeRedirect(windowSearch, location.pathname);
    if (wtResult) {
      redirectPath = redirectPath || wtResult.redirectPath;
      paramsModified = paramsModified || wtResult.paramsModified;
    }

    const hasRedirectKeys =
      GOOGLE_DRIVE_REDIRECT_KEYS.some((k) => windowSearch[k] !== undefined) ||
      WIKITREE_REDIRECT_KEYS.some((k) => windowSearch[k] !== undefined);

    if (paramsModified || hasRedirectKeys) {
      // Strip external state / authcode parameters from window.location.search to prevent redirect loops.
      const cleanWindowSearch = {...windowSearch};
      GOOGLE_DRIVE_REDIRECT_KEYS.forEach((k) => delete cleanWindowSearch[k]);
      WIKITREE_REDIRECT_KEYS.forEach((k) => delete cleanWindowSearch[k]);

      const cleanWindowSearchStr = queryString.stringify(cleanWindowSearch);
      const newUrl =
        window.location.origin +
        window.location.pathname +
        (cleanWindowSearchStr ? '?' + cleanWindowSearchStr : '') +
        window.location.hash;
      window.history.replaceState(null, '', newUrl);

      return {
        pathname: redirectPath || location.pathname,
        search: queryString.stringify(mergedParams),
      };
    }

    return null;
  }, [location.pathname, location.search]);

  if (redirectTarget) {
    return (
      <Routes>
        <Route path="*" element={<Navigate to={redirectTarget} replace />} />
      </Routes>
    );
  }

  const isViewPage = location.pathname === '/view';

  if (isViewPage) {
    return (
      <Routes>
        <Route path="/view" element={<ViewPage />} />
        <Route path="*" element={<Navigate to="/view" replace />} />
      </Routes>
    );
  }

  return staticUrl ? (
    <Routes>
      <Route path="*" element={<Navigate to="/view" replace />} />
    </Routes>
  ) : (
    <Routes>
      <Route path="/" element={<IntroPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
