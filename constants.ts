import { ActionType, InitialState, Position, Stage } from "./types";

export const playerOptions = [
    { label: '2', value: '2' },
    { label: '3', value: '3' },
    { label: '4', value: '4' },
    { label: '5', value: '5' },
    { label: '6', value: '6' },
    { label: '7', value: '7' },
    { label: '8', value: '8' },
    { label: '9', value: '9' },
]

export const positionMapping: Record<number, { label: string; value: Position }[]> = {
    2: [
      { label: Position.SB, value: Position.SB },
      { label: Position.BB, value: Position.BB },
    ],
    3: [
      { label: Position.SB, value: Position.SB },
      { label: Position.BB, value: Position.BB },
      { label: Position.BTN, value: Position.BTN },
    ],
    4: [
      { label: Position.SB, value: Position.SB },
      { label: Position.BB, value: Position.BB },
      { label: Position.CO, value: Position.CO },
      { label: Position.BTN, value: Position.BTN },
    ],
    5: [
      { label: Position.SB, value: Position.SB },
      { label: Position.BB, value: Position.BB },
      { label: Position.UTG, value: Position.UTG },
      { label: Position.CO, value: Position.CO },
      { label: Position.BTN, value: Position.BTN },
    ],
    6: [
      { label: Position.SB, value: Position.SB },
      { label: Position.BB, value: Position.BB },
      { label: Position.UTG, value: Position.UTG },
      { label: Position.HJ, value: Position.HJ },
      { label: Position.CO, value: Position.CO },
      { label: Position.BTN, value: Position.BTN },
    ],
    7: [
      { label: Position.SB, value: Position.SB },
      { label: Position.BB, value: Position.BB },
      { label: Position.UTG, value: Position.UTG },
      { label: Position.LJ, value: Position.LJ },
      { label: Position.HJ, value: Position.HJ },
      { label: Position.CO, value: Position.CO },
      { label: Position.BTN, value: Position.BTN },
    ],
    8: [
      { label: Position.SB, value: Position.SB },
      { label: Position.BB, value: Position.BB },
      { label: Position.UTG, value: Position.UTG },
      { label: Position.UTG_1, value: Position.UTG_1 },
      { label: Position.LJ, value: Position.LJ },
      { label: Position.HJ, value: Position.HJ },
      { label: Position.CO, value: Position.CO },
      { label: Position.BTN, value: Position.BTN },
    ],
    9: [
      { label: Position.SB, value: Position.SB },
      { label: Position.BB, value: Position.BB },
      { label: Position.UTG, value: Position.UTG },
      { label: Position.UTG_1, value: Position.UTG_1 },
      { label: Position.UTG_2, value: Position.UTG_2 },
      { label: Position.LJ, value: Position.LJ },
      { label: Position.HJ, value: Position.HJ },
      { label: Position.CO, value: Position.CO },
      { label: Position.BTN, value: Position.BTN },
    ],
  };

export const numPlayersToActionSequenceList: Record<number, Position[]> = {
    2: [Position.SB, Position.BB],
    3: [Position.SB, Position.BB, Position.BTN],
    4: [Position.SB, Position.BB, Position.CO, Position.BTN],
    5: [Position.SB, Position.BB, Position.UTG, Position.CO, Position.BTN],
    6: [Position.SB, Position.BB, Position.UTG, Position.HJ, Position.CO, Position.BTN],
    7: [Position.SB, Position.BB, Position.UTG, Position.LJ, Position.HJ, Position.CO, Position.BTN],
    8: [Position.SB, Position.BB, Position.UTG, Position.UTG_1, Position.LJ, Position.HJ, Position.CO, Position.BTN],
    9: [Position.SB, Position.BB, Position.UTG, Position.UTG_1, Position.UTG_2, Position.LJ, Position.HJ, Position.CO, Position.BTN],
};

export const initialDeck: string[] = [
    '2h', '3h', '4h', '5h', '6h', '7h', '8h', '9h', 'Th', 'Jh', 'Qh', 'Kh', 'Ah',
    '2d', '3d', '4d', '5d', '6d', '7d', '8d', '9d', 'Td', 'Jd', 'Qd', 'Kd', 'Ad',
    '2c', '3c', '4c', '5c', '6c', '7c', '8c', '9c', 'Tc', 'Jc', 'Qc', 'Kc', 'Ac',
    '2s', '3s', '4s', '5s', '6s', '7s', '8s', '9s', 'Ts', 'Js', 'Qs', 'Ks', 'As'
];

export const initialState: InitialState = {
    gameQueue: [
        {
            placeholder: 'Flop cards',
            shouldTransitionAfterStep: false,
            actionType: ActionType.kCard,
        },
        {
            placeholder: 'Flop action',
            shouldTransitionAfterStep: true,
            actionType: ActionType.kActionSequence,
        },
        {
            placeholder: 'Turn card',
            shouldTransitionAfterStep: false,
            actionType: ActionType.kCard,
        },
        {
            placeholder: 'Turn action',
            shouldTransitionAfterStep: true,
            actionType: ActionType.kActionSequence,
        },
        {
            placeholder: 'River card',
            shouldTransitionAfterStep: false,
            actionType: ActionType.kCard,
        },
        {
            placeholder: 'River action',
            shouldTransitionAfterStep: true,
            actionType: ActionType.kActionSequence,
        },
    ],
    currentAction: {
        placeholder: 'Preflop action',
        shouldTransitionAfterStep: true,
        actionType: ActionType.kActionSequence,
    },
    handHistory: [],
    input: '',
    cards: ['', '', '', '', ''],
    playerActions: [],
    stage: Stage.Preflop,
    stageDisplayed: Stage.Preflop,
    hero: '',
    actionSequence: [],
    pot: 0,
    deck: initialDeck,
    mostRecentBet: 0,
};


// utg utg1 utg2 lj hj co btn sb bb