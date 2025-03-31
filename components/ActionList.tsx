import { PlayerAction, Stage } from '@/types';
import * as React from 'react';
import { StyleSheet } from 'react-native';
import { List, Text } from 'react-native-paper';

export default function ActionList({ stage, actionList }: { stage: Stage, actionList: PlayerAction[] }) {
    const filteredActions = actionList.filter(action => action.stage === stage && !action.shouldHideFromUi);
    return (
        <List.Section>
            {filteredActions.map((item, index) => (
                // <List.Item key={index} title={item.text} style={{ padding: 0 }} />
                <List.Item
                key={`${item.stage}-${item.position}-${index}`} // More robust key
                title={item.text} // e.g., "checks", "bets 50"
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
        paddingVertical: 4, // Adjust spacing
        paddingLeft: 2,
        paddingInlineStart: 0,
        paddingInline: 0,
        padding: 0,
        // backgroundColor: index % 2 === 0 ? '#f8f8f8' : 'white' // Optional: Zebra striping
    },
    actionPosition: {
        fontWeight: 'bold',
        marginLeft: 8,
        minWidth: 24, // Ensure consistent alignment
        textAlign: 'center', // Center position text
        alignSelf: 'center', // Center vertically
        color: '#555', // Example color
    },
    actionText: {
        fontSize: 14, // Adjust size
    },
    // ... other styles
});