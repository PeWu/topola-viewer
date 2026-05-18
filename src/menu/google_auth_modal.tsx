import {useEffect, useRef, useState} from 'react';
import {FormattedMessage} from 'react-intl';
import {Button, Header, Icon, Message, Modal} from 'semantic-ui-react';
import {googleDriveService} from '../datasource/google_drive_service';

interface Props {
  /** The Google Drive file ID that initially failed to load. */
  failedFileId: string;
  /** Callback triggered when the authentication and file selection are successful. */
  onAuthSuccess: (fileId: string) => void;
  /** Callback triggered when the user cancels the modal. */
  onCancel: () => void;
}

/**
 * Modal dialog that prompts the user to authenticate and select a specific file
 * from Google Drive when direct file loading fails due to insufficient permissions.
 */
export function GoogleAuthModal(props: Props) {
  const [loading, setLoading] = useState(false);
  const [showPickerInstructions, setShowPickerInstructions] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  async function completeAuthFlow(token: string) {
    const response = await window.fetch(
      `https://www.googleapis.com/drive/v3/files/${props.failedFileId}?alt=media`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (response.status === 200) {
      setLoading(false);
      props.onAuthSuccess(props.failedFileId);
      return;
    }

    setShowPickerInstructions(true);

    googleDriveService.showPicker(
      (pickedFileId) => {
        setLoading(false);
        props.onAuthSuccess(pickedFileId);
      },
      () => {
        setLoading(false);
      },
    );
  }

  async function handleConnect() {
    setLoading(true);
    setErrorMessage(null);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setLoading(false);
      timeoutRef.current = null;
    }, 20000);

    try {
      const token = await googleDriveService.requestToken(false);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      await completeAuthFlow(token);
    } catch (err: unknown) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      console.error('Auth error in fallback modal:', err);
      setErrorMessage(
        (err as Error).message || 'An error occurred during authentication.',
      );
      setLoading(false);
    }
  }

  async function handleSwitchAccount() {
    setLoading(true);
    setErrorMessage(null);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setLoading(false);
      timeoutRef.current = null;
    }, 20000);

    try {
      const token = await googleDriveService.requestToken(true);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      await completeAuthFlow(token);
    } catch (err: unknown) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      console.error('Switch account error in fallback modal:', err);
      setErrorMessage(
        (err as Error).message || 'An error occurred during authentication.',
      );
      setLoading(false);
    }
  }

  return (
    <Modal open={true} onClose={props.onCancel} centered={true} size="tiny">
      <Header>
        <Icon name="google drive" />
        <FormattedMessage
          id="google_auth.title"
          defaultMessage="Google Drive Access Required"
        />
      </Header>
      <Modal.Content>
        <p>
          <FormattedMessage
            id="google_auth.instructions"
            defaultMessage="To view this file, you must authenticate and select the file from your Google Drive to grant permissions."
          />
        </p>
        {showPickerInstructions && (
          <Message warning>
            <Message.Header>
              <FormattedMessage
                id="google_auth.picker_instructions_header"
                defaultMessage="Permissions Required"
              />
            </Message.Header>
            <p>
              <FormattedMessage
                id="google_auth.picker_instructions"
                defaultMessage="The application does not have permission to read this file. Please select it in the file browser popup to grant access. If this is a shared file that doesn't show up, try adding a shortcut to your Drive first."
              />
            </p>
          </Message>
        )}
        {errorMessage && (
          <Message negative>
            <p>{errorMessage}</p>
          </Message>
        )}
      </Modal.Content>
      <Modal.Actions>
        <Button secondary onClick={props.onCancel}>
          <FormattedMessage id="google_auth.cancel" defaultMessage="Cancel" />
        </Button>
        {showPickerInstructions && (
          <Button basic onClick={handleSwitchAccount} loading={loading}>
            <FormattedMessage
              id="google_auth.switch_account_button"
              defaultMessage="Switch Account"
            />
          </Button>
        )}
        <Button primary onClick={handleConnect} loading={loading}>
          <FormattedMessage
            id="google_auth.grant_button"
            defaultMessage="Grant Access & Select File"
          />
        </Button>
      </Modal.Actions>
    </Modal>
  );
}
