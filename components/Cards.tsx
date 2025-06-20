import { transFormCardsToFormattedString } from '@/utils/hand_utils';
import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle, TextStyle, Platform } from 'react-native';
import { Text } from 'react-native-paper';

interface CardProps {
  /** The card string, e.g., "As", "Th", "2d", "Kc" */
  card: string | null | undefined;
  /** Optional additional styles for the container View */
  style?: StyleProp<ViewStyle>;
  /** Optional additional styles for the Text component */
  textStyle?: StyleProp<TextStyle>;
}

// Helper function to get suit color and symbol
const getSuitInfo = (suitChar: string): { color: string; symbol: string } => {
  switch (suitChar.toLowerCase()) {
    case 'h':
      return { color: 'red', symbol: '♥' };
    case 'd':
      return { color: 'red', symbol: '♦' };
    case 's':
      return { color: 'black', symbol: '♠' };
    case 'c':
      return { color: 'black', symbol: '♣' };
    default:
      return { color: 'grey', symbol: '?' };
  }
};

export const Card: React.FC<CardProps> = ({ card, style, textStyle }) => {
  if (!card || typeof card !== 'string' || card.length !== 2) {
    return (
      <View style={[styles.cardContainer, styles.emptyCard, style]}>
        <Text style={[styles.cardText, styles.emptyCardText, textStyle]}>?</Text>
      </View>
    );
  }

  const rank = card.substring(0, card.length - 1).toUpperCase();
  const suitChar = card.substring(card.length - 1).toLowerCase();

  const { color: suitColor, symbol: suitSymbol } = getSuitInfo(suitChar);

  return (
    <View style={[styles.cardContainer, style]}>
      <Text style={[styles.cardText, { color: suitColor }, textStyle]}>
        {rank}{suitSymbol}
      </Text>
    </View>
  );
};

export const SimpleCard: React.FC<CardProps> = ({ card, style, textStyle }) => {
  const rank = card.substring(0, card.length - 1).toUpperCase();
  const suitChar = card.substring(card.length - 1).toLowerCase();

  const { color: suitColor, symbol: suitSymbol } = getSuitInfo(suitChar);

  return (
    <View style={{display: 'flex', flexDirection: 'row', alignItems: 'center'}}>
      <Text style={[styles.cardText, { color: suitColor }, textStyle]}>
        {rank}
      </Text>
      <Text style={[styles.cardText, { color: suitColor }, {fontSize: 14}, textStyle]}>
        {suitSymbol}
      </Text>
    </View>
  );
};

export const ShowdownCard: React.FC<CardProps> = ({ card }) => {
  if (card === "muck") {
    return (
      <View style={{position: 'relative', top: Platform.OS === "ios" ? 7 : 10.5}}>
        <Text style={[styles.cardText, styles.emptyCardText]}>?</Text>
      </View>
    );
  }
  const rank = card.substring(0, card.length - 1).toUpperCase();
  const suitChar = card.substring(card.length - 1).toLowerCase();

  const { color: suitColor, symbol: suitSymbol } = getSuitInfo(suitChar);

  return (
    <View style={{display: 'flex', flexDirection: 'row', alignItems: 'center'}}>
      <Text style={{color: suitColor, fontWeight: '600'}} variant='bodyLarge'>
        {rank}
      </Text>
      <Text style={{ color: suitColor, fontSize: 14}} variant='bodyLarge'>
        {suitSymbol}
      </Text>
    </View>
  );
};

export const MyHand = ({ cards, textStyle }: { cards: string }) => {
  return (
    <View style={{ flexDirection: 'row' }}>
      <SimpleCard textStyle={{marginEnd: 2, ...textStyle}} card={cards.substring(0, 2)} />
      <SimpleCard textStyle={{...textStyle}} card={cards.substring(2)} />
    </View>
  )
};

export const ShowdownCards = ({ cards, style }: { cards: string[] }) => {
  return (
    <View style={{ flexDirection: 'row', gap: 4, ...style }}>
      {cards.map((card, i) => (
        <SimpleCard card={card} key={i} />
      ))}
    </View>
  )
}

export const CommunityCards = ({ cards }: { cards: string[] }) => {
  return (
    <View style={{ flexDirection: 'row' }}>
      {cards.map((card, i) => (
        <Card card={card} key={i} />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginHorizontal: 2,
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
  },
  cardText: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  emptyCard: {
    backgroundColor: '#E0E0E0',
  },
  emptyCardText: {
    color: '#757575',
  }
});