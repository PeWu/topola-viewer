import * as locale_en from 'react-intl/locale-data/en';
import * as locale_pl from 'react-intl/locale-data/pl';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import messages_pl from './translations/pl.json';
import {addLocaleData} from 'react-intl';
import {App} from './app';
import {detect} from 'detect-browser';
import {HashRouter as Router, Route} from 'react-router-dom';
import {IntlProvider} from 'react-intl';
import './index.css';
import 'semantic-ui-css/semantic.min.css';
import 'canvas-toBlob';

addLocaleData([...locale_en, ...locale_pl]);

const messages = {
  pl: messages_pl,
};
const language = navigator.language && navigator.language.split(/[-_]/)[0];

const browser = detect();

if (browser && browser.name === 'ie') {
  ReactDOM.render(
    <p>
      Topola Genealogy Viewer does not support Internet Explorer. Please try a
      different browser.
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
