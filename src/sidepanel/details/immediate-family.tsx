import {GedcomEntry} from 'parse-gedcom';
import {FormattedMessage} from 'react-intl';
import {Header, Item} from 'semantic-ui-react';
import {getDate} from 'topola';
import {compareDates} from '../../util/date_util';
import {GedcomData, pointerToId, resolveDate} from '../../util/gedcom_util';
import {PersonLink} from './person-link';

interface Props {
  gedcom: GedcomData;
  indi: string;
}

function mapSpousalFamily(
  familyRecord: GedcomEntry,
  gedcom: GedcomData,
  indi: string,
) {
  const spouseSubEntry = familyRecord.tree?.find(
    (sub) =>
      ['HUSB', 'WIFE'].includes(sub.tag) && pointerToId(sub.data) !== indi,
  );
  const spouseId = spouseSubEntry
    ? pointerToId(spouseSubEntry.data)
    : undefined;
  const spouseRecord = spouseId ? gedcom.indis[spouseId] : undefined;

  const chilSubEntries =
    familyRecord.tree?.filter((sub) => sub.tag === 'CHIL') || [];

  const validChildren = chilSubEntries.filter(
    (childSub) => !!gedcom.indis[pointerToId(childSub.data)],
  );

  // Pre-parse dates to avoid redundant O(N log N) parsing inside sort comparator
  const mappedChildren = validChildren.map((childSub) => {
    const childEntry = gedcom.indis[pointerToId(childSub.data)];
    const birt = childEntry?.tree.find((sub) => sub.tag === 'BIRT');
    const dateSub = birt ? resolveDate(birt) : undefined;
    const parsedDate = dateSub ? getDate(dateSub.data) : undefined;
    return {
      childEntry,
      parsedDate,
    };
  });

  const sortedChildren = mappedChildren
    .sort((a, b) => compareDates(a.parsedDate, b.parsedDate))
    .map((item) => item.childEntry);

  return {
    familyId: pointerToId(familyRecord.pointer),
    spouseTag: spouseSubEntry?.tag,
    spouseRecord,
    children: sortedChildren,
  };
}

/**
 * Renders the immediate family section of a person, displaying their parents,
 * spouses, and children.
 */
export function ImmediateFamily(props: Props) {
  const personEntry = props.gedcom.indis[props.indi];
  if (!personEntry) {
    return null;
  }

  const entries = personEntry.tree;

  // --- Parents Block Renderer ---
  const famcEntry = entries.find((sub) => sub.tag === 'FAMC');
  const parentalFamily = famcEntry
    ? props.gedcom.fams[pointerToId(famcEntry.data)]
    : undefined;

  const isParentalFamilyValid = parentalFamily?.tag === 'FAM';

  const husbEntry = isParentalFamilyValid
    ? parentalFamily?.tree.find((sub) => sub.tag === 'HUSB')
    : undefined;
  const wifeEntry = isParentalFamilyValid
    ? parentalFamily?.tree.find((sub) => sub.tag === 'WIFE')
    : undefined;

  const fatherId = husbEntry ? pointerToId(husbEntry.data) : undefined;
  const fatherRecord = fatherId ? props.gedcom.indis[fatherId] : undefined;

  const motherId = wifeEntry ? pointerToId(wifeEntry.data) : undefined;
  const motherRecord = motherId ? props.gedcom.indis[motherId] : undefined;

  const hasParents = fatherRecord || motherRecord;

  // --- Spouses and Children Block Renderer ---
  const famsEntries = entries.filter((sub) => sub.tag === 'FAMS');
  const spousalFamilies = famsEntries.map(
    (entry) => props.gedcom.fams[pointerToId(entry.data)],
  );

  const mappedFamilies = spousalFamilies.map((familyRecord) =>
    mapSpousalFamily(familyRecord, props.gedcom, props.indi),
  );

  const validMappedFamilies = mappedFamilies.filter(
    (group) => group.spouseRecord || group.children.length > 0,
  );

  const totalValidFams = validMappedFamilies.length;
  const hasSpousesOrChildren = totalValidFams > 0;

  if (!hasParents && !hasSpousesOrChildren) {
    return null;
  }

  return (
    <Item>
      <Item.Content>
        <div className="item-header">
          <Header as="span" size="small">
            <FormattedMessage
              id="family.immediate_family"
              defaultMessage="Immediate Family"
            />
          </Header>
        </div>
        {hasParents && (
          <div className="parents-block">
            {fatherRecord && (
              <div>
                <strong>
                  <FormattedMessage
                    id="family.father"
                    defaultMessage="Father"
                  />
                </strong>
                : <PersonLink person={fatherRecord} />
              </div>
            )}
            {motherRecord && (
              <div>
                <strong>
                  <FormattedMessage
                    id="family.mother"
                    defaultMessage="Mother"
                  />
                </strong>
                : <PersonLink person={motherRecord} />
              </div>
            )}
          </div>
        )}

        {validMappedFamilies.map((group) => {
          const showUnknownSpouse = !group.spouseRecord && totalValidFams > 1;
          return (
            <div key={group.familyId} className="spousal-group">
              {group.spouseRecord ? (
                <div>
                  <strong>
                    {group.spouseTag === 'HUSB' ? (
                      <FormattedMessage
                        id="family.husband"
                        defaultMessage="Husband"
                      />
                    ) : (
                      <FormattedMessage
                        id="family.wife"
                        defaultMessage="Wife"
                      />
                    )}
                  </strong>
                  : <PersonLink person={group.spouseRecord} />
                </div>
              ) : showUnknownSpouse ? (
                <div>
                  <strong>
                    <FormattedMessage
                      id="family.unknown_spouse"
                      defaultMessage="Unknown Spouse"
                    />
                  </strong>
                </div>
              ) : null}

              {group.children.length > 0 && (
                <div className="children-block">
                  <div>
                    <strong>
                      {group.children.length === 1 ? (
                        <FormattedMessage
                          id="family.child"
                          defaultMessage="Child"
                        />
                      ) : (
                        <FormattedMessage
                          id="family.children"
                          defaultMessage="Children"
                        />
                      )}
                    </strong>
                    :&nbsp;
                  </div>
                  <div>
                    {group.children.map((child) => (
                      <div key={child.pointer}>
                        <PersonLink person={child} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </Item.Content>
    </Item>
  );
}
