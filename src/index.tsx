import * as locale_en from 'react-intl/locale-data/en';
import * as locale_pl from 'react-intl/locale-data/pl';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import messages_pl from './translations/pl.json';
import {addLocaleData} from 'react-intl';
import {detect} from 'detect-browser';
import {ChartView} from './chart_view';
import {
  HashRouter as Router,
  Route,
  RouteComponentProps,
  Switch,
} from 'react-router-dom';
import {IntlProvider} from 'react-intl';
import {Intro} from './intro';
import {TopBar} from './top_bar';
import './index.css';
import 'semantic-ui-css/semantic.min.css';

addLocaleData([...locale_en, ...locale_pl]);

const messages = {
  pl: messages_pl,
};
const language = navigator.language && navigator.language.split(/[-_]/)[0];

const browser = detect();

let chartViewRef: ChartView | null = null;

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
        <div className="root">
          <Route
            component={(props: RouteComponentProps) => (
              <TopBar
                {...props}
                onPrint={() => chartViewRef && chartViewRef.print()}
                onDownloadSvg={() => chartViewRef && chartViewRef.downloadSvg()}
                onDownloadPng={() => chartViewRef && chartViewRef.downloadPng()}
              />
            )}
          />
          <Switch>
            <Route exact path="/" component={Intro} />
            <Route
              exact
              path="/view"
              component={(props: RouteComponentProps) => (
                <ChartView {...props} ref={(ref) => (chartViewRef = ref)} />
              )}
            />
          </Switch>
        </div>
      </Router>
    </IntlProvider>,
    document.querySelector('#root'),
  );
}
