import { FieldValues } from "react-hook-form";
import { ImmutableStack } from "./utils/immutable_stack";

export type Suit = 's' | 'h' | 'd' | 'c';
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14; // 10=T, 11=J, 12=Q, 13=K, 14=A
export type RankChar = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'T' | 'J' | 'Q' | 'K' | 'A';

export interface ParsedCard {
    rank: Rank;
    suit: Suit;
    str: string; // Original string representation e.g., "Ah"
}

// Hand Ranks (Higher is better)
export enum HandRank {
    HIGH_CARD = 1,
    ONE_PAIR = 2,
    TWO_PAIR = 3,
    THREE_OF_A_KIND = 4,
    STRAIGHT = 5,
    FLUSH = 6,
    FULL_HOUSE = 7,
    FOUR_OF_A_KIND = 8,
    STRAIGHT_FLUSH = 9,
}

// Structure to hold evaluation result for comparison
export interface HandEvaluation {
    rank: HandRank;
    values: number[]; // Relevant card ranks for tie-breaking, highest first
}

export interface PokerPlayerInput {
    playerId: string;
    // TODO improve type safety
    holeCards: string[]|"muck";
    description: string;
}

export interface WinnerInfo {
    details: PokerPlayerInput[];
    winners: PokerPlayerInput[];
    winningHandDescription: string;
    bestHandCards: string[];
}

export enum Stage {
    Preflop,
    Flop,
    Turn,
    River,
    Showdown,
}

export enum ActionType {
    kCommunityCard,
    kActionSequence,
    kVillainCards,
}

export type PlayerStacks = Partial<Record<Position, number>>;
export interface GameAppState {
    current: GameState;
    history: ImmutableStack<GameState>;
}

export enum Position {
    SB = 'SB',
    BB = 'BB',
    UTG = 'UTG',
    UTG_1 = 'UTG+1',
    UTG_2 = 'UTG+2',
    LJ = 'LJ',
    HJ = 'HJ',
    CO = 'CO',
    BU = 'BU',
}

export enum DispatchActionType {
    kTransition,
    kAddAction,
    kSetInput,
    kReset,
    kUndo,
}

export enum GameQueueItemType {
    kPreflopAction,
    kFlopCards,
    kFlopAction,
    kTurnCard,
    kTurnAction,
    kRiverCard,
    kRiverAction,
    kVillainCard,
};

export interface GameQueueItem {
    placeholder: string;
    shouldTransitionAfterStep: boolean;
    actionType: ActionType;
    position?: Position
    id?: GameQueueItemType;
}

export enum Decision {
    kCheck = 'X',
    kBet = 'B',
    kRaise = 'R',
    kCall = 'C',
    kFold = 'F',
    kAllIn = 'A',
}

export interface PlayerAction {
    text: string;
    position: Position;
    decision: Decision;
    amount: number;
    stage: Stage;
    shouldHideFromUi: boolean;
    id: string;
    isLastActionForStage: boolean;
    playerStackBefore: number;
    potSizeBefore: number;
}

export interface ActionTextToken {
    position: Position;
    decision: Decision;
    amount: number;
}

export interface ShowdownDetails {
    description: string;
    holeCards: string[]|"muck"
    playerId: string;
}

export interface PlayerStatus {
    position: Position;
    isAllIn: boolean;
    hasToAct: boolean;
}

export interface PreflopStatus {
    position: Position;
    isAllIn: boolean;
    hasActed: boolean;
}

// Define the structure of the data returned from the 'hands' table
// Adjust based on your actual table columns and desired data
export interface SavedHandSummary {
    id: string;
    played_at: string;
    game_type: string;
    small_blind: number;
    big_blind: number;
    location: string;
    num_players: number;
    hero_position: string;
    hero_cards: string;
    final_pot_size: number;
    currency: string;
    notes?: string | null;
    created_at: string;
}

export interface HandSetupInfo extends FieldValues {
    smallBlind: number;
    bigBlind: number;
    numPlayers: number;
    position: string;
    relevantStacks: string;
    location: string;
    hand: string;
    playedAt?: Date | string;
}

export type BetsForStreetMap = Partial<Record<Position, number>>;

export interface GameState {
    gameQueue: GameQueueItem[];
    currentAction: GameQueueItem;
    input: string;
    cards: string[];
    playerActions: PlayerAction[];
    stage: Stage;
    hero: { position: string, hand: string };
    actionSequence: PlayerStatus[];
    pot: number;
    deck: string[];
    betsThisStreet: BetsForStreetMap;
    potForStreetMap: Partial<Record<Stage, number>>;
    stacks: PlayerStacks;
    currentBetFacing: number;
    showdownHands: PokerPlayerInput[];
    mostRecentBet: number;
    calculatedPots: CalculatedPot[];
    showdown: ShowdownDetails[] | null;
    preflopSequence: PreflopStatus[] | undefined;
    allPlayerContributions: PlayerPotContribution[];
}

export interface PlayerPotContribution {
    // Is the player still in the hand (not folded)?
    eligible: boolean;
    // Total amount this player has put into the pot for the whole hand
    amount: number;
    position: Position;
}

export interface CalculatedPot {
    potAmount: number;
    eligiblePositions: Position[];
    winningPlayerPositions?: string[];
    winningHandDescription?: string;
}

// Type for rows from the 'actions' table
export interface ActionRecord {
    id: number;
    hand_id: string;
    action_index: number;
    stage: number;
    position: string;
    decision: string;
    action_amount: number;
    player_stack_before: number;
    pot_size_before: number;
    text_description: string;
    created_at: string;
    was_auto_folded: boolean;
  }
  
  // Type for rows from the 'showdown_hands' table
export interface ShowdownHandRecord {
    id: number;
    hand_id: string;
    position: string;
    hole_cards: string;
    is_winner: boolean;
    hand_description: string;
    created_at: string;
  }
  
/**
* Represents a single pot (main or side pot) within a poker hand,
* typically corresponding to a row from the 'hand_pots' table.
*/
export interface HandPot {
    /**
     * Unique identifier for this specific pot record (UUID).
     * @example "6fd730f3-6ff2-4bb7-8833-49d0fe08cbc0"
     */
    id: string;

    /**
     * The total amount of chips in this specific pot.
     * @example 900
     */
    amount: number;

    /**
     * Identifier of the hand this pot belongs to (UUID).
     * @example "2feca68c-a1c5-47e6-9fc2-8a96e5692abd"
     */
    hand_id: string;

    /**
     * Timestamp indicating when this pot record was created (ISO 8601 format).
     * @example "2025-05-09T14:29:01.512696+00:00"
     */
    created_at: string;

    /**
     * The order/index of this pot within the hand (0 for main pot, 1 for first side pot, etc.).
     * @example 0
     */
    pot_number: number;

    /**
     * A textual description of the hand that won this specific pot (e.g., "One Pair", "Flush").
     * This can be null if the pot was not won at showdown or if the description is not available.
     * @example "One Pair"
     */
    winning_hand_description: string | null; // Made nullable based on schema (NULL allowed)

    /**
     * An array of player positions (e.g., "SB", "BB") who won this specific pot.
     * Can be null if the pot has not yet been awarded or if no specific winner (e.g. an uncalled bet returned).
     * Can contain multiple positions in case of a split pot.
     * @example ["SB"]
     */
    winning_player_positions: string[] | null; // Made nullable based on schema (NULL allowed)

    /**
     * An array of player positions (e.g., "SB", "BB", "CO") who were eligible to win this pot.
     * @example ["SB", "BB", "CO"]
     */
    eligible_player_positions: string[];
}
export interface DetailedHandData {
    // All columns from the 'hands' table
    id: string;
    user_id: string;
    played_at: string;
    game_type: string;
    small_blind: number;
    big_blind: number;
    location?: string;
    num_players: number;
    hero_position?: string;
    hero_cards?: string;
    final_pot_size?: number;
    final_street: Stage;
    stacks: string;
    currency: string;
    notes?: string | null;
    created_at: string;
    actions: ActionRecord[];
    showdown_hands: ShowdownHandRecord[];
    community_cards: string[];
    hand_pots: HandPot[];
}

export interface ValidationResult {
    isValid: boolean;
    flagErrorToUser?: boolean;
    error?: string; // The specific error message if isValid is false
}

export type ValidationFunction = (
    inputValue: string,
    currentState: GameState,
) => ValidationResult;
