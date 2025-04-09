import * as React from 'react';
import { Appbar } from 'react-native-paper';
import { MyHand } from './Cards';

const GameInfo = ({ info }) => {
  return (
    <Appbar.Header>
      <Appbar.Content
        title={`$${info.smallBlind}/$${info.bigBlind} • ${info.location} • ${info.position}`}
        titleStyle={{ fontSize: 18 }}

      />
      <Appbar.Content title={<MyHand cards={info.hand} />} style={{alignSelf: 'flex-end'}}/>
    </Appbar.Header>
  );
};

export default GameInfo;