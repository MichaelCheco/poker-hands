import * as React from 'react';
import { View, Button, StyleSheet, ScrollView } from 'react-native';
import { Divider, TextInput } from 'react-native-paper';
import ActionList from '../components/ActionList';
import GameInfo from '../components/GameInfo';
import { useLocalSearchParams } from 'expo-router';
import { Stage } from '@/types';

function getStagePlaceholder(stage: Stage): string {
    switch (stage) {
        case Stage.Preflop:
            return 'Preflop Action';
        case Stage.Flop:
            return 'Flop Action';
        case Stage.Turn:
            return 'Turn Action';
        case Stage.River:
            return 'River Action';
        default:
            return 'Showdown';
    }
}

interface Step {
    placeholder: string;
    shouldTransitionAfterStep: boolean;
    validate: () => { success: boolean; message?: string };
    dataKey: string;
}

const stageSteps: Record<Stage, Step[]> = {
    [Stage.Preflop]: [
        {
            placeholder: 'co r 15, btn c, sb c',
            shouldTransitionAfterStep: true,
            validate: () => ({ success: true }),
            dataKey: 'preflopAction',
        },
    ],
    [Stage.Flop]: [
        {
            placeholder: 'Flop Cards (e.g., AsTc7h)',
            shouldTransitionAfterStep: true,
            validate: () => ({ success: true }),
            dataKey: 'flopCards',
        },
    ],
    [Stage.Turn]: [
        {
            placeholder: 'Turn Card (e.g., Qd)',
            shouldTransitionAfterStep: true,
            validate: () => ({ success: true }),
            dataKey: 'turnCard',
        }
    ],
    [Stage.River]: [
        {
            placeholder: 'River Card (e.g., Ks)',
            shouldTransitionAfterStep: true,
            validate: () => ({ success: true }),
            dataKey: 'riverCard',
        }
    ],
    [Stage.Showdown]: [
        {
            placeholder: 'Showdown Actions',
            shouldTransitionAfterStep: true,
            validate: () => ({ success: true }),
            dataKey: 'showdownActions'
        }
    ]
};

const initialState = {
    handHistory: [],
    currentAction: '',
    stage: Stage.Preflop,
    input: '',
    inputError: '',
    blinds: '',
    location: '',
    position: '',
    flopCards: '',
    preflopAction: [],
    hand: '',
};

const getLastAction = (s) => {
    let val = s.split(',').filter(e => Boolean(e)).pop()
    if (val.endsWith('.')) {
        return val.slice(0, -1);
    }
    return val;
};

const reducer = (state, action) => {
    const input = action.payload;
    switch (action.type) {
        case 'SET_INPUT':
            return { ...state, input };
        case 'ADD_ACTION':
            return { ...state, input, preflopAction: [...state.preflopAction, getLastAction(input)] };
        case 'TRANSITION':
            const stage = getNextStage(state.stage) as Stage;
            return { ...state, stage, preflopAction: [...state.preflopAction, getLastAction(input)], input: '' };
        default:
            return state;
    }
};

export default function App() {
    const { data } = useLocalSearchParams();

    const parsedGameInfo = JSON.parse(data);
    const [state, dispatch] = React.useReducer(reducer, initialState);

    const handleInputChange = (text) => {
        const shouldTransition = text.endsWith('.');
        const shouldAddAction = text.endsWith(',');

        if (shouldTransition) {
            dispatch({ type: 'TRANSITION', payload: text })
        } else if (shouldAddAction) {
            dispatch({ type: 'ADD_ACTION', payload: text })
        } else {
            dispatch({ type: 'SET_INPUT', payload: text });
        }
    };

    return (
        <View style={styles.container}>
            <ScrollView style={styles.content}>
                <GameInfo info={parsedGameInfo} />
                <Divider />
                <ActionList stage={state.stage} preflopAction={state.preflopAction} />
                {state.stage === Stage.Showdown && (
                    <Button mode="contained" onPress={() => dispatch({ type: 'RESET' })}>
                        Reset
                    </Button>
                )}
            </ScrollView>

            <View style={styles.inputContainer}>
                <TextInput
                    mode="outlined"
                    label={"idk"}
                    onChangeText={handleInputChange}
                    value={state.input}
                    style={styles.input}
                    autoFocus
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        flex: 1,
    },
    inputContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 16,
        backgroundColor: 'white',
    },
    input: {
        alignSelf: 'center',
        width: '90%',
    },
    errorText: {
        color: 'red',
        marginBottom: 8,
    },
});

const validateNextStage = () => {
    if (state.currentAction.trim() === '') {
        dispatch({ type: 'SET_INPUT_ERROR', payload: 'Action cannot be empty before changing stages.' });
        return false;
    }

    // Add more validation checks as needed
    // Example: check for raise amounts
    const regex = /raise to \d+/i
    if (state.stage === Stage.Preflop && !regex.test(state.currentAction)) {
        dispatch({ type: 'SET_INPUT_ERROR', payload: 'Preflop actions must contain a raise amount' });
        return false;
    }

    return true; // Validation passed
};

function getNextStage(stage: Stage) {
    switch (stage) {
        case Stage.Preflop:
            return Stage.Flop;
        case Stage.Flop:
            return Stage.Turn;
        case Stage.Turn:
            return Stage.River;
        case Stage.River:
            return Stage.Showdown;
    }
}