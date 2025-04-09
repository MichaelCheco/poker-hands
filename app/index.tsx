import * as React from 'react';
import { View, StyleSheet } from 'react-native'; // Import View and StyleSheet
import { Modal, Portal, PaperProvider, useTheme } from 'react-native-paper';
import PokerHandForm from '../components/PokerHandForm';
import Fab from '@/components/Fab';

export default function Index() {
  const [visible, setVisible] = React.useState(false);
  const theme = useTheme(); // Get the theme object

  const containerStyle = {
    flex: 1,
    backgroundColor: '#FFF',
  };

  return (
    <PaperProvider theme={theme}>
      <View style={containerStyle}>
        <Portal>
          <Modal
            style={{ backgroundColor: '#F2F2F2' }}
            visible={visible}
            onDismiss={() => setVisible(false)}
            contentContainerStyle={{ padding: 5 }}
          >
            <PokerHandForm />
          </Modal>
        </Portal>
        <Fab onPress={() => setVisible(true)} />
      </View>
    </PaperProvider>
  );
}