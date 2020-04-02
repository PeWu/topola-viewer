import * as React from 'react';
import {InjectedIntl} from 'react-intl';
import {SearchResult} from './search_index';
import {formatDateOrRange} from './date_util';
import {JsonIndi} from 'topola';

function getNameLine(result: SearchResult) {
  const name = [result.indi.firstName, result.indi.lastName].join(' ').trim();
  if (result.id.length > 8) {
    return name;
  }
  return (
    <>
      {name} <i>({result.id})</i>
    </>
  );
}

function getDescriptionLine(indi: JsonIndi, intl: InjectedIntl) {
  const birthDate = formatDateOrRange(indi.birth, intl);
  const deathDate = formatDateOrRange(indi.death, intl);
  if (!deathDate) {
    return birthDate;
  }
  return `${birthDate} – ${deathDate}`;
}

/** Produces an object that is displayed in the Semantic UI Search results. */
export function displaySearchResult(result: SearchResult, intl: InjectedIntl) {
  return {
    id: result.id,
    key: result.id,
    title: getNameLine(result),
    description: getDescriptionLine(result.indi, intl),
  };
}
