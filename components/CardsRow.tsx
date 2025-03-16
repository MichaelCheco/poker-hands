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
const Card = ({ card }) => {
  if (!card || card.length < 2) {
    return <View style={styles.card} />; // Empty card placeholder
  }

  const value = card.slice(0, card.length - 1);
  const suit = card.slice(-1);

  const suitSymbol = suits[suit];
  const color = suit === 'h' || suit === 'd' ? 'red' : 'black';

  return (
    <View style={styles.card}>
      <Text style={[styles.cardText, { color }]}>
        {value}
        {suitSymbol}
      </Text>
    </View>
  );
};

// Function to render multiple cards in a row
const CardRow = ({ cards }) => {
  return (
    <View style={styles.cardRow}>
      {cards.map((card, index) => (
        <Card key={index} card={card} />
      ))}
    </View>
  );
};

const Hand = ({cards}) => {

  const hand = [cards.slice(0,2) , cards.slice(2, 4)] 

  return (
    <View style={styles.container}>
      <CardRow cards={hand} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  cardRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  card: {
    width: 40,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
});

export default Hand;