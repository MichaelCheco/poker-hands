import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { List, Card, Text } from 'react-native-paper';
import PokerHandHistory from './HandHistory';
import { MyHand, ShowdownCards } from './Cards';
import { PokerPlayerInput } from '@/hand-evaluator';

const Showdown = ({ showdown }: { showdown: { text: string, winner: string, combination: string[], hands: PokerPlayerInput[] } }) => {
    return (
        <View>
            <List.Section>
                {showdown.hands.map((hand, index) => {
                    return (
                        <List.Item
                            contentStyle={{ flexGrow: 0, alignItems: 'center' }}
                            key={`${hand.playerId}-${hand.holeCards.join('')}-${index}`}
                            title={() => <MyHand cards={hand.holeCards.join('')} />}
                            left={() => <Text style={styles.actionPosition}>{hand.playerId}</Text>}
                            right={hand.playerId === showdown.winner ? () => <Text style={{marginInlineStart: 8, alignSelf: 'center'}}>wins with {showdown.text}</Text> : undefined}
                        />
                    )
                }
                )}
            </List.Section>
        </View>
    );
};

const styles = StyleSheet.create({
    actionText: {
        fontSize: 16,
        marginRight: 0,
    },
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
});

export default Showdown;