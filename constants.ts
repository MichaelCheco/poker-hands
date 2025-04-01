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
      { label: Position.BU, value: Position.BU },
    ],
    4: [
      { label: Position.SB, value: Position.SB },
      { label: Position.BB, value: Position.BB },
      { label: Position.CO, value: Position.CO },
      { label: Position.BU, value: Position.BU },
    ],
    5: [
      { label: Position.SB, value: Position.SB },
      { label: Position.BB, value: Position.BB },
      { label: Position.UTG, value: Position.UTG },
      { label: Position.CO, value: Position.CO },
      { label: Position.BU, value: Position.BU },
    ],
    6: [
      { label: Position.SB, value: Position.SB },
      { label: Position.BB, value: Position.BB },
      { label: Position.UTG, value: Position.UTG },
      { label: Position.HJ, value: Position.HJ },
      { label: Position.CO, value: Position.CO },
      { label: Position.BU, value: Position.BU },
    ],
    7: [
      { label: Position.SB, value: Position.SB },
      { label: Position.BB, value: Position.BB },
      { label: Position.UTG, value: Position.UTG },
      { label: Position.LJ, value: Position.LJ },
      { label: Position.HJ, value: Position.HJ },
      { label: Position.CO, value: Position.CO },
      { label: Position.BU, value: Position.BU },
    ],
    8: [
      { label: Position.SB, value: Position.SB },
      { label: Position.BB, value: Position.BB },
      { label: Position.UTG, value: Position.UTG },
      { label: Position.UTG_1, value: Position.UTG_1 },
      { label: Position.LJ, value: Position.LJ },
      { label: Position.HJ, value: Position.HJ },
      { label: Position.CO, value: Position.CO },
      { label: Position.BU, value: Position.BU },
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
      { label: Position.BU, value: Position.BU },
    ],
  };

export const numPlayersToActionSequenceList: Record<number, Position[]> = {
    2: [Position.SB, Position.BB],
    3: [Position.SB, Position.BB, Position.BU],
    4: [Position.SB, Position.BB, Position.CO, Position.BU],
    5: [Position.SB, Position.BB, Position.UTG, Position.CO, Position.BU],
    6: [Position.SB, Position.BB, Position.UTG, Position.HJ, Position.CO, Position.BU],
    7: [Position.SB, Position.BB, Position.UTG, Position.LJ, Position.HJ, Position.CO, Position.BU],
    8: [Position.SB, Position.BB, Position.UTG, Position.UTG_1, Position.LJ, Position.HJ, Position.CO, Position.BU],
    9: [Position.SB, Position.BB, Position.UTG, Position.UTG_1, Position.UTG_2, Position.LJ, Position.HJ, Position.CO, Position.BU],
};

export const initialDeck: string[] = [
    '2H', '3H', '4H', '5H', '6H', '7H', '8H', '9H', 'TH', 'JH', 'QH', 'KH', 'AH',
    '2D', '3D', '4D', '5D', '6D', '7D', '8D', '9D', 'TD', 'JD', 'QD', 'KD', 'AD',
    '2C', '3C', '4C', '5C', '6C', '7C', '8C', '9C', 'TC', 'JC', 'QC', 'KC', 'AC',
    '2S', '3S', '4S', '5S', '6S', '7S', '8S', '9S', 'TS', 'JS', 'QS', 'KS', 'AS'
];

export const initialState: InitialState = {
    gameQueue: [
        {
            placeholder: 'Flop cards',
            shouldTransitionAfterStep: false,
            actionType: ActionType.kCommunityCard,
        },
        {
            placeholder: 'Flop action',
            shouldTransitionAfterStep: true,
            actionType: ActionType.kActionSequence,
        },
        {
            placeholder: 'Turn card',
            shouldTransitionAfterStep: false,
            actionType: ActionType.kCommunityCard,
        },
        {
            placeholder: 'Turn action',
            shouldTransitionAfterStep: true,
            actionType: ActionType.kActionSequence,
        },
        {
            placeholder: 'River card',
            shouldTransitionAfterStep: false,
            actionType: ActionType.kCommunityCard,
        },
        {
            placeholder: 'River action',
            shouldTransitionAfterStep: false,
            actionType: ActionType.kActionSequence,
        },
        {
          placeholder: "Villain's cards",
          shouldTransitionAfterStep: true,
          actionType: ActionType.kVillainCards,
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
    betsThisStreet: {},
    currentBetFacing: 0,
    mostRecentBet: 0,
    villainCards: {},
    showdown: '',
};

