import * as React from 'react';

import { Modal, Portal, PaperProvider, useTheme } from 'react-native-paper';
import PokerHandForm from '../components/PokerHandForm';
import Fab from '@/components/Fab';

export default function Index() {
  const [visible, setVisible] = React.useState(false);
  const theme = useTheme();

  return (
    <PaperProvider theme={theme}>
      <Portal>
        <Modal visible={visible} onDismiss={() => setVisible(false)} contentContainerStyle={{padding: 20}}>
          <PokerHandForm />
        </Modal>
      </Portal>
      <Fab onPress={() => setVisible(true)} />
    </PaperProvider>
  );
}
