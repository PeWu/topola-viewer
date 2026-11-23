import {Tabs} from '@mantine/core';
import {IconArrowLeft, IconArrowRight} from '@tabler/icons-react';
import {useIntl} from 'react-intl';
import {TopolaData} from '../util/gedcom_util';
import {Config, ConfigPanel} from './config/config';
import {CollapsedDetails} from './details/collapsed-details';
import {Details} from './details/details';

interface SidePanelProps {
  data: TopolaData;
  selectedIndiId: string;
  config: Config;
  onConfigChange: (patch: Partial<Config>) => void;
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

  return (
    <div id="sidebar" className={expanded ? 'wide' : 'very thin'}>
      {expanded ? (
        <Tabs id="sideTabs" defaultValue="info" variant="outline" radius={4}>
          <Tabs.List style={{paddingLeft: 60, height: 43}}>
            <Tabs.Tab value="info">
              {intl.formatMessage({
                id: 'tab.info',
                defaultMessage: 'Info',
              })}
            </Tabs.Tab>
            <Tabs.Tab value="settings">
              {intl.formatMessage({
                id: 'tab.settings',
                defaultMessage: 'Settings',
              })}
            </Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="info" style={{height: 'calc(100% - 43px)'}}>
            <Details
              gedcom={data.gedcom}
              indi={selectedIndiId}
              config={config}
              images={data.images}
            />
          </Tabs.Panel>
          <Tabs.Panel value="settings" style={{height: 'calc(100% - 43px)'}}>
            <ConfigPanel
              gedcom={data.gedcom}
              config={config}
              onChange={onConfigChange}
            />
          </Tabs.Panel>
        </Tabs>
      ) : (
        <CollapsedDetails gedcom={data.gedcom} indi={selectedIndiId} />
      )}
      <button
        id="sideToggle"
        onClick={() => onToggle()}
        aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
      >
        {expanded ? (
          <IconArrowRight size={20} stroke={2.5} color="rgba(0, 0, 0, 0.6)" />
        ) : (
          <IconArrowLeft size={20} stroke={2.5} color="rgba(0, 0, 0, 0.6)" />
        )}
      </button>
    </div>
  );
}
