import {useIntl} from 'react-intl';
import {Button, Icon, Sidebar, Tab} from 'semantic-ui-react';
import {TopolaData} from '../util/gedcom_util';
import {Config, ConfigPanel} from './config/config';
import {CollapsedDetails} from './details/collapsed-details';
import {Details} from './details/details';

interface SidePanelProps {
  data: TopolaData;
  selectedIndiId: string;
  config: Config;
  onConfigChange: (config: Config) => void;
  expanded: boolean;
  onToggle: () => void;
}

export function SidePanel({
  data,
  selectedIndiId,
  config,
  onConfigChange,
  expanded,
  onToggle,
}: SidePanelProps) {
  const intl = useIntl();

  const tabs = [
    {
      menuItem: intl.formatMessage({
        id: 'tab.info',
        defaultMessage: 'Info',
      }),
      render: () => <Details gedcom={data.gedcom} indi={selectedIndiId} />,
    },
    {
      menuItem: intl.formatMessage({
        id: 'tab.settings',
        defaultMessage: 'Settings',
      }),
      render: () => <ConfigPanel gedcom={data.gedcom} config={config} onChange={onConfigChange} />,
    },
  ];

  return (
    <Sidebar
      id="sidebar"
      animation="overlay"
      icon="labeled"
      width={expanded ? 'wide' : 'very thin'}
      direction="right"
      visible={true}
    >
      {expanded ? (
        <Tab id="sideTabs" panes={tabs} />
      ) : (
        <CollapsedDetails gedcom={data.gedcom} indi={selectedIndiId} />
      )}
      <Button id="sideToggle" icon size="mini" onClick={() => onToggle()}>
        <Icon size="large" name={expanded ? 'arrow right' : 'arrow left'} />
      </Button>
    </Sidebar>
  );
}
