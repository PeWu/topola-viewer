import {Menu} from '@mantine/core';
import React from 'react';

export enum MenuType {
  Menu,
  Dropdown,
}

interface Props {
  menuType?: MenuType;
  onClick?: (event: React.MouseEvent) => void;
  children?: React.ReactNode;
  title?: string;
  href?: string;
  target?: string;
  rel?: string;
  closeMenuOnClick?: boolean;
}

export function MenuItem(props: Props) {
  if (props.menuType === MenuType.Menu) {
    if (props.href) {
      return (
        <a
          href={props.href}
          target={props.target}
          rel={props.rel}
          className="topbar-item"
          title={props.title}
        >
          {props.children}
        </a>
      );
    }
    return (
      <button
        onClick={props.onClick}
        className="topbar-item"
        title={props.title}
      >
        {props.children}
      </button>
    );
  }

  // Dropdown item
  if (props.href) {
    return (
      <Menu.Item
        component="a"
        href={props.href}
        target={props.target}
        rel={props.rel}
        title={props.title}
        closeMenuOnClick={props.closeMenuOnClick}
      >
        {props.children}
      </Menu.Item>
    );
  }
  return (
    <Menu.Item
      onClick={props.onClick}
      title={props.title}
      closeMenuOnClick={props.closeMenuOnClick}
    >
      {props.children}
    </Menu.Item>
  );
}
