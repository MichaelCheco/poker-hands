import React from 'react';
import { StyleSheet, View } from 'react-native';
import { List, Text, useTheme, Icon } from 'react-native-paper';
import { MyHand } from './Cards';
import { ShowdownHandRecord, Stage, ActionRecord, Position } from '@/types';
import { getHandSummary } from '@/utils/hand-utils';
import { useRouter } from 'expo-router';

const Showdown = ({ showdownHands, finalStreet, actions, pot, smallBlind, bigBlind }: {
    showdownHands: ShowdownHandRecord[],
    finalStreet: Stage,
    actions: ActionRecord[],
    pot: number,
    smallBlind: number,
    bigBlind: number,
}) => {
    const stacksMap = actions.filter(a => !(a.was_auto_folded)).reduce((acc, action) => {
        if (!acc[action.position]) {
            let startVal =
                action.position === Position.SB
                    ? smallBlind
                    : action.position === Position.BB
                        ? bigBlind
                        : 0;
            acc[action.position] = { start: action.player_stack_before + startVal, end: 0 };
        }
        acc[action.position].end = acc[action.position].end + action.action_amount;
        return acc;
    }, {});
    const theme = useTheme();
    const winner = showdownHands.find(hand => hand.is_winner);
    const amt = Object.values(stacksMap).reduce((acc, val) => acc += val.end, 0);
    function StackChange({hand}: {hand: ShowdownHandRecord}) {
        return (
            <View style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', flex: 1 }}>
            <Text style={{ marginInlineStart: 4, alignSelf: 'center' }} variant='bodyMedium'>- {hand.hand_description}</Text>
            <View style={{ display: 'flex', flexDirection: 'row' }}>
    
                <Icon source={hand.is_winner ? "plus" : "minus"} color={hand.is_winner ? '#388E4A' : "#DA3036"} size={15} />
                <Text variant='bodyMedium' style={{ color: hand.is_winner ? '#388E4A' : "#DA3036", fontWeight: 700, position: 'relative', bottom: 2 }}>{hand.is_winner ? amt : stacksMap[hand.position].end}</Text>
            </View>
        </View> 
        )
    }
    return (
        <List.Section>
            <List.Subheader style={{
                marginLeft: -10, marginInline: 0, padding: 0,
                fontWeight: '700',
                color: '#000000E8',
            }}>
                Result
            </List.Subheader>
            {showdownHands ? showdownHands.map((hand, index) => {
                return (
                    <List.Item
                        contentStyle={{ flexGrow: 0, alignItems: 'center', }}
                        key={`${hand.position}-${hand.hole_cards}-${index}`}
                        title={() => {
                            if (hand.hole_cards !== "muck") {
                                return (
                                    <MyHand cards={hand.hole_cards} textStyle={{ fontSize: 14, fontWeight: 400 }} />
                                )
                            }
                            return (
                                <Text style={{ fontSize: 16 }}>Mucked</Text>
                            )
                        }}
                        left={() => <Text style={styles.actionPosition}>{hand.position}</Text>}
                        right={() => <StackChange hand={hand} />}
                    />
                )
            }
            ) : (
                <Text style={{ marginTop: 8 }}>{getHandSummary(finalStreet, actions, winner?.position as string, pot)}</Text>
            )}
        </List.Section>
    );
};

const styles = StyleSheet.create({
    actionText: {
        fontSize: 13,
        marginRight: 0,
    },
    actionItem: {
        paddingVertical: 0,
        paddingLeft: 0,
        paddingInlineStart: 0,
        paddingInline: 0,
        padding: 0,
    },
    actionPosition: {
        fontWeight: 'bold',
        marginLeft: 8,
        textAlign: 'center',
        alignSelf: 'center',
        color: '#555',
    },
});

export default Showdown;