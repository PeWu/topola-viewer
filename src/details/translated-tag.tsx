import {FormattedMessage} from 'react-intl';

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
  ['birth', 'Birth name'],
  ['married', 'Married name'],
  ['maiden', 'Maiden name'],
  ['immigrant', 'Immigrant name'],
  ['aka', 'Also known as'],
]);

interface Props {
  tag: string;
}

export function TranslatedTag(props: Props) {
  const normalizedTag = props.tag.replace(/_/g, '');
  return (
    <FormattedMessage
      id={`gedcom.${normalizedTag}`}
      defaultMessage={TAG_DESCRIPTIONS.get(normalizedTag) || normalizedTag}
    />
  );
}
