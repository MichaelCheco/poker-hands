import { PokerPlayerInput } from "./hand-evaluator";

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
    stacks: { [key in Position]: number  };
    currentBetFacing: number;
    showdownHands: PokerPlayerInput[];
    mostRecentBet: number;
    showdown: ShowdownDetails | null;
}
