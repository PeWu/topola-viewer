import 'react-app-polyfill/ie11';
import 'string.prototype.startswith';
import 'array.prototype.find';
import * as locale_en from 'react-intl/locale-data/en';
import * as locale_pl from 'react-intl/locale-data/pl';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import messages_pl from './translations/pl.json';
import {addLocaleData} from 'react-intl';
import {ChartView} from './chart_view';
import {HashRouter as Router, Route, Switch} from 'react-router-dom';
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

ReactDOM.render(
  <IntlProvider locale={language} messages={messages[language]}>
    <Router>
      <div className="root">
        <Route component={TopBar} />
        <Switch>
          <Route exact path="/" component={Intro} />
          <Route exact path="/view" component={ChartView} />
        </Switch>
      </div>
    </Router>
  </IntlProvider>,
  document.querySelector('#root'),
);
