import {Menu} from '@mantine/core';
import {
  IconCaretDownFilled,
  IconDownload,
  IconEye,
  IconFolderOpen,
  IconHourglass,
  IconLogout,
  IconMenu2,
  IconPrinter,
  IconTrain,
  IconUsers,
} from '@tabler/icons-react';
import queryString from 'query-string';
import {FormattedMessage} from 'react-intl';
import {Link, useLocation, useNavigate} from 'react-router';
import {ModelData} from 'topola/model';
import {isGoogleDriveConfigured} from '../datasource/google_drive_service';
import {IndiInfo} from '../util/gedcom_util';
import {Media} from '../util/media';
import {isOnWikitreeDomain} from '../util/wikitree_util';
import {GoogleDriveMenu} from './google_drive_menu';
import {MenuItem, MenuType} from './menu_item';
import {SearchBar} from './search';
import {UploadMenu} from './upload_menu';
import {UrlMenu} from './url_menu';
import {useSearch} from './use_search';
import {WikiTreeLoginMenu, WikiTreeMenu} from './wikitree_menu';

enum ScreenSize {
  LARGE,
  SMALL,
}

interface EventHandlers {
  onSelection: (indiInfo: IndiInfo) => void;
  onPrint: () => void;
  onDownloadPdf: () => void;
  onDownloadPng: () => void;
  onDownloadSvg: () => void;
}

interface Props {
  /** True if the application is currently showing a chart. */
  showingChart: boolean;
  /** Data used for the search index. */
  data?: ModelData;
  standalone: boolean;
  /** Whether to show the "All relatives" chart type in the menu. */
  allowAllRelativesChart?: boolean;
  allowPrintAndDownload?: boolean;
  eventHandlers?: EventHandlers;
  /** Whether to show additional WikiTree menus. */
  showWikiTreeMenus?: boolean;
  /** Whether the user has authorized Google Drive and has an active token. */
  hasGoogleToken?: boolean;
  /** Callback to sign out of Google Drive. */
  onGoogleSignOut?: () => void;
  /** Callback triggered when a new Google Drive token is acquired. */
  onGoogleTokenAcquired?: () => void;
}

export function TopBar(props: Props) {
  const navigate = useNavigate();
  const location = useLocation();

  // WikiTree menus only work when hosted on apps.wikitree.com because
  // WikiTree's API requires same-origin access. The CORS proxy workaround is
  // no longer functional.
  const showWikiTree = props.showWikiTreeMenus && isOnWikitreeDomain();

  const {searchResults, searchString, setSearchString, handleResultSelect} =
    useSearch({
      data: props.data,
      onSelection: props.eventHandlers?.onSelection,
    });

  function changeView(view: string) {
    const search = queryString.parse(location.search);
    if (search.view !== view) {
      search.view = view;
      location.search = queryString.stringify(search);
      navigate(location);
    }
  }

  function chartMenus(screenSize: ScreenSize) {
    if (!props.showingChart || !props.data) {
      return null;
    }
    const chartTypeItems = (
      <>
        <Menu.Item
          leftSection={<IconHourglass size={18} />}
          onClick={() => changeView('hourglass')}
        >
          <FormattedMessage
            id="menu.hourglass"
            defaultMessage="Hourglass chart"
          />
        </Menu.Item>
        {props.allowAllRelativesChart ? (
          <Menu.Item
            leftSection={<IconUsers size={18} />}
            onClick={() => changeView('relatives')}
          >
            <FormattedMessage
              id="menu.relatives"
              defaultMessage="All relatives"
            />
          </Menu.Item>
        ) : null}
        <Menu.Item
          leftSection={<IconUsers size={18} />}
          onClick={() => changeView('donatso')}
        >
          <FormattedMessage
            id="menu.donatso"
            defaultMessage="Donatso family chart"
          />
        </Menu.Item>
        <Menu.Item
          leftSection={<IconUsers size={18} />}
          onClick={() => changeView('fancy')}
        >
          <FormattedMessage
            id="menu.fancy"
            defaultMessage="Fancy tree (experimental)"
          />
        </Menu.Item>
        <Menu.Item
          leftSection={<IconTrain size={18} />}
          onClick={() => changeView('transit')}
        >
          <FormattedMessage
            id="menu.transit"
            defaultMessage="Transit map (experimental)"
          />
        </Menu.Item>
      </>
    );
    switch (screenSize) {
      case ScreenSize.LARGE:
        return (
          <>
            <button
              className="topbar-item"
              onClick={props.eventHandlers?.onPrint}
              disabled={!props.allowPrintAndDownload}
            >
              <IconPrinter
                size={18}
                style={{marginRight: 6, verticalAlign: 'middle'}}
              />
              <FormattedMessage id="menu.print" defaultMessage="Print" />
            </button>

            <Menu shadow="md" width={180} keepMounted>
              <Menu.Target>
                <div
                  role="button"
                  tabIndex={0}
                  className="topbar-item"
                  style={{
                    opacity: props.allowPrintAndDownload ? 1 : 0.45,
                    pointerEvents: props.allowPrintAndDownload
                      ? 'auto'
                      : 'none',
                  }}
                >
                  <IconDownload
                    size={18}
                    style={{marginRight: 6, verticalAlign: 'middle'}}
                  />
                  <FormattedMessage
                    id="menu.download"
                    defaultMessage="Download"
                  />
                  <IconCaretDownFilled size={12} style={{marginLeft: 10}} />
                </div>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item onClick={props.eventHandlers?.onDownloadPdf}>
                  <FormattedMessage
                    id="menu.pdf_file"
                    defaultMessage="PDF file"
                  />
                </Menu.Item>
                <Menu.Item onClick={props.eventHandlers?.onDownloadPng}>
                  <FormattedMessage
                    id="menu.png_file"
                    defaultMessage="PNG file"
                  />
                </Menu.Item>
                <Menu.Item onClick={props.eventHandlers?.onDownloadSvg}>
                  <FormattedMessage
                    id="menu.svg_file"
                    defaultMessage="SVG file"
                  />
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>

            <Menu shadow="md" width={220} keepMounted>
              <Menu.Target>
                <div role="button" tabIndex={0} className="topbar-item">
                  <IconEye
                    size={18}
                    style={{marginRight: 6, verticalAlign: 'middle'}}
                  />
                  <FormattedMessage id="menu.view" defaultMessage="View" />
                  <IconCaretDownFilled size={12} style={{marginLeft: 10}} />
                </div>
              </Menu.Target>
              <Menu.Dropdown>{chartTypeItems}</Menu.Dropdown>
            </Menu>
            <SearchBar
              results={searchResults}
              value={searchString}
              onSearchChange={setSearchString}
              onResultSelect={handleResultSelect}
            />
          </>
        );

      case ScreenSize.SMALL:
        return (
          <>
            <Menu.Item
              leftSection={<IconPrinter size={18} />}
              onClick={props.eventHandlers?.onPrint}
            >
              <FormattedMessage id="menu.print" defaultMessage="Print" />
            </Menu.Item>

            <Menu.Divider />

            <Menu.Item
              leftSection={<IconDownload size={18} />}
              onClick={props.eventHandlers?.onDownloadPdf}
            >
              <FormattedMessage
                id="menu.download_pdf"
                defaultMessage="Download PDF"
              />
            </Menu.Item>
            <Menu.Item
              leftSection={<IconDownload size={18} />}
              onClick={props.eventHandlers?.onDownloadPng}
            >
              <FormattedMessage
                id="menu.download_png"
                defaultMessage="Download PNG"
              />
            </Menu.Item>
            <Menu.Item
              leftSection={<IconDownload size={18} />}
              onClick={props.eventHandlers?.onDownloadSvg}
            >
              <FormattedMessage
                id="menu.download_svg"
                defaultMessage="Download SVG"
              />
            </Menu.Item>

            <Menu.Divider />
            {chartTypeItems}
            <Menu.Divider />
          </>
        );
    }
  }

  function title() {
    return <span className="topbar-title">Topola Genealogy</span>;
  }

  function googleDriveDisconnectMenu(screenSize: ScreenSize) {
    if (!props.hasGoogleToken || !isGoogleDriveConfigured()) {
      return null;
    }
    return (
      <>
        <MenuItem
          menuType={
            screenSize === ScreenSize.SMALL ? MenuType.Dropdown : MenuType.Menu
          }
          onClick={props.onGoogleSignOut}
        >
          <IconLogout
            size={18}
            style={{marginRight: 6, verticalAlign: 'middle'}}
          />
          <FormattedMessage
            id="menu.google_sign_out"
            defaultMessage="Disconnect Google Drive"
          />
        </MenuItem>
        {screenSize === ScreenSize.SMALL ? <Menu.Divider /> : null}
      </>
    );
  }

  function fileMenuItems(menuType: MenuType) {
    return (
      <>
        <UploadMenu menuType={menuType} />
        <UrlMenu menuType={menuType} />
        {showWikiTree && <WikiTreeMenu menuType={menuType} />}
        <GoogleDriveMenu
          menuType={menuType}
          onTokenAcquired={props.onGoogleTokenAcquired}
        />
      </>
    );
  }

  function fileMenus(screenSize: ScreenSize) {
    // In standalone WikiTree mode, show only the "Select WikiTree ID" menu.
    if (!props.standalone && showWikiTree) {
      switch (screenSize) {
        case ScreenSize.LARGE:
          return <WikiTreeMenu menuType={MenuType.Menu} />;
        case ScreenSize.SMALL:
          return (
            <>
              <WikiTreeMenu menuType={MenuType.Dropdown} />
              <Menu.Divider />
            </>
          );
      }
    }

    // Don't show "open" menus in non-standalone mode.
    if (!props.standalone) {
      return null;
    }

    switch (screenSize) {
      case ScreenSize.LARGE:
        // Show dropdown if chart is shown, otherwise show individual menu
        // items.
        return props.showingChart ? (
          <Menu shadow="md" width={220} keepMounted>
            <Menu.Target>
              <div role="button" tabIndex={0} className="topbar-item">
                <IconFolderOpen
                  size={18}
                  style={{marginRight: 6, verticalAlign: 'middle'}}
                />
                <FormattedMessage id="menu.open" defaultMessage="Open" />
                <IconCaretDownFilled size={12} style={{marginLeft: 10}} />
              </div>
            </Menu.Target>
            <Menu.Dropdown>{fileMenuItems(MenuType.Dropdown)}</Menu.Dropdown>
          </Menu>
        ) : (
          fileMenuItems(MenuType.Menu)
        );

      case ScreenSize.SMALL:
        return (
          <>
            {fileMenuItems(MenuType.Dropdown)}
            <Menu.Divider />
          </>
        );
    }
  }

  function wikiTreeLoginMenu(screenSize: ScreenSize) {
    if (!showWikiTree) {
      return null;
    }
    return (
      <>
        <WikiTreeLoginMenu
          menuType={
            screenSize === ScreenSize.SMALL ? MenuType.Dropdown : MenuType.Menu
          }
        />
        {screenSize === ScreenSize.SMALL ? <Menu.Divider /> : null}
      </>
    );
  }

  function mobileMenus() {
    return (
      <>
        <Menu shadow="md" width={240} keepMounted>
          <Menu.Target>
            <div
              role="button"
              tabIndex={0}
              className="topbar-item"
              aria-label="Menu"
            >
              <IconMenu2 size={22} />
            </div>
          </Menu.Target>
          <Menu.Dropdown>
            {fileMenus(ScreenSize.SMALL)}
            {chartMenus(ScreenSize.SMALL)}
            {googleDriveDisconnectMenu(ScreenSize.SMALL)}
            {wikiTreeLoginMenu(ScreenSize.SMALL)}

            <Menu.Item
              component="a"
              href="https://github.com/PeWu/topola-viewer"
              target="_blank"
              rel="noopener noreferrer"
            >
              <FormattedMessage
                id="menu.github"
                defaultMessage="GitHub project"
              />
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
        <div className="topbar--title">
          {props.standalone ? <Link to="/">{title()}</Link> : title()}
        </div>
        {props.showingChart && props.data && (
          <SearchBar
            results={searchResults}
            value={searchString}
            onSearchChange={setSearchString}
            onResultSelect={handleResultSelect}
            hideShortcutHint={true}
          />
        )}
      </>
    );
  }

  function desktopMenus() {
    return (
      <>
        {props.standalone ? (
          <Link to="/" style={{textDecoration: 'none'}}>
            {title()}
          </Link>
        ) : null}
        {fileMenus(ScreenSize.LARGE)}
        {chartMenus(ScreenSize.LARGE)}
        <div
          style={{marginLeft: 'auto', display: 'flex', alignItems: 'center'}}
        >
          {googleDriveDisconnectMenu(ScreenSize.LARGE)}
          {wikiTreeLoginMenu(ScreenSize.LARGE)}
          <a
            className="topbar-item"
            href="https://github.com/PeWu/topola-viewer"
            target="_blank"
            rel="noopener noreferrer"
          >
            <FormattedMessage
              id="menu.github"
              defaultMessage="GitHub project"
            />
          </a>
        </div>
      </>
    );
  }

  return (
    <div>
      <Media greaterThanOrEqual="large">
        <div className="topbar">{desktopMenus()}</div>
      </Media>
      <Media at="small">
        <div className="topbar">{mobileMenus()}</div>
      </Media>
    </div>
  );
}
