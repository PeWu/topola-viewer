import * as React from 'react';
import {GedcomEntry} from 'parse-gedcom';
import {InjectedIntl} from 'react-intl';
import {SearchResult} from './search_index';
import {translateDate} from './date_util';

function getNameLine(result: SearchResult) {
  const nameTag = result.indi.tree.find((entry) => entry.tag === 'NAME');
  const name =
    nameTag &&
    nameTag.data
      .split('/')
      .filter((s) => !!s)
      .join(' ');
  if (result.id.length > 8) {
    return name;
  }
  return (
    <>
      {name} <i>({result.id})</i>
    </>
  );
}

function getDate(indi: GedcomEntry, tag: string, intl: InjectedIntl) {
  const eventEntry = indi.tree.find((entry) => entry.tag === tag);
  const dateEntry =
    eventEntry && eventEntry.tree.find((entry) => entry.tag === 'DATE');
  return (dateEntry && translateDate(dateEntry.data, intl)) || '';
}

function getDescriptionLine(indi: GedcomEntry, intl: InjectedIntl) {
  const birthDate = getDate(indi, 'BIRT', intl);
  const deathDate = getDate(indi, 'DEAT', intl);
  if (!deathDate) {
    return birthDate;
  }
  return `${birthDate} – ${deathDate}`;
}

/** Produces an object that is displayed in the Semantic UI Search results. */
export function displaySearchResult(result: SearchResult, intl: InjectedIntl) {
  return {
    id: result.id,
    title: getNameLine(result),
    description: getDescriptionLine(result.indi, intl),
  };
}
