import * as React from 'react';
import { Appbar } from 'react-native-paper';
import Hand from './CardsRow';

const GameInfo = ({info}) => {
    return (
  <Appbar.Header>
    <Appbar.Content title={`$${info.smallBlind}/$${info.bigBlind} • ${info.location}`} titleStyle={{fontSize: 18}}/>
    <Hand cards={info.hand}/>
  </Appbar.Header>
)
}

export default GameInfo;