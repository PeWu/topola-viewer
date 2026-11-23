import {Alert, Portal} from '@mantine/core';
import {FormattedMessage} from 'react-intl';

/** Shows an error message in the middle of the screen. */
export function ErrorMessage(props: {message?: string}) {
  return (
    <Alert
      color="red"
      title={
        <FormattedMessage
          id="error.failed_to_load_file"
          defaultMessage={'Failed to load file'}
        />
      }
      className="error"
      data-testid="error-message"
      style={{maxWidth: 600, margin: 'auto'}}
    >
      {props.message}
    </Alert>
  );
}

export interface ErrorPopupProps {
  message?: string;
  open: boolean;
  onDismiss: () => void;
}

/**
 * Shows a dismissable error message in the bottom left corner of the screen.
 */
export function ErrorPopup(props: ErrorPopupProps) {
  if (!props.open) {
    return null;
  }
  return (
    <Portal>
      <Alert
        color="red"
        withCloseButton
        onClose={props.onDismiss}
        title={<FormattedMessage id="error.error" defaultMessage={'Error'} />}
        className="errorPopup"
        data-testid="error-popup"
        style={{
          position: 'fixed',
          left: 40,
          bottom: 40,
          zIndex: 1000,
          maxWidth: 400,
        }}
      >
        {props.message}
      </Alert>
    </Portal>
  );
}
