import queryString from 'query-string';
import {useEffect, useRef} from 'react';
import {Navigate, Route, Routes, useLocation, useNavigate} from 'react-router';
import {IntroPage} from './pages/intro_page';
import {ViewPage} from './pages/view_page';
import {getStaticUrl} from './util/url_args';

const staticUrl = getStaticUrl();

/**
 * Root App component that orchestrates top-level routing, Google Drive "Open with"
 * payload interception and redirection.
 */
export function App() {
  const navigate = useNavigate();
  const location = useLocation();

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
