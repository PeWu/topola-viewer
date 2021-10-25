import * as React from 'react';
import {injectIntl, WrappedComponentProps} from 'react-intl';
import Linkify from 'react-linkify';

interface Props {
  lines: (JSX.Element | string)[];
}

function joinLines(lines: (JSX.Element | string)[]) {
  return (
    <>
      {lines.map((line, index) => (
        <div key={index}>
          <Linkify properties={{target: '_blank'}}>{line}</Linkify>
          <br />
        </div>
      ))}
    </>
  );
}

class MultilineTextComponent extends React.Component<
  Props & WrappedComponentProps,
  {}
> {
  render() {
    return joinLines(this.props.lines);
  }
}

export const MultilineText = injectIntl(MultilineTextComponent);
