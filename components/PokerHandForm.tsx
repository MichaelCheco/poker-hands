import React, { useMemo } from 'react';
import { StyleSheet, ScrollView } from 'react-native';
import { useForm, Controller, FieldValues } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as Yup from 'yup';
import { TextInput, Button, HelperText, useTheme } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { playerOptions, positionMapping } from '@/constants';
import { HandSetupInfo } from '@/types';

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

function PokerHandForm({close, preset}) {
    const { control, watch, handleSubmit, formState: { errors, isSubmitting }, setValue } = useForm<HandSetupInfo>({
        resolver: yupResolver(handFormValidationSchema),
        defaultValues: { 
            smallBlind: 5,
            bigBlind: 5,
            location: 'Aria',
            numPlayers: 6,
            position: 'SB',
            hand: '8s8c',
            relevantStacks: 'SB 400, CO 600, BB 300',
            ...preset
        },
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
        close();
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
            setValue('position', 'SB');
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
                control={control}
                render={({ field: { onChange, onBlur, value } }) => (
                    <>
                        <TextInput
                            label="Number of Players"
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
                            error={!!errors.numPlayers}
                        />
                        {errors.numPlayers && <HelperText type="error" visible={!!errors.numPlayers}>{errors.numPlayers.message}</HelperText>}
                    </>
                )}
                name="numPlayers"
            />
            <Controller
                control={control}
                render={({ field: { onChange, onBlur, value } }) => (
                    <>
                        <TextInput
                            label="Hero's Position"
                            placeholder={positionOptions.map(v => v.value).join(', ')}
                            onBlur={onBlur}
                            onChangeText={onChange}
                            value={value}
                            mode="outlined"
                            style={styles.input}
                            activeOutlineColor='#000000'
                            error={!!errors.smallBlind}
                        />
                        {errors.position && <HelperText type="error" visible={!!errors.position}>{errors.position.message}</HelperText>}
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
                            label="Relevant Stack Sizes (e.g., CO 725, BU 1000)"
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