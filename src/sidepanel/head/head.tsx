import {
  dereference,
  GedcomData,
} from '../../util/gedcom_util';
import {FormattedMessage, useIntl} from 'react-intl';
import {Header, Divider, List} from 'semantic-ui-react';
import {getDate} from 'topola';
import {formatDateOrRange} from '../../util/date_util';

export function SourceHead(gedcom: GedcomData){
  const head = gedcom.head;
  /* Don't show the section if there is no relevant information */
  if (!head || !head.tree) {
    return null;
  } 

  const sour = head.tree.find((entry) => entry.tag === 'SOUR');
  const sour_name = sour && sour.tree && sour.tree.find((entry) => entry.tag === 'NAME')?.data; // Software name

  const date = head.tree.find((entry) => entry.tag === 'DATE'); // Creation date
  const intl = useIntl();
  const dateFormatted = date ? formatDateOrRange(getDate(date.data), intl) : null; // Formatted creation date

  const file = head.tree.find((entry) => entry.tag === 'FILE')?.data; // File path
  const filename = file && ( file.split('\\').pop() || file.split('/').pop() ); // Extract file name from path
  const copr = head.tree.find((entry) => entry.tag === 'COPR')?.data; // Copyright

  // Reference to submitter
  const submReference = head.tree.find((entry) => entry.tag === 'SUBM');
  const subm = submReference && dereference(submReference, gedcom, (gedcom) => gedcom.other);

  const name = subm && subm.tree && subm.tree.find((entry) => entry.tag === 'NAME')?.data; // Submitter name
  const phon = subm && subm.tree && subm.tree.find((entry) => entry.tag === 'PHON')?.data; // Phone number
  const email = subm && subm.tree && subm.tree.find((entry) => entry.tag === 'EMAIL')?.data; // Email

  const addr = subm && subm.tree && subm.tree.find((entry) => entry.tag === 'ADDR'); // Address
  const adr1 = addr && addr.tree && addr.tree.find((entry) => entry.tag === 'ADR1')?.data; // Street address
  const city = addr && addr.tree && addr.tree.find((entry) => entry.tag === 'CITY')?.data; // City
  const post = addr && addr.tree && addr.tree.find((entry) => entry.tag === 'POST')?.data; // Postal code
  const location = [adr1, post, city].filter(Boolean).join(', '); // Combined location

  /* Don't show the section if there is no relevant information */
  if (!(sour_name || dateFormatted || filename || copr || name || phon || email || location)) {
    return null;
  }

  // Icons: https://react.semantic-ui.com/elements/icon/
    return (
      <>
      <Header sub>
        <FormattedMessage id="head.source" defaultMessage="Data source" />
      </Header>
      <List>
        {sour_name && (          
          <List.Item>
            <List.Icon name='edit' />
            <List.Content>{sour_name}</List.Content>
          </List.Item>
        )}
        
        {date && (
          <List.Item>
            <List.Icon name='calendar' />
            <List.Content>{dateFormatted}</List.Content>
          </List.Item>
        )}
        {file && (
          <List.Item>
            <List.Icon name='file' />
            <List.Content>{filename}</List.Content>
          </List.Item>
        )}
        {name && (
          <List.Item>
            <List.Icon name='user' />
            <List.Content>{name}</List.Content>
          </List.Item>
        )}
        {adr1 && (
          <List.Item>
            <List.Icon name='marker' />
            <List.Content>{location}</List.Content>
          </List.Item>
        )}
         {phon && (
          <List.Item>
            <List.Icon name='phone' />
            <List.Content>{phon}</List.Content>
          </List.Item>
        )}
        {email && (
          <List.Item>
            <List.Icon name='mail' />
            <List.Content>{email}</List.Content>
          </List.Item>
        )}
        {copr && (
          <List.Item>
            <List.Icon name='copyright' />
            <List.Content>{copr}</List.Content>
          </List.Item>
        )}
      </List>

      <Divider />
      </>
    );
}