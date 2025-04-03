import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { List, Card, Text } from 'react-native-paper';
import PokerHandHistory from './HandHistory';
import { MyHand } from './Cards';

const Showdown = ({ villainCards, playerActions, showdown }) => {
    return (
        <View>
        <List.Section>
            {villainCards.map((villain, index) => (
                <List.Item
                    contentStyle={{ flexGrow: 0 }}
                    key={`${villain.playerId}-${villain.holeCards.join('')}-${index}`}
                    title={`shows`}
                    titleStyle={styles.actionText}
                    left={() => <Text style={styles.actionPosition}>{villain.playerId}</Text>}
                    right={() => <MyHand cards={villain.holeCards.join('')} />}
                    style={{ ...styles.actionItem }}
                />
            ))}
            <List.Item key={'showdown'}
                title={`wins with ${showdown.text}`}
                titleStyle={styles.actionText}
                left={() => <Text style={styles.actionPosition}>{showdown.winner}</Text>}
                style={{ ...styles.actionItem, flexGrow: 0 }} />
        </List.Section>
        <PokerHandHistory actions={playerActions} />
    </View>
    );
};

const styles = StyleSheet.create({
    actionText: {
        fontSize: 14,
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