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
    console.log(potForStreetMap )
    // Group actions by stage
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

    console.log(sortedStages, ' SOR')
    return (
        <List.Section>
            {sortedStages.map((stage) => (
                <View>
                    <List.Subheader style={{ 
                        marginLeft: -10, marginInline: 0, padding: 0,
                        fontWeight: '800',
                        color: '#555',

                         }}>
                      {`${getStageName(stage)}${stage !== Stage.Preflop ? ` ($${potForStreetMap[stage]})` : ''}`}
                    </List.Subheader>
                    {groupedActions[stage].map((item, index) => (
                        <>
                            <List.Item
                                key={`${item.stage}-${item.position}-${index}`}
                                title={item.text}
                                titleStyle={styles.actionText}
                                left={() => <Text style={styles.actionPosition}>{item.position}</Text>}
                                style={styles.actionItem}
                            />
                            {item.isLastActionForStage && (
                                <Divider key={`divider-${index}`} />
                            )}
                        </>
                    ))}
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