import {useState} from 'react';
import {googleDriveService} from '../datasource/google_drive_service';

/**
 * Custom React hook to manage and track the state of Google Drive OAuth2 credentials.
 */
export function useGoogleAuth() {
  /** Tracks whether the user has a valid cached Google Drive OAuth access token. */
  const [hasGoogleToken, setHasGoogleToken] = useState(
    () => !!googleDriveService.getAccessToken(),
  );

  return {
    /** Tracks whether the user has a valid cached Google Drive OAuth access token. */
    hasGoogleToken,
    /** Function to update the token presence state in React. */
    setHasGoogleToken,
  };
}
