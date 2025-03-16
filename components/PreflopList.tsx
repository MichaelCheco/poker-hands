import * as React from 'react';
import { Divider, List, MD3Colors, Surface, TextInput } from 'react-native-paper';
// left={() => <List.Icon icon="alpha-p-circle"} />

export default function PreflopList({state}) {
    console.log(state, 'PreflopList')
    return (
        <List.Section>
            <List.Subheader>PREFLOP</List.Subheader>
            {state.preflopAction.map((item, index) => (
                <List.Item key={index} title={item} style={{padding: 0}} />
            ))}
        </List.Section>
    );
}