import React, { useReducer, useRef, useState, useEffect, useLayoutEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import ActionList from '../../components/ActionList';
import GameInfo from '../../components/GameInfo';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActionType, Decision, DispatchActionType, Stage, HandSetupInfo, Position, GameQueueItemType } from '@/types';
import { CommunityCards } from '@/components/Cards';
import { numPlayersToActionSequenceList } from '@/constants';
import { calculateEffectiveStack} from '@/utils/hand_utils';
import { useTheme } from 'react-native-paper';
import { useHeaderHeight } from '@react-navigation/elements';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import HeroHandInfo from '@/components/HeroHandInfo';
import { saveHandToSupabase } from '@/api/hands';
import SuccessAnimation from '@/components/AnimatedSuccess';
import { getLastAction, getPlayerAction, getUpdatedBettingInfo } from '@/utils/action_utils';
import { createInitialAppState, initialAppState, reducer } from '@/reducers/add_hand_reducer';
import { assertIsDefined } from '@/utils/assert';
import AnimatedInstructionText from '@/components/AnimatedInstructionText';

export default function App() {
    const { data }: { data: string } = useLocalSearchParams();
    const gameInfo: HandSetupInfo = JSON.parse(data);

    // State
    const [state, dispatch] = useReducer(reducer, initialAppState, (arg) => createInitialAppState(arg, gameInfo));
    const [isLoading, setIsLoading] = useState(false);
    const [savedId, setSavedId] = useState('');
    const [inputError, setInputError] = useState('');
    const [inputValue, setInputValue] = useState('');

    // Hooks
    const theme = useTheme();
    const headerHeight = useHeaderHeight();
    const navigation = useNavigation();
    const router = useRouter();
    const scrollViewRef = useRef<ScrollView>(null);
    const VALID_POSITIONS = numPlayersToActionSequenceList[gameInfo.numPlayers];
    const VALID_ACTIONS = Object.values(Decision);

    // Effects
    useLayoutEffect(() => {
        navigation.setOptions({
            headerLeft: () => <GameInfo info={gameInfo} />,
            headerRight: () => <HeroHandInfo info={gameInfo} />,
        });
    }, [navigation]);

    useEffect(() => {
        // Initialize local state when the relevant global state changes (e.g., when currentAction changes)
        setInputValue(state.current.input);
    }, [state.current.input, state.current.gameQueue.length, state.current.playerActions.length]);

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

    const isInputValid = useCallback((input: string) => {

        const isAlphanumeric = /^[a-zA-Z0-9]+$/;
        const disallowedChars = /[deikmnpqvwyzDEIKMNPQVWYZ]/;
        return isAlphanumeric.test(input) && !disallowedChars.test(input);

    }, []);

    const validateSegment = useCallback((input: string) => { 
        // todo add handling for all inputs
        if (state.current.stage !== Stage.Preflop) {
            return { isValid: true };
        }
        if (!input || input.trim() === '') {
            return { isValid: true };
        }
        if (input.trim() === ',' || input.trim() === '.') {
            return { isValid: false, error: `Incomplete segment`, flagErrorToUser: true };

        }
        const segment = ((input.endsWith('.') || input.endsWith(',')) ? input.slice(0, -1) : input).toUpperCase().trim();
        if (segment.length < 2) {
            if (!isInputValid(segment)) {
                return { isValid: false, error: `Invalid character detected`, flagErrorToUser: true };

            }
            return { isValid: false, error: `Incomplete segment: "${segment}"`, flagErrorToUser: false };
        }
        switch (state.current.currentAction.id) {
            case GameQueueItemType.kPreflopAction: {
                const parts = segment.split(' ').map(p => p.trim()).filter(p => p !== '');
                
                if (parts.some(part => !isInputValid(part))) {
                    return { isValid: false, error: `Invalid character detected`, flagErrorToUser: true };
                }

                const position = parts[0] as Position;
                const action = parts[1] as Decision;
                const amount = parts.length > 2 ? Number(parts[2]) : 0;

                if (!VALID_POSITIONS.includes(position)) {
                    return {
                        isValid: false,
                        error: `Invalid Pos: "${position}", (Valid: ${VALID_POSITIONS.join(', ')})`,
                        flagErrorToUser: true
                    };
                }
                if (!VALID_ACTIONS.includes(action)) {
                    return { isValid: false, error: `Invalid action: "${action}", (Valid: ${VALID_ACTIONS.map(a => a.toLowerCase()).join(', ')})`, flagErrorToUser: parts.length >= 2 };
                }

                // TODO handle multiple raises
                if ((action === Decision.kRaise || action === Decision.kBet) && (!amount || isNaN(Number(amount)) || Number(amount) <= 0)) {
                    return { isValid: false, error: `Invalid amount for ${action}: "${amount || ''}" in segment "${segment}"`, flagErrorToUser: parts.length > 2 };
                }
                if ((action === Decision.kRaise || action === Decision.kBet)) {
                    assertIsDefined(state.current.stacks[position]);
                    if (amount > state.current.stacks[position]) {
                        return { isValid: false, error: `Invalid amount for ${position}. Stack: ${state.current.stacks[position]}`, flagErrorToUser: parts.length > 2 };
                    }
                }
                if ((action === Decision.kCall || action === Decision.kFold) && amount) {
                    return { isValid: false, error: `Amount not allowed for ${action} in segment "${segment}"`, flagErrorToUser: true };
                }
            }
            default:
                console.log('in default case')
                return { isValid: true };
        }
    }, [[state.current.playerActions?.length]]);

    const handleInputChange = (text: string) => {
        // console.log('in handleInputChange with, ', text, ' : ', text.length)

        // ignore extra characters typed when error is present.
        if (inputError && text > inputValue) {
            return;
        }

        // check ordering here
        setInputValue(text)
        let result = validateSegment(text);
        if (result.isValid && inputError || (inputError && !result.flagErrorToUser)) {
            setInputError('');
        }
        if (result.error && result.flagErrorToUser && !result.isValid) {
            setInputError(result.error);
        }
        if (!result.isValid) {
            return;
        }

        let type: DispatchActionType;
        const isAddAction = text.endsWith(',');
        const isTransition = text.endsWith('.');
        if (isTransition) {
            type = DispatchActionType.kTransition;
            dispatch({ type, payload: { input: text } });
            // Update this else/if since cards should always use "."
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

    const handleUndo = () => {
        if (state.history.isEmpty()) {
            setInputValue('');
            setInputError('');
        } else {
            dispatch({ type: DispatchActionType.kUndo, payload: {} });
        }
    };

    const computePlaceholderText = () => { 
        if (inputError) {
            return inputError;
        }
        switch (state.current.currentAction.id) {
            case GameQueueItemType.kFlopAction: {
                return `${state.current.actionSequence[0].position} to act`
            }
            default:
                return state.current.currentAction?.placeholder;
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
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                enabled={Platform.OS === "ios"}
                keyboardVerticalOffset={Platform.OS === "ios" ? headerHeight : 0}
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
                <ScrollView
                    ref={scrollViewRef}
                    style={styles.content}
                    contentContainerStyle={styles.contentContainer}
                    keyboardShouldPersistTaps="handled"
                >
                    {state.current.stage !== Stage.Showdown && (
                        <ActionList
                            actionList={state.current.playerActions}
                            potForStreetMap={state.current.potForStreetMap}
                            currentStage={state.current.stage}
                        />
                    )}
                </ScrollView>
                {state.current.stage !== Stage.Showdown && (
                    <SafeAreaView style={[styles.inputContainer]}>
                         <AnimatedInstructionText
                             text={computePlaceholderText()}
                             style={styles.instructionText}
                             variant="labelLarge"
                         />
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
    keyboardAvoidingContainer: {
        flex: 1,
    },
    content: {
        flex: 1,
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
        paddingHorizontal: 8,
        marginTop: 0,
        paddingVertical: 0,
        paddingBottom: Platform.OS === 'ios' ? 3 : 6,
        flexDirection: 'column',
    },
    input: {
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

// wip preflop validation
// if (input.endsWith('.')) {
//     const {
//         preflopSequence,
//         stage,
//         currentBetFacing,
//         betsThisStreet,
//     } = state.current;
//     const nextPlayerToActPos = preflopSequence ? preflopSequence[0].position : '';
//     const playerAction = getPlayerAction(nextPlayerToActPos, getLastAction(input), stage, 0);
//     const playerPos = playerAction.position;
//     const currentStack = state.current.stacks[playerAction.position] as number;
//     const { newPlayerBetTotal } =
//         getUpdatedBettingInfo(betsThisStreet, currentBetFacing, currentStack, playerAction)
//     const updatedBetsThisStreet = {
//         ...betsThisStreet,
//         [playerPos]: newPlayerBetTotal,
//     };
//     const bets: number[] = [];
//     Object.entries(updatedBetsThisStreet).forEach(([pos, val]) => {
//         let match = preflopSequence?.find(p => p.position === pos);
//         if (match && match.hasActed) {
//             bets.push(val);
//         }
//     });
//     const num = Math.max(...bets);
//     const valid = bets.every(bet => bet === num)
//     if (!valid) {
//         return { isValid: false, error: `invalid`, flagErrorToUser: true };
//     }
// }