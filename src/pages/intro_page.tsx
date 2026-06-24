import {useMemo} from 'react';
import {useLocation} from 'react-router';
import {useGoogleDriveAuth} from '../hooks/use_google_drive_auth';
import {Intro} from '../intro';
import {TopBar} from '../menu/top_bar';
import {getArguments} from '../util/url_args';

/**
 * IntroPage component that represents the landing page of the application.
 * It renders the intro text and lists examples alongside its own TopBar.
 */
export function IntroPage() {
  const {hasGoogleToken, setHasGoogleToken, onGoogleSignOut} =
    useGoogleDriveAuth();
  const location = useLocation();

  const args = useMemo(() => getArguments(location), [location]);
  const standalone = args.standalone;

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
