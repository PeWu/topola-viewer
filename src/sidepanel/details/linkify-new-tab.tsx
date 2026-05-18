import Linkify from 'react-linkify';

interface Props {
  children: React.ReactNode;
}

/**
 * A wrapper component that uses react-linkify to convert any plain text URLs
 * within its children into clickable links that open in a new tab.
 */
export function LinkifyNewTab({children}: Props) {
  return (
    <Linkify
      componentDecorator={(
        decoratedHref: string,
        decoratedText: string,
        key: number,
      ) => (
        <a
          href={decoratedHref}
          key={key}
          target="_blank"
          rel="noopener noreferrer"
        >
          {decoratedText}
        </a>
      )}
    >
      {children}
    </Linkify>
  );
}
