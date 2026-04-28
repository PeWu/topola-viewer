import {LinkifyNewTab} from './linkify-new-tab';

interface Props {
  lines: (React.ReactNode | string)[];
}

export function MultilineText(props: Props) {
  return (
    <>
      {props.lines.map((line, index) => (
        <div key={index}>
          <LinkifyNewTab>{line}</LinkifyNewTab>
          <br />
        </div>
      ))}
    </>
  );
}
