import 'canvas-toBlob';
import {detect} from 'detect-browser';
import {createRoot} from 'react-dom/client';
import {IntlProvider} from 'react-intl';
import {HashRouter as Router} from 'react-router';
import 'semantic-ui-css/semantic.min.css';
import {App} from './app';
import './index.css';
import messages_cs from './translations/cs.json';
import messages_de from './translations/de.json';
import messages_fr from './translations/fr.json';
import messages_it from './translations/it.json';
import messages_pl from './translations/pl.json';
import messages_ru from './translations/ru.json';
import {MediaContextProvider, mediaStyles} from './util/media';

const messages: {[language: string]: {[message_id: string]: string}} = {
  cs: messages_cs,
  de: messages_de,
  fr: messages_fr,
  it: messages_it,
  pl: messages_pl,
  ru: messages_ru,
};
const language = navigator.language && navigator.language.split(/[-_]/)[0];

const browser = detect();

const container = document.getElementById('root');
const root = createRoot(container!);

if (browser && browser.name === 'ie') {
  root.render(
    <p>
      Topola Genealogy Viewer does not support Internet Explorer. Please try a
      different (modern) browser.
    </p>,
  );
} else {
  root.render(
    <IntlProvider locale={language} messages={messages[language]}>
      <MediaContextProvider>
        <style>{mediaStyles}</style>
        <Router>
          <App />
        </Router>
      </MediaContextProvider>
    </IntlProvider>,
  );
}
