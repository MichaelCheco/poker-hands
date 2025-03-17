import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const suits = {
  h: '♥',
  d: '♦',
  c: '♣',
  s: '♠',
};

const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

// Function to render a single card
const Card = ({ card, small }) => {
  if (!card || card.length < 2) {
    return (
      <View style={styles.smallCard}>
      <Text style={[styles.smallCardText, { color: 'black' }]}>
        ?
      </Text>
    </View>)
  }

  const value = card.slice(0, card.length - 1);
  const suit = card.slice(-1);

  const suitSymbol = suits[suit];
  const color = suit === 'h' || suit === 'd' ? 'red' : 'black';
  const a = small ? styles.smallCard : styles.card
  const b = small ? styles.smallCardText : styles.cardText
  return (
    <View style={a}>
      <Text style={[b, { color }]}>
        {value}
        {suitSymbol}
      </Text>
    </View>
  );
};

// Function to render multiple cards in a row
export const CardRow = ({ cards, small }) => {
  return (
    <View style={styles.cardRow}>
      {cards.map((card, index) => (
        <Card key={index} card={card} small={small} />
      ))}
    </View>
  );
};

const Hand = ({cards}) => {

  const hand = [cards.slice(0,2) , cards.slice(2, 4)] 

  return (
    <View>
      <CardRow cards={hand} small={false}/>
    </View>
  );
};

const styles = StyleSheet.create({
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  cardRow: {
    flexDirection: 'row',
  },
  smallCard: {
    width: 30,
    padding: 4,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: 40,
    padding: 8,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  smallCardText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default Hand;

