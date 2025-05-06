import { initialState } from "../constants";
import { ActionRecord, Decision, GameState, PlayerAction, PlayerStacks, PlayerStatus, PokerPlayerInput, Position, ShowdownHandRecord, Stage } from "../types";
import * as Clipboard from 'expo-clipboard';
import { format, parseISO } from 'date-fns';

export function calculateEffectiveStack(
    positionsLeft: string[],
    stacks: { [position: string]: number }
): number {
    // 1. Map the list of positions directly to their stack sizes
    //    (Assumes every position exists in stacks and the value is a number)
    const relevantStacks = positionsLeft.map(position => stacks[position]);
    // 2. Find the minimum value among those stack sizes
    //    Math.min() returns Infinity if relevantStacks is empty (shouldn't happen if positionsLeft isn't empty)
    //    Math.min() returns NaN if any value in relevantStacks is not a number (e.g., undefined from a bad lookup)
    const effectiveStack = Math.min(...relevantStacks);

    return effectiveStack;
}

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

export function decisionToText(decision: Decision): string {
    switch (decision) {
        case Decision.kCheck: return 'checked';
        case Decision.kBet: return 'bet';
        case Decision.kCall: return 'called';
        case Decision.kFold: return 'folded';
        case Decision.kRaise: return 'raised';
        case Decision.kAllIn: return 'all-in';
    }
}

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
): PlayerStacks {
    const stackObjects: PlayerStacks = {};
    const stackEntries = stackString.split(',').map(entry => entry.trim());
    for (const entry of stackEntries) {
        const match = entry.match(/^([a-zA-Z]+)\s+(\d+)$/);
        if (match) {
            const position = match[1].toUpperCase();
            const size = parseInt(match[2], 10);
            if (!isNaN(size)) {
                stackObjects[position as Position] = size;
            }
        }
    }
    const result: PlayerStacks = sequence.reduce((acc, player) => {
        if (!stackObjects[player as Position]) {
            stackObjects[player as Position] = Number.POSITIVE_INFINITY;
        }
        return acc;
    }, stackObjects);
    if (result[Position.SB] !== Number.POSITIVE_INFINITY) {
        result[Position.SB] = result[Position.SB] as number - smallBlind
    }
    if (result[Position.BB] !== Number.POSITIVE_INFINITY) {
        result[Position.BB] = result[Position.BB] as number  - bigBlind
    }

    // TODO handle straddles and antes
    return result;
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

export function formatHeroHand(hero: { position: string, hand: string }): PokerPlayerInput {
    return {
        playerId: hero.position,
        holeCards: [hero.hand.slice(0, 2), hero.hand.slice(2)],
        description: '',
    }
}