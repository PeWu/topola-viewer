import * as React from 'react';
import * as ReactDOM from 'react-dom';
import messages_cs from './translations/cs.json';
import messages_de from './translations/de.json';
import messages_fr from './translations/fr.json';
import messages_it from './translations/it.json';
import messages_pl from './translations/pl.json';
import messages_ru from './translations/ru.json';
import {App} from './app';
import {detect} from 'detect-browser';
import {HashRouter as Router, Route} from 'react-router-dom';
import {IntlProvider} from 'react-intl';
import {MediaContextProvider, mediaStyles} from './util/media';
import './index.css';
import 'semantic-ui-css/semantic.min.css';
import 'canvas-toBlob';

const messages = {
  cs: messages_cs,
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
      <MediaContextProvider>
        <style>{mediaStyles}</style>
        <Router>
          <Route component={App} />
        </Router>
      </MediaContextProvider>
    </IntlProvider>,
    document.querySelector('#root'),
  );
}
