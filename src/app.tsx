import * as React from 'react';
import {ChartView} from './chart_view';
import {Route, RouteComponentProps, Switch} from 'react-router-dom';
import {Intro} from './intro';
import {TopBar} from './top_bar';

export class App extends React.Component<{}, {}> {
  chartViewRef?: ChartView;

  render() {
    return (
      <div className="root">
        <Route
          component={(props: RouteComponentProps) => (
            <TopBar
              {...props}
              onPrint={() => this.chartViewRef && this.chartViewRef.print()}
              onDownloadSvg={() =>
                this.chartViewRef && this.chartViewRef.downloadSvg()
              }
              onDownloadPng={() =>
                this.chartViewRef && this.chartViewRef.downloadPng()
              }
            />
          )}
        />
        <Switch>
          <Route exact path="/" component={Intro} />
          <Route
            exact
            path="/view"
            component={(props: RouteComponentProps) => (
              <ChartView {...props} ref={(ref) => (this.chartViewRef = ref!)} />
            )}
          />
        </Switch>
      </div>
    );
  }
}
