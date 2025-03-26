import React, { useReducer } from 'react';
import { View, Button, StyleSheet, ScrollView } from 'react-native';
import { Divider, TextInput } from 'react-native-paper';
import ActionList from '../components/ActionList';
import GameInfo from '../components/GameInfo';
import { useLocalSearchParams } from 'expo-router';
import { ActionType, ActionTextToken, Decision, DispatchActionType, InitialState, PlayerAction, Position, Stage } from '@/types';
import { CardRow } from '@/components/CardsRow';
import SegmentedActionLists from '@/components/SegmentedActionLists';
import { numPlayersToActionSequenceList } from '@/constants';
import { PokerFormData } from '@/components/PokerHandForm';
import { moveFirstTwoToEnd, positionToRank } from '@/utils';

// update action sequence, does preflop need to be handled differently than postflop?
// can i just remove folds list and update actions to include generated actions?
// what about partial states like an initial raise to 20 and then having to call 60 more when 3!
// for above these are distinct actions and should be treated as such, action sequence will need
// to account for dupes
// autofold
// when calling preflop, add the raise amount
// record game state
// undo

const initialState: InitialState = {
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
    cards: ['', '', '', '', ''],
    playerActions: [],
    stage: Stage.Preflop,
    stageDisplayed: Stage.Preflop,
    hero: '',
    actionSequence: [],
    pot: 0,
};

function reducer(state: InitialState, action: { type: DispatchActionType; payload: any }): InitialState {
    const { currentAction, stage, gameQueue } = state;

    switch (action.type) {
        case DispatchActionType.kSetInput:
            return { ...state, input: action.payload.input };

        case DispatchActionType.kAddAction: {
            const mostRecentActionText = getLastAction(action.payload.input);
            const actionInfo = parseAction(mostRecentActionText);
            const playerAction = buildPlayerAction(mostRecentActionText, actionInfo, stage);
            const newPlayerActions = [...state.playerActions, playerAction];

            return {
                ...state,
                input: action.payload.input,
                playerActions: newPlayerActions,
            };
        }

        case DispatchActionType.kTransition: {
            const nextStage = currentAction.shouldTransitionAfterStep ? getNextStage(stage) : stage;
            const nextAction = gameQueue[0];
            let propertyToAdd: Partial<InitialState> = {};

            if (currentAction.actionType === ActionType.kCard) {
                const newCards = getCards(state.cards, action.payload.input.slice(0, -1));
                propertyToAdd = { cards: newCards };
            } else {
                const mostRecentActionText = getLastAction(action.payload.input);
                const actionInfo = parseAction(mostRecentActionText);
                const playerAction = buildPlayerAction(mostRecentActionText, actionInfo, stage);
                propertyToAdd = { playerActions: [...state.playerActions, playerAction] };
            }

            const newState: InitialState = {
                ...state,
                stage: nextStage,
                stageDisplayed: nextStage,
                ...propertyToAdd,
                input: '',
                gameQueue: gameQueue.slice(1),
                currentAction: nextAction,
            };
            if (stage === Stage.Preflop) {
                const updatedPlayerActions = getPlayerActionsWithAutoFolds(newState.actionSequence, newState.playerActions)
                const updatedActionSequence = getNewActionSequence(updatedPlayerActions);
                newState.actionSequence = updatedActionSequence;
                newState.playerActions = updatedPlayerActions;
            }
            console.log(newState)
            return newState;
        }

        case DispatchActionType.kSetVisibleStage:
            return { ...state, stageDisplayed: action.payload.newStage };

        case DispatchActionType.kSetGameInfo: {
            const { actionSequence, potSize, heroPosition } = action.payload;
            return {
                ...state,
                actionSequence: moveFirstTwoToEnd(actionSequence),
                pot: potSize,
                hero: heroPosition,
            };
        }

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
            type: DispatchActionType.kSetGameInfo,
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
        const type = isTransition
            ? DispatchActionType.kTransition
            : isAddAction
                ? DispatchActionType.kAddAction
                : DispatchActionType.kSetInput;
        dispatch({ type, payload: { input: text } });
    };

    return (
        <View style={styles.container}>
            <ScrollView style={styles.content}>
                <GameInfo info={gameInfo} />
                <SegmentedActionLists stageDisplayed={state.stageDisplayed} dispatch={dispatch} />
                <View style={{ alignItems: 'flex-end' }}><CardRow cards={state.cards} small={true} /></View>
                <ActionList stage={state.stageDisplayed} actionList={state.playerActions} />
                {state.stage === Stage.Showdown && (
                    <Button mode="contained" onPress={() => dispatch({ type: DispatchActionType.kReset, payload: {} })}>
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



function getNewActionSequence(playerActions: PlayerAction[]): Position[] {
    return playerActions
        .filter((action) => action.decision !== Decision.kFold)
        .sort((a, b) => positionToRank(a.position) - positionToRank(b.position))
        .map(action => action.position);
}

function createPlayerActionForAutoFoldedPlayer(position: Position): PlayerAction {
    return {
        amount: 0,
        decision: Decision.kFold,
        position,
        shouldHideFromUi: true,
        text: `${position} f`,
        stage: Stage.Preflop,
    };
}

function getPlayerActionsWithAutoFolds(actionSequence: Position[], playerActions: PlayerAction[]) {
    return actionSequence.map((player) => {
        const found = playerActions.find(action => action.position == player);
        return found ? found : createPlayerActionForAutoFoldedPlayer(player);
    })
}

function getCards(currentCards: string[], newCards: string) {
    const EMPTY_CARD = '';
    let cardsToAdd: string[] = newCards.length > 2 ? [newCards.slice(0, 2), newCards.slice(2, 4), newCards.slice(4)] : [newCards]
    for (let i = 0; i < currentCards.length; i++) {
        if (currentCards[i] === EMPTY_CARD) {
            currentCards[i] = cardsToAdd.shift() as string;
            if (cardsToAdd.length === 0) {
                return currentCards;
            }
        }
    }
    return currentCards
}

function buildPlayerAction(text: string, actionInfo: ActionTextToken, stage: Stage): PlayerAction {
    return { text, stage, shouldHideFromUi: false, ...actionInfo };
}

function getLastAction(newVal: string): string {
    const actions: string[] = newVal.split(',').filter(Boolean);
    const lastAction = actions.pop() as string;
    const text = lastAction?.endsWith('.') ? lastAction.slice(0, -1) : lastAction;
    return text.trim();
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

function parseAction(action: string): ActionTextToken {
    const tokens = action.split(' ');
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

    const amountAsNum = Number(amountStr);
    return { position, decision, amount: isNaN(amountAsNum) ? 0 : amountAsNum };
}

function findPlayerAndAddAction() {

}


function recordFolds(actionSequence: Position[], mostRecentAction: PlayerAction) {
    let folds = [];
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
    return { folds, sequence: [...updatedActionSequence.splice(1), updatedActionSequence[0]] }
}