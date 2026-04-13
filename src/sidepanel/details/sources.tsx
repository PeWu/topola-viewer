import {useIntl} from 'react-intl';
import Linkify from 'react-linkify';
import {List} from 'semantic-ui-react';
import {formatDateOrRange} from '../../util/date_util';
import {Source, getFileName} from '../../util/gedcom_util';
import {WrappedImage} from './wrapped-image';

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
          <List.Icon verticalAlign="top" name="circle" size="tiny"/>
          <List.Content>
            <List.Header>
              <Linkify properties={{target: '_blank'}}>
                {[source.author, source.title, source.publicationInfo]
                  .filter((sourceElement) => !!sourceElement)
                  .join(', ')}
              </Linkify>
            </List.Header>
            <List.Description>
              <Linkify properties={{target: '_blank'}}>{source.page}</Linkify>
              {source.date && ` [${formatDateOrRange(source.date, intl)}]`}
              {source.images?.length ? (
                <div className="source-images">
                  {source.images.map((image, imageIndex) => (
                    <div key={imageIndex} className="source-image">
                      <WrappedImage
                        url={image.data}
                        filename={getFileName(image) || ''}
                      />
                    </div>
                  ))}
                </div>
              ) : null}
            </List.Description>
          </List.Content>
        </List.Item>
      ))}
    </List>
  );
}
