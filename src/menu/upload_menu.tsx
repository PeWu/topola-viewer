import * as queryString from 'query-string';
import * as React from 'react';
import md5 from 'md5';
import {analyticsEvent} from '../util/analytics';
import {Dropdown, Icon, Menu} from 'semantic-ui-react';
import {FormattedMessage} from 'react-intl';
import {MenuType} from './menu_item';
import {RouteComponentProps} from 'react-router-dom';

function loadFileAsText(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (evt: ProgressEvent) => {
      resolve((evt.target as FileReader).result as string);
    };
    reader.readAsText(file);
  });
}

function isImageFileName(fileName: string) {
  const lower = fileName.toLowerCase();
  return lower.endsWith('.jpg') || lower.endsWith('.png');
}

interface Props {
  menuType: MenuType;
}

/** Displays and handles the "Open file" menu. */
export class UploadMenu extends React.Component<RouteComponentProps & Props> {
  private async handleUpload(event: React.SyntheticEvent<HTMLInputElement>) {
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

    // Convert uploaded images to object URLs.
    const images = filesArray
      .filter(
        (file) => file.name !== gedcomFile.name && isImageFileName(file.name),
      )
      .map((file) => ({
        name: file.name,
        url: URL.createObjectURL(file),
      }));
    const imageMap = new Map(
      images.map((entry) => [entry.name, entry.url] as [string, string]),
    );

    const data = await loadFileAsText(gedcomFile);
    const imageFileNames = images
      .map((image) => image.name)
      .sort()
      .join('|');
    // Hash GEDCOM contents with uploaded image file names.
    const hash = md5(md5(data) + imageFileNames);

    // Use history.replace() when reuploading the same file and history.push() when loading
    // a new file.
    const search = queryString.parse(this.props.location.search);
    const historyPush =
      search.file === hash
        ? this.props.history.replace
        : this.props.history.push;

    historyPush({
      pathname: '/view',
      search: queryString.stringify({file: hash}),
      state: {data, images: imageMap},
    });
  }

  render() {
    const content = (
      <>
        <Icon name="folder open" />
        <FormattedMessage id="menu.open_file" defaultMessage="Open file" />
      </>
    );
    return (
      <>
        {this.props.menuType === MenuType.Menu ? (
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
          accept=".ged,image/*"
          id="fileInput"
          multiple
          onChange={(e) => this.handleUpload(e)}
        />
      </>
    );
  }
}
