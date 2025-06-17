import * as React from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { Modal, Portal, PaperProvider, useTheme, List, ActivityIndicator, Text, Divider, IconButton, Button } from 'react-native-paper';
import PokerHandForm from '../../components/PokerHandForm';
import Fab from '@/components/Fab';
import { formatDateMMDDHHMM } from '@/utils/hand_utils';
import { MyHand } from '@/components/Cards';
import { useFocusEffect, useRouter } from 'expo-router';
import { getSavedHands } from '@/api/hands';
import { PokerHandFilters, SavedHandSummary } from '@/types';
import EmptyState from '@/components/EmptyState';
import { parsePokerHandString } from '@/utils/card_utils';
import { useNavigation } from '@react-navigation/native';
import { TouchableOpacity } from 'react-native';
import FilterModal from '@/components/FilterModal';
import EmptyFilterState from '@/components/EmptyFilterState';

export default function Index() {
  const router = useRouter();
  const [visible, setVisible] = React.useState(false);
  const theme = useTheme();
  const containerStyle = {
    flex: 1,
    backgroundColor: '#FFF',
  };
    const navigation = useNavigation();

  const [savedHands, setSavedHands] = React.useState<SavedHandSummary[] | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [preset, setPreset] = React.useState({});
  const [error, setError] = React.useState<any>(null);
  const [filterModalVisible, setFilterModalVisible] = React.useState(false); // State for new FilterModal
  // State to store the currently active filters
  const [activeFilters, setActiveFilters] = React.useState<PokerHandFilters>({
    potType: 'any',
    position: 'any',
    boardTexture: 'any',
    relativeHeroPosition: 'any',
  });

  // --- Modal Visibility Handlers ---
  const showNewHandModal = () => setVisible(true);
  const hideNewHandModal = () => setVisible(false);

  const showFilterModal = () => setFilterModalVisible(true);
  const hideFilterModal = () => setFilterModalVisible(false);
  const Options = () => {
      return (
          <TouchableOpacity>
          <IconButton icon={"tune"} onPressIn={showFilterModal} style={{zIndex:3}}/>
          </TouchableOpacity>
      )
  }
  React.useLayoutEffect(() => {
      navigation.setOptions({
        headerRight: () => <Options />,
      });
  }, [navigation])

  // --- Fetching Logic ---
  const loadHands = React.useCallback(async (showLoadingIndicator = true, filters: PokerHandFilters = activeFilters) => {
    // Only show full loading indicator on initial load or manual refresh
    if (showLoadingIndicator) setIsLoading(true);
    setError(null);
    try {
      const { hands, error: fetchError, count } = await getSavedHands(filters);
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
  }, [activeFilters]);

  useFocusEffect(
    React.useCallback(() => {
      // Clear any presets
      setPreset({});
      // Load hands, show loading indicator only if savedHands is currently null (initial load)
      loadHands(savedHands === null);

    }, [activeFilters])
  );
  const handleApplyFilters = React.useCallback((filters: PokerHandFilters) => {
    setActiveFilters(filters); // Update the active filters state
    // Now re-load/filter your hands based on the new active filters
    loadHands(true, filters); // Pass the new filters directly
  }, [loadHands]);

  function closeModal() {
    setVisible(false);
  }

  const renderHandItem = ({ item }: { item: SavedHandSummary }) => (
    <>
      <List.Item
        title={`${item.currency}${item.small_blind}/${item.currency}${item.big_blind}${item.third_blind ? `/${item.currency}${item.third_blind}` : ''} • ${item.location}`}
        description={`${formatDateMMDDHHMM(item.played_at)}`}
        left={props => <List.Icon {...props} icon="cards-playing" />}
        onPress={() => {
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
        {isLoading && <ActivityIndicator animating={true} size="large" style={styles.loader} />}
        {error && <Text style={styles.errorText}>Error loading hands: {error}</Text>}
        {!isLoading && !error && (
          <FlatList
            data={savedHands}
            renderItem={renderHandItem}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={
              Object.values(activeFilters).some(f => typeof f === "string" ? f !== 'any' : f[0] !== 'any') ? <EmptyFilterState /> : <EmptyState />
            }
            contentContainerStyle={styles.listContentContainer}
          />
        )}
        <Portal>
          <Modal
            style={{ backgroundColor: '#F2F2F2' }}
            visible={visible}
            onDismiss={() => setVisible(false)}
            contentContainerStyle={{ padding: 5 }}
          >
            <PokerHandForm close={closeModal} preset={preset} />
          </Modal>
        </Portal>
        {/* PokerHandForm Modal */}
        <Portal>
          <Modal
            style={{ backgroundColor: '#F2F2F2' }} // Consider moving this style to a StyleSheet object
            visible={visible}
            onDismiss={hideNewHandModal}
            contentContainerStyle={{ padding: 5 }} // Consider moving this style
          >
            <PokerHandForm close={hideNewHandModal} preset={preset} />
          </Modal>
        </Portal>

        {/* Your new FilterModal */}
        <FilterModal
          visible={filterModalVisible}
          onDismiss={hideFilterModal}
          onApplyFilters={handleApplyFilters}
          currentFilters={activeFilters} // Pass current active filters to initialize modal
        />

        <Fab fabVisible={!visible && !filterModalVisible}
          setPreset={setPreset}
          setVisible={() => setVisible(true)}
          recentHands={savedHands || []} />
      </View>
    </PaperProvider>
  );
}

const styles = StyleSheet.create({
  container: {
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
    flex: 1,
    paddingBottom: 120, // Add padding so FAB doesn't cover last item
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