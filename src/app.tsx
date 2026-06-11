import queryString from 'query-string';
import {useEffect, useMemo, useRef} from 'react';
import {Navigate, Route, Routes, useLocation, useNavigate} from 'react-router';
import {
  clearGoogleDriveCache,
  googleDriveService,
} from './datasource/google_drive_service';
import {useGoogleAuth} from './hooks/use_google_auth';
import {Intro} from './intro';
import {TopBar} from './menu/top_bar';
import {ViewPage} from './pages/view_page';
import {getArguments, getStaticUrl} from './util/url_args';

const staticUrl = getStaticUrl();

/**
 * Root App component that orchestrates top-level routing, Google Drive "Open with"
 * payload interception and redirection, and global layout rendering for the intro view.
 */
export function App() {
  /** Tracks whether the user has a valid cached Google Drive OAuth access token and provides a state setter. */
  const {hasGoogleToken, setHasGoogleToken} = useGoogleAuth();

  const navigate = useNavigate();
  const location = useLocation();

  const args = useMemo(() => getArguments(location), [location]);
  /** Whether the app is in standalone mode, i.e. showing 'open file' menus. */
  const standalone = args.standalone;

  /** Prevents the Google Drive "Open with" state from being processed more than once. */
  const stateProcessed = useRef(false);

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
    // Purge sessionStorage keys starting with "google-drive:"
    clearGoogleDriveCache();
    navigate({pathname: '/'}, {replace: true});
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

  return (
    <>
      <TopBar
        showingChart={false}
        standalone={standalone}
        hasGoogleToken={hasGoogleToken}
        onGoogleSignOut={onGoogleSignOut}
        onGoogleTokenAcquired={() => setHasGoogleToken(true)}
      />
      {staticUrl ? (
        <Routes>
          <Route path="*" element={<Navigate to="/view" replace />} />
        </Routes>
      ) : (
        <Routes>
          <Route path="/" element={<Intro />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      )}
    </>
  );
}
