import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Platform, Dimensions } from 'react-native';
import { Modal, Portal, Text, Button, useTheme } from 'react-native-paper';

// Define the shape of your filter options (for clarity and type safety)
export interface PokerHandFilters {
    potType: 'any' | 'srp' | '3bet' | 'limped' | '4bet';
    position: 'any' | 'sb' | 'bb' | 'co' | 'bu' | 'utg' | 'hj' | 'utg1' | 'lj';
    boardTexture: 'any' | 'ace_high' | 'monotone' | 'paired' | '2_broadway' | 'trips' | 'rainbow' | 'flush_draw';
    relativeHeroPosition: 'any' | 'ip' | 'oop';
}

interface FilterModalProps {
    visible: boolean;
    onDismiss: () => void;
    onApplyFilters: (filters: PokerHandFilters) => void;
    // Pass the currently active filters to pre-select buttons
    currentFilters: PokerHandFilters;
}

// --- Filter Options: Now just single arrays per category ---

// 1. Pot Type
const potTypeOptions = [
    { value: 'any', label: 'Any' },
    { value: 'srp', label: 'SRP' },
    { value: '3bet', label: '3-bet' },
    { value: 'limped', label: 'Limped' },
    { value: '4bet', label: '4-bet' },
];

// 2. Position
const positionOptions = [
    { value: 'any', label: 'Any' },
    { value: 'sb', label: 'SB' },
    { value: 'bb', label: 'BB' },
    { value: 'utg', label: 'UTG' },
    { value: 'utg1', label: 'UTG1' },
    { value: 'lj', label: 'LJ' },
    { value: 'hj', label: 'HJ' },
    { value: 'co', label: 'CO' },
    { value: 'bu', label: 'BU' },
];

// 3. Board Texture
const boardTextureOptions = [
    { value: 'any', label: 'Any' },
    { value: 'ace_high', label: 'Ace high' },
    { value: 'monotone', label: 'Monotone' },
    { value: 'paired', label: 'Paired' },
    { value: '2_broadway', label: '2 Broadway' },
    { value: 'trips', label: 'Trips' },
    { value: 'rainbow', label: 'Rainbow' },
    { value: 'flush_draw', label: 'Flush Draw' },
];

// 4. Relative Hero Position
const relativeHeroPositionOptions = [
    { value: 'any', label: 'Any' },
    { value: 'ip', label: 'IP' },
    { value: 'oop', label: 'OOP' },
];


const FilterModal: React.FC<FilterModalProps> = ({ visible, onDismiss, onApplyFilters, currentFilters }) => {
    const theme = useTheme();
    // Internal state for selected filter values in the modal
    const [potType, setPotType] = useState<PokerHandFilters['potType']>(currentFilters.potType);
    const [position, setPosition] = useState<PokerHandFilters['position']>(currentFilters.position);
    const [boardTexture, setBoardTexture] = useState<PokerHandFilters['boardTexture']>(currentFilters.boardTexture);
    const [relativeHeroPosition, setRelativeHeroPosition] = useState<PokerHandFilters['relativeHeroPosition']>(currentFilters.relativeHeroPosition);

    // Update internal state when `currentFilters` prop changes
    useEffect(() => {
        if (visible) {
            setPotType(currentFilters.potType);
            setPosition(currentFilters.position);
            setBoardTexture(currentFilters.boardTexture);
            setRelativeHeroPosition(currentFilters.relativeHeroPosition);
        }
    }, [visible, currentFilters]);


    const handleApply = () => {
        onApplyFilters({
            potType,
            position,
            boardTexture,
            relativeHeroPosition,
        });
        onDismiss();
    };

    const handleClearAll = () => {
        setPotType('any');
        setPosition('any');
        setBoardTexture('any');
        setRelativeHeroPosition('any');
        onApplyFilters({
            potType: 'any',
            position: 'any',
            boardTexture: 'any',
            relativeHeroPosition: 'any',
        });
    };

    // Helper to render a group of filter buttons
    const renderFilterButtons = (
        options: { value: string; label: string }[],
        selectedValue: string,
        onSelect: (value: any) => void
    ) => {
        return (
            // A View with flexWrap will create rows automatically
            <View style={styles.buttonRow}>
                {options.map(option => {
                    const isSelected = selectedValue === option.value;
                    return (
                        <Button
                            key={option.value}
                            mode={isSelected ? 'contained' : 'outlined'}
                            onPress={() => onSelect(option.value)}
                            compact // Makes button smaller
                            style={styles.filterButton}
                            labelStyle={styles.filterButtonLabel}
                            buttonColor={isSelected ? theme.button.backgroundColor : theme.colors.surface}
                            textColor={isSelected ? theme.button.color : theme.colors.onSurface}
                        >
                            {option.label}
                        </Button>
                    );
                })}
            </View>
        );
    };


    return (
        <Portal>
            <Modal
                visible={visible}
                onDismiss={onDismiss}
                contentContainerStyle={styles.modalContent}
            >
                <View style={styles.modalHeader}>
                    <Text variant="titleLarge" style={styles.modalTitle}>Filter Hands</Text>
                    <Button onPress={onDismiss} mode="text" labelStyle={styles.closeButtonLabel}>Close</Button>
                </View>

                <ScrollView contentContainerStyle={styles.scrollViewContent}>

                    {/* Pot Type Filter */}
                    <Text variant="titleSmall" style={styles.filterSectionTitle}>Pot Type</Text>{renderFilterButtons(potTypeOptions, potType, setPotType)}

                    {/* Position Filter */}
                    <Text variant="titleSmall" style={styles.filterSectionTitle}>Position</Text>{renderFilterButtons(positionOptions, position, setPosition)}

                    {/* Board Texture Filter */}
                    <Text variant="titleSmall" style={styles.filterSectionTitle}>Board Texture</Text>{renderFilterButtons(boardTextureOptions, boardTexture, setBoardTexture)}

                    {/* Relative Hero Position Filter */}
                    <Text variant="titleSmall" style={styles.filterSectionTitle}>Relative Hero Position</Text>{renderFilterButtons(relativeHeroPositionOptions, relativeHeroPosition, setRelativeHeroPosition)}

                </ScrollView>

                <View style={styles.modalActions}>
                    <Button onPress={handleClearAll}
                        mode="contained"
                        style={{
                            backgroundColor: '#FFF',
                            borderColor: "#000000",
                            borderWidth: 1
                        }} // Use specific action button style
                        buttonColor={theme.colors.secondaryContainer} // Custom color for Clear All
                        textColor={"#000000"} // Custom text color
                    >
                        Clear All
                    </Button>
                    <Button onPress={handleApply}
                        mode="contained"
                        style={styles.actionButton} // Use specific action button style
                        buttonColor={theme.button.backgroundColor} // Custom color for Apply Filters
                        textColor={theme.button.color} // Custom text color
                    >
                        Apply Filters
                    </Button>
                </View>
            </Modal>
        </Portal>
    );
};

const styles = StyleSheet.create({
    modalContent: {
        backgroundColor: 'white',
        margin: 10, // Reduced margin from edges
        borderRadius: 8,
        padding: 12, // Reduced overall padding
        // maxHeight: '95%',
        // maxHeight will be removed below, letting flex handle it
        justifyContent: 'space-between',
        flex: 1, // Allows modal to take up available height
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 0, // Reduced margin
        paddingBottom: 0, // Added a small padding at the bottom of header
        borderBottomWidth: 1, // Optional: add a subtle separator
        borderBottomColor: '#eee',
    },
    modalTitle: {
        fontWeight: 'bold',
        fontSize: 18, // Slightly smaller title
    },
    closeButtonLabel: {
        fontSize: 14, // Smaller "Close" button text
    },
    scrollViewContent: {
        // No flexGrow: 1 here, as the outer modalContent will handle height.
        // This ensures the scroll view only scrolls if content truly overflows.
        paddingVertical: 2, // Reduced vertical padding
    },
    filterSectionTitle: {
        marginTop: 12, // Reduced top margin
        marginBottom: 6, // Reduced bottom margin
        fontWeight: '600',
        color: '#333',
        fontSize: 14, // Smaller section titles
    },
    buttonRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'flex-start',
        gap: 8, // Slightly reduced gap between buttons from 8 to 6
        marginBottom: 10, // Space after each entire button row
    },
    filterButton: {
        borderRadius: 6,
        paddingHorizontal: 0, // Ensure no extra padding from default button styles
        marginBottom: 4,
        paddingVertical: 0,   // Ensure no extra padding from default button styles
        minHeight: 28, // Give buttons a fixed minimum height to keep them uniform
    },
    filterButtonLabel: {
        fontSize: 13, // Even smaller font size for filter labels
        paddingHorizontal: 4, // Restore some horizontal padding within the label itself
        paddingVertical: 2, // Restore some vertical padding within the label itself
        lineHeight: 12, // Keep line height consistent with font size
    },
    modalActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginTop: 8, // Reduced margin
        borderTopWidth: 1,
        borderTopColor: '#eee',
        paddingTop: 12, // Reduced padding
    },
    actionButton: {
        marginLeft: 8,
        // Optional: reduce vertical padding of the action buttons
        paddingVertical: 0, // Example: make them a bit shorter
        paddingHorizontal: 8,
    },
});

export default FilterModal;