import {Combobox, TextInput, useCombobox} from '@mantine/core';
import {IconSearch} from '@tabler/icons-react';
import React, {useEffect, useRef} from 'react';
import {IntlShape, useIntl} from 'react-intl';
import {PersonRecord} from 'topola/model';
import {formatDateOrRange} from '../util/date_util';
import {SearchResult} from './search_index';
import {
  registerSearchInput,
  unregisterSearchInput,
} from './use_search_shortcut';

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

function getDescriptionLine(indi: PersonRecord, currentIntl: IntlShape) {
  const birthDate = formatDateOrRange(indi.birth, currentIntl);
  const deathDate = formatDateOrRange(indi.death, currentIntl);
  if (!deathDate) {
    return birthDate;
  }
  return `${birthDate} – ${deathDate}`;
}

interface Props {
  results: SearchResult[];
  value: string;
  onSearchChange: (value: string) => void;
  onResultSelect: (id: string) => void;
  hideShortcutHint?: boolean;
}

/** Displays and handles the search box in the top bar. */
export const SearchBar = React.memo(function SearchBar(props: Props) {
  const intl = useIntl();
  const wrapperRef = useRef<HTMLDivElement>(null);

  const combobox = useCombobox({
    onDropdownClose: () => combobox.resetSelectedOption(),
  });

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) {
      return;
    }
    const input = el.querySelector('input');
    if (input) {
      registerSearchInput(input);
      return () => unregisterSearchInput(input);
    }
  }, []);

  const placeholder = props.hideShortcutHint
    ? intl.formatMessage({
        id: 'menu.search.placeholder',
        defaultMessage: 'Search for people',
      })
    : intl.formatMessage({
        id: 'menu.search.placeholder_with_shortcut',
        defaultMessage: "Search for people (press '/')",
      });

  const hasResults = props.results.length > 0;
  const hasValue = props.value.trim().length > 0;

  return (
    <div ref={wrapperRef} className="ui search">
      <Combobox
        store={combobox}
        width={252}
        position="bottom-start"
        shadow="md"
        onOptionSubmit={(val) => {
          props.onResultSelect(val);
          combobox.closeDropdown();
        }}
      >
        <Combobox.Target>
          <TextInput
            placeholder={placeholder}
            value={props.value}
            onChange={(event) => {
              props.onSearchChange(event.currentTarget.value);
              combobox.openDropdown();
              combobox.updateSelectedOptionIndex();
            }}
            onClick={() => combobox.openDropdown()}
            onFocus={() => {
              if (hasValue) combobox.openDropdown();
            }}
            onBlur={() => combobox.closeDropdown()}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                if (hasResults) {
                  props.onResultSelect(props.results[0].id);
                  combobox.closeDropdown();
                }
              }
            }}
            rightSection={
              <IconSearch size={16} stroke={2} color="rgba(0, 0, 0, 0.5)" />
            }
            rightSectionPointerEvents="none"
            aria-keyshortcuts="/"
            size="sm"
            radius="xl"
            w={230}
          />
        </Combobox.Target>

        {hasValue && (
          <Combobox.Dropdown className="results" p={0}>
            <Combobox.Options>
              {hasResults ? (
                props.results.map((result, index) => (
                  <Combobox.Option
                    value={result.id}
                    key={result.id}
                    className="result"
                    style={{
                      padding: '10px 14px',
                      borderBottom:
                        index < props.results.length - 1
                          ? '1px solid rgba(34, 36, 38, 0.1)'
                          : 'none',
                      borderRadius: 0,
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: '14px',
                        color: 'rgba(0, 0, 0, 0.87)',
                      }}
                    >
                      {getNameLine(result)}
                    </div>
                    <div
                      style={{
                        fontSize: '13px',
                        color: 'rgba(0, 0, 0, 0.4)',
                        marginTop: 2,
                      }}
                    >
                      {getDescriptionLine(result.indi, intl)}
                    </div>
                  </Combobox.Option>
                ))
              ) : (
                <Combobox.Empty>
                  {intl.formatMessage({
                    id: 'menu.search.no_results',
                    defaultMessage: 'No results found',
                  })}
                </Combobox.Empty>
              )}
            </Combobox.Options>
          </Combobox.Dropdown>
        )}
      </Combobox>
    </div>
  );
});
