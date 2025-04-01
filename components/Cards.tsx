import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle, TextStyle } from 'react-native';
import { Text } from 'react-native-paper'; // Using Text from react-native-paper

// Define the props for the Card component
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
      return { color: 'grey', symbol: '?' }; // Fallback for invalid suit
  }
};

/**
 * A simple, borderless component to display a single playing card.
 */
export const Card: React.FC<CardProps> = ({ card, style, textStyle }) => {
  // Handle cases where card might be null, undefined, or not a valid string
  if (!card || typeof card !== 'string' || card.length !== 2) {
    // Optionally render a placeholder or null
    return (
      <View style={[styles.cardContainer, styles.emptyCard, style]}>
        <Text style={[styles.cardText, styles.emptyCardText, textStyle]}>?</Text>
      </View>
    );
    // Or return null;
  }

  const rank = card.substring(0, card.length - 1).toUpperCase(); // e.g., "A", "T", "2", "K"
  const suitChar = card.substring(card.length - 1).toLowerCase(); // e.g., "s", "h", "d", "c"

  const { color: suitColor, symbol: suitSymbol } = getSuitInfo(suitChar);

  return (
    <View style={[styles.cardContainer, style]}>
      {/* Using React Native Paper Text */}
      <Text style={[styles.cardText, { color: suitColor }, textStyle]}>
        {rank}{suitSymbol}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#FFFFFF', // White background like a card
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 4, // Slight rounding for aesthetics
    marginHorizontal: 2, // Small margin between cards if in a row
    minWidth: 40, // Ensure a minimum width
    alignItems: 'center', // Center text horizontally
    justifyContent: 'center', // Center text vertically
    elevation: 1, // Subtle shadow on Android
    shadowColor: '#000', // Subtle shadow on iOS
    shadowOffset: { width: 1, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
  },
  cardText: {
    fontSize: 18, // Adjust size as needed
    fontWeight: 'bold',
    textAlign: 'center',
    // Color is applied dynamically
  },
  emptyCard: {
     backgroundColor: '#E0E0E0', // Grey background for empty/invalid
  },
   emptyCardText: {
     color: '#757575', // Darker grey text
   }
});

export const MyHand = ({cards}: {cards: string}) => {
  const [firstCard, secondCard] = [cards.slice(0, 2), cards.slice(2)];
  return (
  <View style={{ flexDirection: 'row', padding: 10 }}>
    <Card card={firstCard} />
    <Card card={secondCard} />
  </View>
)};

export const CommunityCards = ({cards}: {cards: string[]}) => {
  return (
    <View style={{ flexDirection: 'row', padding: 8 }}>
    {cards.map((card, i) => (
        <Card card={card} key={i} />
    ))}
    </View>
  )
}
