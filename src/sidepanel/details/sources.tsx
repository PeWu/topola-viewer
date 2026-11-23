import {List, Text} from '@mantine/core';
import {IconPointFilled} from '@tabler/icons-react';
import {useIntl} from 'react-intl';
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
    <List spacing={6} size="sm">
      {sources.map((source, index) => (
        <List.Item
          key={index}
          icon={
            <IconPointFilled
              size={12}
              style={{color: 'rgba(0, 0, 0, 0.87)', verticalAlign: 'middle'}}
            />
          }
        >
          <Text
            size="sm"
            fw={700}
            style={{color: 'rgba(0, 0, 0, 0.87)', lineHeight: 1.2857}}
          >
            <LinkifyNewTab>
              {[source.author, source.title, source.publicationInfo]
                .filter((sourceElement) => !!sourceElement)
                .join(', ')}
            </LinkifyNewTab>
          </Text>
          <Text
            size="sm"
            style={{color: 'rgba(0, 0, 0, 0.7)', lineHeight: 1.35}}
          >
            <LinkifyNewTab>{source.page}</LinkifyNewTab>
            {source.date && ` [${formatDateOrRange(source.date, intl)}]`}
          </Text>
        </List.Item>
      ))}
    </List>
  );
}
