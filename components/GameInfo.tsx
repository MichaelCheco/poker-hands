import * as React from 'react';
import { Text } from 'react-native-paper';

const GameInfo = ({ info }) => {
  return (
    <Text style={{fontSize: 20, fontWeight: 'bold', color: '#555'}}>
      ${info.smallBlind}/${info.bigBlind} • {info.location}
    </Text>
  );
};

export default GameInfo;