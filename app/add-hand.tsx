import React, { useReducer } from 'react';
import { View, Button, StyleSheet, ScrollView } from 'react-native';
import { Divider, TextInput } from 'react-native-paper';
import ActionList from '../components/ActionList';
import GameInfo from '../components/GameInfo';
import { useLocalSearchParams } from 'expo-router';
import { ActionType, Position, Stage } from '@/types';
import { CardRow } from '@/components/CardsRow';
import SegmentedActionLists from '@/components/SegmentedActionLists';
import { numPlayersToActionSequenceList } from '@/constants';
import { PokerFormData } from '@/components/PokerHandForm';
import { moveFirstTwoToEnd } from '@/utils';

const initialState = {
    gameQueue: [
        {
            placeholder: 'Flop cards',
            shouldTransitionAfterStep: false,
            actionType: ActionType.kCard,
        },
        {
            placeholder: 'Flop action',
            shouldTransitionAfterStep: true,
            actionType: ActionType.kActionSequence,
        },
        {
            placeholder: 'Turn card',
            shouldTransitionAfterStep: false,
            actionType: ActionType.kCard,
        },
        {
            placeholder: 'Turn action',
            shouldTransitionAfterStep: true,
            actionType: ActionType.kActionSequence,
        },
        {
            placeholder: 'River card',
            shouldTransitionAfterStep: false,
            actionType: ActionType.kCard,
        },
        {
            placeholder: 'River action',
            shouldTransitionAfterStep: true,
            actionType: ActionType.kActionSequence,
        },
    ],
    currentAction: {
        placeholder: 'Preflop action',
        shouldTransitionAfterStep: true,
        actionType: ActionType.kActionSequence,
    },
    handHistory: [],
    input: '',
    position: '',
    cards: ['', '', '', '', ''],
    // preflopAction: [],
    // flopAction: [],
    // turnAction: [],
    // riverAction: [],
    playerActions: [],
    stage: Stage.Preflop,
    stageDisplayed: Stage.Preflop,
    hero: '',
    actionSequence: [],
    pot: 0,
    foldedOutPlayers: [],
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

function buildPlayerAction(text: string, actionInfo: ActionTextToken, stage: Stage): PlayerAction {
    return {text, stage, ...actionInfo};
}

function getLastAction(newVal: string): string {
    const actions: string[] = newVal.split(',').filter(Boolean);
    const lastAction = actions.pop() as string;
    return lastAction?.endsWith('.') ? lastAction.slice(0, -1): lastAction;
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

enum Decision {
  kCheck = 'x',
  kBet = 'b',
  kRaise = 'r',
  kCall = 'c',
  kFold = 'f',
}
// num tokens, 3 tokens = bet/raise  || 2 tokens = call, check, fold, all in
interface PlayerAction {
  text: string;
  position: Position;
  decision: Decision;
  amount: number | null;
  stage:  Stage;
}

interface ActionTextToken {
    position: Position;
    decision: Decision;
    amount: number | null;
}

function parseAction(action: string): ActionTextToken {
    const tokens = action.split(' ').map(s => s.trim());
    const positionKey = tokens[0];
    const decisionKey = tokens[1];
    const amountStr = tokens[2];
    let decision: Decision | undefined;
    for (const key in Decision) {
        if (Decision[key] === decisionKey) {
            decision = Decision[key];
            break;
        }
    }

    let position: Position | undefined;

    for (const key in Position) {
        if (Position[key] === positionKey) {
            position = Position[key];
            break;
        }
    }
    const amount = amountStr ? Number(amountStr) : null;
    return { position, decision, amount };
}

function findPlayerAndAddAction() {

}


function recordFolds(actionSequence: Position[], mostRecentAction: PlayerAction) {
    let folds = [];
    // let found = false;
    for (let player of actionSequence) {
        if (player == mostRecentAction.position) {
            if (mostRecentAction.decision == Decision.kFold) {
                folds.push(player);
                return folds;
            }
            return folds;
        }
        folds.push(player);
    }
  
}

function getAutoFolds(actionSequence: Position[], mostRecentAction: PlayerAction): Position[] {
    let folds = [];
    for (let player of actionSequence) {
        if (player == mostRecentAction.position) {
            return folds;
        }
        folds.push(player);
    }
    return folds;
}

function removeFoldsFromActionSequence(array1: string[], array2: string[]): string[] {
    return array2.filter(element => !array1.includes(element));
  }

function updateActionSequenceAndFolds(actionSequence: Position[], mostRecentAction: PlayerAction) {
  let folds = getAutoFolds(actionSequence, mostRecentAction);
  let updatedActionSequence = removeFoldsFromActionSequence(folds, actionSequence)
  console.log(folds, ' - [ ', updatedActionSequence)
  return {folds, sequence: [...updatedActionSequence.splice(1), updatedActionSequence[0]]}
}

        // "UTG", "UTG+1", "LJ", "HJ", "CO", "BTN", "SB", "BB"
        // LJ r 20, --> {position: LJ, action: r, size: number}
        // ['UTG', 'UTG+1']
        // ['HJ', 'CO', 'BTN', 'SB', 'BB', 'LJ']
function reducer(state, action) {
    const { currentAction, stage, queue } = state;

    switch (action.type) {
        case 'SET_INPUT':
            return { ...state, input: action.payload.input };
        case 'ADD_ACTION':

        // [...currVal, lastAction.slice(0, -1)]
    // return lastAction?.endsWith('.') ? [...currVal, lastAction.slice(0, -1)] : [...currVal, lastAction];
    //
        // currentAction.actionType
        const mostRecentActionText = getLastAction(action.payload.input);

        const actionInfo = parseAction(mostRecentActionText);
        const playerAction = buildPlayerAction(mostRecentActionText, actionInfo, state.stage);
        console.log(playerAction, ' player action')
        const actionArr = state.playerActions;
        // const mostRecentAction = parseAction(actionArr[actionArr.length - 1]);
        // const {folds, sequence} = updateActionSequenceAndFolds(state.actionSequence, mostRecentAction);
        // console.log(updateActionSequenceAndFolds(state.actionSequence, mostRecentAction))
        const newState = { 
            ...state,
            input: action.payload.input,
            playerActions: [...actionArr, playerAction]
            // foldedOutPlayers: folds,
            // actionSequence: sequence,
            // pot: state.pot + mostRecentAction.amount
        }
        return newState;
        case 'TRANSITION':
            const nextStage = currentAction.shouldTransitionAfterStep ? getNextStage(stage) : stage;
            const nextAction = queue[0];
            return {
                ...state,
                // stage: nextStage,
                // stageDisplayed: nextStage,
                // [currentAction.dataKey]: currentAction.actionType === ActionType.kCard
                //     ? getCards(state[currentAction.dataKey], action.payload.input.slice(0, -1))
                //     : getLastAction(state[currentAction.dataKey], action.payload.input),
                // input: '',
                // queue: queue.slice(1),
                // currentAction: nextAction,
            };
        case 'SET_VISIBLE_STAGE':
            return { ...state, stageDisplayed: action.payload.newStage }
        case 'SET_GAME_INFO':
            const { actionSequence, potSize, heroPosition } = action.payload;
            return { ...state, actionSequence: moveFirstTwoToEnd(actionSequence), pot: potSize, hero: heroPosition };
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
                <ActionList stage={state.stageDisplayed} actionList={state.playerActions} />
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