import {GedcomEntry} from 'parse-gedcom';
import queryString from 'query-string';
import {FormattedMessage} from 'react-intl';
import {Link, useLocation} from 'react-router';
import {getName, pointerToId} from '../../util/gedcom_util';

interface Props {
  person: GedcomEntry;
}

/**
 * Renders a clickable link to an individual's profile view, preserving existing query parameters.
 */
export function PersonLink(props: Props) {
  const location = useLocation();

  const name = getName(props.person);

  const search = queryString.parse(location.search);
  search['indi'] = pointerToId(props.person.pointer);

  return (
    <Link to={{pathname: '/view', search: queryString.stringify(search)}}>
      {name ? (
        name
      ) : (
        <FormattedMessage id="name.unknown_name" defaultMessage="N.N." />
      )}
    </Link>
  );
}
