import { PlayerAction, Position, Stage } from '@/types';
import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { Divider, List, Text } from 'react-native-paper';

const getStageName = (stage) => {
    switch (stage) {
        case 0: return 'PREFLOP';
        case 1: return 'FLOP';
        case 2: return 'TURN';
        case 3: return 'RIVER';
        default: return `Stage ${stage}`;
    }
};

export default function ActionList({ actionList, currentStage, potForStreetMap }: { actionList: PlayerAction[], currentStage: Stage; potForStreetMap: { [key in Position]?: number }; }) {
    const filteredActions = actionList.filter(action => !action.shouldHideFromUi);
    const groupedActions = React.useMemo(() => {
        return filteredActions.reduce((acc, action) => {
            const stage = action.stage;
            if (!action.shouldHideFromUi) {
                acc[stage].push(action);
            }
            return acc;
        }, {
            [Stage.Preflop]: [],
            [Stage.Flop]: [],
            [Stage.Turn]: [],
            [Stage.River]: [],
        });
    }, [actionList]);
    const sortedStages = Object.keys(groupedActions).map(Number).filter(n => n <= currentStage).sort((a, b) => a - b);

    return (
        <List.Section>
            {sortedStages.map((stage) => (
                // 1. Add unique key to the outer View for each stage
                <View key={`stage-container-${stage}`}>
                    <List.Subheader style={{
                        marginLeft: -10, marginInline: 0, padding: 0,
                        fontWeight: '800',
                        color: '#555',
                     }}>
                      {/* Using the improved version from the previous step */}
                      {`${getStageName(stage)}${stage !== Stage.Preflop ? ` ($${potForStreetMap[stage]})` : ''}`}
                    </List.Subheader>
                    {groupedActions[stage].map((item, index) => {
                        // Determine a unique key for each action item.
                        // Prefer item.id if it's guaranteed to be unique when present.
                        // Use a composite key with index as a fallback if id is empty or not unique enough.
                        const uniqueItemKey = item.id || `action-${stage}-${item.position}-${index}`;
    
                        // 2. Use React.Fragment with the key for the inner map's top-level element
                        return (
                            <React.Fragment key={uniqueItemKey}>
                                <List.Item
                                    // No 'key' prop needed here anymore, it's on the Fragment
                                    title={item.text}
                                    titleStyle={styles.actionText}
                                    left={() => <Text style={styles.actionPosition}>{item.position}</Text>}
                                    style={styles.actionItem}
                                />
                                {item.isLastActionForStage && (
                                    // 3. Give the conditional Divider a unique key too (relative to siblings)
                                    <Divider key={`${uniqueItemKey}-divider`} />
                                )}
                            </React.Fragment>
                        );
                    })}
                </View>
            ))}
        </List.Section>
    );
}

const styles = StyleSheet.create({
    actionItem: {
        paddingVertical: 4,
        padding: 0,
    },
    actionPosition: {
        fontWeight: '500',
        marginLeft: 8,
        minWidth: 24,
        textAlign: 'center',
        alignSelf: 'center',
    },
    actionText: {
        fontSize: 16,
    },
});