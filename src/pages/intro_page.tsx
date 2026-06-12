import {useMemo} from 'react';
import {useLocation, useNavigate} from 'react-router';
import {
  clearGoogleDriveCache,
  googleDriveService,
} from '../datasource/google_drive_service';
import {useGoogleAuth} from '../hooks/use_google_auth';
import {Intro} from '../intro';
import {TopBar} from '../menu/top_bar';
import {getArguments} from '../util/url_args';

/**
 * IntroPage component that represents the landing page of the application.
 * It renders the intro text and lists examples alongside its own TopBar.
 */
export function IntroPage() {
  const {hasGoogleToken, setHasGoogleToken} = useGoogleAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const args = useMemo(() => getArguments(location), [location]);
  const standalone = args.standalone;

  async function onGoogleSignOut() {
    await googleDriveService.signOut();
    setHasGoogleToken(false);
    clearGoogleDriveCache();
    navigate({pathname: '/'}, {replace: true});
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
      <Intro />
    </>
  );
}
