import * as React from 'react';
import { View, Button, StyleSheet, ScrollView } from 'react-native';
import { Divider, TextInput } from 'react-native-paper';
import ActionList from '../components/ActionList';
import GameInfo from '../components/GameInfo';
import { useLocalSearchParams } from 'expo-router';
import { Stage } from '@/types';
import { CardRow } from '@/components/CardsRow';

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

enum ActionType {
    kCard,
    kActionSequence,
}

const initialState = {
    handHistory: [],
    stage: Stage.Preflop,
    input: '',
    inputError: '',
    position: '',
    cards: [],
    preflopAction: [],
    flopAction: [],
    queue: [
        {
            placeholder: 'Flop cards',
            shouldTransitionAfterStep: false,
            validate: () => ({ success: true }),
            dataKey: 'cards',
            actionType: ActionType.kCard
        },
        {
            placeholder: 'Flop action',
            shouldTransitionAfterStep: true,
            validate: () => ({ success: true }),
            dataKey: 'flopAction',
            actionType: ActionType.kActionSequence
        },
        
    ],
        currentAction:  {
        placeholder: 'Preflop action',
        shouldTransitionAfterStep: true,
        validate: () => ({ success: true }),
        dataKey: 'preflopAction',
        actionType: ActionType.kActionSequence
    },
};

function getCards(currVal, newVal) {
    let text = newVal.slice(0, -1)
    if (currVal.length === 0) {
        return [text.slice(0,2), text.slice(2, 4), text.slice(4)];
    }
    return [...currVal, text];
}
const getLastAction = (currVal, newVal) => {
    let val = newVal.split(',').filter(e => Boolean(e)).pop()
    if (val.endsWith('.')) {
        return [...currVal, val.slice(0, -1)]
    }
    return [...currVal, val]
};

const reducer = (state, action) => {
    const input = action.payload;
    const {currentAction, stage, queue} = state;
    switch (action.type) {
        case 'SET_INPUT':
            return { ...state, input };
        case 'ADD_ACTION':
            return { ...state, input, [state.currentAction.dataKey]: getLastAction(state[currentAction.dataKey], input) };
        case 'TRANSITION':
            const nextStage = currentAction.shouldTransitionAfterStep ? getNextStage(stage) : stage;
            const nextAction = queue[0];
            const nextState =  { 
                ...state, 
                stage: nextStage, 
                [currentAction.dataKey]: currentAction.actionType === ActionType.kCard 
                ? getCards(state[currentAction.dataKey], input) 
                : getLastAction(state[currentAction.dataKey], input),
                input: '', queue: queue.slice(1), currentAction: nextAction};
            console.log(nextState)
                return nextState
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
                <Divider />
                <CardRow cards={state.cards}/>
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