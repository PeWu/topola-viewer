import {Divider, List, Text} from '@mantine/core';
import {
  IconCalendar,
  IconCopyright,
  IconEdit,
  IconFile,
  IconMail,
  IconMapPin,
  IconPhone,
  IconUser,
} from '@tabler/icons-react';
import {FormattedMessage, useIntl} from 'react-intl';
import {parseGedcomDate} from 'topola/gedcom';
import {formatDateOrRange} from '../../util/date_util';
import {dereference, GedcomData} from '../../util/gedcom_util';

export function SourceHead(gedcom: GedcomData) {
  const head = gedcom.head;
  /* Don't show the section if there is no relevant information */
  if (!head || !head.tree) {
    return null;
  }

  const sour = head.tree.find((entry) => entry.tag === 'SOUR');
  const sour_name =
    sour && sour.tree && sour.tree.find((entry) => entry.tag === 'NAME')?.data; // Software name

  const date = head.tree.find((entry) => entry.tag === 'DATE'); // Creation date
  const intl = useIntl();
  const dateFormatted = date
    ? formatDateOrRange(parseGedcomDate(date.data), intl)
    : null; // Formatted creation date

  const file = head.tree.find((entry) => entry.tag === 'FILE')?.data; // File path
  const filename = file && (file.split('\\').pop() || file.split('/').pop()); // Extract file name from path
  const copr = head.tree.find((entry) => entry.tag === 'COPR')?.data; // Copyright

  // Reference to submitter
  const submReference = head.tree.find((entry) => entry.tag === 'SUBM');
  const subm =
    submReference &&
    dereference(submReference, gedcom, (gedcom) => gedcom.other);

  const name =
    subm && subm.tree && subm.tree.find((entry) => entry.tag === 'NAME')?.data; // Submitter name
  const phon =
    subm && subm.tree && subm.tree.find((entry) => entry.tag === 'PHON')?.data; // Phone number
  const email =
    subm && subm.tree && subm.tree.find((entry) => entry.tag === 'EMAIL')?.data; // Email

  const addr =
    subm && subm.tree && subm.tree.find((entry) => entry.tag === 'ADDR'); // Address
  const adr1 =
    addr && addr.tree && addr.tree.find((entry) => entry.tag === 'ADR1')?.data; // Street address
  const city =
    addr && addr.tree && addr.tree.find((entry) => entry.tag === 'CITY')?.data; // City
  const post =
    addr && addr.tree && addr.tree.find((entry) => entry.tag === 'POST')?.data; // Postal code
  const location = [adr1, post, city].filter(Boolean).join(', '); // Combined location

  /* Don't show the section if there is no relevant information */
  if (
    !(
      sour_name ||
      dateFormatted ||
      filename ||
      copr ||
      name ||
      phon ||
      email ||
      location
    )
  ) {
    return null;
  }

  return (
    <div style={{padding: '0 15px 0 25px'}}>
      <Text
        className="sub-header"
        size="xs"
        fw={700}
        tt="uppercase"
        mb={6}
        style={{color: 'rgba(0, 0, 0, 0.87)', lineHeight: 1.2}}
      >
        <FormattedMessage id="head.source" defaultMessage="Data source" />
      </Text>
      <List
        spacing={5}
        size="sm"
        styles={{
          itemIcon: {
            width: 20,
            textAlign: 'center',
            marginRight: 4,
            color: 'rgba(0, 0, 0, 0.87)',
          },
        }}
      >
        {sour_name && (
          <List.Item icon={<IconEdit size={15} stroke={2} />}>
            {sour_name}
          </List.Item>
        )}

        {date && (
          <List.Item icon={<IconCalendar size={15} stroke={2} />}>
            {dateFormatted}
          </List.Item>
        )}
        {file && (
          <List.Item icon={<IconFile size={15} stroke={2} />}>
            {filename}
          </List.Item>
        )}
        {name && (
          <List.Item icon={<IconUser size={15} stroke={2} />}>{name}</List.Item>
        )}
        {adr1 && (
          <List.Item icon={<IconMapPin size={15} stroke={2} />}>
            {location}
          </List.Item>
        )}
        {phon && (
          <List.Item icon={<IconPhone size={15} stroke={2} />}>
            {phon}
          </List.Item>
        )}
        {email && (
          <List.Item icon={<IconMail size={15} stroke={2} />}>
            {email}
          </List.Item>
        )}
        {copr && (
          <List.Item icon={<IconCopyright size={15} stroke={2} />}>
            {copr}
          </List.Item>
        )}
      </List>
      <Divider my={14} color="rgba(34, 36, 38, 0.15)" />
    </div>
  );
}
