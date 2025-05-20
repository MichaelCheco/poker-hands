import React, { useReducer, useRef, useState, useEffect, useLayoutEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import ActionList from '../../components/ActionList';
import GameInfo from '../../components/GameInfo';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActionType, Decision, DispatchActionType, Stage, HandSetupInfo, Position, GameQueueItemType, ValidationFunction, GameState, ValidationResult, PlayerStatus } from '@/types';
import { CommunityCards } from '@/components/Cards';
import { numPlayersToActionSequenceList } from '@/constants';
import { calculateEffectiveStack, decisionToText, isPreflop } from '@/utils/hand_utils';
import { useTheme } from 'react-native-paper';
import { useHeaderHeight } from '@react-navigation/elements';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import HeroHandInfo from '@/components/HeroHandInfo';
import { saveHandToSupabase } from '@/api/hands';
import SuccessAnimation from '@/components/AnimatedSuccess';
import { getLastAction, getPlayerAction, getUpdatedBettingInfo, isAggressiveAction, isPassiveAction } from '@/utils/action_utils';
import { createInitialAppState, initialAppState, reducer } from '@/reducers/add_hand_reducer';
import { assertIsDefined } from '@/utils/assert';
import AnimatedInstructionText from '@/components/AnimatedInstructionText';

const VALID_ACTIONS = Object.values(Decision);

function getPartsFromSegment(segment: string): string[] {
    return segment.split(' ').map(p => p.trim()).filter(p => p !== '')
}

function getSegment(inputValue: string) {
    return ((inputValue.endsWith('.') || inputValue.endsWith(',')) ? inputValue.slice(0, -1) : inputValue).toUpperCase().trim();
}
const isAlphanumeric = /^[a-zA-Z0-9]+$/;
const disallowedChars = /[eimnpvwyzEIMNPVWYZ]/;

const validateInputCharacters: ValidationFunction = (input) => {
    const text = getSegment(input).split(' ').join('').trim();
    if (!(isAlphanumeric.test(text) && !disallowedChars.test(text))) {
        return {
            isValid: false,
            error: `Invalid character detected`,
        };
    }
    return { isValid: true };
}

const validatePosition: ValidationFunction = (input, state) => {
    const parts = getPartsFromSegment(getSegment(input));
    const position = parts[0] as Position;
    // console.log('in validate position with ', parts, position)
    // try to run this only once
    const VALID_POSITIONS = numPlayersToActionSequenceList[Object.keys(state.stacks).length];
    const VALID_POS_STARTS = VALID_POSITIONS.map(p => p[0]);
    console.log(VALID_POS_STARTS)
    if (!isPreflop(state.stage) && !VALID_ACTIONS.map(a => a.toLowerCase()).includes(parts[0].toLowerCase().trim())) {
        return { isValid: false, error: 'Position can be omitted Postflop' }
    }
    if (!isPreflop(state.stage)) { return { isValid: true } }
    // Special case UTG
    if (position.length < 2) {
        if (!VALID_POS_STARTS.includes(position)) {
            return {
                isValid: false,
                error: `Invalid position: "${position}", (Valid: ${VALID_POSITIONS.join(', ')})`,
            };
        }
        return { isValid: true }
    }
    if (!VALID_POSITIONS.includes(position) && position !== "UT") {
        return {
            isValid: false,
            error: `Invalid position: "${position}", (Valid: ${VALID_POSITIONS.join(', ')})`,
        };
    }
    return { isValid: true };
}

const formattedCard = (card: string) => `${card[0]}${card[1].toLowerCase()}`;

const validateDecision: ValidationFunction = (input, { stage }) => {
    const parts = getPartsFromSegment(getSegment(input));
    const decision = parts[stage === Stage.Preflop ? 1 : 0] as Decision;
    if (!decision) {
        return { isValid: true }
    }
    // should this be conditionally added based on # of parts?
    if (!VALID_ACTIONS.includes(decision)) {
        return { isValid: false, error: `Invalid action: "${decision}", (Valid: ${VALID_ACTIONS.map(a => a.toLowerCase()).join(', ')})` };
    }
    return { isValid: true }
}

const getPlayerFromActionSequence = (players: PlayerStatus[], player: Position) => players.find(p => p.position === player);
// TODO validate 3rd part


const validateHeroInAction: ValidationFunction = (input, { playerActions, hero: { position } }) => {
    const isSequenceComplete = input.endsWith('.');
    if (!isSequenceComplete) { return { isValid: true } };
    if (!playerActions.some((action => action.position === position))) {
        return {isValid: false, error: 'Hero must be in action sequence'}
    }
    return { isValid: true };
}

const validateAction: ValidationFunction = (input, state) => {
    const isCompleteSegment = input.endsWith(',') || input.endsWith('.');
    const { playerActions, betsThisStreet, actionSequence, lastRaiseAmount, currentBetFacing, numberOfBetsAndRaisesThisStreet, stage, stacks, bigBlind, playerWhoMadeLastAggressiveAction } = state;
    // console.log(`validateAction: last raise $ - ${lastRaiseAmount} || # bets ${numberOfBetsAndRaisesThisStreet}`)
    const segment = getSegment(input);
    // console.log(input, ' - ', segment)
    const parts = getPartsFromSegment(segment);
    const nextPlayerToActPos = stage === Stage.Preflop
        ? parts[0]
        : actionSequence.find(a => !a.isAllIn)?.position;
    assertIsDefined(nextPlayerToActPos);
    const { decision, position, amount } = getPlayerAction(nextPlayerToActPos, segment, stage, 0);
    console.log(`parts ::: ${decision} :: `, parts)
    // assertIsDefined(playerInSequence);
    if (parts.length === 1) { 
        return { isValid: true }
    }
    console.log(decisionToText(decision), '==')
    if (playerActions.length > 0 && playerActions[playerActions.length - 1].position === position && numberOfBetsAndRaisesThisStreet > 0) {
        return { isValid: false, error: `${position} can not make consecutive actions` };
    }
    if ((decision === Decision.kCall || decision === Decision.kFold) && amount) {
        return { isValid: false, error: `Amount not allowed for action` };
    }
    if (decision === Decision.kCall) {
        // Valid if currentBetToCall > player[playerTurnSeatIndex].amountInvestedThisStreet.
        const contribution = betsThisStreet[position];
        if (!contribution) {
            return { isValid: true }
        }
        if (!(currentBetFacing > contribution)) {
            return { isValid: false, error: `Current bet: ($${currentBetFacing}) is not greater than ${position}'s contribution: $${contribution}` }
        }
        // handle all-in TODO
    }
    const playerInSequence = getPlayerFromActionSequence(actionSequence, position);
    if (decision === Decision.kFold) {
        if (playerInSequence?.isAllIn) {
            return { isValid: false, error: 'All-in player can not fold' }
        }

    }
    if (amount === 0 && !isCompleteSegment) {
        return { isValid: true }
    }

    if (amount === 0 && isCompleteSegment && isAggressiveAction(decision)) {
        return { isValid: false, error: 'Amount is missing' }
    }
    // console.log(playerInSequence, ' p')

    if ((decision === Decision.kRaise || decision === Decision.kBet) && (!amount || isNaN(Number(amount)) || Number(amount) <= 0)) {
        return { isValid: false, error: `Invalid amount for ${decision}: "${amount || ''}` };
    }
    if ((decision === Decision.kRaise || decision === Decision.kBet) && position === playerWhoMadeLastAggressiveAction) {
        // special case for BB open
        if (isPreflop(stage) && position === Position.BB && numberOfBetsAndRaisesThisStreet === 1) {
            return { isValid: true }
        }
        return { isValid: false, error: `${position} can not make consecutive aggressive actions` };
    }
    assertIsDefined(stacks[position]);
    if (amount > stacks[position]) {
        return { isValid: false, error: `Invalid amount for ${position}. Stack: ${stacks[position]}` };
    }
    switch (decision) {
        case Decision.kBet: {
            if (numberOfBetsAndRaisesThisStreet) {
                return { isValid: false, error: `A bet has already occurred on this street` };
            }
            if (amount < bigBlind && isCompleteSegment) {
                return { isValid: false, error: `Bet amount must be > than BB` };
            }
            break;
        }
        case Decision.kRaise: {
            if (numberOfBetsAndRaisesThisStreet === 0) {
                return { isValid: false, error: `Raise invalid: no bets have been made this street` };
            }
            const minLegalRaise = currentBetFacing + lastRaiseAmount
            if (amount < minLegalRaise && isCompleteSegment) {
                return { isValid: false, error: `Min raise amount: ${minLegalRaise}` };
            }
            // TODO fix this
            // if (!playerInSequence?.canRaise) {
            //     return { isValid: false, error: `Player can not raise` };
            // }
            break;
            // TODO handle this case
            // An exception: If currentBetToCall + lastRaiseAmount is greater than the player's stackSize,
            // they can raise all-in for their entire stack. This might be a "short raise."
        }
        case Decision.kAllIn:
        case Decision.kCall:
        case Decision.kCheck:
        case Decision.kFold:
    }
    // handle all-in?
    // Special case #1 Preflop initial open.
    // if (state.stage === Stage.Preflop) {
    //     const isInitialOpen: boolean = state.playerActions.length === 0;
    //     if (amount < (state.currentBetFacing * 2) && isInitialOpen)
    //         return { isValid: false, error: `Open size must be >= 2BB` };
    // }

    return { isValid: true }
}

// function 
const validateSegment1: ValidationFunction = (input) => {
    if (input.trim() === ',' || input.trim() === '.') {
        return { isValid: false, error: `Incomplete segment` };
    }
    return { isValid: true };
}

const validateAggressiveActionNotEndingWithPeriod: ValidationFunction = (input, state) => {
    const endsWithPeriod = input.endsWith('.');
    const segment = getSegment(input)
    const parts = getPartsFromSegment(segment);
    const nextPlayerToActPos = state.stage === Stage.Preflop
        ? parts[0]
        : state.actionSequence[0].position;
    const playerAction = getPlayerAction(nextPlayerToActPos, segment, state.stage, 0);

    if (isAggressiveAction(playerAction.decision) && endsWithPeriod) {
        return {
            isValid: false,
            error: `Cannot end with '.' after a ${decisionToText(playerAction.decision)}. Others must act.`
        };
    }
    return { isValid: true };
};

// Example: Validate non-aggressive closing action ends with a period
const validateNonAggressiveClosingActionRequiresPeriod: ValidationFunction = (input, state) => {
    return { isValid: true };

    const endsWithPeriod = input.endsWith('.');
    const segment = getSegment(input)
    const parts = getPartsFromSegment(segment);
    const nextPlayerToActPos = state.stage === Stage.Preflop
        ? parts[0]
        : state.actionSequence[0].position;
    const playerAction = getPlayerAction(nextPlayerToActPos, segment, state.stage, 0);
    // isRoundOver(currentState, actionDetails) todo implement this
    if (isPassiveAction(playerAction.decision) && !endsWithPeriod) {
        return {
            isValid: false,
            error: "This action closes the round. Please end with '.' to proceed."
        };
    }
    return { isValid: true };
};

const VALID_SUITS_FOR_DECK = ['S', 'D', 'C', 'H']; // Suits as they appear in the deck

const validateCommunityCards: ValidationFunction = (input, currentState) => {
    const trimmedInput = input.trim();
    const containsPeriod = trimmedInput.includes('.');

    if (!trimmedInput) {
        return { isValid: true }; // Empty input is considered valid for this validator
    }

    // Normalize input for rank/suit extraction.
    // The period is used to determine if full validation is needed.
    // For parsing cards, we consider the segment before the first period.
    const normalizedInputForParsing = trimmedInput.toUpperCase().replace(/\s+/g, '');
    const cardsSegment = containsPeriod
        ? normalizedInputForParsing.substring(0, normalizedInputForParsing.indexOf('.'))
        : normalizedInputForParsing;

    const ranks = (cardsSegment.match(/[2-9TJQKA]/g) || []);
    const suits = (cardsSegment.match(/[SDCHX]/g) || []);

    // 1. Obvious Error: Invalid characters (anything not a rank, suit, or 'x' in the card segment)
    if (cardsSegment.length !== (ranks.length + suits.length)) {
        return { isValid: false, error: 'Invalid characters in cards input.' };
    }

    // 2. If no period and input is very short (e.g., "A" or "AS"), allow user to continue typing.
    // This check is a bit broad and relies on subsequent checks for more specific errors.
    if (!containsPeriod && cardsSegment.length <= 2) {
        // "A" (1 rank, 0 suit, len 1) -> valid while typing
        if (ranks.length === 1 && suits.length === 0 && cardsSegment.length === 1) return { isValid: true };
        // "AS" (1 rank, 1 suit, len 2) -> valid while typing
        if (ranks.length === 1 && suits.length === 1 && cardsSegment.length === 2) return { isValid: true };
        // "AA" (2 ranks, 0 suit, len 2) -> will be handled by rule #3.
    }

    // 3. Rank and Suit count mismatch logic
    if (containsPeriod) {
        // If a period is present, ranks and suits must match exactly.
        if (ranks.length !== suits.length) {
            return { isValid: false, error: 'Ranks and suits count must match when ending with "."' };
        }
    } else {
        // If no period, allow ranks to be ahead of suits (user is typing).
        // An error is only if suits are more than ranks.
        if (suits.length > ranks.length) {
            return { isValid: false, error: 'Invalid card sequence: more suits than ranks.' };
        }
        // If ranks.length >= suits.length and no period, it's provisionally fine.
        // e.g., "2", "23", "2s", "2s3", "2s3d" are fine while typing.
    }

    // 4. Obvious Error: No cards found but card segment is not empty
    if (ranks.length === 0 && cardsSegment !== '') {
        return { isValid: false, error: 'No valid cards found in input.' };
    }
    let numCardsExpected;
    if (currentState.currentAction.id === GameQueueItemType.kVillainCard) {
        numCardsExpected = 2;
    } else {
        numCardsExpected = currentState.stage === Stage.Flop ? 3 : 1;
    }
    // 5. Obvious Error: Too many cards (can be checked early)
    if (ranks.length > numCardsExpected) {
        return { isValid: false, error: `Too many cards, expected ${numCardsExpected}.` };
    }

    // --- If a period is NOT present, and no obvious errors so far, perform LIMITED validation ---
    if (!containsPeriod) {
        const cardsInThisInput: Set<string> = new Set();
        // Iterate only up to the number of available suits for pair-wise validation
        for (let i = 0; i < suits.length; i++) {
            const rank = ranks[i]; // Rank at this index must exist if suits.length > 0 and suits.length <= ranks.length
            const suitInput = suits[i];

            // Check for valid suit characters (S,D,C,H,X)
            if (suitInput !== 'X' && !VALID_SUITS_FOR_DECK.includes(suitInput)) {
                return { isValid: false, error: `Invalid suit: "${suitInput}". Use S,D,C,H,X.` };
            }
            // Check for duplicates within the current input string only for fully specified cards
            if (suitInput !== 'X') {
                const specificCard = rank + suitInput;
                if (cardsInThisInput.has(specificCard)) {
                    return { isValid: false, error: `Duplicate card in input: "${formattedCard(specificCard)}"` };
                }
                cardsInThisInput.add(specificCard);
            }
        }
        // If we've reached here (no period, no hard errors, limited validation on existing suits passed),
        // consider the input valid as the user is likely still typing.
        return { isValid: true };
    }

    // --- If a period IS present, perform FULL validation ---
    if (ranks.length === 0 && containsPeriod) { // e.g. user typed only "." or "  ."
        return { isValid: false, error: 'No cards specified before period.' };
    }

    const cardsInThisInputFull: Set<string> = new Set();
    const upperCaseDeck = currentState.deck.map(card => card.toUpperCase());

    for (let i = 0; i < ranks.length; i++) {
        const rank = ranks[i];
        const suitInput = suits[i]; // Ranks and suits length must match here due to earlier check

        if (suitInput !== 'X') {
            if (!VALID_SUITS_FOR_DECK.includes(suitInput)) {
                return { isValid: false, error: `Invalid suit: "${suitInput}" for rank "${rank}". Use S,D,C,H.` };
            }
            const specificCard = rank + suitInput;

            if (cardsInThisInputFull.has(specificCard)) {
                return { isValid: false, error: `Duplicate card in input: "${formattedCard(specificCard)}"` };
            }
            cardsInThisInputFull.add(specificCard);

            if (!upperCaseDeck.includes(specificCard)) {
                return { isValid: false, error: `Card "${formattedCard(specificCard)}" is already in use.` };
            }
        } else { // Suit is 'X' (random)
            let rankHasAvailableSuit = false;
            for (const deckSuit of VALID_SUITS_FOR_DECK) {
                const potentialCard = rank + deckSuit;
                if (upperCaseDeck.includes(potentialCard) && !cardsInThisInputFull.has(potentialCard)) {
                    rankHasAvailableSuit = true;
                    break;
                }
            }
            if (!rankHasAvailableSuit) {
                return { isValid: false, error: `No suits in deck for rank "${rank}" (or all used by other cards in this input).` };
            }
        }
    }

    return { isValid: true };
};

// fix preflop validation to require position
const baseValidationPipeline: ValidationFunction[] = [
    validateSegment1,
    validateInputCharacters,
];

const preflopPipeline: ValidationFunction[] = [validateHeroInAction]

const actionPipeline: ValidationFunction[] = [
    validatePosition,
    validateDecision,
    validateAction,
    validateAggressiveActionNotEndingWithPeriod,
    validateNonAggressiveClosingActionRequiresPeriod,
]

const cardPipeline: ValidationFunction[] = [
    validateCommunityCards
]

export default function App() {
    const { data }: { data: string } = useLocalSearchParams();
    const gameInfo: HandSetupInfo = JSON.parse(data);

    // State
    const [state, dispatch] = useReducer(reducer, initialAppState, (arg) => createInitialAppState(arg, gameInfo));
    const [isLoading, setIsLoading] = useState(false);
    const [animationComplete, setAnimationComplete] = useState(false);

    const [savedId, setSavedId] = useState('');
    const [inputError, setInputError] = useState('');
    const [inputValue, setInputValue] = useState('');
    const [pipeline, setPipeline] = useState<ValidationFunction[]>(baseValidationPipeline);

    // Hooks
    const theme = useTheme();
    const headerHeight = useHeaderHeight();
    const navigation = useNavigation();
    const router = useRouter();
    const scrollViewRef = useRef<ScrollView>(null);
    const VALID_POSITIONS = numPlayersToActionSequenceList[gameInfo.numPlayers];
    const VALID_POS_STARTS = VALID_POSITIONS.map(p => p[0]);

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

    useEffect(() => { setInputError('') }, [state.history.size])
    useEffect(() => {
        if (state.current.playerActions.length > 0) {
            // Use setTimeout to ensure layout is updated before scrolling
            setTimeout(() => {
                scrollViewRef.current?.scrollToEnd({ animated: true });
            }, 100);
        }
    }, [state.current.playerActions.length]);

    useEffect(() => {
        // Validate that bet can't be followed by another bet: b 20, b20
        let actionSpecificValidation: ValidationFunction[] = [];
        switch (state.current.currentAction?.id) {
            case GameQueueItemType.kPreflopAction:
                actionSpecificValidation = [...preflopPipeline, ...actionPipeline];
                break;
            case GameQueueItemType.kFlopAction:
            case GameQueueItemType.kTurnAction:
            case GameQueueItemType.kRiverAction:
                actionSpecificValidation = actionPipeline;
                break;
            case GameQueueItemType.kFlopCards:
            case GameQueueItemType.kTurnCard:
            case GameQueueItemType.kRiverCard:
            case GameQueueItemType.kVillainCard:
                actionSpecificValidation = cardPipeline;
                break;
        }
        const newPipeline = [...baseValidationPipeline, ...actionSpecificValidation];
        setPipeline(newPipeline);
        // update pipeline
    }, [state.current.currentAction?.id])

    function processAndValidateInput(
        inputValue: string,
        currentState: GameState
    ): ValidationResult {
        if (!inputValue || inputValue.trim() === '') {
            return { isValid: true };
        }
        for (const validationFn of pipeline) {
            const result = validationFn(inputValue, currentState);
            if (!result.isValid) {
                return result; // Return the first error encountered
            }
        }
        return { isValid: true }; // All validations passed
    }
    const handleInputChange = (text: string) => {
        // ignore extra characters typed when error is present.
        // if (inputError && text > inputValue) {
        //     return;
        // }

        setInputValue(text)
        const result = processAndValidateInput(text, state.current);
        if (!result.isValid) {
            assertIsDefined(result.error);
            setInputError(result.error); // Set the specific error message
            return;
        } else {
            setInputError(''); // Clear error if the whole string is now valid
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

    useEffect(() => {
        if (savedId && animationComplete) {
            goToDetailPage();
        }
    }, [savedId, animationComplete])

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
            case GameQueueItemType.kFlopAction:
            case GameQueueItemType.kTurnAction:
            case GameQueueItemType.kRiverAction:
                return `${state.current.actionSequence.find(a => !a.isAllIn)?.position} to act`;
            default:
                return state.current.currentAction?.placeholder;
        }

    };
    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            {isLoading && (
                <View style={styles.successContainer}>
                    <SuccessAnimation visible={isLoading} onAnimationComplete={() => setAnimationComplete(true)} />
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
                    justifyContent: 'space-between',
                    zIndex: 1
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
                            onSubmitEditing={() => { }}
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