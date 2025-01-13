import Linkify from 'react-linkify';

interface Props {
  lines: (React.ReactNode | string)[];
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
