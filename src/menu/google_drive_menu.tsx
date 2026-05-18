import queryString from 'query-string';
import {FormattedMessage} from 'react-intl';
import {useNavigate} from 'react-router';
import {Icon} from 'semantic-ui-react';
import {
  googleDriveService,
  isGoogleDriveConfigured,
} from '../datasource/google_drive_service';
import {MenuItem, MenuType} from './menu_item';

interface Props {
  menuType: MenuType;
  onTokenAcquired?: () => void;
}

/**
 * Component representing the Google Drive menu option.
 * It handles authenticating the user and launching the Google Picker to select files.
 */
export function GoogleDriveMenu(props: Props) {
  const navigate = useNavigate();

  // Do not render the menu item if Google Drive API credentials are not configured.
  if (!isGoogleDriveConfigured()) {
    return null;
  }

  async function handleClick() {
    try {
      // 1. Request access token
      await googleDriveService.requestToken();
      if (props.onTokenAcquired) {
        props.onTokenAcquired();
      }
      // 2. Open Google Picker
      await googleDriveService.showPicker((fileId) => {
        navigate({
          pathname: '/view',
          search: queryString.stringify({
            source: 'google-drive',
            fileId,
          }),
        });
      });
    } catch (err) {
      console.error('Failed Google Drive login/file picking:', err);
    }
  }

  return (
    <MenuItem onClick={handleClick} menuType={props.menuType}>
      <Icon name="google drive" />
      <FormattedMessage
        id="menu.load_from_google_drive"
        defaultMessage="Load from Google Drive"
      />
    </MenuItem>
  );
}
