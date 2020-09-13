import * as locale_de from 'react-intl/locale-data/de';
import * as locale_en from 'react-intl/locale-data/en';
import * as locale_fr from 'react-intl/locale-data/fr';
import * as locale_it from 'react-intl/locale-data/it';
import * as locale_pl from 'react-intl/locale-data/pl';
import * as locale_ru from 'react-intl/locale-data/ru';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import messages_de from './translations/de.json';
import messages_fr from './translations/fr.json';
import messages_it from './translations/it.json';
import messages_pl from './translations/pl.json';
import messages_ru from './translations/ru.json';
import {addLocaleData} from 'react-intl';
import {App} from './app';
import {detect} from 'detect-browser';
import {HashRouter as Router, Route} from 'react-router-dom';
import {IntlProvider} from 'react-intl';
import './index.css';
import 'semantic-ui-css/semantic.min.css';
import 'canvas-toBlob';

addLocaleData([
  ...locale_de,
  ...locale_en,
  ...locale_fr,
  ...locale_it,
  ...locale_pl,
  ...locale_ru,
]);

const messages = {
  de: messages_de,
  fr: messages_fr,
  it: messages_it,
  pl: messages_pl,
  ru: messages_ru,
};
const language = navigator.language && navigator.language.split(/[-_]/)[0];

const browser = detect();

if (browser && browser.name === 'ie') {
  ReactDOM.render(
    <p>
      Topola Genealogy Viewer does not support Internet Explorer. Please try a
      different (modern) browser.
    </p>,
    document.querySelector('#root'),
  );
} else {
  ReactDOM.render(
    <IntlProvider locale={language} messages={messages[language]}>
      <Router>
        <Route component={App} />
      </Router>
    </IntlProvider>,
    document.querySelector('#root'),
  );
}
