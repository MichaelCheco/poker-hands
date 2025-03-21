import React, { useReducer } from 'react';
import { View, Button, StyleSheet, ScrollView } from 'react-native';
import { Divider, TextInput } from 'react-native-paper';
import ActionList from '../components/ActionList';
import GameInfo from '../components/GameInfo';
import { useLocalSearchParams } from 'expo-router';
import { ActionType, Stage } from '@/types';
import { CardRow } from '@/components/CardsRow';
import SegmentedActionLists from '@/components/SegmentedActionLists';
import { numPlayersToActionSequenceList } from '@/constants';
import { PokerFormData } from '@/components/PokerHandForm';

const initialState = {
    handHistory: [],
    input: '',
    position: '',
    cards: ['', '', '', '', ''],
    preflopAction: [],
    flopAction: [],
    turnAction: [],
    riverAction: [],
    stage: Stage.Preflop,
    stageDisplayed: Stage.Preflop,
    hero: '',
    gameQueue: [
        {
            placeholder: 'Flop cards',
            shouldTransitionAfterStep: false,
            dataKey: 'cards',
            actionType: ActionType.kCard,
        },
        {
            placeholder: 'Flop action',
            shouldTransitionAfterStep: true,
            dataKey: 'flopAction',
            actionType: ActionType.kActionSequence,
        },
        {
            placeholder: 'Turn card',
            shouldTransitionAfterStep: false,
            dataKey: 'cards',
            actionType: ActionType.kCard,
        },
        {
            placeholder: 'Turn action',
            shouldTransitionAfterStep: true,
            dataKey: 'turnAction',
            actionType: ActionType.kActionSequence,
        },
        {
            placeholder: 'River card',
            shouldTransitionAfterStep: false,
            dataKey: 'cards',
            actionType: ActionType.kCard,
        },
        {
            placeholder: 'River action',
            shouldTransitionAfterStep: true,
            dataKey: 'riverAction',
            actionType: ActionType.kActionSequence,
        },
    ],
    currentAction: {
        placeholder: 'Preflop action',
        shouldTransitionAfterStep: true,
        dataKey: 'preflopAction',
        actionType: ActionType.kActionSequence,
    },
};

function getActionList(state) {
    switch (state.stageDisplayed) {
        case Stage.Preflop:
            return state.preflopAction;
        case Stage.Flop:
            return state.flopAction;
        case Stage.Turn:
            return state.turnAction;
        case Stage.River:
            return state.riverAction;
        default:
            // TODO
            return state.preflopAction
    }
}

function getCards(cards, newCards) {
    let cardsToAdd = newCards.length > 2 ? [newCards.slice(0, 2), newCards.slice(2, 4), newCards.slice(4)] : [newCards]
    for (let i = 0; i < cards.length; i++) {
        if (!cards[i]) {
            cards[i] = cardsToAdd.shift();
            if (cardsToAdd.length === 0) {
                return cards;
            }
        }
    }
    return cards
}

function getLastAction(currVal, newVal) {
    const actions = newVal.split(',').filter(Boolean);
    const lastAction = actions.pop();
    return lastAction?.endsWith('.') ? [...currVal, lastAction.slice(0, -1)] : [...currVal, lastAction];
}

function getNextStage(stage: Stage) {
    const nextStages = {
        [Stage.Preflop]: Stage.Flop,
        [Stage.Flop]: Stage.Turn,
        [Stage.Turn]: Stage.River,
        [Stage.River]: Stage.Showdown,
    };
    return nextStages[stage];
}

function reducer(state, action) {
    const { currentAction, stage, queue } = state;

    switch (action.type) {
        case 'SET_INPUT':
            return { ...state, input: action.payload.input };
        case 'ADD_ACTION':
            return { ...state, input: action.payload.input, [currentAction.dataKey]: getLastAction(state[currentAction.dataKey], action.payload.input) };
        case 'TRANSITION':
            const nextStage = currentAction.shouldTransitionAfterStep ? getNextStage(stage) : stage;
            const nextAction = queue[0];
            return {
                ...state,
                stage: nextStage,
                stageDisplayed: nextStage,
                [currentAction.dataKey]: currentAction.actionType === ActionType.kCard
                    ? getCards(state[currentAction.dataKey], action.payload.input.slice(0, -1))
                    : getLastAction(state[currentAction.dataKey], action.payload.input),
                input: '',
                queue: queue.slice(1),
                currentAction: nextAction,
            };
        case 'SET_VISIBLE_STAGE':
            return { ...state, stageDisplayed: action.payload.newStage }
        case 'SET_GAME_INFO':
            const { actionSequence, potSize, heroPosition } = action.payload;
            return { ...state, actionSequence, potSize, heroPosition };
        default:
            return state;
    }
}

export default function App() {
    const { data }: { data: string } = useLocalSearchParams();
    const gameInfo: PokerFormData = JSON.parse(data);
    const [state, dispatch] = useReducer(reducer, initialState);
    React.useEffect(() => {
        dispatch({
            type: 'SET_GAME_INFO',
            payload: {
                actionSequence: numPlayersToActionSequenceList[gameInfo.numPlayers],
                potSize: gameInfo.smallBlind + gameInfo.bigBlind,
                heroPosition: gameInfo.position,
            },
        });
    }, []);
    const handleInputChange = (text: string) => {
        const isTransition = text.endsWith('.');
        const isAddAction = text.endsWith(',');

        if (isTransition) {
            dispatch({ type: 'TRANSITION', payload: { input: text } });
        } else if (isAddAction) {
            dispatch({ type: 'ADD_ACTION', payload: { input: text } });
        } else {
            dispatch({ type: 'SET_INPUT', payload: { input: text } });
        }
    };

    return (
        <View style={styles.container}>
            <ScrollView style={styles.content}>
                <GameInfo info={gameInfo} />
                <SegmentedActionLists stageDisplayed={state.stageDisplayed} dispatch={dispatch} />
                <View style={{ alignItems: 'flex-end' }}><CardRow cards={state.cards} small={true} /></View>
                <ActionList stage={state.stageDisplayed} preflopAction={getActionList(state)} />
                {state.stage === Stage.Showdown && (
                    <Button mode="contained" onPress={() => dispatch({ type: 'RESET' })}>
                        Reset
                    </Button>
                )}
            </ScrollView>

            <View style={styles.inputContainer}>
                <TextInput
                    mode="outlined"
                    label={state.currentAction.placeholder}
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
});