import * as React from 'react';
import {
  Menu,
  Dropdown,
  MenuItemProps,
  DropdownItemProps,
} from 'semantic-ui-react';

export enum MenuType {
  Menu,
  Dropdown,
}

interface Props {
  menuType: MenuType;
}

export class MenuItem extends React.Component<
  Props & MenuItemProps & DropdownItemProps
> {
  render() {
    return (
      <>
        {this.props.menuType === MenuType.Menu ? (
          <Menu.Item {...this.props}>{this.props.children}</Menu.Item>
        ) : (
          <Dropdown.Item {...this.props}>{this.props.children}</Dropdown.Item>
        )}
      </>
    );
  }
}
