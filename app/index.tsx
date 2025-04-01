import * as React from 'react';

import { Modal, Portal, Button, PaperProvider, useTheme } from 'react-native-paper';
import PokerHandForm from '../components/PokerHandForm';
import Fab from '@/components/Fab';
import { View } from 'react-native';

export default function Index() {
  const [visible, setVisible] = React.useState(false);
    const theme = useTheme();

  const showModal = () => setVisible(true);
  const hideModal = () => setVisible(false);
  const containerStyle = {backgroundColor: 'white', padding: 20};

  return (
    <PaperProvider theme={theme}>
      <Portal>
        <Modal visible={visible} onDismiss={hideModal} contentContainerStyle={containerStyle}>
          <PokerHandForm />
        </Modal>
      </Portal>
      <Fab onPress={showModal} />
    </PaperProvider>
  );
}
