import React, { useReducer, useRef } from 'react';
import { View, Button, StyleSheet, ScrollView } from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import ActionList from '../components/ActionList';
import GameInfo from '../components/GameInfo';
import { useLocalSearchParams } from 'expo-router';
import { ActionType, ActionTextToken, Decision, DispatchActionType, InitialState, PlayerAction, Position, Stage } from '@/types';
import { CommunityCards } from '@/components/Cards';
import SegmentedActionLists from '../components/SegmentedActionLists';
import { initialState, numPlayersToActionSequenceList } from '@/constants';
import { PokerFormData } from '@/components/PokerHandForm';
import { moveFirstTwoToEnd, positionToRank } from '@/utils';

function reducer(state: InitialState, action: { type: DispatchActionType; payload: any }): InitialState {
    const { currentAction, stage, gameQueue, actionSequence, playerActions } = state;

    switch (action.type) {
        case DispatchActionType.kSetInput:
            return { ...state, input: action.payload.input };


        case DispatchActionType.kAddAction: {
            const mostRecentActionText = getLastAction(action.payload.input);
            // Player to act is always the first in the current sequence
            const playerToAct = actionSequence[0];
            if (!playerToAct) {
                console.warn("AddAction dispatched but no player is set to act.");
                return state; // Or handle error appropriately
            }

            const actionInfo = parseAction(mostRecentActionText, playerToAct);
            const playerAction = buildPlayerAction(actionInfo, stage);
            const newPlayerActions = [...playerActions, playerAction];

            let newActionSequence = [...actionSequence]; // Start with current sequence

            // Post-flop: Update action sequence immediately based on the action
            if (stage !== Stage.Preflop) {
                const remainingPlayers = actionSequence.slice(1);
                const actingPlayer = actionSequence[0];
                // If the player didn't fold, add them to the end of the *remaining* sequence
                newActionSequence = [
                    ...remainingPlayers,
                    ...(playerAction.decision !== Decision.kFold ? [actingPlayer] : [])
                ];
            }
            // Pre-flop: Action sequence is handled differently, often based on who is left
            // *after* the betting round, so we don't modify it here per-action.
            // It gets recalculated during the transition from Preflop.

            return {
                ...state,
                input: action.payload.input, // Keep the input for multi-action entry
                playerActions: newPlayerActions,
                actionSequence: newActionSequence, // Update sequence if post-flop
                // Note: Pot updates, mostRecentBet updates etc., likely happen here too.
                // Need to add logic based on playerAction (bet, raise, call amounts)
                // pot: calculateNewPot(state.pot, playerAction),
                // mostRecentBet: calculateNewMostRecentBet(state.mostRecentBet, playerAction)
            };
        }

        case DispatchActionType.kTransition: {
            const initialStage = stage;
            const nextStage = currentAction.shouldTransitionAfterStep ? getNextStage(stage) : stage;
            const nextAction = gameQueue[0]; // Next step in the overall game flow

            let propertyUpdates: Partial<InitialState> = {};
            let finalPlayerActions = [...playerActions]; // Start with current actions
            let finalActionSequence = [...actionSequence]; // Start with current sequence

            // --- Process Final Input Before Transition ---
            if (currentAction.actionType === ActionType.kCard) {
                // Handle card input
                const inputCards = action.payload.input.slice(0, -1).trim().toUpperCase(); // Remove trailing '.'
                const newCards = getCards(state.cards, inputCards);
                propertyUpdates = {
                     cards: newCards,
                     deck: filterNewCardsFromDeck(newCards, state.deck)
                };
            } else if (action.payload.input.trim().length > 1) { // Check if there's action input (not just '.')
                // Handle the last player action input before transitioning
                const mostRecentActionText = getLastAction(action.payload.input);
                const playerToAct = actionSequence[0];

                if (playerToAct) {
                    const actionInfo = parseAction(mostRecentActionText, playerToAct);
                    const playerAction = buildPlayerAction(actionInfo, stage);
                    finalPlayerActions = [...finalPlayerActions, playerAction]; // Add the final action

                    // Update action sequence if post-flop (mirroring kAddAction logic)
                    if (stage !== Stage.Preflop) {
                        const remainingPlayers = actionSequence.slice(1);
                        finalActionSequence = [
                            ...remainingPlayers,
                            ...(playerAction.decision !== Decision.kFold ? [playerToAct] : [])
                        ];
                    }
                    // Add pot/bet updates based on playerAction here too
                    // propertyUpdates.pot = calculateNewPot(state.pot, playerAction);
                    // propertyUpdates.mostRecentBet = calculateNewMostRecentBet(state.mostRecentBet, playerAction);

                } else {
                     console.warn("Transition occurred with action input, but no player was set to act.");
                }
            }
            // --- End Processing Final Input ---


            // --- Prepare for Next Stage/Step ---
            const newStateBase: InitialState = {
                ...state,
                ...propertyUpdates, // Apply updates from card/action input
                playerActions: finalPlayerActions, // Use potentially updated actions
                actionSequence: finalActionSequence, // Use potentially updated sequence
                stage: nextStage,
                stageDisplayed: nextStage,
                input: '', // Clear input after transition
                gameQueue: gameQueue.slice(1),
                currentAction: nextAction, // Set the next expected action/input type
            };

            // --- Post-Transition Adjustments ---
            let finalState = newStateBase;

            // If transitioning *away from* Preflop, apply auto-folds based on the *original* preflop sequence
            if (initialStage === Stage.Preflop && nextStage !== initialStage) {
                 // We need the original preflop sequence to determine who folded automatically
                 // Let's adjust getPlayerActionsWithAutoFolds slightly
                 const originalPreflopSequence = state.actionSequence; // Sequence before any actions in *this* transition
                 finalState = {
                     ...finalState,
                     playerActions: getPlayerActionsWithAutoFolds(originalPreflopSequence, finalState.playerActions)
                 };
            }

            // If the stage actually changed, recalculate the action sequence for the *new* stage
            if (initialStage !== nextStage && nextStage !== Stage.Showdown) {
                // The sequence for the next street starts with players who didn't fold on the *previous* street,
                // ordered by position (usually SB first post-flop).
                finalState = {
                    ...finalState,
                    actionSequence: getNewActionSequence(initialStage, finalState.playerActions) // Sequence based on who is left from initialStage
                    // Reset mostRecentBet for the new street? Usually yes.
                    // mostRecentBet: 0,
                };
            }

            console.log("New state after transition:", finalState);
            return finalState;
        }


        case DispatchActionType.kSetVisibleStage:
             // No change needed here
            return { ...state, stageDisplayed: action.payload.newStage };

        case DispatchActionType.kSetGameInfo: {
            // No change needed here, but ensure moveFirstTwoToEnd is correct for your game logic
            const { actionSequence, heroPosition, hand, smallBlind, bigBlind } = action.payload;
            return {
                ...state, // Preserve deck, cards, etc. from initialState
                actionSequence: moveFirstTwoToEnd(actionSequence), // This sets the initial preflop order
                pot: smallBlind + bigBlind,
                hero: heroPosition,
                deck: filterNewCardsFromDeck(hand, state.deck),
                mostRecentBet: bigBlind, // BB is the initial bet to match
                playerActions: [], // Start fresh
                stage: Stage.Preflop, // Ensure stage is set correctly
                stageDisplayed: Stage.Preflop,
                // Reset other relevant fields?
                cards: initialState.cards,
                input: '',
                // gameQueue should be initialized based on numPlayers/rules
                // currentAction should be the first action in the queue
            };
        }

        // Add kReset case if needed
        case DispatchActionType.kReset:
            // You might want to preserve gameInfo like blinds/position
            // Re-initialize based on initial setup or a complete reset
             return { ...initialState /*, potentially keep blinds/position/hero */ };


        default:
            // Use exhaustive check helper if desired, or just return state
            // const _exhaustiveCheck: never = action.type;
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
        } else if (isAddAction && state.currentAction.actionType !== ActionType.kCard) {
            // Use the new combined action type
            type = DispatchActionType.kAddAction;
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
                <View style={styles.infoRow}>
                    <Text style={styles.potText}>Pot: ${state.pot}</Text>
                    <CommunityCards cards={state.cards} />
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
    infoRow: {
        flexDirection: 'row', // Arrange items side-by-side
        justifyContent: 'space-between', // Pushes Pot left, Cards right
        alignItems: 'center', // Vertically align items in the middle of the row
        paddingHorizontal: 16, // Add horizontal padding to the container
        paddingVertical: 8, // Add some vertical padding
        marginBottom: 8, // Add space below this row, before the ActionList
        // Optional: Add a background color for debugging layout
        // backgroundColor: '#eee',
    },
    potText: {
        fontSize: 16, // Slightly larger font size
        fontWeight: '500', // Medium weight for emphasis
        color: '#333', // Darker text color
        // alignSelf: 'center' is no longer needed due to alignItems: 'center' on parent
        // paddingLeft: 4 is replaced by paddingHorizontal on the parent View
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

// This version assumes playerActions already contains actions from the completed preflop round
// function getPlayerActionsWithAutoFolds(originalPreflopSequence: Position[], completedPlayerActions: PlayerAction[]): PlayerAction[] {
//     const finalActions = [...completedPlayerActions]; // Copy existing actions
//     const actedPositions = new Set(completedPlayerActions.filter(a => a.stage === Stage.Preflop).map(a => a.position));

//     for (const position of originalPreflopSequence) {
//         if (!actedPositions.has(position)) {
//             // If a player in the original sequence didn't act preflop, add an auto-fold
//             finalActions.push(createPlayerActionForAutoFoldedPlayer(position));
//         }
//     }
//     return finalActions;
// }

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
