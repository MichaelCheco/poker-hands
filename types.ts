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
