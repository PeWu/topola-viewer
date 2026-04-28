import {useIntl} from 'react-intl';
import {List} from 'semantic-ui-react';
import {formatDateOrRange} from '../../util/date_util';
import {Source} from '../../util/gedcom_util';
import {LinkifyNewTab} from './linkify-new-tab';

interface Props {
  sources?: Source[];
}

export function Sources({sources}: Props) {
  const intl = useIntl();

  if (!sources?.length) return null;

  return (
    <List>
      {sources.map((source, index) => (
        <List.Item key={index}>
          <List.Icon verticalAlign="middle" name="circle" size="tiny" />
          <List.Content>
            <List.Header>
              <LinkifyNewTab>
                {[source.author, source.title, source.publicationInfo]
                  .filter((sourceElement) => !!sourceElement)
                  .join(', ')}
              </LinkifyNewTab>
            </List.Header>
            <List.Description>
              <LinkifyNewTab>{source.page}</LinkifyNewTab>
              {source.date && ` [${formatDateOrRange(source.date, intl)}]`}
            </List.Description>
          </List.Content>
        </List.Item>
      ))}
    </List>
  );
}
