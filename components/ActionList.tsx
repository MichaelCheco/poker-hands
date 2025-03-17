import { Stage } from '@/types';
import * as React from 'react';
import { List } from 'react-native-paper';

function getListTitleForStage(stage: Stage): string {
    switch (stage) {
        case Stage.Preflop:
            return 'PREFLOP';
        case Stage.Flop:
            return 'FLOP';
        case Stage.Turn:
            return 'TURN';
        case Stage.River:
            return 'RIVER';
        default:
            return 'SHOWDOWN';
    }
}

export default function ActionList({stage, preflopAction}) {
    return (
        <List.Section>
            <List.Subheader>{getListTitleForStage(stage)}</List.Subheader>
            {preflopAction.map((item, index) => (
                <List.Item key={index} title={item} style={{padding: 0}} />
            ))}
        </List.Section>
    );
}