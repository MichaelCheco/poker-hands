import React, { useMemo } from 'react';
import { StyleSheet, ScrollView, View } from 'react-native';
import { useForm, Controller, FieldValues } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as Yup from 'yup';
import { Text, TextInput, Button, HelperText, useTheme, SegmentedButtons } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { playerOptions, positionMapping } from '@/constants';
import { HandSetupInfo, Position } from '@/types';

const handFormValidationSchema = Yup.object().shape({
    smallBlind: Yup.number().required('Required').positive('Must be positive').typeError('Must be a number'),
    bigBlind: Yup.number().required('Required').positive('Must be positive').typeError('Must be a number').min(Yup.ref('smallBlind'), 'Must be >= small blind'),
    location: Yup.string().required('Required'),
    numPlayers: Yup.number().required('Required').integer('Must be an integer').min(2, 'Min 2').max(9, 'Max 9').typeError('Must be a number'),
    position: Yup.string().required('Required'),
    hand: Yup.string().required("Required"),
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
});

function PokerHandForm({ close, preset }) {
    const { control, watch, handleSubmit, formState: { errors, isSubmitting }, setValue, getValues } = useForm<HandSetupInfo>({
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
    const [positionOptions, setPositionOptions] = React.useState<any>([])
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
    const onError = (errors, e) => console.log(errors, e);
    React.useEffect(() => {
        if (numPlayers) {
            setPositionOptions([...(positionMapping[numPlayers].map(p => createSegmentedButton(p.value, p.label)))]);
            setValue('position', '');
        }
    }, [numPlayers, setValue]);
    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Controller
                control={control}
                render={({ field: { onChange, onBlur, value } }) => (
                    <>
                        <TextInput
                            label="Small Blind"
                            onBlur={onBlur}
                            onChangeText={(text) => {
                                const numericText = text.replace(/[^0-9]/g, '');
                                return onChange(numericText);
                            }}
                            value={String(value)}
                            keyboardType="numeric"
                            mode="outlined"
                            style={styles.input}
                            activeOutlineColor='#000000'
                            error={!!errors.smallBlind}
                        />
                        {errors.smallBlind && <HelperText type="error" visible={!!errors.smallBlind}>{errors.smallBlind.message}</HelperText>}
                    </>
                )}
                name="smallBlind"
            />
            <Controller
                control={control}
                render={({ field: { onChange, onBlur, value } }) => (
                    <>
                        <TextInput
                            label="Big Blind"
                            onBlur={onBlur}
                            onChangeText={(text) => {
                                const numericText = text.replace(/[^0-9]/g, '');
                                return onChange(numericText);
                            }}
                            value={String(value)}
                            keyboardType="numeric"
                            mode="outlined"
                            style={styles.input}
                            activeOutlineColor='#000000'
                            error={!!errors.bigBlind}
                        />
                        {errors.bigBlind && <HelperText type="error" visible={!!errors.bigBlind}>{errors.bigBlind.message}</HelperText>}
                    </>
                )}
                name="bigBlind"
            />
            <Controller
                control={control}
                render={({ field: { onChange, onBlur, value } }) => (
                    <>
                        <TextInput
                            label="Location"
                            onBlur={onBlur}
                            onChangeText={onChange}
                            value={value}
                            mode="outlined"
                            style={styles.input}
                            activeOutlineColor='#000000'
                            error={!!errors.smallBlind}
                        />
                        {errors.location && <HelperText type="error" visible={!!errors.location}>{errors.location.message}</HelperText>}
                    </>
                )}
                name="location"
            />
            <Controller
                render={
                    ({ field: { onChange, value } }) => (
                        <View style={{ marginBottom: 8 }}>
                            <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 4 }}>Number of Players</Text>
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
            <Controller
                render={
                    ({ field: { onChange, value } }) => (
                        <View style={{ marginBottom: 8 }}>
                            <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 4 }}>Position</Text>
                            <SegmentedButtons
                                value={value}
                                onValueChange={onChange}
                                density='small'
                                style={{ width: '100%', flexWrap: 'wrap', marginBottom: 12  }}
                                buttons={[...positionOptions.slice(0, Math.ceil(positionOptions.length / 2))]}
                            />
                            <SegmentedButtons
                                value={value}
                                onValueChange={onChange}
                                density='small'
                                style={{ width: '100%', flexWrap: 'wrap',  }}
                                buttons={[...positionOptions.slice(Math.ceil(positionOptions.length / 2))]}
                            />
                        </View>
                    )
                }
                control={control}
                name="position"
            />
            <Controller
                control={control}
                render={({ field: { onChange, onBlur, value } }) => (
                    <>
                        <TextInput
                            label="Starting Hand (e.g., AhKd, 54ss)"
                            onBlur={onBlur}
                            onChangeText={onChange}
                            value={value}
                            mode="outlined"
                            style={styles.input}
                            activeOutlineColor='#000000'
                            error={!!errors.relevantStacks}
                        />
                        {errors.relevantStacks && <HelperText type="error" visible={!!errors.hand}>{errors?.hand.message}</HelperText>}
                    </>
                )}
                name="hand"
            />
            <Controller
                control={control}
                render={({ field: { onChange, onBlur, value } }) => (
                    <>
                        <TextInput
                            label="Stacks for players in hand (e.g., CO 400, BU 600)"
                            onBlur={onBlur}
                            onChangeText={onChange}
                            value={value}
                            mode="outlined"
                            style={styles.input}
                            activeOutlineColor='#000000'
                            error={!!errors.relevantStacks}
                        />
                        {errors.relevantStacks && <HelperText type="error" visible={!!errors.relevantStacks}>{errors.relevantStacks.message}</HelperText>}
                    </>
                )}
                name="relevantStacks"
            />
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
    }
});

export default PokerHandForm;