import { PlayerAction, Stage } from '@/types';
import * as React from 'react';
import { StyleSheet } from 'react-native';
import { List, Text } from 'react-native-paper';
// item.position === heroPosition ? 'HERO' : item.position
export default function ActionList({ stage, actionList, heroPosition }: { stage: Stage, actionList: PlayerAction[], heroPosition: string; }) {
    const filteredActions = actionList.filter(action => action.stage === stage && !action.shouldHideFromUi);
    return (
        <List.Section>
            {filteredActions.map((item, index) => (
                <List.Item
                    key={`${item.stage}-${item.position}-${index}`}
                    title={item.text}
                    titleStyle={styles.actionText}
                    left={() => <Text style={styles.actionPosition}>{item.position}</Text>}
                    style={styles.actionItem}
                />
            ))}
        </List.Section>
    );
}
const styles = StyleSheet.create({
    actionItem: {
        paddingVertical: 4,
        paddingLeft: 2,
        paddingInlineStart: 0,
        paddingInline: 0,
        padding: 0,
    },
    actionPosition: {
        fontWeight: 'bold',
        marginLeft: 8,
        minWidth: 24,
        textAlign: 'center',
        alignSelf: 'center',
        color: '#555',
    },
    actionText: {
        fontSize: 14,
    },
});