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

function calculateNewPot(pot: number, playerAction: PlayerAction): number {
    if (playerAction.amount === 0) {
        return pot;
    }

    if (playerAction.decision === Decision.kCheck || playerAction.decision === Decision.kFold) {
        console.warn("Amount should only be included if player bets or raises.");
    }

    return pot + (playerAction.amount || 0);
}

function calculateNewMostRecentBet(mostRecentBet: number, playerAction: PlayerAction): number {
    return (playerAction.decision === Decision.kBet || playerAction.decision === Decision.kRaise) ? playerAction.amount : mostRecentBet;

}

function getUpdatedBettingInfo(
    betsThisStreet: { [key in Position]?: number },
    currentBetFacing: number, playerAction: PlayerAction) {
    const actingPlayer = playerAction.position;
    const alreadyBet = betsThisStreet[actingPlayer] || 0; // How much player already bet this street

    let amountToAdd = 0; // How much is ACTUALLY added to the pot by THIS action
    let newPlayerBetTotal = alreadyBet; // Player's new total bet this street
    let newCurrentBetFacing = currentBetFacing; // The bet level facing others

    switch (playerAction.decision) {
        case Decision.kBet:
            // Assumes first bet on the street, 'alreadyBet' should be 0
            amountToAdd = playerAction.amount;
            newPlayerBetTotal = playerAction.amount;
            newCurrentBetFacing = playerAction.amount;
            break;

        case Decision.kRaise:
            // Amount to add is the raise amount MINUS what was already bet
            // Example: Raise to 60, already bet 20. Add 40.
            amountToAdd = playerAction.amount - alreadyBet;
            newPlayerBetTotal = playerAction.amount; // Their total commitment is now the raise amount
            newCurrentBetFacing = playerAction.amount; // This sets the new bet level
            break;

        case Decision.kCall:
            // Amount to add is the current bet level MINUS what was already bet
            // Example: Facing 60, already bet 20. Add 40.
            amountToAdd = currentBetFacing - alreadyBet;
            // Ensure amountToAdd isn't negative if something went wrong
            amountToAdd = Math.max(0, amountToAdd);
            // Handle all-ins: if amountToAdd > player's remaining stack, adjust amountToAdd
            // amountToAdd = Math.min(amountToAdd, playerStack); // <-- Need player stack info here!

            newPlayerBetTotal = alreadyBet + amountToAdd; // Their total commitment matches the facing bet
            // newCurrentBetFacing does not change on a call
            break;

        case Decision.kCheck:
        case Decision.kFold:
            amountToAdd = 0;
            // newPlayerBetTotal doesn't change
            // newCurrentBetFacing doesn't change
            break;
    }
    return { amountToAdd, newPlayerBetTotal, newCurrentBetFacing };
}

function reducer(state: InitialState, action: { type: DispatchActionType; payload: any }): InitialState {
    const { currentAction, stage, gameQueue, actionSequence, playerActions } = state;

    switch (action.type) {
        case DispatchActionType.kSetInput:
            return { ...state, input: action.payload.input };


        case DispatchActionType.kAddAction: {
            const mostRecentActionText = getLastAction(action.payload.input);
            // Player to act is always the first in the current sequence
            const playerToAct = actionSequence[0];
            // Convert user input into action tokens.
            const actionInfo = parseAction(mostRecentActionText, playerToAct);
            const playerAction = buildBasePlayerAction(actionInfo, stage);
            // Add new action to list of player actions
            const newPlayerActions = [...playerActions, playerAction];

            const actingPlayer = playerAction.position;
            // Calculate betting information updates (if applicable) based on new player action
            const {amountToAdd, newPlayerBetTotal, newCurrentBetFacing} = getUpdatedBettingInfo(state.betsThisStreet, state.currentBetFacing, playerAction);
            // console.log(`amountToAdd: ${amountToAdd}, newPlayerBetTotal: ${newPlayerBetTotal}, newCurrentBetFacing: ${newCurrentBetFacing}`)
            // Ues betting information to populate `amount` and `text` on player action.
            playerAction.amount = amountToAdd;
            playerAction.text = getMeaningfulTextToDisplay(playerAction);
            // Post-flop: Update action sequence immediately based on the action
            let newActionSequence = [...actionSequence]; // Start with current sequence

            if (stage !== Stage.Preflop) {
                const remainingPlayers = actionSequence.slice(1);
                // const actingPlayer = actionSequence[0];
                // If the player didn't fold, add them to the end of the remaining sequence
                newActionSequence = [
                    ...remainingPlayers,
                    ...(playerAction.decision !== Decision.kFold ? [actingPlayer] : [])
                ];
            }
            // Pre-flop: Action sequence is handled differently, often based on who is left
            // *after* the betting round, so we don't modify it here per-action.
            // It gets recalculated during the transition from Preflop.
            const addActionState = {
                ...state,
                input: action.payload.input, // Keep the input for multi-action entry
                playerActions: newPlayerActions,
                actionSequence: newActionSequence, // Update sequence if post-flop
                pot: state.pot + amountToAdd,
                betsThisStreet: {
                    ...state.betsThisStreet,
                    [actingPlayer]: newPlayerBetTotal,
                },
                currentBetFacing: newCurrentBetFacing,
            };
            console.log(addActionState, ' state after add ');
            return addActionState;
        }

        case DispatchActionType.kTransition: {
            const initialStage = stage;
            const nextStage = currentAction.shouldTransitionAfterStep ? getNextStage(stage) : stage;
            const nextAction = gameQueue[0]; // Next step in the overall game flow

            let propertyUpdates: Partial<InitialState> = {};
            let finalPlayerActions = [...playerActions]; // Start with current actions
            let finalActionSequence = [...actionSequence]; // Start with current sequence
            let amountToAdd = 0;
            let newPlayerBetTotal = 0; 
            let newCurrentBetFacing = 0;
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

                const actionInfo = parseAction(mostRecentActionText, playerToAct);
                const playerAction = buildBasePlayerAction(actionInfo, stage);
                const actingPlayer = playerAction.position;
                const {amountToAdd, newPlayerBetTotal, newCurrentBetFacing} = getUpdatedBettingInfo(state.betsThisStreet, state.currentBetFacing, playerAction);
                playerAction.amount = amountToAdd;
                playerAction.text = getMeaningfulTextToDisplay(playerAction);
                finalPlayerActions = [...finalPlayerActions, playerAction]; // Add the final action
                console.log(finalPlayerActions, ' finalPlayerActions')
                // Update action sequence if post-flop (mirroring kAddAction logic)
                if (stage !== Stage.Preflop) {
                    const remainingPlayers = actionSequence.slice(1);
                    finalActionSequence = [
                        ...remainingPlayers,
                        ...(playerAction.decision !== Decision.kFold ? [playerToAct] : [])
                    ];
                }
                propertyUpdates.pot = state.pot + amountToAdd;
                propertyUpdates.betsThisStreet = {
                    ...state.betsThisStreet,
                    [actingPlayer]: newPlayerBetTotal,
                };
                propertyUpdates.currentBetFacing = newCurrentBetFacing;

                    // Add pot/bet updates based on playerAction here too
                    // propertyUpdates.pot = calculateNewPot(state.pot, playerAction);
                    // propertyUpdates.mostRecentBet = calculateNewMostRecentBet(state.mostRecentBet, playerAction);
            }
            // --- End Processing Final Input ---

            console.log(`amountToAdd: ${amountToAdd}, newPlayerBetTotal: ${newPlayerBetTotal}, newCurrentBetFacing: ${newCurrentBetFacing}`)

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
            // TODO
            // FILTER players with multiple actions that include a fold from action sequence

            // If the stage actually changed, recalculate the action sequence for the *new* stage
            if (initialStage !== nextStage && nextStage !== Stage.Showdown) {
                // The sequence for the next street starts with players who didn't fold on the *previous* street,
                // ordered by position (usually SB first post-flop).
                finalState = {
                    ...finalState,
                    actionSequence: getNewActionSequence(initialStage, finalState.playerActions), // Sequence based on who is left from initialStage
                    // Reset mostRecentBet for the new street? Usually yes.
                    // mostRecentBet: 0,
                    betsThisStreet: {},
                    currentBetFacing: 0,
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
                playerActions: [], // Start fresh
                stage: Stage.Preflop, // Ensure stage is set correctly
                stageDisplayed: Stage.Preflop,
                // Reset other relevant fields?
                cards: initialState.cards,
                input: '',
                betsThisStreet: { [Position.SB]: smallBlind, [Position.BB]: bigBlind },
                currentBetFacing: bigBlind,
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
        paddingHorizontal: 12, // Add horizontal padding to the container
        paddingVertical: 4, // Add some vertical padding
        marginBottom: 4, // Add space below this row, before the ActionList
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


// TODO - handle preflop situation where a player has acted and needs to make an additional action
// for ex: LJ limps, bu raises
// in this case we need the LJ to call, fold, or raise

/**
 * Calculates the sequence of players for the *next* betting round based on actions from the completed stage.
 * It filters for players who did not fold in the given stage, sorts them by position rank,
 * and returns a unique list of their positions in that order.
 *
 * @param stage The stage that just completed (e.g., Stage.Flop to determine Turn sequence).
 * @param playerActions The list of all actions recorded so far.
 * @returns An ordered array of unique positions for the next round of action.
 */
function getNewActionSequence(stage: Stage, playerActions: PlayerAction[]): Position[] {
    // 1. Filter actions for the relevant stage and remove players who folded
    const foldedOutPlayers = playerActions.filter(action => action.stage === stage && action.decision === Decision.kFold).map(a => a.position);
    const activeActions = playerActions
        .filter(action => action.stage === stage && action.decision !== Decision.kFold);
    const filteredActiveActions = activeActions.filter(a => !foldedOutPlayers.includes(a.position));
    const positions = filteredActiveActions.map(action => action.position);
    console.log(positions, ' positions')
    const uniquePositions = positions.filter((position, index, self) =>
        self.indexOf(position) === index
    );
    return uniquePositions.sort((a, b) => positionToRank(a) - positionToRank(b))
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
// [Position.SB, Position.BB, Position.UTG, Position.UTG_1, Position.LJ, Position.HJ, Position.CO, Position.BU]
function getPlayerActionsWithAutoFolds(actionSequence: Position[], playerActions: PlayerAction[]) {
    let index = -1;
    const newSequence = actionSequence.map((player) => {
        const foundIndex = playerActions.findIndex(action => action.position == player);
        index = foundIndex === -1 ? index : foundIndex;
        return foundIndex !== -1 ? playerActions[foundIndex] : createPlayerActionForAutoFoldedPlayer(player);
    });
    if (index !== playerActions.length - 1) {
        return [...newSequence, ...playerActions.slice(index+1)];
    }
    return newSequence;
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

// TODO: 1. betting raising logic to accurately track pot size.
// TODO: 2. add undo logic and button
// TODO: 3. add showdown to river state
// TODO: 4. add stack sizes/effective stacks
// TODO: 5.

function getMeaningfulTextToDisplay(action: PlayerAction): string {
    console.log(action)
    let text = decisionToText(action.decision);
    if (action.amount !== 0) {
        text += ` $${action.amount}`;
    }
    return text;
    //   return `${decisionToText(action.decision)} ${action.amount === 0 ? '' : action.amount}`;
}

function buildBasePlayerAction(actionInfo: ActionTextToken, stage: Stage): PlayerAction {
    const action: PlayerAction = { text: '',  stage, shouldHideFromUi: false, ...actionInfo };
    return action;
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

function parseActionString(actionString: string, currentPosition: Position): ActionTextToken {
    const tokens = actionString.split(' ');

    let position: Position;
    let decision: Decision | null = null;
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
