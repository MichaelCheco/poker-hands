import * as React from 'react';
import { StyleSheet, View } from 'react-native'; // Standard React Native import
import { Button, Dialog, Portal, Text, TextInput, useTheme } from 'react-native-paper'; // React Native Paper import

const HandNotesDialog = ({ visible, hideDialog, onSaveNotes, initialNotes = '' }) => {
    // Access the theme for consistent colors
    const theme = useTheme();

    // State to hold the notes text
    const [notes, setNotes] = React.useState(initialNotes);

    // Ref for the TextInput to manage focus
    const textInputRef = React.useRef(null);

    // Autofocus the TextInput when the dialog becomes visible
    React.useEffect(() => {
        if (visible) {
            // Update notes from initialNotes when dialog becomes visible and initialNotes change
            setNotes(initialNotes);
            // Slight delay to ensure the dialog is fully rendered before focusing
            // This is a common pattern in React Native for focusing elements in modals/dialogs
            setTimeout(() => {
                textInputRef.current?.focus();
            }, 100); // 100ms delay, adjust if needed based on dialog animation and rendering
        }
    }, [visible, initialNotes]);

    const handleSave = () => {
        onSaveNotes(notes);
        hideDialog(); // Optionally close dialog on save
    };

    const handleCancel = () => {
        // Reset notes to initial value on cancel if the dialog is dismissed without saving
        setNotes(initialNotes);
        hideDialog();
    };

    // Define styles using StyleSheet from React Native
    const styles = StyleSheet.create({
        dialog: {
            // General dialog styling if needed, often React Native Paper handles defaults well
        },
        title: {
            marginBottom: 10, // Adds space below the dialog title
        },
        content: {
            paddingHorizontal: 24, // Standard Dialog content padding from Material Design guidelines
            paddingBottom: 0,      // Reduce bottom padding as TextInput will have its own margin
        },
        textInput: {
            // Style for the text input field
            // backgroundColor: theme.colors.background, // Example: Match dialog background or make it stand out
            marginBottom: 20, // Space before action buttons
            maxHeight: 150,   // Optional: limit height for multiline input to prevent overly tall dialogs
        },
        actions: {
            // Container for dialog action buttons
            paddingHorizontal: 16, // Horizontal padding for the actions container
            paddingBottom: 16,     // Bottom padding for the actions container
            justifyContent: 'flex-end', // Aligns buttons to the right, common for dialogs
        },
        button: {
            marginLeft: 8, // Adds space between buttons if there are multiple
            width: 64
        },
        saveButtonLabel: {
            // Specific styling for the save button's label (text) if needed
            // e.g., color: theme.colors.primary,
        },
        cancelButtonLabel: {
            // Specific styling for the cancel button's label if needed
            // e.g., color: theme.colors.onSurfaceVariant,
        },
    });

    return (
        <Portal>
            {/* Dialog component from React Native Paper */}
            <Dialog visible={visible} onDismiss={handleCancel} style={styles.dialog}>
                <Dialog.Title style={styles.title}>Hand Notes</Dialog.Title>
                <Dialog.Content style={styles.content}>
                    <TextInput
                        ref={textInputRef}
                        // label="Enter notes for this hand"
                        value={notes}
                        onChangeText={setNotes} // Updates the 'notes' state on text change
                        mode="outlined" // TextInput mode: 'outlined' or 'flat'
                        style={styles.textInput}
                        activeOutlineColor='#000000'
                        multiline // Allows multiple lines of text
                        numberOfLines={4} // Suggests initial height for multiline input (Android only for effect)
                    // The autoFocus prop might work directly on some platforms/versions for TextInput,
                    // but using useEffect with a ref is generally more reliable for elements
                    // that appear conditionally, like those in a dialog.
                    />
                </Dialog.Content>
                <Dialog.Actions style={styles.actions}>
                    {/* Cancel Button */}
                    <Button
                        onPress={handleCancel}
                        style={styles.button}
                        labelStyle={styles.cancelButtonLabel}
                        textColor={theme.colors.onSurfaceVariant} // Standard text color for a non-primary action
                    >
                        Cancel
                    </Button>
                    {/* Save Notes Button */}
                    <Button
                        onPress={handleSave}
                        mode="contained" // 'contained' mode makes the button more prominent (primary action)
                        style={styles.button}
                        labelStyle={styles.saveButtonLabel}
                        buttonColor={'#000000'} // Use theme's primary color for the save button background
                        textColor={'#ffffff'}   // Text color that contrasts with the primary button background
                    >
                        Save
                    </Button>
                </Dialog.Actions>
            </Dialog>
        </Portal>
    );
};

export default HandNotesDialog;