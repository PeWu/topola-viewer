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
  menuType?: MenuType;
}

export class MenuItem extends React.Component<
  Props & MenuItemProps & DropdownItemProps
> {
  render() {
    const newProps = {...this.props};
    // Remove menuType from props to avoid error message in the console.
    delete newProps.menuType;
    return (
      <>
        {this.props.menuType === MenuType.Menu ? (
          <Menu.Item {...newProps}>{this.props.children}</Menu.Item>
        ) : (
          <Dropdown.Item {...newProps}>{this.props.children}</Dropdown.Item>
        )}
      </>
    );
  }
}
