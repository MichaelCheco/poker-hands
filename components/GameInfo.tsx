import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { Appbar, Text } from 'react-native-paper';
import Hand from './CardsRow';

const GameInfo = ({ info }) => {
  return (
    <Appbar.Header>
      <Appbar.Content
        title={`$${info.smallBlind}/$${info.bigBlind} • ${info.location} • ${info.position}`}
        titleStyle={{ fontSize: 18 }}
      />
      <Hand cards={info.hand} />
      {/* <View style={styles.infoContainer}>
        <Text style={styles.infoText}>{info.position}</Text>
        <Text style={styles.bullet}>•</Text>
        <Hand cards={info.hand} />
      </View> */}
    </Appbar.Header>
  );
};

const styles = StyleSheet.create({
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoText: {
    fontSize: 22,
    position: 'relative',
    top: 0.3,
  },
  bullet: {
    marginHorizontal: 6,
    fontSize: 22,
  },
});

export default GameInfo;