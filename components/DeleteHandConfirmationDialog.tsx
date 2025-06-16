import * as React from 'react';
import { StyleSheet, View } from 'react-native'; // Import StyleSheet and View
import { Button, Dialog, Portal, Text, useTheme } from 'react-native-paper';

const DeleteHandConfirmationDialog = ({ hideDialog, onDeletePress, visible }) => {
    // Access the theme for consistent colors (optional but recommended)
    const theme = useTheme();

    // Define styles using StyleSheet
    const styles = StyleSheet.create({
        dialog: {
            // You can add padding here if needed, but Dialog often handles it
            // Example: padding: 16,
        },
        title: {
            // Make the title slightly bolder or larger if desired
            // Default styling is usually okay, but you can override
             marginBottom: 10, // Add some space below the title
        },
        content: {
            // Add padding to the content area if default isn't enough
             paddingHorizontal: 24, // Standard Dialog content padding
             paddingBottom: 20, // Space before actions
        },
        contentText: {
            // Style the descriptive text
            fontSize: 16,
            lineHeight: 22,
            color: theme.colors.onSurfaceVariant, // Use theme color for secondary text
        },
        actions: {
            // Style the container for the buttons
            paddingHorizontal: 16, // Add some horizontal padding
            paddingBottom: 16, // Add some padding at the bottom
            justifyContent: 'flex-end', // Align buttons to the right (default)
        },
        button: {
            // Common style for both buttons, like margin
            marginLeft: 8, // Add space between buttons
            width: 64
        },
        // Specific styles for the Delete button (destructive action)
        deleteButton: {
            // You might set a specific buttonColor from your theme or a direct color
             backgroundColor: theme.colors.error, // Use theme's error color for background

        },
        deleteButtonLabel: {
             color: theme.colors.onError, // Text color that contrasts with the error background
           // fontWeight: 'bold', // Optionally make the text bold
        },
        // Specific styles for the Cancel button (less emphasis)
        cancelButton: {
            // You might set specific colors if needed, e.g., outline or text color
           // borderColor: theme.colors.outline,
        },
        cancelButtonLabel: {
           // color: theme.colors.primary, // Or another appropriate color
        },
    });

    return (
        <Portal>
            {/* Apply style to the Dialog container */}
            <Dialog visible={visible} onDismiss={hideDialog} style={styles.dialog}>
                {/* Title is now a direct child */}
                <Dialog.Title style={styles.title}>Delete hand?</Dialog.Title>

                {/* Content is now a direct child */}
                <Dialog.Content style={styles.content}>
                    <Text variant="bodyMedium" style={styles.contentText}>
                        This will permanently delete the hand and can't be undone.
                    </Text>
                </Dialog.Content>

                {/* Actions container remains for buttons */}
                <Dialog.Actions style={styles.actions}>
                    {/* Cancel Button - Standard text button */}
                    <Button
                        onPress={hideDialog}
                        style={[styles.button, styles.cancelButton]} // Combine common and specific styles
                        labelStyle={styles.cancelButtonLabel}
                        // mode="outlined" // Alternative look
                        textColor={theme.colors.primary} // Explicitly set text color for clarity
                    >
                        Cancel
                    </Button>
                    {/* Delete Button - Contained button for emphasis */}
                    <Button
                        onPress={onDeletePress}
                        mode="contained" // Makes it stand out
                        style={[styles.button, styles.deleteButton]} // Combine common and specific styles
                        labelStyle={styles.deleteButtonLabel}
                        // Use buttonColor for background in Paper v5+
                         buttonColor={theme.colors.error}
                         // For older versions, you might need to rely more on style={{backgroundColor: ...}}
                    >
                        Delete
                    </Button>
                </Dialog.Actions>
            </Dialog>
        </Portal>
    );
};

export default DeleteHandConfirmationDialog;