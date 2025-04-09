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

export interface GameQueueItem {
    placeholder: string;
    shouldTransitionAfterStep: boolean;
    actionType: ActionType;
}


export enum Decision {
    kCheck = 'X',
    kBet = 'B',
    kRaise = 'R',
    kCall = 'C',
    kFold = 'F',
}

export interface PlayerAction {
    text: string;
    position: Position;
    decision: Decision;
    amount: number;
    stage: Stage;
    shouldHideFromUi: boolean;
    id: string;
}

export interface ActionTextToken {
    position: Position;
    decision: Decision;
    amount: number;
}

export interface GameState {
    gameQueue: GameQueueItem[];
    currentAction: GameQueueItem;
    input: string;
    cards: string[];
    playerActions: PlayerAction[];
    stage: Stage;
    hero: { position: string, hand: string };
    actionSequence: Position[];
    pot: number;
    deck: string[];
    betsThisStreet: { [key in Position]?: number };
    stacks: { [key in Position]?: number  };
    currentBetFacing: number;
    mostRecentBet: number;
    villainCards: any;
    showdown: { text: string, winner: string, combination: string[] };
}
