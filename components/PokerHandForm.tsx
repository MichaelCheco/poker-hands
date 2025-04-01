import React, { useMemo } from 'react';
import { StyleSheet, ScrollView } from 'react-native';
import { useForm, Controller, FieldValues } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as Yup from 'yup';
import { TextInput, Button, HelperText, useTheme } from 'react-native-paper';
import { Dropdown } from 'react-native-paper-dropdown';
import { useRouter } from 'expo-router';
import { playerOptions, positionMapping } from '@/constants';

const handFormValidationSchema = Yup.object().shape({
    smallBlind: Yup.number().required('Required').positive('Must be positive').typeError('Must be a number'),
    bigBlind: Yup.number().required('Required').positive('Must be positive').typeError('Must be a number').min(Yup.ref('smallBlind'), 'Must be >= small blind'),
    location: Yup.string().required('Required'),
    numPlayers: Yup.number().required('Required').integer('Must be an integer').min(2, 'Min 2').max(9, 'Max 9').typeError('Must be a number'),
    position: Yup.string().required('Required'),
    hand: Yup.string().required("Required"),
});

export interface PokerFormData extends FieldValues {
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
        defaultValues: { smallBlind: 2, bigBlind: 5, location: '', numPlayers: 8, position: '', hand: '' },
    });
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
    };
    const onError = (errors, e) => console.log(errors, e);
    const positionOptions = useMemo(() => {
        if (numPlayers) {
            return [...(positionMapping[numPlayers] || [])];
        }
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
            <Button mode="contained" onPress={handleSubmit(onSubmit, onError)} disabled={isSubmitting} style={{...styles.button, backgroundColor: theme.colors.primary}}>
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

// TODO
/* <Controller
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
/> */
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