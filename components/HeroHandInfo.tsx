import * as React from 'react';
import { View } from 'react-native';
import { Text } from 'react-native-paper';
import { MyHand } from './Cards';
import { parsePokerHandString } from '@/utils';

const HeroHandInfo = ({ info }) => {
  return (
    <View style={{
        flexDirection: 'row', alignItems: 'center',
        justifyContent: 'center',
    }}>
        <MyHand cards={parsePokerHandString(info.hand.toUpperCase())} />
        <Text style={{ marginInline: 4, fontSize: 20, fontWeight: 'bold' }}>•</Text>
        <Text style={{ fontSize: 20, fontWeight: 'bold' }}>{info.position}</Text>
    </View>
  );
};

export default HeroHandInfo;