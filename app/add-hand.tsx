import React, { useReducer, useRef } from 'react';
import { View, Button, StyleSheet, ScrollView } from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import ActionList from '../components/ActionList';
import GameInfo from '../components/GameInfo';
import { useLocalSearchParams } from 'expo-router';
import { ActionType, ActionTextToken, Decision, DispatchActionType, InitialState, PlayerAction, Position, Stage } from '@/types';
import { CardRow } from '@/components/CardsRow';
import SegmentedActionLists from '../components/SegmentedActionLists';
import { initialState, numPlayersToActionSequenceList } from '@/constants';
import { PokerFormData } from '@/components/PokerHandForm';
import { moveFirstTwoToEnd, positionToRank } from '@/utils';

function reducer(state: InitialState, action: { type: DispatchActionType; payload: any }): InitialState {
    const { currentAction, stage, gameQueue } = state;

    switch (action.type) {
        case DispatchActionType.kSetInput:
            return { ...state, input: action.payload.input };

        case DispatchActionType.kAddPreflopAction: {
            const mostRecentActionText = getLastAction(action.payload.input);
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
            const playerToAct = state.actionSequence[0];
            const actionInfo = parseAction(mostRecentActionText, playerToAct);
            const playerAction = buildPlayerAction(actionInfo, stage);
            const newPlayerActions = [...state.playerActions, playerAction];
            const currentActionSequence = state.actionSequence;
            const newActionSequence =
            [...currentActionSequence.slice(1),
             ...(playerAction.decision !== Decision.kFold ? [playerToAct] : [])];
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
            // Only process commas when we're dealing with an action sequence
        } else if (isAddAction && state.currentAction.actionType !== ActionType.kCard) {
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
                {/* alignItems: 'flex-end' */}
                <View style={{ display: 'flex',flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Text style={{alignSelf: 'center', paddingLeft: 4}}>Pot: ${state.pot}</Text>
                    <CardRow cards={state.cards} small={true} />
                    </View>
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
    return text.trim().toUpperCase();
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

function isValidPosition(positionToCheck: string): boolean {
    return Object.values(Position).includes(positionToCheck);
}

function isValidPlayerAction(actionToCheck: string): boolean {
    return Object.values(Decision).includes(actionToCheck);
}

// ['LJ', 'r', '20']
// [CO,  c]
// [b, 50]
// [x]

function parseActionString(actionString: string, currentPosition: Position): ActionTextToken {
    const tokens = actionString.split(' ');
  
    let position: Position;
    let decision: Decision|null = null;
    let amount = 0;
  
    let tokenIndex = 0;
  
    if (Object.values(Position).includes(tokens[tokenIndex] as Position)) {
      position = tokens[tokenIndex] as Position;
      tokenIndex++;
    } else {
      position = currentPosition;
    }
  
    if (tokens[tokenIndex] && Object.values(Decision).includes(tokens[tokenIndex] as Decision)) {
      decision = tokens[tokenIndex] as Decision;
      tokenIndex++;
    }
  
    if (tokens[tokenIndex] && !isNaN(parseInt(tokens[tokenIndex], 10))) {
      amount = parseInt(tokens[tokenIndex], 10);
      tokenIndex++;
    }
  
    return {
      position,
      decision,
      amount,
    };
  }

function parseAction(action: string, currentPosition: string): ActionTextToken {
    return parseActionString(action, currentPosition as Position);
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
