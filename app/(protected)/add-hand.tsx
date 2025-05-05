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
import { getLastAction, getNewActionSequence, getNumBetsForStage, getPlayerAction, getPlayerActionsWithAutoFolds, getUpdatedBettingInfo, hasActionBeenAddedAlready, removeAfterLastComma } from '@/utils/action_utils';
import { createInitialAppState, initialAppState, reducer } from '@/reducers/add_hand_reducer';

export default function App() {
    const { data }: { data: string } = useLocalSearchParams();
    const gameInfo: HandSetupInfo = JSON.parse(data);
    const [state, dispatch] = useReducer(reducer, initialAppState, (arg) => createInitialAppState(arg, gameInfo));
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
            const nextPlayerToActPos = preflopSequence ? preflopSequence[0].position : '';
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
        marginBottom: 4,
        marginLeft: 4,
    },
    successContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
});
