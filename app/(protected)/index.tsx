import * as React from 'react';
import { View, StyleSheet, FlatList } from 'react-native'; // Import View and StyleSheet
import { Icon, Modal, Portal, PaperProvider, useTheme, List, ActivityIndicator, Text, Divider } from 'react-native-paper';
import PokerHandForm from '../../components/PokerHandForm';
import Fab from '@/components/Fab';
import { formatDateMMDDHHMM, parsePokerHandString } from '@/utils/hand-utils';
import { MyHand } from '@/components/Cards';
import { useFocusEffect, useRouter } from 'expo-router';
import { getSavedHands } from '@/api/hands';
import { SavedHandSummary } from '@/types';

export default function Index() {
  const router = useRouter();

  const [visible, setVisible] = React.useState(false);
  const theme = useTheme(); // Get the theme object
  const containerStyle = {
    flex: 1,
    backgroundColor: '#FFF',
  };
  // State for fetched hands
  const [savedHands, setSavedHands] = React.useState<SavedHandSummary[] | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<any>(null);

    // --- Fetching Logic ---
    const loadHands = React.useCallback(async (showLoadingIndicator = true) => {
      console.log("Loading hands...");
      // Only show full loading indicator on initial load or manual refresh
      if (showLoadingIndicator) setIsLoading(true);
      setError(null);
      try {
          const { hands, error: fetchError, count } = await getSavedHands();
          if (fetchError) throw fetchError;
          setSavedHands(hands || []);
      } catch (err: any) {
          console.error("Error fetching hands:", err);
          setError(err.message || 'An unknown error occurred');
          setSavedHands([]);
      } finally {
          // Only turn off loading indicator if it was turned on
           if (showLoadingIndicator) setIsLoading(false);
      }
  }, []);

  // --- Use useFocusEffect to load data ---
  useFocusEffect(
    React.useCallback(() => {
          // Runs when the screen comes into focus
          console.log('Index screen focused, loading/refreshing hands.');
          // Load hands, show loading indicator only if savedHands is currently null (initial load)
          loadHands(savedHands === null);

          // Optional: Cleanup function if needed (e.g., for subscriptions)
          // return () => console.log('Index screen blurred');
      }, []) // Depend on loadHands and savedHands to decide if loader shows
  );

  function closeModal() {
    setVisible(false);
  }

  const renderHandItem = ({ item }: { item: SavedHandSummary }) => (
    <>
    <List.Item
      title={`${item.currency}${item.small_blind}/${item.currency}${item.big_blind} • ${item.location}`}
      description={`${formatDateMMDDHHMM(item.played_at)}`}
      // onPress={() => {/* Navigate to hand detail? */}}
      left={props => <List.Icon {...props} icon="cards-playing" />}
      onPress={() => {
        console.log(`Navigating to hand: ${item.id}`);
        router.push(`${item.id}`)
      }}
      right={() => <MyHand cards={parsePokerHandString(item.hero_cards.toUpperCase())} />}
    />
    <Divider />
    </>
  );
  return (
    <PaperProvider theme={theme}>
      <View style={containerStyle}>
        {/* --- Display List, Loading, or Error --- */}
        {isLoading && <ActivityIndicator animating={true} size="large" style={styles.loader} />}
        {error && <Text style={styles.errorText}>Error loading hands: {error}</Text>}
        {!isLoading && !error && (
          <FlatList
            data={savedHands}
            renderItem={renderHandItem}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={
                <Text style={styles.emptyText}>No hands saved. Tap the button below to start tracking your play!</Text>
          }
            contentContainerStyle={styles.listContentContainer}
          />
        )}
        {/* --- End Display --- */}
        <Portal>
          <Modal
            style={{ backgroundColor: '#F2F2F2' }}
            visible={visible}
            onDismiss={() => setVisible(false)}
            contentContainerStyle={{ padding: 5 }}
          >
            <PokerHandForm close={closeModal}/>
          </Modal>
        </Portal>
        <Fab onPress={() => setVisible(true)} />
      </View>
    </PaperProvider>
  );
}

const styles = StyleSheet.create({
  container: { // Style for the main screen View
    flex: 1,
  },
  loader: {
    marginTop: 50,
  },
  errorText: {
    textAlign: 'center',
    marginTop: 50,
    color: 'red',
    padding: 20,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 10,
    color: 'grey',
    fontSize: 19,
    padding: 8
  },
  listContentContainer: {
    paddingBottom: 80, // Add padding so FAB doesn't cover last item
  },
  modalContent: { // Style for the area modal content sits within
    margin: 20, // Example margin
    backgroundColor: 'white', // Background for the content area
    borderRadius: 8,
    // Max height or flex might be needed depending on form size
    maxHeight: '90%',
  },
  modalInnerContainer: { // Add specific sizing/flex for content *inside* the modal containerStyle
    // Adjust height or flex as needed for PokerHandForm
    height: '95%', // Example: Take most of the modal height
  }
  // Add other styles if needed
});