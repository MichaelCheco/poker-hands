import React, { useReducer, useRef, useState, useEffect, useLayoutEffect } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import ActionList from '../components/ActionList';
import GameInfo from '../components/GameInfo';
import { useLocalSearchParams } from 'expo-router';
import { ActionType, ActionTextToken, Decision, DispatchActionType, GameState, PlayerAction, Position, Stage } from '@/types';
import { CommunityCards, MyHand } from '@/components/Cards';
import { initialState, numPlayersToActionSequenceList } from '@/constants';
import { PokerFormData } from '@/components/PokerHandForm';
import { formatCommunityCards, getInitialGameState, moveFirstTwoToEnd, parseFlopString, parsePokerHandString, parseStackSizes, positionToRank, transFormCardsToFormattedString } from '@/utils';
import { determinePokerWinnerManual, PokerPlayerInput, WinnerInfo } from '@/hand-evaluator';
import { useTheme } from 'react-native-paper';
import Showdown from '@/components/Showdown';
import { ImmutableStack } from '@/ImmutableStack';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context'; // 1. Import the hook
import { useNavigation } from '@react-navigation/native'; // Or get navigation from props if using older class components/navigation versions
import HeroHandInfo from '@/components/HeroHandInfo';
let start;
interface GameAppState {
    current: GameState; // The current state of the game
    history: ImmutableStack<GameState>; // The stack holding previous states
}


function removeAfterLastComma(input: string): string {
    const lastIndex = input.lastIndexOf(",");
    return lastIndex !== -1 ? input.slice(0, lastIndex) : '';
}

function isRecordedAction(playerActions: PlayerAction[], text: string, playerToAct: string, stage: Stage): boolean {
    const actionText = getLastAction(text.endsWith('.') ? text.slice(0, -1) : text);
    const actionInfo = parseAction(actionText, playerToAct);
    const playerAction = buildBasePlayerAction(actionInfo, stage);
    const result = playerActions.some(ac => ac.id === playerAction.id)
    return result;
}

function hasActionBeenAddedAlready(playerActions: PlayerAction[], currentAction: PlayerAction): boolean {
    return playerActions.some(action => action.id === currentAction.id);
}

function getNumBetsForStage(playerActions: PlayerAction[], stage: Stage): number {
    let numBets = playerActions.filter(a => a.stage === stage && (a.decision === Decision.kBet || a.decision === Decision.kRaise)).length;
    numBets = stage === Stage.Preflop ? numBets + 1 : numBets;
    return numBets;
}

function shouldTriggerUndo(text: string, currState: GameState): boolean {
    const isAddAction = text.endsWith(',');
    return (isAddAction || `${text},` === currState.input) && isRecordedAction(currState.playerActions, text, currState.actionSequence[0] || '', currState.stage);
}

function reducer(state: GameAppState, action: { type: DispatchActionType; payload: any }): GameAppState {
    switch (action.type) {
        case DispatchActionType.kUndo:
            if (state.history.size === 1) {
                return state;
            }
            const { stack: updatedHistory, value: previousState } = state.history.pop();
            return {
                current: { ...previousState as GameState, input: removeAfterLastComma(previousState?.input || '') },
                history: updatedHistory,
            };
        case DispatchActionType.kSetInput:
            return {
                current: { ...state.current, input: action.payload.input },
                history: state.history,
            };
        case DispatchActionType.kAddAction: {
            const currentGameState = state.current;
            const mostRecentActionText = getLastAction(action.payload.input);
            const playerAction = getPlayerAction(state.current.actionSequence[0], getLastAction(action.payload.input), state.current.stage)

            if (hasActionBeenAddedAlready(state.current.playerActions, playerAction)) {
                console.log(`id matched for input: ${mostRecentActionText}`)
                return {
                    current: { ...state.current, input: action.payload.input },
                    history: state.history,
                };
            }

            // Add new action to list of player actions
            const newPlayerActions = [...state.current.playerActions, playerAction];

            const actingPlayer = playerAction.position;
            // Calculate betting information updates (if applicable) based on new player action
            const { amountToAdd, newPlayerBetTotal, newCurrentBetFacing } =
              getUpdatedBettingInfo(state.current.betsThisStreet, state.current.currentBetFacing, playerAction);
            // Use betting information to populate `amount` and `text` on player action.
            playerAction.amount = newPlayerBetTotal;
            playerAction.text = getMeaningfulTextToDisplay(
                playerAction,
                getNumBetsForStage(state.current.playerActions, state.current.stage),
                state.current.stage);

            let newActionSequence = [...state.current.actionSequence];
            if (state.current.stage !== Stage.Preflop) {
                const remainingPlayers = state.current.actionSequence.slice(1);
                // If the player didn't fold, add them to the end of the remaining sequence
                newActionSequence = [
                    ...remainingPlayers,
                    ...(playerAction.decision !== Decision.kFold ? [actingPlayer] : [])
                ];
            }
            // Pre-flop: Action sequence is handled differently, often based on who is left
            // *after* the betting round, so we don't modify it here per-action.
            // It gets recalculated during the transition from Preflop.
            const addActionState: GameState = {
                ...state.current,
                input: action.payload.input,
                playerActions: newPlayerActions,
                actionSequence: newActionSequence,
                pot: state.current.pot + amountToAdd,
                currentBetFacing: newCurrentBetFacing,
                betsThisStreet: {
                    ...state.current.betsThisStreet,
                    [actingPlayer]: newPlayerBetTotal,
                },
            };
            const newHistory = state.history.push(currentGameState);
            const newStateAfterAdd = {
                current: addActionState,
                history: newHistory,
            };
            return newStateAfterAdd;
        }

        case DispatchActionType.kTransition: {
            const currentState = state.current;
            const initialStage = currentState.stage;
            const nextStage = currentState.currentAction.shouldTransitionAfterStep ? getNextStage(currentState.stage) : currentState.stage;
            // Next step in the overall game flow
            const nextAction = currentState.gameQueue[0];

            let propertyUpdates: Partial<GameState> = {};
            let finalPlayerActions = [...currentState.playerActions];
            let finalActionSequence = [...currentState.actionSequence];
            if (currentState.currentAction.actionType === ActionType.kCommunityCard) {
                const inputCards = action.payload.input.slice(0, -1).trim().toUpperCase();
                const newCards = getCards([...currentState.cards], [...currentState.deck], inputCards);
                propertyUpdates = {
                    cards: [...newCards],
                    deck: [...filterNewCardsFromDeck(newCards, [...currentState.deck])]
                };
            } else if (currentState.currentAction.actionType === ActionType.kVillainCards) {
                let villains = currentState.actionSequence.filter(v => v !== currentState.hero.position);
                const inputCards = action.payload.input.slice(0, -1).trim().toUpperCase();
                const villainCards = getVillainCards(inputCards, villains);
                const showdownHands = [{
                    playerId: currentState.hero.position,
                    holeCards: [currentState.hero.hand.slice(0, 2), currentState.hero.hand.slice(2)]
                }, ...villainCards];
                const result = determinePokerWinnerManual(
                    showdownHands,
                    formatCommunityCards(currentState.cards)) as WinnerInfo;
                propertyUpdates.showdown = {
                    combination: result.bestHandCards,
                    hands: showdownHands,
                    text: result.winningHandDescription,
                    winner: `${result.winners.map(w => w.playerId)[0]}`
                };
                // Check if there's action input
            } else if (action.payload.input.trim().length > 1) {
                // Handle the last player action input before transitioning
                const mostRecentActionText = getLastAction(action.payload.input);
                const playerToAct = currentState.actionSequence[0];

                const actionInfo = parseAction(mostRecentActionText, playerToAct);
                const playerAction = buildBasePlayerAction(actionInfo, currentState.stage);
                playerAction.isLastActionForStage = initialStage !== nextStage;
                const actingPlayer = playerAction.position;
                const { amountToAdd, newPlayerBetTotal, newCurrentBetFacing } = getUpdatedBettingInfo(currentState.betsThisStreet, currentState.currentBetFacing, playerAction);
                playerAction.amount = newPlayerBetTotal;
                let numBets = currentState.playerActions.filter(a => a.stage === currentState.stage && (a.decision === Decision.kBet || a.decision === Decision.kRaise)).length;
                numBets = initialStage === Stage.Preflop ? numBets + 1 : numBets;
                playerAction.text = getMeaningfulTextToDisplay(playerAction, numBets, initialStage);
                finalPlayerActions = [...finalPlayerActions, playerAction];
                // Update action sequence if post-flop (mirroring kAddAction logic)
                if (currentState.stage !== Stage.Preflop) {
                    const remainingPlayers = currentState.actionSequence.slice(1);
                    finalActionSequence = [
                        ...remainingPlayers,
                        ...(playerAction.decision !== Decision.kFold ? [playerToAct] : [])
                    ];
                }
                propertyUpdates.pot = currentState.pot + amountToAdd;
                propertyUpdates.betsThisStreet = {
                    ...currentState.betsThisStreet,
                    [actingPlayer]: newPlayerBetTotal,
                };
                propertyUpdates.currentBetFacing = newCurrentBetFacing;

            }

            const newStateBase: GameState = {
                ...currentState,
                ...propertyUpdates,
                playerActions: finalPlayerActions,
                actionSequence: finalActionSequence,
                stage: nextStage,
                input: '',
                gameQueue: currentState.gameQueue.slice(1),
                currentAction: nextAction,
            };

            let finalState = newStateBase;

            // If transitioning *away from* Preflop, apply auto-folds based on the *original* preflop sequence
            if (initialStage === Stage.Preflop && nextStage !== initialStage) {
                const originalPreflopSequence = currentState.actionSequence;
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
                    potForStreetMap: { ...finalState.potForStreetMap, [nextStage]: finalState.pot },
                    currentBetFacing: 0,
                };
            }
            // Advance to showdown
            if (finalState.actionSequence.length === 1) {
                finalState.stage = Stage.Showdown;
            }
            const newHistory = state.history.push(currentState);
            const newTransitionState = {
                current: { ...finalState },
                history: newHistory,
            }
            console.log('newTransitionState ', newTransitionState);
            return newTransitionState;
        }
        case DispatchActionType.kSetGameInfo: {
            const { actionSequence, heroPosition, hand, smallBlind, bigBlind, relevantStacks } = action.payload;
            const upperCasedHand = hand.toUpperCase();
            const initialGameState: GameState = {
                ...state.current,
                actionSequence: moveFirstTwoToEnd(actionSequence),
                pot: smallBlind + bigBlind,
                hero: { position: heroPosition, hand: parsePokerHandString(upperCasedHand) },
                deck: [...filterNewCardsFromDeck(parsePokerHandString(upperCasedHand), [...state.current.deck])],
                playerActions: [],
                stage: Stage.Preflop,
                cards: [...initialState.cards],
                input: '',
                betsThisStreet: { [Position.SB]: smallBlind, [Position.BB]: bigBlind },
                currentBetFacing: bigBlind,
                stacks: parseStackSizes(relevantStacks, actionSequence),
            };
            const gameInfoStateInitial = {
                current: { ...initialGameState },
                history: state.history,
            };
            start = gameInfoStateInitial;
            return gameInfoStateInitial;
        }
        case DispatchActionType.kReset:
            return start;
            return {
                current: getInitialGameState(),
                history: ImmutableStack.create<GameState>([getInitialGameState()])
            };
        default:
            return state;
    }
}

const initialAppState: GameAppState = {
    current: getInitialGameState(),
    history: ImmutableStack.create<GameState>([getInitialGameState()]),
};

export default function App() {
    const { data }: { data: string } = useLocalSearchParams();
    const theme = useTheme();
    const headerHeight = useHeaderHeight();
    const navigation = useNavigation();
    const gameInfo: PokerFormData = JSON.parse(data);

    const [state, dispatch] = useReducer(reducer, initialAppState);
    const ref = useRef({ smallBlind: gameInfo.smallBlind, bigBlind: gameInfo.bigBlind });
    const scrollViewRef = useRef<ScrollView>(null);

    useLayoutEffect(() => {
        navigation.setOptions({
            headerLeft: () => <GameInfo info={gameInfo} />,
            headerRight: () => <HeroHandInfo info={gameInfo} />,
        });
    }, [navigation]);

    useEffect(() => {
        dispatch({
            type: DispatchActionType.kSetGameInfo,
            payload: {
                actionSequence: numPlayersToActionSequenceList[gameInfo.numPlayers],
                heroPosition: gameInfo.position,
                hand: gameInfo.hand,
                smallBlind: gameInfo.smallBlind,
                bigBlind: gameInfo.bigBlind,
                relevantStacks: gameInfo.relevantStacks,
            },
        });
    }, []);

    const handleInputChange = (text: string) => {
        const isTransition = text.endsWith('.');
        const isAddAction = text.endsWith(',');
        let type: DispatchActionType;

        if (isTransition) {
            type = DispatchActionType.kTransition;
        } else if (isAddAction && state.current.currentAction.actionType !== ActionType.kCommunityCard) {
            type = DispatchActionType.kAddAction;
        } else {
            type = DispatchActionType.kSetInput;
        }
        dispatch({ type, payload: { input: text } });
    };

    useEffect(() => {
        if (state.current.playerActions.length > 0) {
            // Use setTimeout to ensure layout is updated before scrolling
            setTimeout(() => {
                scrollViewRef.current?.scrollToEnd({ animated: true });
            }, 100);
        }
    }, [state.current.playerActions.length]);

    const handleUndo = () => {
        dispatch({ type: DispatchActionType.kUndo, payload: {} });
    };
    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardAvoidingContainer}
                // Adjust offset for header above this screen component
                keyboardVerticalOffset={headerHeight - 5}
            >
                <View style={{
                    alignItems: 'center',
                    marginInline: 6,
                    marginTop: 12,
                    flexDirection: 'row',
                    justifyContent: 'space-between'
                }}>
                    <Text style={styles.potText} onPress={() => dispatch({ type: DispatchActionType.kReset, payload: {} })}>
                        Eff: {calculateEffectiveStack(state.current.actionSequence, state.current.stacks)}
                    </Text>
                    <CommunityCards cards={state.current.cards} />
                </View>
                {/* ScrollView now takes up available space within KAV */}
                <ScrollView
                    ref={scrollViewRef}
                    style={styles.content}
                    contentContainerStyle={styles.contentContainer} // Add padding inside if needed
                    keyboardShouldPersistTaps="handled" // Good practice
                >
                    {state.current.stage !== Stage.Showdown && (
                        <ActionList
                            actionList={state.current.playerActions}
                            potForStreetMap={state.current.potForStreetMap}
                            currentStage={state.current.stage}
                        />
                    )}

                    {state.current.stage === Stage.Showdown && (
                        <Showdown
                            actionList={state.current.playerActions}
                            showdown={state.current.gameQueue.length > 0 ? null : state.current.showdown}
                            gameInfo={gameInfo}
                            communityCards={state.current.cards}
                            actionSequence={state.current.actionSequence}
                            pot={state.current.pot} />
                    )}
                </ScrollView>

                {/* Input container remains visually at the bottom, pushed by KAV */}
                {state.current.stage !== Stage.Showdown && (
                    <SafeAreaView style={[
                        styles.inputContainer
                        // { paddingBottom: baseInputPaddingBottom + insets.bottom }
                        // We add the safe area bottom inset to our base padding
                        // This ensures the container itself respects the safe area,
                        // lifting the TextInput inside it above the home indicator.
                    ]}>
                        <TextInput
                            mode="outlined"
                            label={state.current.currentAction?.placeholder}
                            onChangeText={handleInputChange}
                            // submitBehavior={'newline'}
                            value={state.current.input}
                            style={styles.input}
                            autoFocus
                            blurOnSubmit={false}
                            returnKeyType="next"
                            onSubmitEditing={() => {
                                console.log(state.current.input);
                            }}
                            activeOutlineColor='#000000'
                            right={<TextInput.Icon icon="undo-variant" onPress={handleUndo} forceTextInputFocus={false} />}
                        />
                    </SafeAreaView>
                )}
            </KeyboardAvoidingView>
        </View>
    );
}

function calculateEffectiveStack(
    positionsLeft: string[],
    stacks: { [position: string]: number }
): number {
    console.log(positionsLeft, stacks);
    // 1. Map the list of positions directly to their stack sizes
    //    (Assumes every position exists in stacks and the value is a number)
    const relevantStacks = positionsLeft.map(position => stacks[position]);

    // 2. Find the minimum value among those stack sizes
    //    Math.min() returns Infinity if relevantStacks is empty (shouldn't happen if positionsLeft isn't empty)
    //    Math.min() returns NaN if any value in relevantStacks is not a number (e.g., undefined from a bad lookup)
    const effectiveStack = Math.min(...relevantStacks);

    return effectiveStack;
}


function getPlayerAction(playerToAct: string, mostRecentActionText: string, stage: Stage): PlayerAction {
    const actionInfo = parseAction(mostRecentActionText, playerToAct);
    return buildBasePlayerAction(actionInfo, stage);
}
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
        isLastActionForStage: false,
        text: `${position} folds`,
        stage: Stage.Preflop,
        id: '',
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
        return [...newSequence, ...playerActions.slice(index + 1)];
    }
    return newSequence;
}

function getVillainCards(cards: string, villains: string[]): PokerPlayerInput[] {
    let hands = cards.split(",").map(h => {
        let trim = h.trim();
        return transFormCardsToFormattedString(trim);
    });
    // TODO format hands
    let output = []
    for (let i = 0; i < villains.length; i++) {
        let currHand = hands[i];
        let splitCards = [currHand.slice(0, 2), currHand.slice(2)];
        output[i] = {
            holeCards: splitCards,
            playerId: villains[i]
        };
    }
    return output;
}

function getCards(currentCards: string[], currentDeck: string[], newCards: string) {
    const EMPTY_CARD = '';
    let cardsToAdd: string[] = newCards.length > 2 ? parseFlopString(newCards) : [newCards]
    for (let i = 0; i < currentCards.length; i++) {
        if (currentCards[i] === EMPTY_CARD) {
            currentCards[i] = getSuitForCard(cardsToAdd.shift() as string, currentDeck);
            if (cardsToAdd.length === 0) {
                return currentCards;
            }
        }
    }
    return currentCards
}

function getMeaningfulTextToDisplay(action: PlayerAction, numBetsThisStreet: number, stage: Stage): string {
    const amountStr = `$${action.amount}`;
    if (numBetsThisStreet === 1 && stage === Stage.Preflop) {
        return `opens to ${amountStr}`;
    }
    switch (action.decision) {
        case Decision.kBet:
            return `bets ${amountStr}`
        case Decision.kCall:
            return 'calls'
        case Decision.kCheck:
            return 'checks'
        case Decision.kFold:
            return 'folds'
        case Decision.kRaise: {
            if (numBetsThisStreet === 1) {
                return `raises to ${amountStr}`;
            }
            return `${++numBetsThisStreet}-bets to ${amountStr}`;
        }
    }
}


// Used to pick a random suit for a card (Ax).
function getRandomIndex(arrayLen: number): number {
    return Math.floor(Math.random() * arrayLen);
}

const cardHasDefinedSuit = (card: string) => card.charAt(1) !== "X";
function getSuitForCard(card: string, currDeck: string[]): string {
    if (card.length !== 2) {
        console.error("Invalid card: ", card);
        return '';
    }

    if (cardHasDefinedSuit(card)) {
        return card;
    }

    const cardsInDeck = currDeck.filter(c => c.charAt(0) === card.charAt(0));
    return cardsInDeck[getRandomIndex(cardsInDeck.length)]
}

function getIdForPlayerAction(action: PlayerAction): string {
    return `${action.position}-${action.decision}-${action.amount}-${action.stage}`;
}

function buildBasePlayerAction(actionInfo: ActionTextToken, stage: Stage): PlayerAction {
    const action: PlayerAction = { text: '', stage, isLastActionForStage: false, shouldHideFromUi: false, ...actionInfo, id: '' };
    action.id = getIdForPlayerAction(action);
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
        [Stage.Showdown]: Stage.Showdown,
    };
    return nextStages[stage];
}

function parseActionString(actionString: string, currentPosition: Position): ActionTextToken {
    const tokens = actionString.split(' ');
    let position: Position;
    // todo remove this default value
    let decision: Decision = Decision.kCheck;
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
        decision,
        position,
        amount,
    };
}

function parseAction(action: string, currentPosition: string): ActionTextToken {
    return parseActionString(action, currentPosition as Position);
}

function filterNewCardsFromDeck(newCards: string | string[], currDeck: string[]): string[] {
    const cards = typeof newCards === "string" ? extractCards(newCards.toUpperCase()) : newCards;
    return currDeck.filter(card => !cards.includes(card))
}

function extractCards(str: string): string[] {
    const result = [];
    for (let i = 0; i < str.length; i += 2) {
        result.push(str.substring(i, i + 2));
    }
    return result;
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    keyboardAvoidingContainer: { // KAV needs flex: 1 to manage space
        flex: 1,
    },
    content: {
        flex: 1, // Allows ScrollView to grow/shrink within KAV
    },
    contentContainer: {
        paddingBottom: 10,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingVertical: 4,
        marginBottom: 4,
        marginTop: 12,
    },
    potText: {
        fontSize: 16,
        width: '30%',
        fontWeight: '800',
        color: '#555'
    },
    inputContainer: {
        paddingHorizontal: 16,
        paddingVertical: 0,
        paddingBottom: Platform.OS === 'ios' ? 6 : 12,
        flexDirection: 'row',
        alignItems: 'center',
    },
    input: {
        flex: 1,
    },
});
