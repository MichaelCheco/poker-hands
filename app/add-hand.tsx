import React, { useReducer, useRef } from 'react';
import { View, Button, StyleSheet, ScrollView } from 'react-native';
import { Divider, TextInput } from 'react-native-paper';
import ActionList from '../components/ActionList';
import GameInfo from '../components/GameInfo';
import { useLocalSearchParams } from 'expo-router';
import { ActionType, ActionTextToken, Decision, DispatchActionType, InitialState, PlayerAction, Position, Stage } from '@/types';
import { CardRow } from '@/components/CardsRow';
import SegmentedActionLists from '../components/SegmentedActionLists';
import { initialState, numPlayersToActionSequenceList } from '@/constants';
import { PokerFormData } from '@/components/PokerHandForm';
import { moveFirstTwoToEnd, positionToRank } from '@/utils';


// TODO - handle backspace bug
// update action sequence, does preflop need to be handled differently than postflop?
// can i just remove folds list and update actions to include generated actions?
// what about partial states like an initial raise to 20 and then having to call 60 more when 3!
// for above these are distinct actions and should be treated as such, action sequence will need
// to account for dupes
// autofold
// when calling preflop, add the raise amount
// record game state
// undo

// remove blinds from player actions and update slicing logic
// allow fast inputs for check, fold, and call for postflop

function reducer(state: InitialState, action: { type: DispatchActionType; payload: any }): InitialState {
    const { currentAction, stage, gameQueue } = state;

    switch (action.type) {
        case DispatchActionType.kSetInput:
            return { ...state, input: action.payload.input };

        case DispatchActionType.kAddPreflopAction: {
            const mostRecentActionText = getLastAction(action.payload.input);
            console.log(`recent text: ${mostRecentActionText}`);
            const actionInfo = parseAction(mostRecentActionText, state.actionSequence[0] || '');
            const playerAction = buildPlayerAction(actionInfo, stage);
            const newPlayerActions = [...state.playerActions, playerAction];
            return {
                ...state,
                input: action.payload.input,
                playerActions: newPlayerActions,
            };
        }

        case DispatchActionType.kAddPostflopAction: {
            const mostRecentActionText = getLastAction(action.payload.input);
            console.log(`recent text: ${mostRecentActionText}`);
            const playerToAct = state.actionSequence[0];
            const actionInfo = parseAction(mostRecentActionText, playerToAct);
            const playerAction = buildPlayerAction(actionInfo, stage);
            const newPlayerActions = [...state.playerActions, playerAction];
            const currentActionSequence = state.actionSequence;
            console.log(playerAction, ' --- kAddPostflopAction')
            // ['LJ', 'CO', 'BTN'] --> [CO, BTN, LJ]
            // newState.actionSequence = getNewActionSequence(initialStage, newState.playerActions);
            // playerAction.decision !== Decision.kFold ? [playerToAct] : []
            const newActionSequence = [...currentActionSequence.slice(1), ...(playerAction.decision !== Decision.kFold ? [playerToAct] : [])];
            console.log(newActionSequence, ' - - - - - - ', newActionSequence)
            return {
                ...state,
                input: action.payload.input,
                playerActions: newPlayerActions,
                actionSequence: newActionSequence,
            };
        }
        case DispatchActionType.kTransition: {
            const initialStage = stage;
            const nextStage = currentAction.shouldTransitionAfterStep ? getNextStage(stage) : stage;
            const nextAction = gameQueue[0];
            let propertyToAdd: Partial<InitialState> = {};

            if (currentAction.actionType === ActionType.kCard) {
                const newCards = getCards(state.cards, action.payload.input.slice(0, -1));
                propertyToAdd = { cards: newCards, deck: filterNewCardsFromDeck(newCards, state.deck) };
            } else {
                const mostRecentActionText = getLastAction(action.payload.input);
                const actionInfo = parseAction(mostRecentActionText, state.actionSequence[0] || '');
                const playerAction = buildPlayerAction(actionInfo, stage);
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
                newState.playerActions = getPlayerActionsWithAutoFolds(newState.actionSequence, newState.playerActions);
            }
            if (initialStage != nextStage) {
                newState.actionSequence = getNewActionSequence(initialStage, newState.playerActions);
            }
            console.log(newState)
            return newState;
        }

        case DispatchActionType.kSetVisibleStage:
            return { ...state, stageDisplayed: action.payload.newStage };

        case DispatchActionType.kSetGameInfo: {
            const { actionSequence, heroPosition, hand, smallBlind, bigBlind } = action.payload;
            return {
                ...state,
                actionSequence: moveFirstTwoToEnd(actionSequence),
                pot: smallBlind + bigBlind,
                hero: heroPosition,
                deck: filterNewCardsFromDeck(hand, state.deck),
                mostRecentBet: bigBlind,
                playerActions: [],
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
    const ref = useRef({ smallBlind: gameInfo.smallBlind, bigBlind: gameInfo.bigBlind });
    React.useEffect(() => {
        dispatch({
            type: DispatchActionType.kSetGameInfo,
            payload: {
                actionSequence: numPlayersToActionSequenceList[gameInfo.numPlayers],
                heroPosition: gameInfo.position,
                hand: gameInfo.hand,
                smallBlind: gameInfo.smallBlind,
                bigBlind: gameInfo.bigBlind,
            },
        });
    }, []);
    const handleInputChange = (text: string) => {
        const isTransition = text.endsWith('.');
        const isAddAction = text.endsWith(',');
        let type: DispatchActionType;
        if (isTransition) {
            type = DispatchActionType.kTransition;
        } else if (isAddAction) {
            type = state.stage === Stage.Preflop ? DispatchActionType.kAddPreflopAction : DispatchActionType.kAddPostflopAction;
        } else {
            type = DispatchActionType.kSetInput;
        }
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

function getNewActionSequence(stage: Stage, playerActions: PlayerAction[]): Position[] {
    return playerActions
        .filter(action => action.stage === stage).filter((action) => action.decision !== Decision.kFold)
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

// 0 1 2 3 4 5
//['UTG', 'UTG+1', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB']
// //  (4) [{…}, {…}, {…}, {…}]
function getPlayerActionsWithAutoFolds(actionSequence: Position[], playerActions: PlayerAction[]) {
    return actionSequence.map((player) => {
        const found = playerActions.find(action => action.position == player);
        return found ? found : createPlayerActionForAutoFoldedPlayer(player);
    });
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

function decisionToText(decision: Decision): string {
    switch (decision) {
        case Decision.kBet:
            return 'bets'
        case Decision.kCall:
            return 'calls'
        case Decision.kCheck:
            return 'checks'
        case Decision.kFold:
            return 'folds'
        case Decision.kRaise:
            return 'raises'
    }
}

function getMeaningfulTextToDisplay(actionInfo: ActionTextToken): string {
  return `${actionInfo.position} ${decisionToText(actionInfo.decision)} ${actionInfo.amount === 0 ? '' : actionInfo.amount}`;
}

function buildPlayerAction(actionInfo: ActionTextToken, stage: Stage): PlayerAction {
    return { text: getMeaningfulTextToDisplay(actionInfo), stage, shouldHideFromUi: false, ...actionInfo };
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

function createActionTextToken(positionKey: string, decisionKey: string, num: number): ActionTextToken {
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

    return { position, decision, amount: isNaN(num) ? 0 : num };
}

function isValidPosition(positionToCheck: string): boolean {
    return Object.values(Position).includes(positionToCheck);
}

function parseAction(action: string, currentPosition: string): ActionTextToken {
    if (action.length === 1) {
        return createActionTextToken(currentPosition, action, 0);    
    }
    const tokens = action.split(' ');
    const positionKey = tokens[0];
    const decisionKey = tokens[1];
    const amountStr = tokens[2];
    return createActionTextToken(positionKey, decisionKey, Number(amountStr));
}

function filterNewCardsFromDeck(newCards: string | string[], currDeck: string[]): string[] {
    const cards = typeof newCards === "string" ? extractCards(newCards) : newCards;
    return currDeck.filter(card => !cards.includes(card))
}

function extractCards(str: string): string[] {
    const result = [];
    for (let i = 0; i < str.length; i += 2) {
        result.push(str.substring(i, i + 2));
    }
    return result;
}

//   {
//     amount: smallBlind,
//     decision: Decision.kBet,
//     position: Position.SB,
//     shouldHideFromUi: true,
//     text: `SB posts $${smallBlind}`,
//     stage: Stage.Preflop,
// },
// {
//     amount: bigBlind,
//     decision: Decision.kRaise,
//     position: Position.BB,
//     shouldHideFromUi: true,
//     text: `BB posts $${bigBlind}`,
//     stage: Stage.Preflop,
// }