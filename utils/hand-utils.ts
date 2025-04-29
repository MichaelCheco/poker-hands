import { initialState } from "../constants";
import { ActionRecord, Decision, DetailedHandData, GameState, HandSetupInfo, PlayerAction, PlayerStatus, Position, ShowdownDetails, ShowdownHandRecord, Stage } from "../types";
import * as Clipboard from 'expo-clipboard';

function getStageName(stage: Stage): string {
    switch (stage) {
        case Stage.Preflop: return 'Preflop';
        case Stage.Flop: return 'Flop';
        case Stage.Turn: return 'Turn';
        case Stage.River: return 'River';
        case Stage.Showdown: return 'Showdown';
        default: return `Unknown Stage (${stage})`;
    }
}

function getTextSummaryForLastStage(actionList: ActionRecord[]): string {
    const lastStagePlayed = actionList[actionList.length - 1].stage;
    const lastStageActions = actionList.filter(action => action.stage === lastStagePlayed);
    let text = '';
    for (const action of lastStageActions) {
        text = text + `${action.position} ${action.decision}, `
    }
    text = text.slice(0, -2);
    return `${text}.`
}

function decisionToText(decision: Decision): string {
    switch (decision) {
        case Decision.kCheck: return 'checked';
        case Decision.kBet: return 'bet';
        case Decision.kCall: return 'called';
        case Decision.kFold: return 'folded';
        case Decision.kRaise: return 'raised';
    }
}


import { format, parseISO } from 'date-fns';

/**
 * Formats a date into MM/DD hh:mm a format (e.g., 04/26 01:41 PM).
 * Handles Date objects, ISO 8601 strings, and Unix timestamps (milliseconds).
 * Displays time in the user's local timezone.
 *
 * @param dateInput The date to format (Date object, ISO string, or timestamp number).
 * @returns The formatted date string or "Invalid Date" on error.
 */
export function formatDateMMDDHHMM(dateInput: string | Date | number): string {
    try {
        // Ensure we have a valid Date object
        // parseISO is good for strings like '2025-04-26T20:41:00.000Z' from Supabase
        const date = typeof dateInput === 'string' ? parseISO(dateInput) : new Date(dateInput);

        // Check if the date is valid after parsing/creation
        if (isNaN(date.getTime())) {
            throw new Error("Invalid date input provided");
        }

        // MM: Month, 2-digit (01-12)
        // dd: Day, 2-digit (01-31)
        // hh: Hour, 12-hour clock, 2-digit (01-12)
        // mm: Minute, 2-digit (00-59)
        // a: AM/PM marker (uppercase: AM/PM)
        return format(date, 'MM/dd hh:mm a');

    } catch (error) {
        console.error("Error formatting date:", error);
        return "Invalid Date";
    }
}

function getWinner(actionSequence: string[]): string {
    if (actionSequence.length > 1) {
        console.error(`action sequence should only contain 1 player. `, actionSequence)
    }
    return actionSequence[0];
}

export function getHandSummary(finalStreet: Stage, actions: ActionRecord[], winner: string, pot: number): string {
    let summary = `Hand ended on the ${getStageName(finalStreet)}.\n${getTextSummaryForLastStage(actions)}.\n${winner} wins $${pot}.`;
    return summary;
    // Hand ended on the River. Pot: $250. SB wins $250. CO folded.
}

function getStageCards(stage: Stage, communityCards: string[]): string {
    const flopCardStr = communityCards.slice(0, 3).map(c => `${c[0]}${getSuit(c[1])}`).join(', ');
    const turnCardStr = communityCards[3].split(' ').map(c => `${c[0]}${getSuit(c[1])}`);
    const riverCardStr = communityCards[4].split(' ').map(c => `${c[0]}${getSuit(c[1])}`);;
    switch (stage) {
        case Stage.Preflop: return '';
        case Stage.Flop: return `: ${flopCardStr}`;
        case Stage.Turn: return `: ${turnCardStr}`;
        case Stage.River: return `: ${riverCardStr}`;
        case Stage.Showdown: return '';
        default: return `Unknown Stage (${stage})`;
    }
}

function getLastStageName(actionList: PlayerAction[]): string {
    return getStageName(actionList[actionList.length - 1].stage);
}

export async function copyHand(
        actionList: ActionRecord[],
        communityCards: string[],
        smallBlind: number,
        bigBlind: number,
        location: string,
        hand: string,
        position: string,
        pot: number,
        showdown: ShowdownHandRecord[]
): Promise<boolean> {
    const text = formatAndGetTextToCopy(
        actionList,
        communityCards,
        smallBlind,
        bigBlind,
        location,
        hand,
        position,
        pot,
        showdown
    );
    // Copy to clipboard
    try {
        await Clipboard.setStringAsync(text);
        console.log("Hand history copied to clipboard.");
        // You could add user feedback here (e.g., a toast message)
        return true;
    } catch (error) {
        console.error("Failed to copy hand history to clipboard:", error);
        // Add user feedback for error
        return false;
    }
}

export function getSuit(suit: string) {
    switch (suit.toLowerCase()) {
        case 'h':
            return '♥️';
        case 'd':
            return '♦️';
        case 's':
            return '♠️';
        case 'c':
            return '♣️';
    }
}

export function formatAndGetTextToCopy(
    actions: ActionRecord[],
    communityCards: string[],
    smallBlind: number,
    bigBlind: number,
    location: string,
    hand: string,
    position: string,
    pot: number,
    showdown: ShowdownHandRecord[]
): string {
    if (!actions || actions.length === 0) {
        console.warn("No actions provided to format.");
        // Optionally set clipboard to empty or show user feedback
        // await Clipboard.setStringAsync("");
        return '';
    }

    const lines: string[] = [];
    lines.push('\n')
    lines.push(`$${smallBlind}/$${bigBlind} • ${location}`.trimStart());
    lines.push(`\nHero: ${hand} ${position}`.trimStart());

    // Group actions by stage
    const groupedActions: { [stage: number]: ActionRecord[] } = {};
    for (const action of actions) {
        // Only include stages relevant to betting rounds for action listing
        if (action.stage <= Stage.River) {
            if (!groupedActions[action.stage]) {
                groupedActions[action.stage] = [];
            }
            groupedActions[action.stage].push(action);
        }
    }
    const flopCardStr = communityCards.slice(0, 3).join(', ');
    const turnCardStr = communityCards[3];
    const riverCardStr = communityCards[4];

    // Define the order of stages
    const stageOrder: Stage[] = [Stage.Preflop, Stage.Flop, Stage.Turn, Stage.River];

    // Process stages in order
    for (const stageNum of stageOrder) {
        const stageActions = groupedActions[stageNum];

        if (stageActions && stageActions.length > 0) {
            lines.push(`\n${getStageName(stageNum).toUpperCase()}${getStageCards(stageNum, communityCards)}\n`);

            const visibleActions = stageActions.filter(a => !a.was_auto_folded);

            if (visibleActions.length === 0 && stageNum !== Stage.Preflop) {
            }

            if (visibleActions.length > 0) {
                visibleActions.forEach(action => {
                    lines.push(`${action.position}: ${action.text_description}`);
                });
            } else if (stageNum > Stage.Preflop) {
                const onlyChecks = stageActions.every(a => a.decision === 'X');
                if (onlyChecks) {
                    lines.push("(Checked around)");
                } else {
                    lines.push("(No significant action shown)");
                }

            }
        }
    }

    if (showdown.length > 0) {
        lines.push("\nSHOWDOWN");

        showdown.forEach(handInfo => {
                const cardsString = handInfo.hole_cards
                lines.push(`- ${handInfo.position} shows [ ${cardsString} ]`);
            });

        const winner = showdown.find(h => h.is_winner);
        if (winner) {
            lines.push(`\nWinner: ${winner.position} wins ${pot} with ${winner.hand_description}`);
    } else {
        // Optional: Indicate how the hand ended if not by showdown (e.g. player won uncontested)
        // This would require analysing the last actions. For simplicity, we omit this for now.
    }
    }

    // Join lines into a single string
    const historyString = lines.join('\n');
    console.log("\n", historyString); // For debugging
    return historyString;
}

export function parseStackSizes(stackString: string, sequence: string[],
    smallBlind: number, bigBlind: number
): { [position: string]: number } {
    if (!stackString) {
        return {};
    }
    const stackObjects: { [position: string]: number } = {};
    const stackEntries = stackString.split(',').map(entry => entry.trim());
    for (const entry of stackEntries) {
        const match = entry.match(/^([a-zA-Z]+)\s+(\d+)$/);
        if (match) {
            const position = match[1].toUpperCase();
            const size = parseInt(match[2], 10);
            if (!isNaN(size)) {
                stackObjects[position] = size;
            }
        }
    }
    const result = sequence.reduce((acc, player) => {
        if (!stackObjects[player]) {
            stackObjects[player] = Number.POSITIVE_INFINITY;
        }
        return acc;
    }, stackObjects);
    if (result[Position.SB] !== Number.POSITIVE_INFINITY) {
        result[Position.SB] = result[Position.SB] - smallBlind
    }
    if (result[Position.BB] !== Number.POSITIVE_INFINITY) {
        result[Position.BB] = result[Position.BB] - bigBlind
    }

    // TODO handle straddles and antes
    return result;
}

export function transFormCardsToFormattedString(cards: string): string {
    return cards.split('').map((c, i) => i % 2 === 0 ? c.toUpperCase() : c.toLowerCase()).join('');
}

export function formatCommunityCards(cards: string[]): string[] {
    return cards.map(c => `${c[0].toUpperCase()}${c[1].toLowerCase()}`);
}

export function moveFirstTwoToEnd(list: PlayerStatus[]): PlayerStatus[] {
    if (list.length < 2 || list.length > 9) {
        throw new Error("List length must be between 2 and 9 elements.");
    }

    if (list.length === 2) {
        return list;
    }
    return [...list.slice(2), ...list.slice(0, 2)];
}

export function positionToRank(positionKey: string): number {
    const positionToRankMap: Record<string, number> = {
        'SB': 0,
        'BB': 1,
        'UTG': 2,
        'UTG_1': 3,
        'UTG_2': 4,
        'LJ': 5,
        'HJ': 6,
        'CO': 7,
        'BU': 8,
    }
    return positionToRankMap[positionKey];
}


export const getInitialGameState = (): GameState => {
    return initialState;
};


const VALID_RANKS = 'AKQJT98765432';
const VALID_SUITS = 'SHDCX'; // spades, hearts, diamonds, clubs, random

const isRank = (char: string): boolean => VALID_RANKS.includes(char);
export const isSuit = (char: string): boolean => VALID_SUITS.includes(char);

/**
 * Converts a 4-character poker hand string from RRSS format (Rank1, Rank2, Suit1, Suit2)
 * to RSRS format (Rank1, Suit1, Rank2, Suit2).
 *
 * For example, "AQss" becomes "AsQs", and "T9ch" becomes "Tc9h".
 *
 * @param rrssHandString The 4-character input string, expected to be in RRSS format.
 * @returns The hand string converted to RSRS format.
 * @throws Error if the input string is null, not 4 characters long, or doesn't match the RRSS format (Rank, Rank, Suit, Suit).
 */
export function convertRRSS_to_RSRS(rrssHandString: string | null | undefined): string {
    // Define valid characters (using common poker notation casing)

    // Helper functions for validation

    // 1. Validate input type and length
    if (typeof rrssHandString !== 'string' || rrssHandString.length !== 4) {
        throw new Error(
            `Invalid input: Hand string must be exactly 4 characters long. Received: "${rrssHandString}"`
        );
    }

    // 2. Extract characters based on RRSS assumption
    const rank1 = rrssHandString[0];
    const rank2 = rrssHandString[1];
    const suit1 = rrssHandString[2];
    const suit2 = rrssHandString[3];

    // 3. Validate that the input string actually matches the RRSS format
    if (!isRank(rank1)) {
        throw new Error(`Invalid RRSS format: First character "${rank1}" must be a rank (${VALID_RANKS}).`);
    }
    if (!isRank(rank2)) {
        throw new Error(`Invalid RRSS format: Second character "${rank2}" must be a rank (${VALID_RANKS}).`);
    }
    if (!isSuit(suit1)) {
        throw new Error(`Invalid RRSS format: Third character "${suit1}" must be a suit (${VALID_SUITS}).`);
    }
    if (!isSuit(suit2)) {
        throw new Error(`Invalid RRSS format: Fourth character "${suit2}" must be a suit (${VALID_SUITS}).`);
    }

    // 4. Perform the conversion by rearranging the characters
    // R1 R2 S1 S2  ->  R1 S1 R2 S2
    const rsrsHandString = rank1 + suit1 + rank2 + suit2;

    return rsrsHandString;
}


/**
* Converts a 4-character string representing a poker hand into a two-card array.
* Handles two formats:
* 1. RSRS (Rank1, Suit1, Rank2, Suit2) - e.g., "AsQs" -> ["As", "Qs"]
* 2. RRSS (Rank1, Rank2, Suit1, Suit2) - e.g., "AQss" -> ["As", "Qs"], "T9ch" -> ["Tc", "9h"]
*
* @param handString The 4-character input string.
* @returns A tuple `[string, string]` containing the two card strings (e.g., ["As", "Qs"]).
* @throws Error if the input string is invalid (length, format, characters).
*/
export function parsePokerHandString(handString: string): string {
    // 1. Validate input type and length
    if (typeof handString !== 'string' || handString.length !== 4) {
        throw new Error(
            `Invalid input: Hand string must be exactly 4 characters long. Received: "${handString}"`
        );
    }

    // 2. Extract characters
    const c1 = handString[0]; // Potential Rank 1
    const c2 = handString[1]; // Potential Suit 1 or Rank 2
    const c3 = handString[2]; // Potential Rank 2 or Suit 1
    const c4 = handString[3]; // Potential Suit 2

    // 3. Preliminary validation: First char must be Rank, last must be Suit
    if (!isRank(c1)) {
        throw new Error(
            `Invalid input: First character "${c1}" must be a valid rank (${VALID_RANKS}).`
        );
    }
    if (!isSuit(c4)) {
        throw new Error(
            `Invalid input: Last character "${c4}" must be a valid suit (${VALID_SUITS}).`
        );
    }

    let card1: string;
    let card2: string;

    // 4. Determine format based on the character at index 1 (c2)
    if (isSuit(c2)) {
        // --- Format 1: R1 S1 R2 S2 ---
        // Example: "AsQs"
        // Validate remaining structure: c3 must be Rank
        if (!isRank(c3)) {
            throw new Error(
                `Invalid input: Format appears to be RSRS, but character at index 2 "${c3}" is not a valid rank (${VALID_RANKS}).`
            );
        }
        const rank1 = c1;
        const suit1 = c2;
        const rank2 = c3;
        const suit2 = c4; // c4 already validated as suit

        card1 = rank1.toUpperCase() + suit1.toLowerCase(); // e.g., "A" + "s"
        card2 = rank2.toUpperCase() + suit2.toLowerCase(); // e.g., "Q" + "s"

    } else if (isRank(c2)) {
        // --- Format 2: R1 R2 S1 S2 ---
        // Examples: "AQss", "T9ch"
        // Validate remaining structure: c3 must be Suit
        if (!isSuit(c3)) {
            throw new Error(
                `Invalid input: Format appears to be RRSS, but character at index 2 "${c3}" is not a valid suit (${VALID_SUITS}).`
            );
        }
        const rank1 = c1;
        const rank2 = c2;
        const suit1 = c3;
        const suit2 = c4; // c4 already validated as suit

        card1 = rank1.toUpperCase() + suit1.toLowerCase(); // e.g., "A" + "s"
        card2 = rank2.toUpperCase() + suit2.toLowerCase(); // e.g., "Q" + "s" or "9" + "h"

    } else {
        // Character at index 1 is neither a valid Rank nor a valid Suit
        throw new Error(
            `Invalid input: Character at index 1 "${c2}" must be a valid rank (${VALID_RANKS}) or suit (${VALID_SUITS}).`
        );
    }

    // 5. Return the result as a tuple
    return `${card1}${card2}`;
}

/**
 * Converts a 6-character string representing the three flop cards into a three-card array.
 * Handles two formats:
 * 1. RSRSRS (R1S1 R2S2 R3S3) - e.g., "AsKcTd" -> ["As", "Kc", "Td"]
 * 2. RRRSSS (R1R2R3 S1S2S3) - e.g., "AKTscd" -> ["As", "Kc", "Td"]
 *
 * @param flopString The 6-character input string representing the flop.
 * @returns A tuple `[string, string, string]` containing the three card strings.
 * @throws Error if the input string is invalid (null, length, format, characters).
 */
export function parseFlopString(flopString: string | null | undefined): [string, string, string] {
    // 1. Validate input type and length
    if (typeof flopString !== 'string' || flopString.length !== 6) {
        throw new Error(
            `Invalid input: Flop string must be exactly 6 characters long. Received: "${flopString}"`
        );
    }

    // 2. Extract characters
    const c1 = flopString[0]; // Potential Rank 1
    const c2 = flopString[1]; // Potential Suit 1 or Rank 2
    const c3 = flopString[2]; // Potential Rank 2 or Rank 3
    const c4 = flopString[3]; // Potential Suit 2 or Suit 1
    const c5 = flopString[4]; // Potential Rank 3 or Suit 2
    const c6 = flopString[5]; // Potential Suit 3

    // 3. Preliminary validation: First char must be Rank, last must be Suit
    if (!isRank(c1)) {
        throw new Error(`Invalid input: First character "${c1}" must be a valid rank (${VALID_RANKS}).`);
    }
    if (!isSuit(c6)) {
        throw new Error(`Invalid input: Last character "${c6}" must be a valid suit (${VALID_SUITS}).`);
    }

    let card1: string;
    let card2: string;
    let card3: string;

    // 4. Determine format based on character at index 1 (c2)
    if (isSuit(c2)) {
        // --- Format 1: R1 S1 R2 S2 R3 S3 --- e.g., "AsKcTd"
        // Validate the rest of the structure: R S R S R S
        if (!isRank(c3)) throw new Error(`Invalid RSRSRS format: Character 3 "${c3}" must be a rank.`);
        if (!isSuit(c4)) throw new Error(`Invalid RSRSRS format: Character 4 "${c4}" must be a suit.`);
        if (!isRank(c5)) throw new Error(`Invalid RSRSRS format: Character 5 "${c5}" must be a rank.`);
        // c6 already validated as suit

        // Assign cards directly
        card1 = c1 + c2;
        card2 = c3 + c4;
        card3 = c5 + c6;

    } else if (isRank(c2)) {
        // --- Format 2: R1 R2 R3 S1 S2 S3 --- e.g., "AKTscd"
        // Validate the rest of the structure: R R R S S S
        if (!isRank(c3)) throw new Error(`Invalid RRRSSS format: Character 3 "${c3}" must be a rank.`);
        if (!isSuit(c4)) throw new Error(`Invalid RRRSSS format: Character 4 "${c4}" must be a suit.`);
        if (!isSuit(c5)) throw new Error(`Invalid RRRSSS format: Character 5 "${c5}" must be a suit.`);
        // c6 already validated as suit

        // Assign cards pairing Ranks with corresponding Suits
        card1 = c1 + c4; // Rank 1 + Suit 1
        card2 = c2 + c5; // Rank 2 + Suit 2
        card3 = c3 + c6; // Rank 3 + Suit 3

    } else {
        // Character at index 1 is neither a valid Rank nor a valid Suit
        throw new Error(
            `Invalid input: Character at index 1 "${c2}" must be a valid rank (${VALID_RANKS}) or suit (${VALID_SUITS}).`
        );
    }

    // 5. Return the result as a fixed-size tuple
    return [card1, card2, card3];
}