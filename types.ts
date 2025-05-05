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
    text: string;
    winner: string;
    combination: string[];
    hands: PokerPlayerInput[];
}

export interface PlayerStatus {
    position: Position;
    isAllIn: boolean;
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
    stake_level?: string | null;
    small_blind: number;
    big_blind: number;
    location?: string | null;
    num_players: number;
    hero_position?: string | null;
    hero_cards?: string | null;
    final_pot_size?: number | null;
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
    betsThisStreet: { [key in Position]?: number };
    potForStreetMap: { [key in Stage]?: number };
    stacks: { [key in Position]: number };
    currentBetFacing: number;
    showdownHands: PokerPlayerInput[];
    mostRecentBet: number;
    showdown: ShowdownDetails | null;
    preflopSequence: PreflopStatus[] | undefined;
}

// Type for rows from the 'actions' table
export interface ActionRecord {
    id: number;
    hand_id: string;
    action_index: number;
    stage: number;
    position: string;
    decision: string;
    action_amount: number | null;
    player_stack_before: number | null;
    pot_size_before: number | null;
    text_description: string | null;
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
  
export interface DetailedHandData {
    // All columns from the 'hands' table
    id: string;
    user_id: string;
    played_at: string;
    game_type: string;
    stake_level?: string | null;
    small_blind: number;
    big_blind: number;
    location?: string | null;
    num_players: number;
    hero_position?: string | null;
    hero_cards?: string | null;
    final_pot_size?: number | null;
    final_street: Stage;
    stacks: string;
    currency: string;
    notes?: string | null;
    created_at: string;
    actions: ActionRecord[];
    showdown_hands: ShowdownHandRecord[];
    community_cards: string[];
}