import React from 'react';
import { Platform, StyleSheet, ScrollView, View } from 'react-native';
import { useForm, Controller, FieldValues, FieldErrors } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as Yup from 'yup';
import { Text, TextInput, Button, HelperText, useTheme, SegmentedButtons } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { playerOptions, positionMapping } from '@/constants';
import { HandSetupInfo, Position } from '@/types';
import { validateAndParsePokerHandString } from '@/utils/card_utils';

let handMessage = '';
const handFormValidationSchema = Yup.object().shape({
    smallBlind: Yup.number().required('Required').positive('Must be positive').typeError('Must be a number'),
    bigBlind: Yup.number().required('Required').positive('Must be positive').typeError('Must be a number').min(Yup.ref('smallBlind'), 'Must be >= small blind'),
    location: Yup.string().required('Required'),
    numPlayers: Yup.number().required('Required').integer('Must be an integer').min(2, 'Min 2').max(8, 'Max 8').typeError('Must be a number'),
    position: Yup.string().required('Required'),
    hand: Yup.string()
        .required("Required")
        .test(
            'valid-hand-format',
            'Invalid hand format',
            function (value) { // Use a regular function to access `this.createError` if needed, or just return the string
                if (!value) { // Handle cases where value might be undefined or null if not caught by .required()
                    return true; // Or handle as an error if empty string is invalid despite .required()
                }
                const result = validateAndParsePokerHandString(value);
                console.log('Validation result:', result); // For debugging

                if (result.isValid) {
                    return true; // Validation passes
                }

                // If not valid, return the specific error message from your function
                // This message will be used by Yup.
                return this.createError({ message: result.error || 'Invalid hand format' });
                // Or, more simply, if you don't need to customize the path/params of the error:
                // return result.error || 'Invalid hand format'; 
            }
        ),
    relevantStacks: Yup.string().required('Required').test(
        'contains-position',
        'Stack size for selected position is missing',
        (value, context) => {

            const selectedPosition = context.parent.position;
            if (!selectedPosition || !value) {
                return true;
            }

            // Check if the string contains the selected position (case-insensitive)
            const regex = new RegExp(`${selectedPosition}\\s*\\d+`, 'i');
            return regex.test(value);
        }
    ),
});

const createSegmentedButton = (value: any, label: string) => ({
    value, label, checkedColor: '#FFF',
    uncheckedColor: '#000000',

    style: {
        borderRadius: 0,
    },
});

const createSegmentedButtonForNumPlayers = (value: any, label: string) => ({
    value, label, checkedColor: '#FFF', uncheckedColor: '#000000',
    style: {
        borderRadius: 0,
        minWidth: 50,
    },
    labelStyle: {
        fontWeight: Platform.OS === "ios" ? '400' : '500',
    },
});

const createSegmentedButtonForBlind = (value: number, label: string) => ({
    value, label, checkedColor: '#FFF', uncheckedColor: '#000000',
    style: {
        borderRadius: 0,
        minWidth: 50,
    },
    labelStyle: {
        fontWeight: Platform.OS === "ios" ? '400' : '500',
    },
});

function PokerHandForm({ close, preset }) {
    const { control, watch, handleSubmit, formState: { errors, isSubmitting }, setValue, getValues, clearErrors } = useForm<HandSetupInfo>({
        resolver: yupResolver(handFormValidationSchema),
        defaultValues: {
            smallBlind: 5,
            bigBlind: 5,
            location: '',
            numPlayers: 8,
            position: '',
            hand: '',
            relevantStacks: '',
            ...preset
        },
    });
    const [positionOptions, setPositionOptions] = React.useState<any>([]);
    const [initialLoad, setInitialLoad] = React.useState<any>(true);

    const router = useRouter();
    const theme = useTheme();

    const numPlayers = watch('numPlayers');
    const onSubmit = (data) => {
        router.push({
            pathname: '/add-hand',
            params: {
                data: JSON.stringify(data)
            },
        });
        close();
    };
    const onError = (errors: FieldErrors, e) => {
        console.log(errors, ' error')
    };
    React.useEffect(() => {
        if (numPlayers) {
            setPositionOptions([...(positionMapping[numPlayers].map(p => createSegmentedButton(p.value, p.label)))]);
            if (initialLoad) {
                setInitialLoad(false);
            }
            setValue('position', initialLoad ? 'BU' : '');
        }
    }, [numPlayers, setValue]);

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Controller
                control={control}
                render={({ field: { onChange, onBlur, value } }) => (
                    <>
                        <TextInput
                            label="Starting Hand (e.g., AhKd, 54ss)"
                            onBlur={onBlur}
                            onChangeText={(text) => {
                                if (errors.hand) { clearErrors('hand') };
                                return onChange(text);
                            }}
                            value={value}
                            mode="outlined"
                            style={styles.input}
                            activeOutlineColor='#000000'
                            error={!!errors.hand}
                        />
                        {errors.hand && <HelperText type="error" visible={!!errors.hand}>{errors.hand?.message}</HelperText>}
                    </>
                )}
                name="hand"
            />
            <Controller
                control={control}
                render={({ field: { onChange, onBlur, value } }) => (
                    <>
                        <TextInput
                            label="Location"
                            onBlur={onBlur}
                            onChangeText={(text) => {
                                if (errors.location) { clearErrors('location') };
                                return onChange(text);
                            }}
                            value={value}
                            mode="outlined"
                            style={styles.input}
                            activeOutlineColor='#000000'
                            error={!!errors.location}
                        />
                        {/* {errors.location && <HelperText type="error" visible={!!errors.location}>{errors.location?.message}</HelperText>} */}
                    </>
                )}
                name="location"
            />
            <Controller
                control={control}
                render={({ field: { onChange, onBlur, value } }) => (
                    <>
                        <TextInput
                            label="Relevant Stacks (e.g., CO 400, BU 600)"
                            onBlur={onBlur}
                            onChangeText={(text) => {
                                if (errors.relevantStacks) { clearErrors('relevantStacks') };
                                return onChange(text);
                            }}
                            value={value}
                            mode="outlined"
                            style={styles.input}
                            activeOutlineColor='#000000'
                            error={!!errors.relevantStacks}
                        />
                        {errors.relevantStacks && <HelperText type="error" visible={!!errors.relevantStacks}>{errors.relevantStacks?.message}</HelperText>}
                    </>
                )}
                name="relevantStacks"
            />
            <Controller
                render={
                    ({ field: { onChange, value } }) => (
                        <View style={{ marginBottom: 8 }}>
                            <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 4, fontWeight: Platform.OS === "ios" ? '400' : '500' }}>Small Blind</Text>
                            <SegmentedButtons
                                value={value}
                                onValueChange={onChange}
                                density='small'
                                style={{ width: '100%' }}
                                buttons={[
                                    createSegmentedButtonForBlind(1, '1'),
                                    createSegmentedButtonForBlind(2, '2'),
                                    createSegmentedButtonForBlind(3, '3'),
                                    createSegmentedButtonForBlind(5, '5'),
                                    createSegmentedButtonForBlind(10, '10'),
                                ]}
                            />
                            {errors.smallBlind && <HelperText type="error" visible={!!errors.smallBlind}>{errors.smallBlind?.message}</HelperText>}
                        </View>
                    )
                }
                control={control}
                name="smallBlind"
            />
            <Controller
                render={
                    ({ field: { onChange, value } }) => (
                        <View style={{ marginBottom: 8 }}>
                            <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 4, fontWeight: Platform.OS === "ios" ? '400' : '500' }}>Big Blind</Text>
                            <SegmentedButtons
                                value={value}
                                onValueChange={onChange}
                                density='small'
                                style={{ width: '100%' }}
                                buttons={[
                                    createSegmentedButtonForBlind(2, '2'),
                                    createSegmentedButtonForBlind(3, '3'),
                                    createSegmentedButtonForBlind(5, '5'),
                                    createSegmentedButtonForBlind(10, '10'),
                                    createSegmentedButtonForBlind(20, '20'),
                                ]}
                            />
                            {errors.bigBlind && <HelperText type="error" visible={!!errors.bigBlind}>{errors.bigBlind?.message}</HelperText>}
                        </View>
                    )
                }
                control={control}
                name="bigBlind"
            />
            <Controller
                render={
                    ({ field: { onChange, value } }) => (
                        <View style={{ marginBottom: 8 }}>
                            <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 4, fontWeight: Platform.OS === "ios" ? '400' : '500' }}>Number of Players</Text>
                            <SegmentedButtons
                                value={value}
                                onValueChange={onChange}
                                density='small'
                                style={{ width: '100%' }}
                                buttons={[
                                    createSegmentedButtonForNumPlayers(2, '2'),
                                    createSegmentedButtonForNumPlayers(3, '3'),
                                    createSegmentedButtonForNumPlayers(4, '4'),
                                    createSegmentedButtonForNumPlayers(5, '5'),
                                    createSegmentedButtonForNumPlayers(6, '6'),
                                    createSegmentedButtonForNumPlayers(7, '7'),
                                    createSegmentedButtonForNumPlayers(8, '8'),
                                ]}
                            />
                        </View>
                    )
                }
                control={control}
                name="numPlayers"
            />
            {numPlayers === 2 && <Controller
                render={
                    ({ field: { onChange, value } }) => (
                        <View style={{ marginBottom: 8 }}>
                            <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 4, fontWeight: Platform.OS === "ios" ? '400' : '500' }}>Position</Text>
                            <SegmentedButtons
                                value={value}
                                onValueChange={onChange}
                                density='small'
                                style={{ width: '100%', flexWrap: 'wrap', marginBottom: 12 }}
                                buttons={[...(positionMapping[2].map(p => createSegmentedButton(p.value, p.label)))]}
                            />
                            {errors.position && <HelperText type="error" visible={!!errors.position}>{errors.position?.message}</HelperText>}
                        </View>
                    )
                }
                control={control}
                name="position"
            />}
            {numPlayers === 3 && <Controller
                render={
                    ({ field: { onChange, value } }) => (
                        <View style={{ marginBottom: 8 }}>
                            <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 4, fontWeight: Platform.OS === "ios" ? '400' : '500' }}>Position</Text>
                            <SegmentedButtons
                                value={value}
                                onValueChange={onChange}
                                density='small'
                                style={{ width: '100%', flexWrap: 'wrap', marginBottom: 12 }}
                                buttons={[...(positionMapping[3].map(p => createSegmentedButton(p.value, p.label)))]}
                            />
                            {errors.position && <HelperText type="error" visible={!!errors.position}>{errors.position?.message}</HelperText>}
                        </View>
                    )
                }
                control={control}
                name="position"
            />}
            {numPlayers !== 2 && numPlayers !== 3 && <Controller
                render={
                    ({ field: { onChange, value } }) => (
                        <View style={{ marginBottom: 8 }}>
                            <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 4, fontWeight: Platform.OS === "ios" ? '400' : '500' }}>Position</Text>
                            <SegmentedButtons
                                value={value}
                                onValueChange={onChange}
                                density='small'
                                style={{ width: '100%', flexWrap: 'wrap', marginBottom: 12 }}
                                buttons={[...positionOptions.slice(0, Math.ceil(positionOptions.length / 2))]}
                            />
                            <SegmentedButtons
                                value={value}
                                onValueChange={onChange}
                                density='small'
                                style={{ width: '100%', flexWrap: 'wrap', }}
                                buttons={[...positionOptions.slice(Math.ceil(positionOptions.length / 2))]}
                            />
                            {errors.position && <HelperText type="error" visible={!!errors.position}>{errors.position?.message}</HelperText>}
                        </View>
                    )
                }
                control={control}
                name="position"
            />}
            <Button mode="contained" onPress={handleSubmit(onSubmit, onError)} disabled={isSubmitting} style={{ ...styles.button, ...theme.button }}>
                Start
            </Button>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 20,
        flexGrow: 1,
    },
    input: {
        marginBottom: 10,
    },
    button: {
        marginTop: 8,
        borderRadius: 4,
        minHeight: 40,
        padding: 2
    },
});

export default PokerHandForm;