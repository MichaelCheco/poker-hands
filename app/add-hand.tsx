import React, { useReducer, useRef } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
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
import { determinePokerWinnerManual, PokerPlayerInput } from '@/hand-evaluator';
import { useTheme } from 'react-native-paper';

function reducer(state: InitialState, action: { type: DispatchActionType; payload: any }): InitialState {
    const { currentAction, stage, gameQueue, actionSequence, playerActions } = state;

    switch (action.type) {
        case DispatchActionType.kUndo:
            if (state.handHistory.length === 1) {
                return state;
            }
            state.handHistory.pop();
            return state.handHistory[state.handHistory.length - 1];

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
            // Use betting information to populate `amount` and `text` on player action.
            playerAction.amount = amountToAdd;
            playerAction.text = getMeaningfulTextToDisplay(playerAction);
            let newActionSequence = [...actionSequence];

            if (stage !== Stage.Preflop) {
                const remainingPlayers = actionSequence.slice(1);
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
                input: action.payload.input,
                playerActions: newPlayerActions,
                actionSequence: newActionSequence,
                pot: state.pot + amountToAdd,
                betsThisStreet: {
                    ...state.betsThisStreet,
                    [actingPlayer]: newPlayerBetTotal,
                },
                currentBetFacing: newCurrentBetFacing,
            };
            addActionState.handHistory = [...addActionState.handHistory, {...addActionState}];
            return addActionState;
        }

        case DispatchActionType.kTransition: {
            const initialStage = stage;
            const nextStage = currentAction.shouldTransitionAfterStep ? getNextStage(stage) : stage;
            // Next step in the overall game flow
            const nextAction = gameQueue[0];

            let propertyUpdates: Partial<InitialState> = {};
            let finalPlayerActions = [...playerActions];
            let finalActionSequence = [...actionSequence];
            let amountToAdd = 0;
            let newPlayerBetTotal = 0; 
            let newCurrentBetFacing = 0;
            if (currentAction.actionType === ActionType.kCommunityCard) {
                // Remove trailing '.'
                const inputCards = action.payload.input.slice(0, -1).trim().toUpperCase();
                const newCards = getCards(state.cards, inputCards);
                propertyUpdates = {
                    cards: newCards,
                    deck: filterNewCardsFromDeck(newCards, state.deck)
                };
            }  else if (currentAction.actionType === ActionType.kVillainCards) {
                let villains = state.actionSequence.filter(v => v !== state.hero);
                const inputCards = action.payload.input.slice(0, -1).trim().toUpperCase();
                const villainCards = getVillainCards(inputCards, villains);
                propertyUpdates.villainCards = villainCards;
                const result = determinePokerWinnerManual(villainCards, state.cards.map((c) => `${c[0]}${c[1].toLowerCase()}`));
                propertyUpdates.showdown = JSON.stringify(result);
                // Check if there's action input
            } else if (action.payload.input.trim().length > 1) {
                // Handle the last player action input before transitioning
                const mostRecentActionText = getLastAction(action.payload.input);
                const playerToAct = actionSequence[0];

                const actionInfo = parseAction(mostRecentActionText, playerToAct);
                const playerAction = buildBasePlayerAction(actionInfo, stage);
                const actingPlayer = playerAction.position;
                const {amountToAdd, newPlayerBetTotal, newCurrentBetFacing} = getUpdatedBettingInfo(state.betsThisStreet, state.currentBetFacing, playerAction);
                playerAction.amount = amountToAdd;
                playerAction.text = getMeaningfulTextToDisplay(playerAction);
                finalPlayerActions = [...finalPlayerActions, playerAction];
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

            }

            const newStateBase: InitialState = {
                ...state,
                ...propertyUpdates,
                playerActions: finalPlayerActions,
                actionSequence: finalActionSequence,
                stage: nextStage,
                stageDisplayed: nextStage,
                input: '',
                gameQueue: gameQueue.slice(1),
                currentAction: nextAction,
            };

            let finalState = newStateBase;

            // If transitioning *away from* Preflop, apply auto-folds based on the *original* preflop sequence
            if (initialStage === Stage.Preflop && nextStage !== initialStage) {
                const originalPreflopSequence = state.actionSequence;
                finalState = {
                    ...finalState,
                    playerActions: getPlayerActionsWithAutoFolds(originalPreflopSequence, finalState.playerActions)
                };
            }

            // If the stage actually changed, recalculate the action sequence for the *new* stage
            if (initialStage !== nextStage && nextStage !== Stage.Showdown) {
                finalState = {
                    ...finalState,
                    actionSequence: getNewActionSequence(initialStage, finalState.playerActions),
                    betsThisStreet: {},
                    currentBetFacing: 0,
                };
            }

            if (finalState.gameQueue.length === 0) {

            }
            console.log("New state: ", finalState);
            finalState.handHistory = [...finalState.handHistory, {...finalState}];
            return finalState;
        }


        case DispatchActionType.kSetVisibleStage:
            return { ...state, stageDisplayed: action.payload.newStage };

        case DispatchActionType.kSetGameInfo: {
            const { actionSequence, heroPosition, hand, smallBlind, bigBlind } = action.payload;
            const initialGameState = {
                ...state,
                actionSequence: moveFirstTwoToEnd(actionSequence),
                pot: smallBlind + bigBlind,
                hero: heroPosition,
                deck: filterNewCardsFromDeck(hand, state.deck),
                playerActions: [],
                stage: Stage.Preflop,
                stageDisplayed: Stage.Preflop,
                cards: initialState.cards,
                input: '',
                betsThisStreet: { [Position.SB]: smallBlind, [Position.BB]: bigBlind },
                currentBetFacing: bigBlind,
            };
            initialGameState.handHistory = [{...initialGameState}];
            return initialGameState;
        }
        case DispatchActionType.kReset:
            return { ...initialState };
        default:
            return state;
    }
}


export default function App() {
    const { data }: { data: string } = useLocalSearchParams();
    const theme = useTheme();
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
        } else if (isAddAction && state.currentAction.actionType !== ActionType.kCommunityCard) {
            type = DispatchActionType.kAddAction;
        } else {
            type = DispatchActionType.kSetInput;
        }
        dispatch({ type, payload: { input: text } });
    };

    return (
        <View style={{...styles.container, backgroundColor: theme.colors.myOwnColor}}>
            <ScrollView style={styles.content}>
                <GameInfo info={gameInfo} />
                <SegmentedActionLists stageDisplayed={state.stageDisplayed} dispatch={dispatch} />
                <View style={styles.infoRow}>
                    <Text style={styles.potText}>Pot: ${state.pot}</Text>
                    <CommunityCards cards={state.cards} />
                </View>
                <ActionList stage={state.stageDisplayed} actionList={state.playerActions} />
                {state.stage === Stage.Showdown && (
                    <Text>
                        {state.showdown}
                    </Text>
                )}
            </ScrollView>
            {state.stage !== Stage.Showdown && <View style={styles.inputContainer}>
                <TextInput
                    mode="outlined"
                    label={state.currentAction.placeholder}
                    onChangeText={handleInputChange}
                    value={state.input}
                    style={styles.input}
                    autoFocus
                    right={<TextInput.Icon icon="undo-variant" onPress={() => dispatch({ type: DispatchActionType.kUndo, payload: {} })}/>}

                />
            </View>}
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
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 4,
        marginBottom: 4,
    },
    potText: {
        fontSize: 16,
        fontWeight: '500',
        color: '#333',
    },
    inputContainer: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: 'white',
        flexDirection: 'row',
        alignItems: 'stretch',

        borderTopWidth: 1,
        borderTopColor: '#e0e0e0',
    },
    input: {
        flex: 1,
        marginRight: 8,
        height: 56,
    },
    undoButton: {
        borderRadius: 4,
        height: 56,
        position: 'relative',
        top: 6,
        justifyContent: 'center',
        marginRight: 8,
    },
});

function getUpdatedBettingInfo(
    betsThisStreet: { [key in Position]?: number },
    currentBetFacing: number, playerAction: PlayerAction) {
    const actingPlayer = playerAction.position;
    // How much player already bet this street
    const alreadyBet = betsThisStreet[actingPlayer] || 0;
    // How much is ACTUALLY added to the pot by THIS action
    let amountToAdd = 0;
    // Player's new total bet this street
    let newPlayerBetTotal = alreadyBet;
     // The bet level facing others
    let newCurrentBetFacing = currentBetFacing;

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
            // Their total commitment is now the raise amount
            newPlayerBetTotal = playerAction.amount;
            // This sets the new bet level
            newCurrentBetFacing = playerAction.amount;
            break;

        case Decision.kCall:
            // Amount to add is the current bet level MINUS what was already bet
            // Example: Facing 60, already bet 20. Add 40.
            amountToAdd = currentBetFacing - alreadyBet;
            // Ensure amountToAdd isn't negative if something went wrong
            amountToAdd = Math.max(0, amountToAdd);
            // Handle all-ins: if amountToAdd > player's remaining stack, adjust amountToAdd
            // amountToAdd = Math.min(amountToAdd, playerStack); // <-- Need player stack info here!

            // Their total commitment matches the facing bet
            newPlayerBetTotal = alreadyBet + amountToAdd;
            break;

        case Decision.kCheck:
        case Decision.kFold:
            amountToAdd = 0;
            break;
    }
    return { amountToAdd, newPlayerBetTotal, newCurrentBetFacing };
}

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

function getVillainCards(cards: string, villains: string[]): PokerPlayerInput[] {
    let hands = cards.split(",");
    let output = []
    for (let i = 0; i < villains.length; i++) {
        let currHand = hands[i];
        let splitCards = [currHand.slice(0, 2), currHand.slice(2)];
        splitCards[0][1] = splitCards[0][1].toLowerCase();
        splitCards[1][1] = splitCards[1][1].toLowerCase();

        output[i] = {
            holeCards: splitCards, 
            playerId: villains[i]};
    }
    return output;
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

function getMeaningfulTextToDisplay(action: PlayerAction): string {
    let text = decisionToText(action.decision);
    if (action.amount !== 0) {
        text += ` $${action.amount}`;
    }
    return text;
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
