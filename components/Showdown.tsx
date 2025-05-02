import React from 'react';
import { StyleSheet, View } from 'react-native';
import { List, Text, useTheme, Icon } from 'react-native-paper';
import { ShowdownCard } from './Cards';
import { ShowdownHandRecord, Stage, ActionRecord, Position } from '@/types';
import { getHandSummary } from '@/utils/hand_utils';
function getSuit2(suit: string) {
    switch (suit.toLowerCase()) {
        case 'h':
            return '♥️';
        case 'd':
            return '♦️';
        case 's':
            return '♠️';
        case 'c':
            return '♣️';
    }
}
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
    function StackChange2({ hand }: { hand: ShowdownHandRecord }) {
        return ( 
            <View style={{ display: 'flex', flexDirection: 'row', justifyContent: 'flex-end', flex: 1, position: 'relative', top: 2 }}>
                <View style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <View style={{ display: 'flex', flexDirection: 'row' }}>
                        <Icon source={hand.is_winner ? "plus" : "minus"} color={hand.is_winner ? '#388E4A' : "#DA3036"} size={15} />
                        <Text variant='bodyLarge' style={{ color: hand.is_winner ? '#388E4A' : "#DA3036", fontWeight: 700, position: 'relative', bottom: 4 }}>{hand.is_winner ? amt : stacksMap[hand.position].end}</Text>
                    </View>
                    <Text variant='bodyMedium' style={{ alignSelf: 'flex-end', position: 'relative', bottom: 4 }}>{hand.is_winner ? stacksMap[hand.position].start + amt : stacksMap[hand.position].start - amt}</Text>
                </View>
            </View>
        )
    }

    return (
        <List.Section>
            <List.Subheader
            variant='headlineLarge'
            style={{
                marginLeft: -10, marginInline: 0, padding: 0,
                fontWeight: '600',
                color: '#000000E8',
            }}>
              <Text variant="titleMedium" style={{fontWeight: '600',
                color: '#000000E8',}}>Result</Text>
            </List.Subheader>
            {showdownHands ? showdownHands.map((hand, index) => {
                return (
                    <List.Item
                        contentStyle={{  }}
                        description={hand.hand_description}
                        descriptionStyle={{ color: '#00000082' }}
                        key={`${hand.position}-${hand.hole_cards}-${index}`}
                        title={() => {
                            if (hand.hole_cards !== "muck") {
                                return (
                                    <View style={{ display: 'flex', flexDirection: 'row', gap: 2 }} >
                                        <ShowdownCard card={hand.hole_cards.substring(0, 2)} />
                                        <ShowdownCard card={hand.hole_cards.substring(2)} />
                                    </View>
                                )
                            }
                            return (
                                <Text style={{ fontSize: 16 }}>Mucked</Text>
                            )
                        }}
                        left={() => <Text style={styles.actionPosition}>{hand.position}</Text>}
                        right={() => <StackChange2 hand={hand} />}
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