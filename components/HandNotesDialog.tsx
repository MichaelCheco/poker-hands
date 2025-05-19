import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Dialog, Portal, Text, TextInput, useTheme } from 'react-native-paper';
import { useForm, Controller } from "react-hook-form";

interface HandNotesDialogProps {
  visible: boolean;
  hideDialog: () => void;
  onSaveNotes: (notes: string) => Promise<void>;
  initialNotes: string;
}
const HandNotesDialog: React.FC<HandNotesDialogProps> = ({ visible, hideDialog, onSaveNotes, initialNotes }) => {
    const theme = useTheme();
    const textInputRef = React.useRef(null);
    const { control, handleSubmit, formState: { errors } } = useForm({
        defaultValues: {notes: initialNotes}
    });
    const onSubmit = ({notes}: {notes: string}) => {
        console.log(notes)
        onSaveNotes(notes);
    };

    // This ref tracks if the dialog was previously visible.
    // Used to detect when the dialog is *newly* opened.
    const prevVisibleRef = React.useRef(visible);

    React.useEffect(() => {
        // This effect is specifically for initializing when the dialog opens.
        // Update prevVisibleRef for the next render.
        prevVisibleRef.current = visible;
    }, [visible, initialNotes]); // Effect for initialization based on visibility change and initialNotes

    React.useEffect(() => {
        // This effect is for focusing when the dialog becomes visible.
        if (visible) {
            const timerId = setTimeout(() => {
                textInputRef.current?.focus();
            }, 100); // Adjust delay if necessary
            return () => clearTimeout(timerId);
        }
    }, [visible]); // Focus only when visibility changes.

    const handleCancel = () => {
        hideDialog();
    };

    const styles = StyleSheet.create({
        dialog: {},
        title: { marginBottom: 10 },
        content: { paddingHorizontal: 24, paddingBottom: 0 },
        textInput: { marginBottom: 20, maxHeight: 150 },
        actions: { paddingHorizontal: 16, paddingBottom: 16, justifyContent: 'flex-end' },
        button: { marginLeft: 8 },
        saveButtonLabel: {},
        cancelButtonLabel: {},
    });

    return (
        <Portal>
            <Dialog visible={visible} onDismiss={handleCancel} style={styles.dialog}>
                <Dialog.Title style={styles.title}>Hand Notes</Dialog.Title>
                <Dialog.Content style={styles.content}>
                    <Controller
                        control={control}
                        render={({ field: { onChange, onBlur, value } }) => (
                            <TextInput
                                ref={textInputRef}
                                onBlur={onBlur}
                                onChangeText={onChange}
                                value={value}
                                mode="outlined"
                                style={styles.textInput}
                                multiline
                                numberOfLines={4}
                            />
                        )}
                        name="notes"
                    />
                </Dialog.Content>
                <Dialog.Actions style={styles.actions}>
                    <Button
                        onPress={handleCancel}
                        style={styles.button}
                        labelStyle={styles.cancelButtonLabel}
                        textColor={theme.colors.onSurfaceVariant}
                    >
                        Cancel
                    </Button>
                    <Button
                        onPress={handleSubmit(onSubmit)}
                        mode="contained"
                        style={styles.button}
                        labelStyle={styles.saveButtonLabel}
                        buttonColor={theme.colors.primary}
                        textColor={theme.colors.onPrimary}
                    >
                        Save Notes
                    </Button>
                </Dialog.Actions>
            </Dialog>
        </Portal>
    );
};

export default HandNotesDialog;