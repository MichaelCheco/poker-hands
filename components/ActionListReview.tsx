import { ActionRecord, PlayerAction, Position, ShowdownHandRecord, Stage } from '@/types';
import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { Divider, List, Text } from 'react-native-paper';

export default function ActionListReview({ actionList }: { actionList: ActionRecord[] }) {
    // const filteredActions = actionList.filter(action => !action.shouldHideFromUi);
    const groupedActions = React.useMemo(() => {
        return actionList.filter(a => !(a.was_auto_folded)).reduce((acc, action) => {
            const stage = action.stage;
            acc[stage].push(action);
            // if (!action.shouldHideFromUi) {
            //     acc[stage].push(action);
            // }
            return acc;
        }, {
            [Stage.Preflop]: [],
            [Stage.Flop]: [],
            [Stage.Turn]: [],
            [Stage.River]: [],
        });
    }, [actionList]);

    const sortedStages = Object.keys(groupedActions).map(Number).sort((a, b) => a - b);

    return (
        <List.Section>
                    <List.Subheader style={{
            marginLeft: -10,
            marginInline: 0, padding: 0,
            fontWeight: '700',
            color: '#000000E8',
        }}>
            HAND HISTORY
        </List.Subheader>
            {sortedStages.map((stage) => (
                <View key={`stage-container-${stage}`}>
                    <List.Subheader variant='bodySmall' style={{
                        marginLeft: -10,
                        marginInline: 0, padding: 0,
                        fontWeight: '700',
                        color: '#0000009A',
                    }}>
                        {`${getStageName(stage)}`}
                    </List.Subheader>
                    {groupedActions[stage].map((item: ActionRecord, index: number) => {
                        const uniqueItemKey = item.id || `action-${stage}-${item.position}-${index}`;
                        return (
                            <React.Fragment key={uniqueItemKey}>
                                <List.Item
                                    title={item.text_description}
                                    titleStyle={styles.actionText}
                                    left={() => <Text style={styles.actionPosition}>{item.position}</Text>}
                                    style={styles.actionItem}
                                />
                                {/* {item.isLastActionForStage && (
                                    <Divider key={`${uniqueItemKey}-divider`} />
                                )} */}
                            </React.Fragment>
                        );
                    })}
                </View>
            ))}
        </List.Section>
    );
}

const getStageName = (stage: Stage) => {
    switch (stage) {
        case Stage.Preflop: return 'PREFLOP';
        case Stage.Flop: return 'FLOP';
        case Stage.Turn: return 'TURN';
        case Stage.River: return 'RIVER';
        default: return '';
    }
};

const styles = StyleSheet.create({
    actionItem: {
        paddingVertical: 4,
        padding: 0,
    },
    actionPosition: {
        fontWeight: '500',
        marginLeft: 8,
        // minWidth: 24,
        textAlign: 'center',
        alignSelf: 'center',
    },
    actionText: {
        // fontSize: 16,
    },
});