import React, { useMemo } from 'react';
import { StyleSheet, ScrollView } from 'react-native';
import { useForm, Controller, FieldValues } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as Yup from 'yup';
import { TextInput, Button, HelperText } from 'react-native-paper';
import { Dropdown } from 'react-native-paper-dropdown';
import { useRouter } from 'expo-router';

export function parseStackSizes(stackString: string): { position: string; stackSize: number }[] {
    if (!stackString) {
        return [];
    }
    const stackObjects: { position: string; stackSize: number }[] = [];
    const stackEntries = stackString.split(',').map(entry => entry.trim());
    for (const entry of stackEntries) {
        const match = entry.match(/^([a-zA-Z]+)\s+(\d+)$/);
        if (match) {
            const position = match[1].toUpperCase();
            const stackSize = parseInt(match[2], 10);
            if (!isNaN(stackSize)) {
                stackObjects.push({ position, stackSize });
            }
        }
    }
    return stackObjects;
}
export const positionMapping: Record<number, { label: string; value: string }[]> = {
    2: [
        { label: 'SB', value: 'SB' },
        { label: 'BB', value: 'BB' }
    ],
    3: [
        { label: 'SB', value: 'SB' },
        { label: 'BB', value: 'BB' },
        { label: 'BTN', value: 'BTN' }
    ],
    4: [
        { label: 'SB', value: 'SB' },
        { label: 'BB', value: 'BB' },
        { label: 'CO', value: 'CO' },
        { label: 'BTN', value: 'BTN' }
    ],
    5: [
        { label: 'SB', value: 'SB' },
        { label: 'BB', value: 'BB' },
        { label: 'UTG', value: 'UTG' },
        { label: 'CO', value: 'CO' },
        { label: 'BTN', value: 'BTN' }
    ],
    6: [
        { label: 'SB', value: 'SB' },
        { label: 'BB', value: 'BB' },
        { label: 'UTG', value: 'UTG' },
        { label: 'HJ', value: 'HJ' },
        { label: 'CO', value: 'CO' },
        { label: 'BTN', value: 'BTN' }
    ],
    7: [
        { label: 'SB', value: 'SB' },
        { label: 'BB', value: 'BB' },
        { label: 'UTG', value: 'UTG' },
        { label: 'MP', value: 'MP' },
        { label: 'HJ', value: 'HJ' },
        { label: 'CO', value: 'CO' },
        { label: 'BTN', value: 'BTN' }
    ],
    8: [
        { label: 'SB', value: 'SB' },
        { label: 'BB', value: 'BB' },
        { label: 'UTG', value: 'UTG' },
        { label: 'UTG+1', value: 'UTG+1' },
        { label: 'MP', value: 'MP' },
        { label: 'HJ', value: 'HJ' },
        { label: 'CO', value: 'CO' },
        { label: 'BTN', value: 'BTN' }
    ],
    9: [
        { label: 'SB', value: 'SB' },
        { label: 'BB', value: 'BB' },
        { label: 'UTG', value: 'UTG' },
        { label: 'UTG+1', value: 'UTG+1' },
        { label: 'UTG+2', value: 'UTG+2' },
        { label: 'MP', value: 'MP' },
        { label: 'HJ', value: 'HJ' },
        { label: 'CO', value: 'CO' },
        { label: 'BTN', value: 'BTN' }
    ],
    10: [
        { label: 'SB', value: 'SB' },
        { label: 'BB', value: 'BB' },
        { label: 'UTG', value: 'UTG' },
        { label: 'UTG+1', value: 'UTG+1' },
        { label: 'UTG+2', value: 'UTG+2' },
        { label: 'MP', value: 'MP' },
        { label: 'LJ', value: 'LJ' },
        { label: 'HJ', value: 'HJ' },
        { label: 'CO', value: 'CO' },
        { label: 'BTN', value: 'BTN' }
    ]

};

export const playerOptions = [
    { label: '2', value: '2' },
    { label: '3', value: '3' },
    { label: '4', value: '4' },
    { label: '5', value: '5' },
    { label: '6', value: '6' },
    { label: '7', value: '7' },
    { label: '8', value: '8' },
    { label: '9', value: '9' },
    { label: '10', value: '10' }
]
const handFormValidationSchema = Yup.object().shape({
    smallBlind: Yup.number().required('Required').positive('Must be positive').typeError('Must be a number'),
    bigBlind: Yup.number().required('Required').positive('Must be positive').typeError('Must be a number').moreThan(Yup.ref('smallBlind'), 'Must be > small blind'),
    location: Yup.string().required('Required'),
    numPlayers: Yup.number().required('Required').integer('Must be an integer').min(2, 'Min 2').max(10, 'Max 10').typeError('Must be a number'),
    position: Yup.string().required('Required'),
    hand: Yup.string().required("Required"),
    // relevantStacks: Yup.string().required('Required').test(
    //     'contains-position',
    //     'Stack size for selected position is missing',
    //     (value, context) => {

    //         const selectedPosition = context.parent.position;
    //         if (!selectedPosition || !value) {
    //             return true;
    //         }

    //         // Check if the string contains the selected position (case-insensitive)
    //         const regex = new RegExp(`${selectedPosition}\\s*\\d+`, 'i');
    //         return regex.test(value);
    //     }
    // ),
});
interface PokerFormData extends FieldValues {
    smallBlind: number;
    bigBlind: number;
    numPlayers: number;
    position: string;
    // relevantStacks: string;
    location: string;
    hand: string;
}

function PokerHandForm() {
    const { control, watch, handleSubmit, formState: { errors, isSubmitting }, setValue } = useForm<PokerFormData>({
        resolver: yupResolver(handFormValidationSchema),
        defaultValues: { smallBlind: 2, bigBlind: 5, location: '', numPlayers: 8, position: 'BTN', hand: '' },
    });
    const router = useRouter();

    const numPlayers = watch('numPlayers');
    const onSubmit = (data) => {
        router.push({
            pathname: '/add-hand',
            params: {
                data: JSON.stringify(data)
            },
        });
    };
    const onError = (errors, e) => console.log(errors, e);
    // Use useMemo to efficiently update positionOptions
    const positionOptions = useMemo(() => {
        if (numPlayers) {
            return [...(positionMapping[numPlayers] || [])];
        }
        console.log(" IN THIS BRANCH ======")
        return [{ label: 'Select Position', value: '' }];
    }, [numPlayers]);

    // Reset position when numPlayers changes
    React.useEffect(() => {
        if (numPlayers) {
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
                            onChangeText={(text) => onChange(text === '' ? 0 : Number(text))}
                            value={String(value)}
                            keyboardType="numeric"
                            mode="outlined"
                            style={styles.input}
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
                            onChangeText={(text) => onChange(text === '' ? 0 : Number(text))}
                            value={String(value)}
                            keyboardType="numeric"
                            mode="outlined"
                            style={styles.input}
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
                            error={!!errors.smallBlind}
                        />
                        {errors.smallBlind && <HelperText type="error" visible={!!errors.location}>{errors.location.message}</HelperText>}
                    </>
                )}
                name="location"
            />

            <Controller
                control={control}
                render={({ field: { onChange, value } }) => (
                    <>
                        <Dropdown
                            label="Number of Players"
                            mode="outlined"
                            value={String(value)}
                            options={playerOptions}
                            onSelect={onChange}
                        />

                        {errors.numPlayers && <HelperText type="error" visible={!!errors.numPlayers}>{errors.numPlayers.message}</HelperText>}
                    </>
                )}
                name="numPlayers"
            />
            <Controller
                control={control}
                render={({ field: { onChange, value } }) => (
                    <>
                        <Dropdown
                            label="Hero's Position"
                            mode="outlined"
                            value={value}
                            options={positionOptions}
                            onSelect={onChange}
                        />
                        {errors.position && <HelperText type="error" visible={!!errors.position}> {errors.position.message}</HelperText>}
                    </>

                )}
                name="position"
            />
            <Controller
                control={control}
                render={({ field: { onChange, onBlur, value } }) => (
                    <>
                        <TextInput
                            label="Starting Hand (e.g., AhKd)"
                            onBlur={onBlur}
                            onChangeText={onChange}
                            value={value}
                            mode="outlined"
                            style={styles.input}
                            error={!!errors.relevantStacks}
                        />
                        {errors.relevantStacks && <HelperText type="error" visible={!!errors.hand}>{errors.hand.message}</HelperText>}
                    </>
                )}
                name="hand"
            />
            {/* <Controller
                control={control}
                render={({ field: { onChange, onBlur, value } }) => (
                    <>
                        <TextInput
                            label="Relevant Stack Sizes (e.g., CO 725, BTN 1000)"
                            onBlur={onBlur}
                            onChangeText={onChange}
                            value={value}
                            mode="outlined"
                            style={styles.input}
                            error={!!errors.relevantStacks}
                        />
                        {errors.relevantStacks && <HelperText type="error" visible={!!errors.relevantStacks}>{errors.relevantStacks.message}</HelperText>}
                    </>
                )}
                name="relevantStacks"
            /> */}
            <Button mode="contained" onPress={handleSubmit(onSubmit, onError)} disabled={isSubmitting} style={styles.button}>
                Start
            </Button>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 20,
    },
    input: {
        marginBottom: 10,
    },
    button: {
        marginTop: 10,
    }
});

export default PokerHandForm;