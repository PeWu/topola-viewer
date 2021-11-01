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

export function MenuItem(props: Props & MenuItemProps & DropdownItemProps) {
  const newProps = {...props};
  // Remove menuType from props to avoid error message in the console.
  delete newProps.menuType;
  return (
    <>
      {props.menuType === MenuType.Menu ? (
        <Menu.Item {...newProps}>{props.children}</Menu.Item>
      ) : (
        <Dropdown.Item {...newProps}>{props.children}</Dropdown.Item>
      )}
    </>
  );
}
