import {FormattedMessage, injectIntl, WrappedComponentProps} from 'react-intl';
import * as React from 'react';

interface Props {
  tag: string;
}

const TAG_DESCRIPTIONS = new Map([
  ['ADOP', 'Adoption'],
  ['BAPM', 'Baptism'],
  ['BIRT', 'Birth'],
  ['BURI', 'Burial'],
  ['CENS', 'Census'],
  ['CHR', 'Christening'],
  ['CREM', 'Cremation'],
  ['DEAT', 'Death'],
  ['EDUC', 'Education'],
  ['EMAIL', 'E-mail'],
  ['EMIG', 'Emigration'],
  ['EVEN', 'Event'],
  ['FACT', 'Fact'],
  ['IMMI', 'Immigration'],
  ['MARR', 'Marriage'],
  ['DIV', 'Divorce'],
  ['MILT', 'Military services'],
  ['NATU', 'Naturalization'],
  ['OCCU', 'Occupation'],
  ['TITL', 'Title'],
  ['WWW', 'WWW'],
]);

function translateTag(tag: string) {
  const normalizedTag = tag.replace(/_/g, '');
  return (
    <FormattedMessage
      id={`gedcom.${normalizedTag}`}
      defaultMessage={TAG_DESCRIPTIONS.get(normalizedTag) || normalizedTag}
    />
  );
}

class TranslatedTagComponent extends React.Component<
  Props & WrappedComponentProps,
  {}
> {
  render() {
    return translateTag(this.props.tag);
  }
}

export const TranslatedTag = injectIntl(TranslatedTagComponent);
