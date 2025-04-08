import * as React from 'react';
import { View, Platform } from 'react-native'; // Import View and StyleSheet
import { Modal, Portal, PaperProvider, useTheme } from 'react-native-paper';
import PokerHandForm from '../components/PokerHandForm';
import Fab from '@/components/Fab';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'; // 1. Import the hook

export default function Index() {
  const [visible, setVisible] = React.useState(false);
  const theme = useTheme(); // Get the theme object
  const insets = useSafeAreaInsets(); // 2. Get safe area insets

  const containerStyle = {
    flex: 1,
    backgroundColor: '#FFF',
  };
  const baseInputPaddingBottom = Platform.OS === 'ios' ? 8 : 12;

  return (
    <PaperProvider theme={theme}>
      <SafeAreaView style={[
                        containerStyle,
                        // { paddingBottom: baseInputPaddingBottom + insets.bottom }
                        // We add the safe area bottom inset to our base padding
                        // This ensures the container itself respects the safe area,
                        // lifting the TextInput inside it above the home indicator.
                    ]}>
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
      </SafeAreaView>
    </PaperProvider>
  );
}