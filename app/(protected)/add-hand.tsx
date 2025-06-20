import React, { useReducer, useRef, useState, useEffect, useLayoutEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Button, Chip, Divider, Text, TextInput } from 'react-native-paper';
import ActionList from '../../components/ActionList';
import GameInfo from '../../components/GameInfo';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActionType, Decision, DispatchActionType, Stage, HandSetupInfo, Position, GameQueueItemType, ValidationFunction, GameState, ValidationResult, PlayerStatus, PlayerTag, BoardTexture } from '@/types';
import { CommunityCards } from '@/components/Cards';
import { numPlayersToActionSequenceList } from '@/constants';
import { calculateEffectiveStack, decisionToText, isPreflop, tagToLabel } from '@/utils/hand_utils';
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
import { transFormCardsToFormattedString } from '@/utils/card_utils';

const tags = [
    PlayerTag.kLag,
    PlayerTag.kTag,
    PlayerTag.kLp,
    PlayerTag.kTp,
    PlayerTag.kWhale,
    PlayerTag.kManiac,
    PlayerTag.kPro,
    PlayerTag.kNit,
]
const TagList = ({ chips, selectChip, position }) => {
    return (
        <View style={{ flexDirection: 'row', display: 'flex', width: '100%', flexWrap: 'wrap', gap: 8 }}>
            {tags.map((tag) => (
                <TagChip
                    label={tagToLabel(tag)}
                    onPress={() => {
                        const copyOfChips = { ...chips };
                        const currentChipValue = copyOfChips[position];
                        if (currentChipValue === tag) {
                            delete copyOfChips[position];
                            selectChip(copyOfChips);
                        } else {
                            copyOfChips[position] = tag;
                            selectChip(copyOfChips);
                        }
                    }}
                    key={tag}
                    selected={chips[position] === tag}
                />

            ))}
        </View>
    )
}
const TagChip = ({ label, onPress, selected }: { label: string, onPress: () => void, selected: boolean }) => (
    <Chip showSelectedCheck={false} selected={selected} onPress={onPress} textStyle={{ color: selected ? '#FFF' : '#000000' }} style={{ backgroundColor: selected ? '#000000' : '#0000000D' }}>{label}</Chip>
);

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
        return { isValid: false, error: 'Hero must be in action sequence' }
    }
    return { isValid: true };
}

const validateAction: ValidationFunction = (input, state) => {
    const isCompleteSegment = input.endsWith(',') || input.endsWith('.');
    const { playerActions, betsThisStreet, actionSequence, lastRaiseAmount, currentBetFacing, numberOfBetsAndRaisesThisStreet, stage, stacks, bigBlind, thirdBlind, playerWhoMadeLastAggressiveAction } = state;
    const segment = getSegment(input);
    const parts = getPartsFromSegment(segment);
    const nextPlayerToActPos = stage === Stage.Preflop
        ? parts[0]
        : actionSequence.find(a => !a.isAllIn)?.position;
    assertIsDefined(nextPlayerToActPos);
    const { decision, position, amount } = getPlayerAction(nextPlayerToActPos, segment, stage, 0);
    // console.log(`parts ::: ${decision} :: `, parts)
    if (parts.length === 1) {
        return { isValid: true }
    }
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

    if ((decision === Decision.kRaise || decision === Decision.kBet) && (!amount || isNaN(Number(amount)) || Number(amount) <= 0)) {
        return { isValid: false, error: `Invalid amount for ${decision}: "${amount || ''}` };
    }
    if ((decision === Decision.kRaise || decision === Decision.kBet) && position === playerWhoMadeLastAggressiveAction) {
        // special case for BB open
        if (isPreflop(stage) && position === Position.BB && numberOfBetsAndRaisesThisStreet === 1) {
            return { isValid: true }
        }

        // special case for 3rd blind open
        if (isPreflop(stage) && position === thirdBlind?.position && numberOfBetsAndRaisesThisStreet === 1) {
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
            if (amount < (thirdBlind?.amount || bigBlind) && isCompleteSegment) {
                return { isValid: false, error: `Bet amount must be > than ${thirdBlind ? '3rd Blind' : 'BB'}` };
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
const validateSegment: ValidationFunction = (input) => {
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
    if (currentState.currentAction.id === GameQueueItemType.kVillainCard) {
        if (!containsPeriod) {
            return { isValid: true }
        }
        if (trimmedInput.toLowerCase().slice(0, -1) === "muck") {
            return { isValid: true }
        }
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
    validateSegment,
    validateInputCharacters,
];

const preflopPipeline: ValidationFunction[] = [validateHeroInAction];

const actionPipeline: ValidationFunction[] = [
    validatePosition,
    validateDecision,
    validateAction,
    validateAggressiveActionNotEndingWithPeriod,
    validateNonAggressiveClosingActionRequiresPeriod,
]

const cardPipeline: ValidationFunction[] = [
    validateCommunityCards
];

export default function App() {
    const { data }: { data: string } = useLocalSearchParams();
    const gameInfo: HandSetupInfo = JSON.parse(data);

    // State
    const [state, dispatch] = useReducer(reducer, initialAppState, (arg) => createInitialAppState(arg, gameInfo));
    const [isLoading, setIsLoading] = useState(false);
    const [tagViewVisible, setTagViewVisible] = useState(false);
    const [animationComplete, setAnimationComplete] = useState(false);

    const [savedId, setSavedId] = useState('');
    const [inputError, setInputError] = useState('');
    const [inputValue, setInputValue] = useState('');
    const [chipsSelected, setChipsSelected] = useState({});
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
            if (state.current.showdownHands.length > 0) {
                setTagViewVisible(true);
            } else {
                setIsLoading(true)
                saveHand().then((id) => {
                    setSavedId(id);
                });
            }
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
                actionSpecificValidation = cardPipeline;
                break;
            case GameQueueItemType.kVillainCard:
                setPipeline([validateSegment, ...cardPipeline]);
                return;
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
        setInputValue(text);
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

    // Helper to parse a card string into its rank and suit for easier processing
    interface ParsedCard {
        rank: string; // '2', '3', ..., 'T', 'J', 'Q', 'K', 'A'
        suit: string; // 's', 'h', 'd', 'c'
        rankValue: number; // 2, 3, ..., 10, 11, 12, 13, 14 (for A)
    }

    function parseCardString(cardStr: string): ParsedCard {
        const rankChar = cardStr.substring(0, cardStr.length - 1).toUpperCase();
        const suitChar = cardStr.substring(cardStr.length - 1).toLowerCase();

        let rankValue: number;
        switch (rankChar) {
            case 'T': rankValue = 10; break;
            case 'J': rankValue = 11; break;
            case 'Q': rankValue = 12; break;
            case 'K': rankValue = 13; break;
            case 'A': rankValue = 14; break;
            default: rankValue = parseInt(rankChar, 10);
        }
        return { rank: rankChar, suit: suitChar, rankValue: rankValue };
    }

    // --- Individual Board Texture Checks ---

    // kAceHigh
    function isAceHigh(parsedCards: ParsedCard[]): boolean {
        return parsedCards.some(card => card.rank === 'A');
    }

    // kMonotone
    function isMonotone(parsedCards: ParsedCard[]): boolean {
        return parsedCards[0].suit === parsedCards[1].suit &&
            parsedCards[0].suit === parsedCards[2].suit;
    }

    // kPaired (can also be trips, but trips is a type of paired)
    function isPaired(parsedCards: ParsedCard[]): boolean {
        const ranks = parsedCards.map(card => card.rank);
        const rankCounts: { [key: string]: number } = {};
        ranks.forEach(rank => {
            rankCounts[rank] = (rankCounts[rank] || 0) + 1;
        });
        // If any rank appears 2 or 3 times, it's paired (e.g., AAx, AAA)
        return Object.values(rankCounts).some(count => count >= 2);
    }

    // kTrips (more specific than paired)
    function isTrips(parsedCards: ParsedCard[]): boolean {
        const ranks = parsedCards.map(card => card.rank);
        const rankCounts: { [key: string]: number } = {};
        ranks.forEach(rank => {
            rankCounts[rank] = (rankCounts[rank] || 0) + 1;
        });
        // If any rank appears exactly 3 times
        return Object.values(rankCounts).some(count => count === 3);
    }

    // kDoubleBroadway (two or more Broadway cards: T, J, Q, K, A)
    function isDoubleBroadway(parsedCards: ParsedCard[]): boolean {
        const broadwayRanks = ['T', 'J', 'Q', 'K', 'A'];
        const broadwayCount = parsedCards.filter(card => broadwayRanks.includes(card.rank)).length;
        return broadwayCount >= 2;
    }

    // kRainbow
    function isRainbow(parsedCards: ParsedCard[]): boolean {
        const suits = new Set(parsedCards.map(card => card.suit));
        return suits.size === 3; // All three cards have different suits
    }

    // kFlushDraw (Two-tone board)
    function isFlushDraw(parsedCards: ParsedCard[]): boolean {
        // It's a flush draw board if it's not monotone and not rainbow.
        // Meaning, two suits are the same and one is different (e.g., HH C).
        if (isMonotone(parsedCards) || isRainbow(parsedCards)) {
            return false;
        }
        const suits = parsedCards.map(card => card.suit);
        const suitCounts: { [key: string]: number } = {};
        suits.forEach(suit => {
            suitCounts[suit] = (suitCounts[suit] || 0) + 1;
        });
        // Check if one suit appears twice and another once
        return Object.values(suitCounts).includes(2) && Object.values(suitCounts).includes(1);
    }

    // kConnected (Has straight possibilities - straight, gutshot, or double-guts)
    function isConnected(parsedCards: ParsedCard[]): boolean {
        // Sort cards by rank value for easier checking
        const sortedRanks = parsedCards.map(card => card.rankValue).sort((a, b) => a - b);
        const [r1, r2, r3] = sortedRanks;

        // Handle Ace-low straight (A, 2, 3) where A has value 14
        const ranksForStraightCheck = [...sortedRanks];
        if (ranksForStraightCheck.includes(14)) { // If Ace is present
            ranksForStraightCheck.push(1); // Add a '1' for Ace-low straight considerations
            ranksForStraightCheck.sort((a, b) => a - b); // Re-sort
        }

        // Check for straight (0-gap)
        if (
            (r2 === r1 + 1 && r3 === r2 + 1) || // e.g., 5-6-7
            (ranksForStraightCheck.includes(1) && ranksForStraightCheck.includes(2) && ranksForStraightCheck.includes(3) && ranksForStraightCheck.includes(4) && ranksForStraightCheck.includes(5)) // A-2-3-4-5 special case
        ) {
            return true;
        }

        // Check for 1-gap straight draw (e.g., 7-9-J, 8-T-Q, 2-4-5)
        // This is more complex as it involves any 2 cards being 2-gapped or 1-gapped
        // A simplified approach for 'connected' is often:
        // Are any two cards consecutive? (e.g., 7-8-X)
        // Are any two cards 1-gapped? (e.g., 7-9-X)
        // Are all three cards within 4-5 ranks of each other (e.g., 7-9-J: 7 to J is 4 ranks, 2 gaps)
        const hasConsecutive = (r2 === r1 + 1) || (r3 === r2 + 1);
        const hasOneGap = (r2 === r1 + 2) || (r3 === r1 + 2) || (r3 === r2 + 2); // e.g. 2-4-5 or 2-3-5
        const allWithin4Ranks = (r3 - r1 <= 4); // Max 3 gaps: e.g., 2-6-T (8 ranks apart), 2-3-4 (2 ranks apart) -> 2-3-4-5-6 (5 ranks)

        // A common definition of 'connected' board is a board with at least two cards that are consecutive or one-gapped,
        // making straight draws very common.
        // For simplicity, let's say a board is connected if it offers at least one open-ended or gutshot straight draw with two hole cards.
        // This can be approximated by checking gaps.
        const gap1 = r2 - r1;
        const gap2 = r3 - r2;

        // All consecutive (0 gap)
        if (gap1 === 1 && gap2 === 1) return true; // e.g. 7-8-9

        // Two consecutive, one gapped (1 gap or 2 gap board within 4-5 ranks for OESD)
        if ((gap1 === 1 && gap2 <= 2) || (gap1 <= 2 && gap2 === 1)) return true; // e.g. 7-8-T (1 gap), 7-9-T (1 gap)

        // Two gapped (one card is 2-gapped, e.g., 7-9-J) -- this creates a gutshot to the middle card
        // or two separate gapped straight draws (e.g. 7_9_K needs 8 or T for straight draw)
        // For a broad "connected" filter, we consider more draws.
        // If we have A,2,3... 14,2,3.
        if (ranksForStraightCheck.some((r, i, arr) => i < arr.length - 1 && arr[i + 1] === r + 1) || // Two consecutive
            ranksForStraightCheck.some((r, i, arr) => i < arr.length - 1 && arr[i + 1] === r + 2) // Two 1-gapped
        ) {
            return true;
        }

        // General connectedness: often involves sum of gaps
        // A common simple check: if the largest gap is not too big.
        // The sum of gaps (r3 - r1) should not be too large
        if (r3 - r1 <= 4) { // e.g., 2-3-4, 2-3-5, 2-4-5, 2-3-6, 2-4-6, 2-5-6
            // This covers many straight draws.
            return true;
        }

        return false;
    }


    // kDisconnected (The inverse of connected for filtering purposes)
    function isDisconnected(parsedCards: ParsedCard[]): boolean {
        return !isConnected(parsedCards);
    }


    // kLowCards (All cards are low - typically defined as 8 or lower)
    function isLowCards(parsedCards: ParsedCard[]): boolean {
        // Define a threshold for "low cards" (e.g., 8 or lower)
        const LOW_CARD_THRESHOLD = 8;
        return parsedCards.every(card => card.rankValue <= LOW_CARD_THRESHOLD);
    }


    // --- Main function to get all matching textures ---
    function getMatchingTextures(cards: string[]): BoardTexture[] {
        const textures: BoardTexture[] = [];
        const parsedCards = cards.map(parseCardString);

        // Validate input: ensure exactly 3 cards and no duplicates (basic check)
        if (parsedCards.length !== 3 || new Set(cards).size !== 3) {
            console.warn("Invalid input for getMatchingTextures. Expected 3 unique cards.");
            return [];
        }

        // Order of checks matters for clarity and avoiding redundant flags
        // Example: A-A-A is trips AND paired. A-A-2 is paired.
        // M-Q-J-T is connected, double broadway, ace-high is just ace-high.

        // 1. High Card Presence
        if (isAceHigh(parsedCards)) {
            textures.push(BoardTexture.kAceHigh);
        }
        if (isDoubleBroadway(parsedCards)) {
            textures.push(BoardTexture.kDoubleBroadway);
        }
        if (isLowCards(parsedCards)) {
            textures.push(BoardTexture.kLowCards);
        }

        // 2. Pair/Rank Structure
        if (isTrips(parsedCards)) { // Trips is most specific, so check first if applicable
            textures.push(BoardTexture.kPaired); // Trips is a type of paired board
            // No explicit BoardTexture.kTrips in your enum, so we flag as Paired
        } else if (isPaired(parsedCards)) {
            textures.push(BoardTexture.kPaired);
        }


        // 3. Suit Distribution (Mutually Exclusive)
        if (isMonotone(parsedCards)) {
            textures.push(BoardTexture.kMonotone);
        } else if (isRainbow(parsedCards)) {
            textures.push(BoardTexture.kRainbow);
        } else if (isFlushDraw(parsedCards)) { // Two-tone
            textures.push(BoardTexture.kFlushDraw);
        }

        // 4. Connectedness (Mutually Exclusive for filtering)
        if (isConnected(parsedCards)) {
            textures.push(BoardTexture.kConnected);
        } else {
            textures.push(BoardTexture.kDisconnected);
        }

        return textures;
    }

    async function saveHand() {
        const matchingTextures = getMatchingTextures(state.current.cards.map(c => transFormCardsToFormattedString(c)).slice(0, 3))
        const result = await saveHandToSupabase(state.current, gameInfo, chipsSelected, matchingTextures);
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
            {tagViewVisible && (
                <View style={{ padding: 8, marginTop: 12, display: 'flex', flexDirection: 'column' }}>
                    <Text variant='titleLarge' style={{ marginBottom: 18 }}>Tag Opponents</Text>
                    <Divider bold style={{ marginBottom: 18 }} />
                    {state.current.showdownHands.filter(hand => hand.playerId !== state.current.hero.position).map((hand, index, arr) => (
                        <View key={hand.playerId} style={{ flexDirection: 'column', display: 'flex', gap: 6 }}>
                            <Text variant='titleMedium' style={{ marginBottom: 8 }}>{hand.playerId}</Text>
                            <TagList chips={chipsSelected} selectChip={setChipsSelected} position={hand.playerId} />
                            {index !== state.current.showdownHands.length - 1 && arr.length > 1 && <Divider bold style={{ marginVertical: 20 }} />}
                        </View>
                    ))}
                    <Button
                        mode="contained"
                        onPress={() => {
                            setIsLoading(true)
                            setTagViewVisible(false);
                            saveHand().then((id) => {
                                setSavedId(id);
                            })
                        }}
                        style={{ ...styles.button, ...theme.button, marginTop: 18, marginInline: 0 }}>Save Hand</Button>
                </View>
            )}
            {!isLoading && !tagViewVisible && <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                enabled={Platform.OS === "ios"}
                keyboardVerticalOffset={Platform.OS === "ios" ? headerHeight - 8 : 0}
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
                            onSubmitEditing={() => {
                                handleInputChange(`${inputValue}.`);
                            }}
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