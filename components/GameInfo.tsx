import * as React from 'react';
import { Text } from 'react-native-paper';
import { PokerFormData } from './PokerHandForm';

const GameInfo = ({ info }: {info: PokerFormData}) => {
  return (
    <Text style={{fontSize: 20, fontWeight: 'bold', color: '#555'}}>
      ${info.smallBlind}/${info.bigBlind}{info.thirdBlind ? `/$${info.thirdBlind}` : ''} • {info.location}
    </Text>
  );
};

export default GameInfo;