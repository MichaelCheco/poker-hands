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

// Input/Output Interfaces (same as library example)
export interface PokerPlayerInput {
    playerId: string;
    // TODO improve type safety
    holeCards: string[]|"muck";
}

export interface WinnerInfo {
    winners: PokerPlayerInput[];
    winningHandDescription: string;
    bestHandCards: string[]; // The 5 cards forming the best hand
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
    kSetGameInfo,
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
}
