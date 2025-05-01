import React, { useReducer, useRef, useState, useEffect, useLayoutEffect, useCallback } from 'react';
import { ActivityIndicator, View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, TextInput, Snackbar } from 'react-native-paper';
import ActionList from '../../components/ActionList';
import GameInfo from '../../components/GameInfo';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActionType, ActionTextToken, Decision, DispatchActionType, GameState, PlayerAction, Position, Stage, GameQueueItem, PlayerStatus, GameQueueItemType, PokerPlayerInput, WinnerInfo, HandSetupInfo } from '@/types';
import { CommunityCards } from '@/components/Cards';
import { initialState, numPlayersToActionSequenceList } from '@/constants';
import { convertRRSS_to_RSRS, formatCommunityCards, getInitialGameState, isSuit, moveFirstTwoToEnd, parseFlopString, parsePokerHandString, parseStackSizes, positionToRank, transFormCardsToFormattedString } from '@/utils/hand-utils';
import { determinePokerWinnerManual } from '@/hand-evaluator';
import { useTheme } from 'react-native-paper';
import { ImmutableStack } from '@/ImmutableStack';
import { useHeaderHeight } from '@react-navigation/elements';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import HeroHandInfo from '@/components/HeroHandInfo';
import { saveHandToSupabase } from '@/api/hands';
import SuccessAnimation from '@/components/AnimatedSuccess';

const logging = false;

interface GameAppState {
    current: GameState;
    history: ImmutableStack<GameState>;
}

function removeAfterLastComma(input: string): string {
    const lastIndex = input.lastIndexOf(",");
    return lastIndex !== -1 ? input.slice(0, lastIndex) : '';
}

function hasActionBeenAddedAlready(playerActions: PlayerAction[], currentAction: PlayerAction): boolean {
    return playerActions.some(action => action.id === currentAction.id);
}

function getNumBetsForStage(playerActions: PlayerAction[], stage: Stage): number {
    let numBets = playerActions.filter(a => a.stage === stage && (a.decision === Decision.kBet || a.decision === Decision.kRaise)).length;
    numBets = stage === Stage.Preflop ? numBets + 1 : numBets;
    return numBets;
}

function reducer(state: GameAppState, action: { type: DispatchActionType; payload: any }): GameAppState {
    switch (action.type) {
        case DispatchActionType.kUndo:
            if (state.history.isEmpty()) {
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
            const nextPlayerToActIndex = currentGameState.actionSequence.findIndex(a => !a.isAllIn);
            const playerToAct = currentGameState.actionSequence[nextPlayerToActIndex] as PlayerStatus
            const playerAction = getPlayerAction(playerToAct.position, getLastAction(action.payload.input), state.current.stage)

            if (hasActionBeenAddedAlready(state.current.playerActions, playerAction)) {
                return {
                    current: { ...state.current, input: action.payload.input },
                    history: state.history,
                };
            }

            // Add new action to list of player actions
            const newPlayerActions = [...state.current.playerActions, playerAction];

            const actingPlayer = playerAction.position;
            const currentStack = state.current.stacks[playerAction.position];
            // Calculate betting information updates (if applicable) based on new player action
            const { amountToAdd, newPlayerBetTotal, newCurrentBetFacing } =
                getUpdatedBettingInfo(state.current.betsThisStreet, state.current.currentBetFacing, currentStack, playerAction);
            // Use betting information to populate `amount` and `text` on player action.
            playerAction.amount = amountToAdd;
            playerAction.potSizeBefore = currentGameState.pot;
            playerAction.playerStackBefore = currentStack;
            // Calculate the player's new stack size
            const newStackSize = currentStack - amountToAdd;

            playerAction.text = getMeaningfulTextToDisplay(
                playerAction,
                getNumBetsForStage(state.current.playerActions, state.current.stage),
                state.current.stage);

            let newActionSequence: PlayerStatus[] = [...state.current.actionSequence];
            if (state.current.stage !== Stage.Preflop) {
                const remainingPlayers = [...state.current.actionSequence.slice(0, nextPlayerToActIndex), ...state.current.actionSequence.slice(nextPlayerToActIndex + 1)]
                const addPlayerBack = playerAction.decision !== Decision.kFold;
                const isAllIn = playerAction.decision === Decision.kAllIn || newStackSize === 0;
                newActionSequence = [
                    ...remainingPlayers,
                    ...(addPlayerBack ? [{ position: actingPlayer, isAllIn }] : [])
                ];
            }
            // Pre-flop: Action sequence is handled differently, often based on who is left
            // after the betting round, so we don't modify it here per-action.
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

            // update player's stack size
            addActionState.stacks = {
                ...addActionState.stacks,
                [actingPlayer]: newStackSize
            };
            const newHistory = state.history.push(currentGameState);
            const newStateAfterAdd = {
                current: addActionState,
                history: newHistory,
            };
            // console.log(addActionState.actionSequence, ' add')
            return newStateAfterAdd;
        }
        case DispatchActionType.kTransition: {
            const currentState = state.current;
            const initialStage = currentState.stage;
            // We don't always move to the next stage after a transition (turn card --> turn action)
            const nextStage = currentState.currentAction.shouldTransitionAfterStep ? getNextStage(currentState.stage) : currentState.stage;
            // Next step in the overall game flow
            let nextAction = currentState.gameQueue[0];
            let updatedGameQueue = currentState.gameQueue.slice(1);
            // Contains properties to update based on the current action type.
            let propertyUpdates: Partial<GameState> = {};
            // Get current actions and sequence before any potential modifications
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
                const handText = action.payload.input.slice(0, -1).trim().toUpperCase();
                const position = currentState.currentAction.position as Position;
                const villainHand = isMuck(handText) ? { playerId: position, holeCards: "muck" } as PokerPlayerInput : getVillainCards(action.payload.input.slice(0, -1).trim().toUpperCase(), position);
                const hands = [...currentState.showdownHands, villainHand];
                // All hands have been collected, determine winner information.
                if (!nextAction) {
                    const showdownHands = [formatHeroHand(currentState.hero), ...hands];
                    const result = determinePokerWinnerManual(
                        showdownHands.filter(hand => !(typeof hand.holeCards === "string")),
                        formatCommunityCards(currentState.cards)) as WinnerInfo;
                    propertyUpdates.showdown = {
                        combination: result.bestHandCards,
                        hands: result.details,
                        text: result.winningHandDescription,
                        winner: `${result.winners.map(w => w.playerId)[0]}`,
                    };
                } else {
                    console.log(`updating showdownHands`)
                    propertyUpdates.showdownHands = hands;
                }
            } else if (action.payload.input.trim().length > 1) {
                const currentGameState = state.current;
                const nextPlayerToActIndex = currentGameState.actionSequence.findIndex(a => !a.isAllIn);
                const playerToAct = currentGameState.actionSequence[nextPlayerToActIndex] as PlayerStatus
                const playerAction = getPlayerAction(playerToAct.position, getLastAction(action.payload.input), currentGameState.stage)
                // Used to display a divider between stages in action list.
                playerAction.isLastActionForStage = initialStage !== nextStage;
                const playerPos = playerAction.position;
                const currentStack = state.current.stacks[playerAction.position];
                const { amountToAdd, newPlayerBetTotal, newCurrentBetFacing } =
                    getUpdatedBettingInfo(currentState.betsThisStreet, currentState.currentBetFacing, currentStack, playerAction)
                playerAction.amount = amountToAdd;
                playerAction.potSizeBefore = currentGameState.pot;
                playerAction.playerStackBefore = currentStack;

                // Calculate the player's new stack size
                const newStackSize = currentStack - amountToAdd;

                playerAction.text = getMeaningfulTextToDisplay(
                    playerAction,
                    getNumBetsForStage(currentState.playerActions, initialStage),
                    initialStage);
                finalPlayerActions = [...finalPlayerActions, playerAction];
                // Update action sequence if post-flop (mirroring kAddAction logic)
                if (currentState.stage !== Stage.Preflop) {
                    const remainingPlayers = [
                        ...state.current.actionSequence.slice(0, nextPlayerToActIndex),
                        ...state.current.actionSequence.slice(nextPlayerToActIndex + 1)]

                    // If the player didn't fold, add them to the end of the remaining sequence
                    const addPlayerBack = playerAction.decision !== Decision.kFold;
                    const isAllIn = playerAction.decision === Decision.kAllIn || newStackSize === 0;
                    finalActionSequence = [
                        ...remainingPlayers,
                        ...(addPlayerBack ? [{ position: playerPos, isAllIn }] : [])
                    ];
                }

                // Update betting information
                propertyUpdates.pot = currentState.pot + amountToAdd;
                propertyUpdates.betsThisStreet = {
                    ...currentState.betsThisStreet,
                    [playerPos]: newPlayerBetTotal,
                };
                propertyUpdates.stacks = {
                    ...currentState.stacks,
                    [playerPos]: newStackSize
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
                currentAction: nextAction,
                gameQueue: updatedGameQueue, // remove upcoming `currentAction` from queue
            };

            let finalState = newStateBase;

            // If transitioning away from* Preflop, apply auto-folds based on the original preflop sequence
            if (initialStage === Stage.Preflop && nextStage !== initialStage) {
                const originalPreflopSequence = currentState.actionSequence.map(v => v.position);
                finalState = {
                    ...finalState,
                    playerActions: getPlayerActionsWithAutoFolds(originalPreflopSequence, finalState.playerActions)
                };
            }

            // If the stage actually changed, recalculate the action sequence for the new stage.
            if (initialStage !== nextStage && nextStage !== Stage.Showdown) {
                finalState = {
                    ...finalState,
                    actionSequence: getNewActionSequence(initialStage, finalState.playerActions, finalState.actionSequence),
                    // Update betting information for new stage
                    betsThisStreet: {},
                    potForStreetMap: { ...finalState.potForStreetMap, [nextStage]: finalState.pot },
                    currentBetFacing: 0,
                };
            }
            if (currentState.currentAction.id === GameQueueItemType.kRiverAction) {
                // add villains to queue for card collection
                updatedGameQueue = AddVillainsToGameQueue(currentState.actionSequence.filter(v => v.position !== currentState.hero.position).map(v => v.position));
                nextAction = updatedGameQueue[0];
                updatedGameQueue = updatedGameQueue.slice(1);
                finalState = {
                    ...finalState,
                    currentAction: nextAction,
                    gameQueue: updatedGameQueue
                };
            }
            // Advance to showdown if necessary.
            const playersLeft = finalState.actionSequence.filter(player => !player.isAllIn).length;
            // Should this and the statement above be conditional and ordered?
            if (playersLeft <= 1) {
                const allInAndACall = didAllInAndACallOccurOnStreet(finalState.playerActions);
                console.log(allInAndACall, ' allInAndACall value')
                if (allInAndACall) {
                    finalState.gameQueue = getRemainingCardActions(finalState.gameQueue)
                    if (!finalState.currentAction) {
                        finalState.stage = Stage.Showdown;
                    }
                } else {
                    console.log('skipping to showdown state because no one called ... ')
                    finalState.stage = Stage.Showdown;
                }
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
            const initialPlayerStatuses: PlayerStatus[] = actionSequence.map((position: Position) => ({
                position,
                isAllIn: false,
            }));
            const initialGameState: GameState = {
                ...state.current,
                actionSequence: moveFirstTwoToEnd(initialPlayerStatuses),
                pot: smallBlind + bigBlind,
                hero: { position: heroPosition, hand: parsePokerHandString(upperCasedHand) },
                deck: [...filterNewCardsFromDeck(parsePokerHandString(upperCasedHand), [...state.current.deck])],
                playerActions: [],
                stage: Stage.Preflop,
                input: '',
                betsThisStreet: { [Position.SB]: smallBlind, [Position.BB]: bigBlind },
                currentBetFacing: bigBlind,
                stacks: parseStackSizes(relevantStacks, actionSequence, smallBlind, bigBlind),
            };
            state.history.pop();
            state.history.push(initialGameState);
            const gameInfoStateInitial = {
                current: initialGameState,
                history: state.history,
            };
            return gameInfoStateInitial;
        }
        case DispatchActionType.kReset:
            return {
                current: getInitialGameState(),
                history: ImmutableStack.create<GameState>([getInitialGameState()])
            };
        default:
            return state;
    }
}

function didAllInAndACallOccurOnStreet(playerActions: PlayerAction[]): boolean {
    // console.log('====== didAllInAndACallOccurOnStreet ======')
    let allInIndex = playerActions.findIndex((action: PlayerAction) => action.decision === Decision.kAllIn);
    if (allInIndex === -1) {
        return false;
    }
    const decisions = Object.values(Decision).filter(d => d !== Decision.kFold);
    return playerActions.slice(allInIndex + 1).some(((action: PlayerAction) => decisions.includes(action.decision)));

}

function getRemainingCardActions(gameQueue: GameQueueItem[]): GameQueueItem[] {
    // console.log('====== getRemainingCardActions ======')
    // console.log(gameQueue, ' queue')
    return gameQueue.filter((item: GameQueueItem) => item.actionType !== ActionType.kActionSequence);
}

function AddVillainsToGameQueue(villains: Position[]): GameQueueItem[] {
    const newQueueItems: GameQueueItem[] = villains.map(villain => ({ placeholder: `${villain}'s cards`, shouldTransitionAfterStep: false, actionType: ActionType.kVillainCards, position: villain }));
    const sortedQueueItems = newQueueItems.sort((a, b) => positionToRank(a.position as Position) - positionToRank(b.position as Position));
    sortedQueueItems[sortedQueueItems.length - 1].shouldTransitionAfterStep = true;
    return sortedQueueItems;
}

const initialAppState: GameAppState = {
    current: getInitialGameState(),
    history: ImmutableStack.create<GameState>([getInitialGameState()]),
};

export default function App() {
    const { data }: { data: string } = useLocalSearchParams();
    const [isLoading, setIsLoading] = React.useState(false);
    const [isTransitioning, setIsTransitioning] = React.useState(false);

    const [visible, setVisible] = React.useState(false);
    const [snackbarText, setSnackbarText] = React.useState('');
    const [savedId, setSavedId] = React.useState('');
    const [inputError, setInputError] = React.useState('');
    const onToggleSnackBar = () => setVisible(!visible);
    const onDismissSnackBar = () => setVisible(false);
    const theme = useTheme();
    const headerHeight = useHeaderHeight();
    const navigation = useNavigation();
    const router = useRouter();
    const gameInfo: HandSetupInfo = JSON.parse(data);
    const [inputValue, setInputValue] = useState('');
    const [state, dispatch] = useReducer(reducer, initialAppState);
    const scrollViewRef = useRef<ScrollView>(null);
    const VALID_POSITIONS = numPlayersToActionSequenceList[gameInfo.numPlayers];
    const VALID_ACTIONS = Object.values(Decision);
   
    const isInputValid = useCallback((input: string) => {
        
        const isAlphanumeric = /^[a-zA-Z0-9]+$/;
        const disallowedChars = /[deikmnpqvwyzDEIKMNPQVWYZ]/;
        return isAlphanumeric.test(input) && !disallowedChars.test(input);

    }, []);
    const validatePreflopActionSegments = useCallback((input: string) => {
        if (!input || input.trim() === '') {
            return { isValid: true }; // Or handle empty input as needed
        }

        const segments = input.toUpperCase().split(',').map(s => s.trim()).filter(s => s !== '');
        for (const segment of segments) {
            const parts = segment.split(' ').map(p => p.trim()).filter(p => p !== '');
            if (parts[0].length < 2 && parts.length < 2) {
                return { isValid: false, error: `Incomplete segment: "${segment}"`, flagErrorToUser: false };
            }
            
            const position = parts[0];
            const action = parts[1];
            const amount = parts.length > 2 ? parts[2] : null;
            

            // validate amounts and action sequence
            // Validate Position
            // handle "." ","
            // update undo to work with partial input for first segment
            if (!VALID_POSITIONS.includes(position)) {
                return { isValid: false,
                    error: `Invalid Pos: "${position}", (Valid: ${VALID_POSITIONS.join(', ')})`,
                    flagErrorToUser: true
                };
            }
            
            // Validate Action
            if (!VALID_ACTIONS.includes(action)) {
                return { isValid: false, error: `Invalid action: "${action}", (Valid: ${VALID_ACTIONS.map(a => a.toLowerCase()).join(', ')})`, flagErrorToUser: parts.length >= 2 };
            }
            
            // Validate Amount (if applicable for the action)
            if ((action === Decision.kRaise || action === Decision.kBet) && (!amount || isNaN(Number(amount)) || Number(amount) <= 0)) {
                return { isValid: false, error: `Invalid amount for ${action}: "${amount || ''}" in segment "${segment}"`, flagErrorToUser: parts.length > 2 };
            }
            if ((action === Decision.kCall || action === Decision.kFold) && amount) {
                return { isValid: false, error: `Amount not allowed for ${action} in segment "${segment}"`, flagErrorToUser: true };
            }
            if (parts.some(part => !isInputValid(part))) {
                return { isValid: false, error: `Invalid character detected`, flagErrorToUser: true };
            }

            // Add more specific rules as needed...
        }

        return { isValid: true, error: '', flagErrorToUser: false };
    }, []);

    useLayoutEffect(() => {
        navigation.setOptions({
            headerLeft: () => <GameInfo info={gameInfo} />,
            headerRight: () => <HeroHandInfo info={gameInfo} />,
        });
    }, [navigation]);

    useEffect(() => {
        // Initialize local state when the relevant global state changes (e.g., when currentAction changes)
        console.log(`in useEffect: setting ${state.current.input}`)
        setInputValue(state.current.input);
    }, [state.current.input, state.current.gameQueue.length]);

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
        setInputValue(isTransition ? '' : text);

        const result = validatePreflopActionSegments(text);
        if (result.error) {
            console.log(result);
        }
        if (result.isValid && inputError || (!result.isValid && inputError && !result.flagErrorToUser)) {
            setInputError('');
        }
        if (result.error && result.flagErrorToUser && !result.isValid) {
            setInputError(result.error);
        }
        const isAddAction = text.endsWith(',');
        let type: DispatchActionType;

        if (isTransition) {
            type = DispatchActionType.kTransition;
            dispatch({ type, payload: { input: text } });
        } else if (isAddAction && (state.current.currentAction.actionType !== ActionType.kCommunityCard && state.current.currentAction.actionType !== ActionType.kVillainCards)) {
            type = DispatchActionType.kAddAction;
            dispatch({ type, payload: { input: text } });
        } else {
        }
    };

    async function saveHand() {
        const result = await saveHandToSupabase(state.current, gameInfo);
        console.log(result, 'result')
        return result.handId
    }
    const goToDetailPage = () => {
        router.replace(`/${savedId}`);
        setIsLoading(false)
        // setIsTransitioning(false);
    }
    useEffect(() => {
        if (state.current.stage === Stage.Showdown) {
            setIsLoading(true)
            saveHand().then((id) => {
                setSavedId(id);
            });
        }
    }, [state.current.stage])

    useEffect(() => {
        if (state.current.playerActions.length > 0) {
            // Use setTimeout to ensure layout is updated before scrolling
            setTimeout(() => {
                scrollViewRef.current?.scrollToEnd({ animated: true });
            }, 100);
        }
    }, [state.current.playerActions.length]);

    const handleUndo = () => {
        if (state.history.isEmpty()) {
            setInputValue('');
            setInputError('');
        } else {
            dispatch({ type: DispatchActionType.kUndo, payload: {} });    
        }
    };
    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>

            {isLoading && (
                <View style={styles.successContainer}>
                    <SuccessAnimation visible={isLoading} onAnimationComplete={goToDetailPage} />
                </View>
            )}
            {!isLoading && <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === "ios" ? "padding" : undefined} // Often disable behavior prop on Android
                // or sometimes behavior={Platform.OS === "ios" ? "padding" : "height"} // Incorrect - height doesn't work on Android
                // or conditionally enable the whole component:
                enabled={Platform.OS === "ios"}
                keyboardVerticalOffset={Platform.OS === "ios" ? headerHeight : 0} // Example offset for iOS header
            >
                <View style={{
                    alignItems: 'center',
                    marginInline: 6,
                    marginTop: 12,
                    flexDirection: 'row',
                    justifyContent: 'space-between'
                }}>
                    <Text style={styles.potText} onPress={() => dispatch({ type: DispatchActionType.kReset, payload: {} })}>
                        Eff: ${calculateEffectiveStack(state.current.actionSequence.map(a => a.position), state.current.stacks)}
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
                </ScrollView>

                {/* Input container remains visually at the bottom, pushed by KAV */}
                {state.current.stage !== Stage.Showdown && (
                    <SafeAreaView style={[styles.inputContainer]}>
                        <Text variant='labelLarge' style={styles.instructionText}>{inputError ? inputError : (state.current.currentAction?.placeholder || 'Enter value...')}</Text>
                        <TextInput
                            mode="outlined"
                            // label={state.current.currentAction?.placeholder || ''}
                            // label={inputError ? inputError : (state.current.currentAction?.placeholder || 'Enter value...')}
                            placeholderTextColor={inputError ? theme.colors.error : undefined} // Make error placeholder red (optional)
                            activeOutlineColor={inputError ? theme.colors.error : '#000000'}
                            onChangeText={handleInputChange}
                            // submitBehavior={'newline'}
                            value={inputValue}
                            style={styles.input}
                            dense={true}
                            autoFocus
                            blurOnSubmit={false}
                            returnKeyType="next"
                            onSubmitEditing={() => {
                                console.log(state.current.input);
                            }}
                            right={<TextInput.Icon icon="undo-variant" onPress={handleUndo} forceTextInputFocus={true} />}
                        />
                    </SafeAreaView>
                )}
            </KeyboardAvoidingView>}
        </View>
    );
}


function isMuck(text: string): boolean {
    return text.toLowerCase().trim() === "muck";
}

function calculateEffectiveStack(
    positionsLeft: string[],
    stacks: { [position: string]: number }
): number {
    // 1. Map the list of positions directly to their stack sizes
    //    (Assumes every position exists in stacks and the value is a number)
    const relevantStacks = positionsLeft.map(position => stacks[position]);
    // console.log(`${positionsLeft.join(', ')} : ${relevantStacks.join(', ')}`)
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
    currentBetFacing: number,
    playerStack: number,
    playerAction: PlayerAction) {
    if (logging) {
        console.log(`${playerAction.position} stack sz before action: ${playerStack}`)
    }
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
            amountToAdd = Math.min(amountToAdd, playerStack);

            // Their total commitment matches the facing bet
            newPlayerBetTotal = alreadyBet + amountToAdd;
            break;
        case Decision.kAllIn:
            // Calculate how much more is going in NOW compared to what's already bet
            const amountGoingInNow = playerStack - alreadyBet;
            amountToAdd = Math.max(0, amountGoingInNow); // Ensure non-negative

            // Player's total commitment this street after the all-in
            newPlayerBetTotal = alreadyBet + amountToAdd;
            // The bet level facing others is the MAX of the previous facing bet
            // and the total amount this player just committed.
            newCurrentBetFacing = Math.max(currentBetFacing, newPlayerBetTotal);
            break;
        case Decision.kCheck:
        case Decision.kFold:
            amountToAdd = 0;
            break;
    }
    if (logging) {
        console.log(`${playerAction.position} ~ amountToAdd: ${amountToAdd}, newPlayerBetTotal: ${newPlayerBetTotal}, newCurrentBetFacing: ${newCurrentBetFacing}`)
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
function getNewActionSequence(stage: Stage, playerActions: PlayerAction[], sequence: PlayerStatus[]): PlayerStatus[] {
    // 1. Filter actions for the relevant stage and remove players who folded
    const foldedOutPlayers = playerActions.filter(action => action.stage === stage && action.decision === Decision.kFold).map(a => a.position);

    const activeActions = playerActions
        .filter(action => action.stage === stage && action.decision !== Decision.kFold);
    const filteredActiveActions = activeActions.filter(a => !foldedOutPlayers.includes(a.position));
    const allInPlayers = sequence.filter(s => s.isAllIn);
    const allInPlayersPositions = allInPlayers.map(s => s.position);

    const positions: PlayerStatus[] = [...allInPlayers, ...filteredActiveActions.map(action => ({ position: action.position, isAllIn: allInPlayersPositions.includes(action.position) }))];
    const uniquePositionsSet = new Set<string>();
    const uniquePositions: PlayerStatus[] = [];
    positions.forEach(p => {
        if (!uniquePositionsSet.has(p.position)) {
            uniquePositionsSet.add(p.position);
            uniquePositions.push(p);
        }
    })
    return uniquePositions.sort((a, b) => positionToRank(a.position) - positionToRank(b.position));
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

function formatHeroHand(hero: { position: string, hand: string }): PokerPlayerInput {
    return {
        playerId: hero.position,
        holeCards: [hero.hand.slice(0, 2), hero.hand.slice(2)]
    }
}

function getVillainCards(inputCards: string, playerId: Position): PokerPlayerInput {
    const thirdCard = inputCards[2];
    const formattedCards = transFormCardsToFormattedString(isSuit(thirdCard) ? convertRRSS_to_RSRS(inputCards) : inputCards);
    const card1 = formattedCards.slice(0, 2);
    const card2 = formattedCards.slice(2);
    return { playerId, holeCards: [card1, card2] }
}

function getCards(communityCards: string[], currentDeck: string[], newCards: string) {
    const EMPTY_CARD = '';
    let deckToPickFrom = currentDeck;
    let cardsToAdd: string[] = newCards.length > 2 ? parseFlopString(newCards) : [newCards]
    for (let i = 0; i < communityCards.length; i++) {
        if (communityCards[i] === EMPTY_CARD) {
            const newCard = getSuitForCard(cardsToAdd.shift() as string, deckToPickFrom);
            deckToPickFrom = filterNewCardsFromDeck(newCard, deckToPickFrom);
            communityCards[i] = newCard;
            if (cardsToAdd.length === 0) {
                return communityCards;
            }
        }
    }
    return communityCards.map(c => `${c[0].toUpperCase()}${c[1].toLowerCase()}}`);
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
        case Decision.kAllIn:
            return `all-in for ${amountStr}`
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
    button: {
        borderRadius: 4,
        minHeight: 40,
        padding: 2
    },
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
        // borderTopWidth: 1,
        // borderTopColor: 'red',
        paddingHorizontal: 8,
        marginTop: 0,
        paddingVertical: 0,
        paddingBottom: Platform.OS === 'ios' ? 3 : 6,
        flexDirection: 'column',
    },
    input: {
        // flex: 1,
        // minHeight: 42
    },
    instructionText: {
        // --- Reduce margin ---
        marginBottom: 4, // Reduced from 6
        // marginTop: 0,
        marginLeft: 4,
        // textAlign: 'center',
        // fontWeight: '500',
        // position: 'relative',
        // bottom: 4, left: 4
        // You could also force a smaller font size:
        // fontSize: 12,
    },
    successContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
});
