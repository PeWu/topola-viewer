import Linkify from 'react-linkify';

interface Props {
  lines: (JSX.Element | string)[];
}

export function MultilineText(props: Props) {
  return (
    <>
      {props.lines.map((line, index) => (
        <div key={index}>
          <Linkify properties={{target: '_blank'}}>{line}</Linkify>
          <br />
        </div>
      ))}
    </>
  );
}
