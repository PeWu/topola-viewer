import '@fontsource/lato/400-italic.css';
import '@fontsource/lato/400.css';
import '@fontsource/lato/700-italic.css';
import '@fontsource/lato/700.css';
import {createTheme, MantineProvider} from '@mantine/core';
import '@mantine/core/styles.css';
import 'canvas-toBlob';
import {detect} from 'detect-browser';
import {createRoot} from 'react-dom/client';
import {IntlProvider} from 'react-intl';
import {HashRouter as Router} from 'react-router';
import {App} from './app';
import './index.css';

import messages_bg from './translations/bg.json';
import messages_cs from './translations/cs.json';
import messages_de from './translations/de.json';
import messages_fr from './translations/fr.json';
import messages_it from './translations/it.json';
import messages_pl from './translations/pl.json';
import messages_ru from './translations/ru.json';
import messages_sv from './translations/sv.json';
import {MediaContextProvider, mediaStyles} from './util/media';

const theme = createTheme({
  fontFamily: "Lato, 'Helvetica Neue', Arial, Helvetica, sans-serif",
  headings: {
    fontFamily: "Lato, 'Helvetica Neue', Arial, Helvetica, sans-serif",
  },
});

const messages: {[language: string]: {[message_id: string]: string}} = {
  bg: messages_bg,
  cs: messages_cs,
  de: messages_de,
  fr: messages_fr,
  it: messages_it,
  pl: messages_pl,
  ru: messages_ru,
  sv: messages_sv,
};
const language = navigator.language && navigator.language.split(/[-_]/)[0];

const browser = detect();

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const container = document.getElementById('root')!;
const root = createRoot(container);

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
        <MantineProvider theme={theme}>
          <Router>
            <App />
          </Router>
        </MantineProvider>
      </MediaContextProvider>
    </IntlProvider>,
  );
}
