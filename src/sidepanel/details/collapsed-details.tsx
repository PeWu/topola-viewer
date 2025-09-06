import {FormattedMessage} from 'react-intl';
import {GedcomData} from '../../util/gedcom_util';

interface Props {
  gedcom: GedcomData;
  indi: string;
}

export function CollapsedDetails(props: Props) {
  const entries = props.gedcom.indis[props.indi].tree;
  const nameEntry = entries.find((entry) => entry.tag === 'NAME');

  const fullName = nameEntry?.data.replaceAll('/', '') ?? '';

  return (
    <div className="collapsed-details">
      {fullName ? (
        <span className="vertical-name">{fullName}</span>
      ) : (
        <span className="vertical-name">
          <FormattedMessage id="name.unknown_name" defaultMessage="N.N." />
        </span>
      )}
    </div>
  );
}
