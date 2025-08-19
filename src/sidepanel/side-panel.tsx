import {useIntl} from 'react-intl';
import {Tab} from 'semantic-ui-react';
import {Details} from './details/details';
import {TopolaData} from '../util/gedcom_util';
import React from 'react';
import {Config, ConfigPanel} from './config/config';
import {Media} from '../util/media';

interface SidePanelProps {
    data: TopolaData;
    selectedIndiId: string;
    config: Config;
    onConfigChange: (config: Config) => void;
}

interface SidePanelProps {
    data: TopolaData;
    selectedIndiId: string;
    config: Config;
    onConfigChange: (config: Config) => void;
    show: boolean;
}

export function SidePanel({ data, selectedIndiId, config, onConfigChange, show }: SidePanelProps) {
    const intl = useIntl();

    if (!show) {
        return null;
    }

    const tabs = [
        {
            menuItem: intl.formatMessage({
                id: 'tab.info',
                defaultMessage: 'Info',
            }),
            render: () => (
                <Details gedcom={data.gedcom} indi={selectedIndiId} />
            ),
        },
        {
            menuItem: intl.formatMessage({
                id: 'tab.settings',
                defaultMessage: 'Settings',
            }),
            render: () => (
                <ConfigPanel
                    config={config}
                    onChange={onConfigChange}
                />
            ),
        },
    ];

    return (
        <Media greaterThanOrEqual="large" className="sidePanel">
            <Tab panes={tabs} />
        </Media>
    );
}