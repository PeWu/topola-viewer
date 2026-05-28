import md5 from 'md5';
import queryString from 'query-string';
import {SyntheticEvent} from 'react';
import {FormattedMessage} from 'react-intl';
import {useLocation, useNavigate} from 'react-router';
import {Dropdown, Icon, Menu} from 'semantic-ui-react';
import {loadFile} from '../datasource/load_data';
import {analyticsEvent} from '../util/analytics';
import {isImageFile} from '../util/gedcom_util';
import {MenuType} from './menu_item';

interface Props {
  menuType: MenuType;
}

/**
 * On touch devices (iOS, Android) the browser's file picker ignores unknown
 * extensions like .ged and may restrict selection to photos when image types
 * are listed. Omitting the `accept` attribute lets the OS file browser show
 * all files without filtering.
 */
const isTouchDevice = navigator.maxTouchPoints > 0;

/** Displays and handles the "Open file" menu. */
export function UploadMenu(props: Props) {
  const navigate = useNavigate();
  const location = useLocation();

  async function handleUpload(event: SyntheticEvent<HTMLInputElement>) {
    const files = (event.target as HTMLInputElement).files;
    if (!files || !files.length) {
      return;
    }
    const filesArray = Array.from(files);
    (event.target as HTMLInputElement).value = ''; // Reset the file input.
    analyticsEvent('upload_files_selected', {
      event_value: files.length,
    });

    const gedcomFile =
      filesArray.length === 1
        ? filesArray[0]
        : filesArray.find((file) => file.name.toLowerCase().endsWith('.ged')) ||
          filesArray[0];
    const {gedcom, images} = await loadFile(gedcomFile);

    // Convert uploaded images to object URLs.
    filesArray
      .filter((file) => file.name !== gedcomFile.name && isImageFile(file.name))
      .forEach((file) =>
        images.set(file.name.toLowerCase(), URL.createObjectURL(file)),
      );

    // Hash GEDCOM contents with uploaded image file names.
    const imageFileNames = Array.from(images.keys()).sort().join('|');
    const hash = md5(md5(gedcom) + imageFileNames);

    // Use history.replace() when reuploading the same file and history.push() when loading
    // a new file.
    const search = queryString.parse(location.search);
    const replace = search.file === hash;

    navigate(
      {
        pathname: '/view',
        search: queryString.stringify({file: hash}),
      },
      {
        replace,
        state: {data: gedcom, images},
      },
    );
  }

  const content = (
    <>
      <Icon name="folder open" />
      <FormattedMessage id="menu.open_file" defaultMessage="Open file" />
    </>
  );
  return (
    <>
      {props.menuType === MenuType.Menu ? (
        <label htmlFor="fileInput">
          <Menu.Item as="a">{content}</Menu.Item>
        </label>
      ) : (
        <Dropdown.Item as="label" htmlFor="fileInput">
          {content}
        </Dropdown.Item>
      )}
      <input
        className="hidden"
        type="file"
        accept={
          isTouchDevice
            ? undefined
            : '.ged,.gdz,.gedzip,.zip,.jpg,.jpeg,.png,.gif,.webp'
        }
        id="fileInput"
        multiple
        onChange={handleUpload}
      />
    </>
  );
}
