import {FormattedMessage} from 'react-intl';

const TAG_DESCRIPTIONS = new Map([
  ['ADOP', 'Adoption'],
  ['BAPM', 'Baptism'],
  ['BARM', 'Bar Mitzvah'],
  ['BASM', 'Bas Mitzvah'],
  ['BIRT', 'Birth'],
  ['BLES', 'Blessing'],
  ['BURI', 'Burial'],
  ['CENS', 'Census'],
  ['CHR', 'Christening'],
  ['CHRA', 'Adult christening'],
  ['CONF', 'Confirmation'],
  ['CREM', 'Cremation'],
  ['DEAT', 'Death'],
  ['DEG', 'Degree'],
  ['DIV', 'Divorce'],
  ['DIVF', 'Divorce filed'],
  ['EDUC', 'Education'],
  ['ELEC', 'Elected'],
  ['EMAIL', 'E-mail'],
  ['EMIG', 'Emigration'],
  ['ENGA', 'Engagement'],
  ['EVEN', 'Event'],
  ['FACT', 'Fact'],
  ['FCOM', 'First communion'],
  ['GRAD', 'Graduation'],
  ['IMMI', 'Immigration'],
  ['MARB', 'Marriage bann'],
  ['MARC', 'Marriage contract'],
  ['MARL', 'Marriage license'],
  ['MARR', 'Marriage'],
  ['MARS', 'Marriage settlement'],
  ['MDCL', 'Medical info'],
  ['MILT', 'Military services'],
  ['NATU', 'Naturalization'],
  ['OBJE', 'Additional files'],
  ['OCCU', 'Occupation'],
  ['ORDN', 'Ordination'],
  ['PROB', 'Probate'],
  ['PROP', 'Property'],
  ['RESI', 'Residence'],
  ['RETI', 'Retirement'],
  ['SOUR', 'Sources'],
  ['TITL', 'Title'],
  ['WILL', 'Will'],
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
