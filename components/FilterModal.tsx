import { BoardTexture, PokerHandFilters, Position, PotType, RelativeHeroPosition } from '@/types';
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Platform, Dimensions } from 'react-native';
import { Modal, Portal, Text, Button, useTheme } from 'react-native-paper';


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
    { value: PotType.kLimped, label: 'Limped' },
    { value: PotType.kSrp, label: 'SRP' },
    { value: PotType.kThreeBet, label: '3-bet' },
    { value: PotType.kFourBet, label: '4-bet' },
];

// 2. Position
const positionOptions = [
    { value: 'any', label: 'Any' },
    { value: Position.SB, label: 'SB' },
    { value: Position.BB, label: 'BB' },
    { value: Position.UTG, label: 'UTG' },
    { value: Position.UTG_1, label: 'UTG1' },
    { value: Position.LJ, label: 'LJ' },
    { value: Position.HJ, label: 'HJ' },
    { value: Position.CO, label: 'CO' },
    { value: Position.BU, label: 'BU' },
];

// 3. Board Texture
const boardTextureOptions = [
    { value: 'any', label: 'Any' }, // 'Any' needs special handling for multi-select
    { value: BoardTexture.kAceHigh, label: 'Ace high' },
    { value: BoardTexture.kMonotone, label: 'Monotone' },
    { value: BoardTexture.kPaired, label: 'Paired' },
    { value: BoardTexture.kDoubleBroadway, label: '2 Broadway' },
    { value: BoardTexture.kRainbow, label: 'Rainbow' },
    { value: BoardTexture.kFlushDraw, label: 'Flush Draw' },
    { value: BoardTexture.kConnected, label: 'Connected' },
    { value: BoardTexture.kDisconnected, label: 'Disconnected' },
    { value: BoardTexture.kLowCards, label: 'Low Cards' },
];

// 4. Relative Hero Position
const relativeHeroPositionOptions = [
    { value: 'any', label: 'Any' },
    { value: RelativeHeroPosition.kInPosition, label: 'IP' },
    { value: RelativeHeroPosition.kOutOfPosition, label: 'OOP' },
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
            // Ensure boardTexture is initialized as an array, even if currentFilters.boardTexture was single select before
            setBoardTexture(Array.isArray(currentFilters.boardTexture) ? currentFilters.boardTexture : [currentFilters.boardTexture]);
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
        setBoardTexture(['any']); // Reset to ['any'] for multi-select
        setRelativeHeroPosition('any');
        onApplyFilters({
            potType: 'any',
            position: 'any',
            boardTexture: ['any'], // Pass as array
            relativeHeroPosition: 'any',
        });
    };

    // Helper for single-select filter buttons
    const renderSingleSelectFilterButtons = (
        options: { value: string; label: string }[],
        selectedValue: string,
        onSelect: (value: any) => void // Single value expected
    ) => {
        return (
            <View style={styles.buttonRow}>
                {options.map(option => {
                    const isSelected = selectedValue === option.value;
                    return (
                        <Button
                            key={option.value}
                            mode={isSelected ? 'contained' : 'outlined'}
                            onPress={() => onSelect(option.value)}
                            compact
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

    // Helper for multi-select filter buttons (specifically for Board Texture)
    const renderMultiSelectFilterButtons = (
        options: { value: string; label: string }[],
        selectedValues: string[], // Array of selected values
        onToggle: (value: string) => void // Toggle logic
    ) => {
        return (
            <View style={styles.buttonRow}>
                {options.map(option => {
                    const isSelected = selectedValues.includes(option.value);
                    return (
                        <Button
                            key={option.value}
                            mode={isSelected ? 'contained' : 'outlined'}
                            onPress={() => onToggle(option.value)} // Call onToggle
                            compact
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

    // Logic for toggling Board Texture selections
    const handleBoardTextureToggle = (value: string) => {
        if (value === 'any') {
            // If "Any" is clicked, set boardTexture to just ['any']
            setBoardTexture(['any']);
        } else {
            // If another option is clicked:
            let newSelection = [...boardTexture];
            const wasAnySelected = newSelection.includes('any');

            if (wasAnySelected) {
                // If "Any" was selected, start fresh with only the new value
                newSelection = [value];
            } else if (newSelection.includes(value)) {
                // If the value was already selected, remove it
                newSelection = newSelection.filter(item => item !== value);
                // If removing the last item, default to ['any']
                if (newSelection.length === 0) {
                    newSelection = ['any'];
                }
            } else {
                // If the value was not selected, add it
                newSelection.push(value);
            }
            setBoardTexture(newSelection);
        }
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

                    {/* Pot Type Filter (Single-select) */}
                    <Text variant="titleSmall" style={styles.filterSectionTitle}>Pot Type</Text>{renderSingleSelectFilterButtons(potTypeOptions, potType, setPotType)}

                    {/* Position Filter (Single-select) */}
                    <Text variant="titleSmall" style={styles.filterSectionTitle}>Position</Text>{renderSingleSelectFilterButtons(positionOptions, position, setPosition)}

                    {/* Board Texture Filter (Multi-select) */}
                    <Text variant="titleSmall" style={styles.filterSectionTitle}>Board Texture</Text>{renderMultiSelectFilterButtons(boardTextureOptions, boardTexture, handleBoardTextureToggle)}


                    {/* Relative Hero Position Filter (Single-select) */}
                    <Text variant="titleSmall" style={styles.filterSectionTitle}>Relative Hero Position</Text>{renderSingleSelectFilterButtons(relativeHeroPositionOptions, relativeHeroPosition, setRelativeHeroPosition)}

                </ScrollView>

                <View style={styles.modalActions}>
                    <Button onPress={handleClearAll}
                        mode="contained"
                        style={{...styles.actionButton, borderColor: '#000000', borderWidth: 1}} // Re-using actionButton style
                        buttonColor={"#FFF"}
                        textColor={"#000000"}
                    >
                        Clear All
                    </Button>
                    <Button onPress={handleApply}
                        mode="contained"
                        style={styles.actionButton}
                        buttonColor={theme.button.backgroundColor}
                        textColor={theme.button.color}
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
        margin: 10,
        borderRadius: 8,
        padding: 12,
        justifyContent: 'space-between',
        flex: 1,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 0,
        paddingBottom: 0,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    modalTitle: {
        fontWeight: 'bold',
        fontSize: 18,
    },
    closeButtonLabel: {
        fontSize: 14,
    },
    scrollViewContent: {
        paddingVertical: 2,
    },
    filterSectionTitle: {
        marginTop: 12,
        marginBottom: 6,
        fontWeight: '600',
        color: '#333',
        fontSize: 14,
    },
    buttonRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'flex-start',
        gap: 8,
        marginBottom: 10,
    },
    filterButton: {
        borderRadius: 6,
        paddingHorizontal: 0,
        marginBottom: 4, // Keep some vertical space for wrapped buttons
        paddingVertical: 0,
        minHeight: 28,
    },
    filterButtonLabel: {
        fontSize: 13,
        paddingHorizontal: 4,
        paddingVertical: 2,
        lineHeight: 12,
    },
    modalActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#eee',
        paddingTop: 12,
    },
    actionButton: {
        marginLeft: 8,
        paddingVertical: 0,
        paddingHorizontal: 8,
    },
});

export default FilterModal;