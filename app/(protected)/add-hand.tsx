import React, { useReducer, useRef, useState, useEffect, useLayoutEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import ActionList from '../../components/ActionList';
import GameInfo from '../../components/GameInfo';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActionType, ActionTextToken, Decision, DispatchActionType, GameState, PlayerAction, Position, Stage, GameQueueItem, PlayerStatus, GameQueueItemType, PokerPlayerInput, WinnerInfo, HandSetupInfo, GameAppState } from '@/types';
import { CommunityCards } from '@/components/Cards';
import { numPlayersToActionSequenceList } from '@/constants';
import { calculateEffectiveStack, formatHeroHand, getInitialGameState, moveFirstTwoToEnd, parseStackSizes} from '@/utils/hand_utils';
import { determinePokerWinnerManual } from '@/utils/hand_evaluator';
import { useTheme } from 'react-native-paper';
import { ImmutableStack } from '@/utils/immutable_stack';
import { useHeaderHeight } from '@react-navigation/elements';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import HeroHandInfo from '@/components/HeroHandInfo';
import { saveHandToSupabase } from '@/api/hands';
import SuccessAnimation from '@/components/AnimatedSuccess';
import { AddVillainsToGameQueue, didAllInAndACallOccurOnStreet, filterNewCardsFromDeck, formatCommunityCards, getCards, getRemainingCardActions, getVillainCards, isMuck, parsePokerHandString } from '@/utils/card_utils';
import { getNewActionSequence, getNumBetsForStage, getPlayerActionsWithAutoFolds, getUpdatedBettingInfo, hasActionBeenAddedAlready, removeAfterLastComma } from '@/utils/action_utils';

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
            const nextPlayerToActIndex = currentGameState.actionSequence.findIndex(a => !a.isAllIn);
            const playerToAct = currentGameState.actionSequence[nextPlayerToActIndex] as PlayerStatus

            const playerAction = getPlayerAction(playerToAct.position, getLastAction(action.payload.input), state.current.stage, currentGameState.playerActions.length + 1)
            // TODO, add this to transition?
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
            playerAction.amount = newPlayerBetTotal;
            playerAction.potSizeBefore = currentGameState.pot;
            playerAction.playerStackBefore = currentStack;
            // Calculate the player's new stack size
            const newStackSize = currentStack - amountToAdd;

            playerAction.text = getMeaningfulTextToDisplay(
                playerAction,
                getNumBetsForStage(state.current.playerActions, state.current.stage),
                state.current.stage);

            let newActionSequence: PlayerStatus[] = [...state.current.actionSequence];
            let intermediateList = state.current.stage === Stage.Preflop ? [] : undefined;
            if (state.current.stage !== Stage.Preflop) {
                const remainingPlayers = [...state.current.actionSequence.slice(0, nextPlayerToActIndex), ...state.current.actionSequence.slice(nextPlayerToActIndex + 1)]
                const addPlayerBack = playerAction.decision !== Decision.kFold;
                const isAllIn = playerAction.decision === Decision.kAllIn || newStackSize === 0;
                newActionSequence = [
                    ...remainingPlayers,
                    ...(addPlayerBack ? [{ position: actingPlayer, isAllIn }] : [])
                ];
            } else {
                const actionIndex = currentGameState.preflopSequence.findIndex(({ position }) => playerAction.position === position);
                const p = currentGameState.preflopSequence[actionIndex];
                intermediateList = [...currentGameState.preflopSequence.slice(actionIndex + 1)];
                const isAllIn = playerAction.decision === Decision.kAllIn || newStackSize === 0;
                const addPlayerBack = playerAction.decision !== Decision.kFold && !isAllIn;
                if (addPlayerBack) {
                    intermediateList.push({ ...p, hasActed: true })
                    // hasActed
                }
            }
            // Pre-flop: Action sequence is handled differently, often based on who is left
            // after the betting round, so we don't modify it here per-action.
            // It gets recalculated during the transition from Preflop.
            const addActionState: GameState = {
                ...state.current,
                input: action.payload.input,
                playerActions: newPlayerActions,
                actionSequence: newActionSequence,
                preflopSequence: intermediateList,
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
                    propertyUpdates.showdownHands = hands;
                }
            } else if (action.payload.input.trim().length > 1) {
                const currentGameState = state.current;
                const nextPlayerToActIndex = currentGameState.actionSequence.findIndex(a => !a.isAllIn);
                const playerToAct = currentGameState.actionSequence[nextPlayerToActIndex] as PlayerStatus
                const playerAction = getPlayerAction(playerToAct.position, getLastAction(action.payload.input), currentGameState.stage, currentGameState.playerActions.length + 1)
                // Used to display a divider between stages in action list.
                // playerAction.id = getIdForPlayerAction(playerAction, ++currentGameState.playerActions.length);
                playerAction.isLastActionForStage = initialStage !== nextStage;
                const playerPos = playerAction.position;
                const currentStack = state.current.stacks[playerAction.position];
                const { amountToAdd, newPlayerBetTotal, newCurrentBetFacing } =
                    getUpdatedBettingInfo(currentState.betsThisStreet, currentState.currentBetFacing, currentStack, playerAction)
                playerAction.amount = newPlayerBetTotal;
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
                if (allInAndACall) {
                    finalState.gameQueue = getRemainingCardActions(finalState.gameQueue)
                    if (!finalState.currentAction) {
                        finalState.stage = Stage.Showdown;
                    }
                } else {
                    finalState.stage = Stage.Showdown;
                }
            }
            const newHistory = state.history.push(currentState);
            const newTransitionState = {
                current: { ...finalState },
                history: newHistory,
            }
            return newTransitionState;
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

const initialAppState: GameAppState = {
    current: getInitialGameState(),
    history: ImmutableStack.create<GameState>([getInitialGameState()]),
};

export default function App() {
    const { data }: { data: string } = useLocalSearchParams();
    const gameInfo: HandSetupInfo = JSON.parse(data);
    const [state, dispatch] = useReducer(reducer, initialAppState, (state) => {
        const { position, hand, smallBlind, bigBlind, relevantStacks } = gameInfo;
        const actionSequence = numPlayersToActionSequenceList[gameInfo.numPlayers];
        const upperCasedHand = hand.toUpperCase();
        const initialPlayerStatuses: PlayerStatus[] = actionSequence.map((position: Position) => ({
            position,
            isAllIn: false,
        }));
        const initialSequence = moveFirstTwoToEnd(initialPlayerStatuses);
        const initialGameState: GameState = {
            ...state.current,
            actionSequence: initialSequence,
            preflopSequence: initialSequence.map(s => ({ ...s, hasActed: false })),
            pot: smallBlind + bigBlind,
            hero: { position, hand: parsePokerHandString(upperCasedHand) },
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
        return {
            current: { ...initialGameState },
            history: state.history,
        };
    });
    const [isLoading, setIsLoading] = React.useState(false);
    const [savedId, setSavedId] = React.useState('');
    const [inputError, setInputError] = React.useState('');
    const theme = useTheme();
    const headerHeight = useHeaderHeight();
    const navigation = useNavigation();
    const router = useRouter();
    const [inputValue, setInputValue] = useState('');
    const scrollViewRef = useRef<ScrollView>(null);
    const VALID_POSITIONS = numPlayersToActionSequenceList[gameInfo.numPlayers];
    const VALID_ACTIONS = Object.values(Decision);

    const isInputValid = useCallback((input: string) => {

        const isAlphanumeric = /^[a-zA-Z0-9]+$/;
        const disallowedChars = /[deikmnpqvwyzDEIKMNPQVWYZ]/;
        return isAlphanumeric.test(input) && !disallowedChars.test(input);

    }, []);

    const validatePreflopActionSegments = useCallback((input: string) => {

        // handle: Co r 20.
        if (!input || input.trim() === '') {
            return { isValid: true }; // Or handle empty input as needed
        }

        if (input.endsWith('.')) {
            // need pos for preflop
            const {
                preflopSequence,
                stage,
                currentBetFacing,
                betsThisStreet,
            } = state.current;
            const nextPlayerToActPos = preflopSequence ? preflopSequence[0].position : '' // .findIndex(a => !a.isAllIn)
            const playerAction = getPlayerAction(nextPlayerToActPos, getLastAction(input), stage)
            const playerPos = playerAction.position;
            const currentStack = state.current.stacks[playerAction.position];
            const { newPlayerBetTotal } =
                getUpdatedBettingInfo(betsThisStreet, currentBetFacing, currentStack, playerAction)
            const updatedBetsThisStreet = {
                ...betsThisStreet,
                [playerPos]: newPlayerBetTotal,
            };
            const bets: number[] = [];
            Object.entries(updatedBetsThisStreet).forEach(([pos, val]) => {
                let match = preflopSequence?.find(p => p.position === pos);
                if (match && match.hasActed) {
                    bets.push(val);
                }
                // values(updatedBetsThisStreet || 0);
            });
            const num = Math.max(...bets);
            const valid = bets.every(bet => bet === num)
            if (!valid) {
                return { isValid: false, error: `invalid`, flagErrorToUser: true };
            }
        }

        // how should i validate multiple actions, most recent action or entire sequence?
        // if ends with . i need to validate sequence

        const segments = (input.endsWith('.') ? input.slice(0, -1) : input).toUpperCase().split(',').map(s => s.trim()).filter(s => s !== '');
        for (const segment of segments) {
            const parts = segment.split(' ').map(p => p.trim()).filter(p => p !== '');
            // maybe do this only when segment len == 1
            if (parts[0].length < 2 && parts.length < 2) {
                return { isValid: false, error: `Incomplete segment: "${segment}"`, flagErrorToUser: false };
            }

            const position = parts[0];
            const action = parts[1];
            const amount = parts.length > 2 ? parts[2] : null;


            // validate amounts and action sequence
            // Validate Position
            if (!VALID_POSITIONS.includes(position)) {
                return {
                    isValid: false,
                    error: `Invalid Pos: "${position}", (Valid: ${VALID_POSITIONS.join(', ')})`,
                    flagErrorToUser: true
                };
            }
            // Validate Action
            if (!VALID_ACTIONS.includes(action)) {
                return { isValid: false, error: `Invalid action: "${action}", (Valid: ${VALID_ACTIONS.map(a => a.toLowerCase()).join(', ')})`, flagErrorToUser: parts.length >= 2 };
            }

            // Validate Amount (if applicable for the action)
            // TODO handle multiple raises
            if ((action === Decision.kRaise || action === Decision.kBet) && (!amount || isNaN(Number(amount)) || Number(amount) <= 0)) {
                return { isValid: false, error: `Invalid amount for ${action}: "${amount || ''}" in segment "${segment}"`, flagErrorToUser: parts.length > 2 };
            }
            if ((action === Decision.kRaise || action === Decision.kBet)) {
                if (amount > state.current.stacks[position]) {
                    return { isValid: false, error: `Invalid amount for ${position}. Stack: ${state.current.stacks[position]}`, flagErrorToUser: parts.length > 2 };
                }
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
    }, [state.current.playerActions?.length]);

    useLayoutEffect(() => {
        navigation.setOptions({
            headerLeft: () => <GameInfo info={gameInfo} />,
            headerRight: () => <HeroHandInfo info={gameInfo} />,
        });
    }, [navigation]);

    useEffect(() => {
        // Initialize local state when the relevant global state changes (e.g., when currentAction changes)
        setInputValue(state.current.input);
    }, [state.current.input, state.current.gameQueue.length]);

    const handleInputChange = (text: string) => {
        if (inputError && text > inputValue) {
            return;
        }
        const isTransition = text.endsWith('.');
        setInputValue(text)
        let result: {
            isValid: boolean;
            error?: string | undefined;
            flagErrorToUser?: boolean | undefined;
        } = { isValid: true, error: '', flagErrorToUser: false }
        if (state.current.stage === Stage.Preflop) {

            result = validatePreflopActionSegments(text);
        }
        if (result.isValid && inputError || (inputError && !result.flagErrorToUser)) {
            setInputError('');
        }
        if (result.error && result.flagErrorToUser && !result.isValid) {
            setInputError(result.error);
        }
        const isAddAction = text.endsWith(',');
        let type: DispatchActionType;
        if (!result.isValid) {
            return;
        }
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
        return result.handId
    }
    const goToDetailPage = () => {
        router.replace(`/${savedId}`);
        setIsLoading(false)
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
                            placeholderTextColor={inputError ? theme.colors.error : undefined} // Make error placeholder red (optional)
                            activeOutlineColor={inputError ? theme.colors.error : '#000000'}
                            onChangeText={handleInputChange}
                            value={inputValue}
                            style={styles.input}
                            dense={true}
                            autoFocus
                            blurOnSubmit={false}
                            returnKeyType="next"
                            onSubmitEditing={() => {}}
                            right={<TextInput.Icon icon="undo-variant" onPress={handleUndo} forceTextInputFocus={true} />}
                        />
                    </SafeAreaView>
                )}
            </KeyboardAvoidingView>}
        </View>
    );
}

function getPlayerAction(playerToAct: string, mostRecentActionText: string, stage: Stage, len: number): PlayerAction {
    const actionInfo = parseAction(mostRecentActionText, playerToAct);
    return buildBasePlayerAction(actionInfo, stage, len);
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

function getIdForPlayerAction(action: PlayerAction, len: number): string {
    return `${action.position}-${action.decision}-${action.amount}-${action.stage}-${len}`;
}

function buildBasePlayerAction(actionInfo: ActionTextToken, stage: Stage, len: number): PlayerAction {
    const action: PlayerAction = { text: '', stage, isLastActionForStage: false, shouldHideFromUi: false, ...actionInfo, id: '' };
    action.id = getIdForPlayerAction(action, len);
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
