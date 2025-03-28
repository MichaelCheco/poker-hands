export enum Stage {
    Preflop,
    Flop,
    Turn,
    River,
    Showdown,
}

export enum ActionType {
    kCard,
    kActionSequence,
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
    BTN = 'BTN',
}

export enum DispatchActionType {
    kSetGameInfo,
    kTransition,
    kAddPreflopAction,
    kAddPostflopAction,
    kSetInput,
    kSetVisibleStage,
    kReset,
}

export interface GameQueueItem {
    placeholder: string;
    shouldTransitionAfterStep: boolean;
    actionType: ActionType;
}


export enum Decision {
    kCheck = 'x',
    kBet = 'b',
    kRaise = 'r',
    kCall = 'c',
    kFold = 'f',
}

export interface PlayerAction {
    text: string;
    position: Position;
    decision: Decision;
    amount: number | null;
    stage: Stage;
    shouldHideFromUi: boolean;
}

export interface ActionTextToken {
    position: Position;
    decision: Decision;
    amount: number | null;
}

export interface InitialState {
    gameQueue: GameQueueItem[];
    currentAction: GameQueueItem;
    handHistory: InitialState[];
    input: string;
    cards: string[];
    playerActions: PlayerAction[];
    stage: Stage;
    stageDisplayed: Stage;
    hero: string;
    actionSequence: Position[];
    pot: number;
    deck: string[];
    mostRecentBet: number;
}