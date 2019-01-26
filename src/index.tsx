import * as React from 'react';
import * as ReactDOM from 'react-dom';
import {ChartView} from './chart_view';
import {HashRouter as Router, Route, Switch} from 'react-router-dom';
import {Intro} from './intro';
import {TopBar} from './top_bar';
import 'semantic-ui-css/semantic.min.css';
import './index.css';

ReactDOM.render(
  <Router>
    <div className="root">
      <Route component={TopBar} />
      <Switch>
        <Route exact path="/" component={Intro} />
        <Route exact path="/view" component={ChartView} />
      </Switch>
    </div>
  </Router>,
  document.querySelector('#root'),
);
