import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Dialog, Portal, Text, TextInput, useTheme } from 'react-native-paper';
import { useForm, Controller } from "react-hook-form";

interface HandNotesDialogProps {
    visible: boolean;
    hideDialog: () => void;
    onSaveNotes: (notes: string) => Promise<void>; // Assuming this can be async
    initialNotes: string | null | undefined;
}

const HandNotesDialog: React.FC<HandNotesDialogProps> = ({ visible, hideDialog, onSaveNotes, initialNotes }) => {
    const theme = useTheme();
    const textInputRef = React.useRef<typeof TextInput | any>(null); // For focusing TextInput

    const { control, reset, getValues, watch } = useForm({
        defaultValues: { notes: initialNotes }
    });

    const watchedNotes = watch("notes");
    const debounceTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

    // Effect to reset the form when initialNotes changes or when dialog becomes visible/hidden (for re-initialization)
    // React.useEffect(() => {
    //     if (visible) {
    //         console.log(`in visible and resetting to ${initialNotes}`)
    //         // When dialog becomes visible, reset the form with the current initialNotes.
    //         // This ensures it always starts fresh with the correct initial value.
    //         reset({ notes: initialNotes });
    //     }
    // }, [visible, initialNotes, reset]);

    // Effect for Debounced Saving
    React.useEffect(() => {
        if (!visible) {
            // If dialog is not visible, clear any pending debounce and do nothing.
            if (debounceTimeoutRef.current) {
                clearTimeout(debounceTimeoutRef.current);
            }
            return;
        }

        // Only proceed if watchedNotes is a string (it might be undefined initially)
        // And if it's different from initialNotes to prevent saving the initial state via debounce.
        if (typeof watchedNotes === 'string' && watchedNotes !== initialNotes) {
            if (debounceTimeoutRef.current) {
                clearTimeout(debounceTimeoutRef.current);
            }
            debounceTimeoutRef.current = setTimeout(async () => {
                try {
                    await onSaveNotes(watchedNotes);
                } catch (error) {
                    console.error("Error during debounced save:", error);
                    // Handle error appropriately in your app
                }
            }, 1000); // 1-second debounce, adjust as needed
        } else {
            // If notes are same as initial or not a string, clear pending debounce
            if (debounceTimeoutRef.current) {
                clearTimeout(debounceTimeoutRef.current);
            }
        }

        return () => {
            if (debounceTimeoutRef.current) {
                clearTimeout(debounceTimeoutRef.current);
            }
        };
    }, [watchedNotes, initialNotes, onSaveNotes, visible]);


    // Effect for focusing when the dialog becomes visible
    React.useEffect(() => {
        if (visible) {
            const timerId = setTimeout(() => {
                textInputRef.current?.focus();
            }, 100); // Adjust delay if necessary
            return () => clearTimeout(timerId);
        }
    }, [visible]);

    // Handles saving current notes and then closing the dialog
    const handleSaveAndClose = React.useCallback(async () => {
        if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current); // Clear any pending debounced save
        }
        const currentNotesValue = getValues("notes");
        if (typeof currentNotesValue === 'string') {
            try {
                await onSaveNotes(currentNotesValue);
            } catch (error) {
                console.error("Error saving on close:", error);
            }
        }
        hideDialog();
    }, [getValues, onSaveNotes, hideDialog, initialNotes]);


    const styles = StyleSheet.create({
        dialog: {marginBottom: 50},
        title: { marginBottom: 10 },
        content: { paddingHorizontal: 24, },
        textInput: { marginTop: 8, marginBottom: 12, maxHeight: 160, minHeight: 120, borderRadius: 8 }, // Added minHeight
        actions: { paddingHorizontal: 16, paddingBottom: 16, justifyContent: 'flex-end' },
        button: { marginLeft: 8 },
        // No saveButtonLabel needed now
        // cancelButtonLabel: {}, // Can be used for "Close" button
    });

    return (
        <Portal>
            <Dialog visible={visible} onDismiss={handleSaveAndClose} style={styles.dialog}>
                {/* <Dialog.Title style={styles.title}>Hand Notes</Dialog.Title> */}
                <Dialog.Content style={styles.content}>
                    <Controller
                        control={control}
                        render={({ field: { onChange, onBlur, value } }) => (
                            <TextInput
                                ref={textInputRef}
                                label="Notes" // Simpler label
                                onBlur={onBlur}
                                onChangeText={onChange}
                                value={value || ''}
                                mode="outlined"
                                activeOutlineColor='#000000'
                                style={styles.textInput}
                                multiline
                                numberOfLines={4} // Initial suggestion for height
                            />
                        )}
                        name="notes"
                    />
                </Dialog.Content>
                {/* <Dialog.Actions style={styles.actions}>
                    <Button
                        onPress={handleSaveAndClose}
                        style={styles.button}
                        // labelStyle={styles.cancelButtonLabel} // Optional styling
                        textColor={theme.colors.primary}
                    >
                        Done
                    </Button>
                </Dialog.Actions> */}
            </Dialog>
        </Portal>
    );
};

export default HandNotesDialog;