import queryString from 'query-string';
import {useCallback, useState} from 'react';
import {useNavigate} from 'react-router';
import {
  clearGoogleDriveCache,
  googleDriveService,
} from '../datasource/google_drive_service';
import {useGoogleAuth} from './use_google_auth';

/**
 * Custom React hook that encapsulates the Google Drive OAuth authorization flow.
 * It manages token states, modal triggers, sign-out sessions, and navigation flows.
 */
export function useGoogleDriveAuthFlow(options: {
  /** Callback triggered to clean up state when signing out. */
  onSignOut: () => void;
  /** Callback triggered when authorization succeeds for the failed file. */
  onAuthSuccess: () => void;
}) {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [failedFileId, setFailedFileId] = useState<string>();
  const {hasGoogleToken, setHasGoogleToken} = useGoogleAuth();
  const navigate = useNavigate();

  /**
   * Performs Google Drive sign-out, clears active sessions, cleans up state,
   * and redirects to the home page.
   */
  const onGoogleSignOut = useCallback(async () => {
    await googleDriveService.signOut();
    setHasGoogleToken(false);
    clearGoogleDriveCache();
    options.onSignOut();
    navigate({pathname: '/'}, {replace: true});
  }, [setHasGoogleToken, navigate, options]);

  /**
   * Triggers the OAuth modal presentation for a failed file.
   */
  const triggerAuthError = useCallback((fileId: string) => {
    setFailedFileId(fileId);
    setShowAuthModal(true);
  }, []);

  /**
   * Called when Google Drive authorization succeeds.
   */
  const onAuthSuccess = useCallback(
    (fileId: string) => {
      setShowAuthModal(false);
      setHasGoogleToken(true);
      if (fileId === failedFileId) {
        options.onAuthSuccess();
      } else {
        // If a different file was selected/authorized, navigate to that one.
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
    },
    [failedFileId, navigate, setHasGoogleToken, options],
  );

  /**
   * Called when the OAuth modal is cancelled.
   */
  const onCancel = useCallback(() => {
    setShowAuthModal(false);
    navigate({pathname: '/'}, {replace: true});
  }, [navigate]);

  return {
    showAuthModal,
    failedFileId,
    hasGoogleToken,
    setHasGoogleToken,
    onGoogleSignOut,
    triggerAuthError,
    onAuthSuccess,
    onCancel,
  };
}
