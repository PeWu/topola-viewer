import {useIntl} from 'react-intl';
import {Label, List, SemanticCOLORS} from 'semantic-ui-react';
import {formatDateOrRange} from '../../util/date_util';
import {Source} from '../../util/gedcom_util';
import {LinkifyNewTab} from './linkify-new-tab';

interface Props {
  sources?: Source[];
}

/** Label text and color for each GEDCOM QUAY value. */
const QUALITY_LABELS: Array<{
  id: string;
  defaultMessage: string;
  color: SemanticCOLORS;
}> = [
  {id: 'source.quality.0', defaultMessage: 'unreliable', color: 'red'},
  {id: 'source.quality.1', defaultMessage: 'questionable', color: 'orange'},
  {id: 'source.quality.2', defaultMessage: 'secondary', color: 'blue'},
  {id: 'source.quality.3', defaultMessage: 'primary', color: 'green'},
];

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
              {source.quality !== undefined && (
                <Label
                  size="mini"
                  basic
                  color={QUALITY_LABELS[source.quality].color}
                  style={{marginLeft: '0.5em'}}
                  title={`QUAY ${source.quality}`}
                >
                  {intl.formatMessage(QUALITY_LABELS[source.quality])}
                </Label>
              )}
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
