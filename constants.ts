import { Position } from "./types";

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



// utg utg1 utg2 lj hj co btn sb bb