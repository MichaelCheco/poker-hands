import { initialState } from "../constants";
import { ActionRecord, CalculatedPot, Decision, GameState, HandPot, PlayerAction, PlayerPotContribution, PlayerStacks, PlayerStatus, PlayerTag, PokerPlayerInput, Position, ShowdownHandRecord, Stage, ThirdBlindInfo } from "../types";
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

export function isPreflop(stage: Stage): boolean {
    return stage === Stage.Preflop;
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

/**
 * Generates a textual summary of actions that occurred on the last played street
 * (Flop, Turn, or River) for hands that did not reach showdown.
 *
 * @param actions - An array of all poker actions in the hand, sorted by action_index.
 * @returns A string summarizing the actions on the last played post-flop street,
 * or a message indicating the hand ended preflop or had no actions.
 */
export function generateLastStreetActionSummary(actions: ActionRecord[]): string {
    if (!actions || actions.length === 0) {
        return "No actions recorded for this hand.";
    }

    let lastPlayedPostFlopStage: Stage | null = null;

    // Iterate backwards to find the last post-flop street with action
    for (let i = actions.length - 1; i >= 0; i--) {
        const stage = actions[i].stage;
        if (stage === Stage.Flop || stage === Stage.Turn || stage === Stage.River) {
            lastPlayedPostFlopStage = stage;
            break;
        }
    }

    if (lastPlayedPostFlopStage === null) {
        return "Hand ended preflop."; // Or "No post-flop actions to summarize."
    }

    // Filter actions for that specific last played post-flop street
    const lastStreetActions = actions.filter(action => action.stage === lastPlayedPostFlopStage);

    if (lastStreetActions.length === 0) {
        // This case should ideally not be reached if lastPlayedPostFlopStage was found
        // and actions array is not malformed.
        return `No actions found on the ${getStageName(lastPlayedPostFlopStage)}.`;
    }

    // Construct the summary from the text_description of each action on that street
    const actionDescriptions = lastStreetActions.map(action => {
        // Prepend position if not already in text_description to avoid "CO CO bets..."
        // This check is basic; more sophisticated NLP might be needed for perfect grammar.
        const positionUpper = action.position.toUpperCase();
        const textDescUpper = action.text_description.toUpperCase();
        if (textDescUpper.startsWith(positionUpper) || textDescUpper.startsWith(action.position.toLowerCase())) {
            return action.text_description;
        }
        return `${action.position} ${action.text_description}`;
    });

    return `${getStageName(lastPlayedPostFlopStage)}: ${actionDescriptions.join(', ')}.`;
}

function getStageCards(stage: Stage, communityCards: string[]): string {
    const flopCardStr = communityCards.slice(0, 3).map(c => `${c[0]}${getSuit(c[1])}`).join(' ');
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
    showdown: ShowdownHandRecord[],
    stacks: PlayerStacks,
    thirdBlind: number | undefined
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
        showdown,
        stacks,
        thirdBlind
    );
    try {
        await Clipboard.setStringAsync(text);
        // console.log("Hand history copied to clipboard.");
        return true;
    } catch (error) {
        console.error("Failed to copy hand history to clipboard:", error);
        return false;
    }
}

export function tagToLabel(tag: PlayerTag): string {
    switch (tag) {
        case PlayerTag.kLag:
            return "Loose Aggressive"
        case PlayerTag.kTag:
            return "Tight Aggressive"
        case PlayerTag.kLp:
            return "Loose Passive"
        case PlayerTag.kTp:
            return "Tight Passive"
        case PlayerTag.kWhale:
            return "Whale"
        case PlayerTag.kManiac:
            return "Maniac"
        case PlayerTag.kPro:
            return "Pro"
        case PlayerTag.kNit:
            return "Nit"
    }
}

export function tagToAbbrievatedLabel(tag: PlayerTag): string {
    switch (tag) {
        case PlayerTag.kLag:
            return "LA"
        case PlayerTag.kTag:
            return "TA"
        case PlayerTag.kLp:
            return "LP"
        case PlayerTag.kTp:
            return "TP"
        case PlayerTag.kWhale:
            return "W"
        case PlayerTag.kManiac:
            return "M"
        case PlayerTag.kPro:
            return "P"
        case PlayerTag.kNit:
            return "N"
    }
}

export type StreetPotSizes = Partial<Record<Stage.Flop | Stage.Turn | Stage.River, number>>;

export function getPotSizesEnteringStreets(actions: ActionRecord[]): StreetPotSizes {
    const potSizesByStreet: StreetPotSizes = {};
    const recordedStages = new Set<Stage>(); // To ensure we only record the first action of a street

    for (const action of actions) {
        const currentStage = action.stage;

        // We are only interested in Flop, Turn, and River
        if (
            (currentStage === Stage.Flop ||
                currentStage === Stage.Turn ||
                currentStage === Stage.River) &&
            !recordedStages.has(currentStage) // Check if we've already recorded this stage
        ) {
            if (action.pot_size_before !== null && action.pot_size_before !== undefined) {
                potSizesByStreet[currentStage as Stage.Flop | Stage.Turn | Stage.River] = action.pot_size_before;
            }
            recordedStages.add(currentStage); // Mark this stage as recorded
        }

        // Optimization: if all relevant stages are recorded, we can stop iterating
        if (recordedStages.has(Stage.Flop) &&
            recordedStages.has(Stage.Turn) &&
            recordedStages.has(Stage.River)) {
            break;
        }
    }
    return potSizesByStreet;
}

export function tagToAbbreviatedLabel(tag: PlayerTag): string {
    switch (tag) {
        case PlayerTag.kLag:
            return "LA"
        case PlayerTag.kTag:
            return "TA"
        case PlayerTag.kLp:
            return "LP"
        case PlayerTag.kTp:
            return "TP"
        case PlayerTag.kWhale:
            return "W"
        case PlayerTag.kManiac:
            return "M"
        case PlayerTag.kPro:
            return "P"
        case PlayerTag.kNit:
            return "N"
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
    showdown: ShowdownHandRecord[],
    stacks: PlayerStacks,
    thirdBlind: number | undefined,
): string {
    if (!actions || actions.length === 0) {
        console.warn("No actions provided to format.");
        return '';
    }
    const positionsForPlayersInHand = showdown.map(s => s.position);
    const relevantStacks = positionsForPlayersInHand.map(p => stacks[p] ?? bigBlind * 100);
    const effectiveStack = Math.min(...relevantStacks);
    const lines: string[] = [];
    lines.push('')
    lines.push(`$${smallBlind}/$${bigBlind}${thirdBlind ? `/$${thirdBlind}` : ''} • ${location}`.trimStart());
    lines.push(`\nHero: ${hand} ${position}`.trimStart());
    lines.push(`\nEff: $${effectiveStack}`.trimStart());

    // Group actions by stage
    const groupedActions: { [stage: number]: ActionRecord[] } = {};
    const stageToPotSizeMap = getPotSizesEnteringStreets(actions);
    for (const action of actions) {
        // Only include stages relevant to betting rounds for action listing
        if (action.stage <= Stage.River) {
            if (!groupedActions[action.stage]) {
                groupedActions[action.stage] = [];
            }
            groupedActions[action.stage].push(action);
        }
    }
    // Define the order of stages
    const stageOrder: Stage[] = [Stage.Preflop, Stage.Flop, Stage.Turn, Stage.River];
    // Tracks the total bet amount of the last aggressor on the current street
    let lastAggressiveBetTotalOnStreet = 0;

    // Process stages in order
    for (const stageNum of stageOrder) {
        const stageActions = groupedActions[stageNum];

        if (stageActions && stageActions.length > 0) {
            lines.push(`\n${getStageName(stageNum).toUpperCase()}${getStageCards(stageNum, communityCards)} ${stageNum !== Stage.Preflop && stageNum !== Stage.Showdown && `($${stageToPotSizeMap[stageNum]})`}\n`);
            // Reset for each new street
            if (stageNum === Stage.Preflop) {
                // Preflop, the BB is the initial "bet" to overcome
                lastAggressiveBetTotalOnStreet = (thirdBlind || bigBlind);
            } else {
                // Postflop, starts at 0 until a bet
                lastAggressiveBetTotalOnStreet = 0;
            }
            const visibleActions = stageActions.filter(a => !a.was_auto_folded);

            if (visibleActions.length > 0) {
                visibleActions.forEach(action => {
                    let actionDetails = "";
                    const currentPotSizeBeforeAction = action.pot_size_before;

                    if (action.decision === Decision.kBet) {
                        if (currentPotSizeBeforeAction > 0) { // Avoid division by zero if pot is 0 (shouldn't happen post-blinds)
                            const potPercentage = (action.action_amount / currentPotSizeBeforeAction) * 100;
                            actionDetails = ` (${potPercentage.toFixed(0)}%)`;
                        }
                        lastAggressiveBetTotalOnStreet = action.action_amount; // This bet is now the one to beat/raise
                    } else if (action.decision === Decision.kRaise) {
                        if (lastAggressiveBetTotalOnStreet > 0) { // If there was a previous bet/raise to calculate against
                            const raiseMultiple = action.action_amount / lastAggressiveBetTotalOnStreet;
                            actionDetails = ` (${raiseMultiple.toFixed(1)}x)`;
                        } else if (stageNum === Stage.Preflop && currentPotSizeBeforeAction === bigBlind + smallBlind + (thirdBlind || 0)) {
                            // First raise preflop over blinds (no limpers)
                            // lastAggressiveBetTotalOnStreet was already set to bigBlind
                            const raiseMultiple = action.action_amount / (thirdBlind || bigBlind);
                            actionDetails = ` (${raiseMultiple.toFixed(1)}x BB)`;
                        }
                        // If lastAggressiveBetTotalOnStreet is 0 postflop, it implies this 'R' is an error, should be 'B'.
                        // Or, if it's a raise over limpers preflop, lastAggressiveBetTotalOnStreet would still be bigBlind.
                        lastAggressiveBetTotalOnStreet = action.action_amount; // This raise is now the one to beat/raise
                    } else if (action.decision === Decision.kCall || action.decision === Decision.kCheck || action.decision === Decision.kFold) {
                        // For calls, checks, folds, lastAggressiveBetTotalOnStreet remains unchanged
                        // as it refers to the standing bet they are responding to.
                    }


                    lines.push(`${action.position}${action.position === position ? ' (H)' : ''}: ${action.text_description}${actionDetails}`);
                });
            } else if (stageNum > Stage.Preflop) { // Only show "Checked around" for postflop if no visible actions
                const onlyChecks = stageActions.every(a => a.decision === Decision.kCheck);
                if (onlyChecks) {
                    lines.push("(Checked around)");
                }
            }
        }
    }

    if (showdown.length > 0) {
        lines.push("\nSHOWDOWN");

        showdown.forEach(handInfo => {
            const cardsString = handInfo.hole_cards;
            if (cardsString.trim().toLowerCase() === "muck") {
                lines.push(`- ${handInfo.position === position ? 'Hero' : handInfo.position} mucks`);
            } else {
                lines.push(`- ${handInfo.position === position ? 'Hero' : handInfo.position} shows [ ${cardsString} ]`);
            }
        });

        const winner = showdown.find(h => h.is_winner);
        if (winner) {
            lines.push(`\nWinner: ${winner.position === position ? 'Hero' : winner.position} wins $${pot} with ${winner.hand_description}`);
        } else {
            // Optional: Indicate how the hand ended if not by showdown (e.g. player won uncontested)
            // This would require analysing the last actions. For simplicity, we omit this for now.
        }
    }

    // Join lines into a single string
    const historyString = lines.join('\n');
    // console.log("\n", historyString);
    return historyString;
}

export function parseStackSizes(stackString: string, sequence: string[],
    smallBlind: number, bigBlind: number, bigBlindAnte: boolean,  thirdBlind?: ThirdBlindInfo,
): PlayerStacks {
    const stackObjects: PlayerStacks = {};
    const stackEntries = stackString.split(',').map(entry => entry.trim());
    const defaultStackSize = bigBlind * 100;
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
            stackObjects[player as Position] = defaultStackSize;
        }
        return acc;
    }, stackObjects);
    result[Position.SB] = result[Position.SB] as number - smallBlind;
    result[Position.BB] = result[Position.BB] as number - (bigBlindAnte ? bigBlind * 2 : bigBlind);
    if (thirdBlind) {
        result[thirdBlind.position] = result[thirdBlind.position] as number - thirdBlind.amount;
    }
    // TODO handle straddles and antes
    return result;
}

export function parseStackSizes2(stackString: string
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
    return stackObjects;
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
        'UTG1': 3,
        'UTG2': 4,
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

export function calculateSidePots(allPlayerContributions: PlayerPotContribution[]): CalculatedPot[] {
    // 1. Filter for players who are still in the hand (eligible) to determine pot layers
    const activePlayers = allPlayerContributions.filter(p => p.eligible);

    if (activePlayers.length === 0) {
        // No active players, so no one can win any pot.
        // However, if money was contributed, a pot still exists.
        // This function's primary role is to define pots and eligibility.
        // If all players folded, the last aggressor might take the pot,
        // or it's handled by other game logic.
        // For now, if no one is eligible, we can return empty or pots with no eligible players.
        // Let's assume if no one is active, the pot formation logic here might not be what's needed,
        // as the hand likely ended pre-showdown with a single winner.
        // However, if the goal is to just show how money was layered:
        if (allPlayerContributions.some(p => p.amount > 0)) {
            // This scenario is complex: all eligible players folded.
            // The pot still contains money from folded players.
            // The "winner" is determined by game rules (e.g. last remaining player before everyone folded).
            // This function focuses on side pot creation based on varying bet amounts.
            // If all active players folded, the concept of "eligible for this pot layer" breaks down
            // for showdown. Let's return empty for simplicity here, assuming pot awarded outside this.
            // A more advanced version might still form pots but list no one as eligible.
            return [];
        }
        return [];
    }

    // 2. Sort a *copy* of active players by their total contribution amount
    // This determines the "betting levels" for pot creation.
    let sortedActivePlayersByContribution = [...activePlayers].sort((a, b) => a.amount - b.amount);

    // 3. Initialize amounts contributed to *previously calculated pots in this function* to 0
    // This must be done for ALL players who contributed, not just active ones.
    const amountContributedToPriorPotsThisFunction: Record<Position, number> = {};
    for (const player of allPlayerContributions) { // Iterate over ALL players
        amountContributedToPriorPotsThisFunction[player.position] = 0;
    }

    const pots: CalculatedPot[] = [];
    let previousPotLevelBet = 0; // Tracks the cumulative bet level of the previous pot

    // Loop while there are active players with unallocated contributions defining pot levels
    while (sortedActivePlayersByContribution.length > 0) {
        // 4. Determine the current betting level based on the smallest total bet among *remaining active* players
        const currentContributionLevel = sortedActivePlayersByContribution[0].amount;

        if (currentContributionLevel <= previousPotLevelBet) {
            // This means the remaining active players all bet the same amount as the previous level,
            // or less (which shouldn't happen if sorted correctly and they are active).
            // Effectively, no new distinct layer to form based on active players.
            // Remove players already fully covered by previousPotLevelBet from consideration for defining new levels.
            sortedActivePlayersByContribution = sortedActivePlayersByContribution.filter(p => p.amount > previousPotLevelBet);
            if (sortedActivePlayersByContribution.length === 0) break;
            continue;
        }

        let currentPotLayerAmount = 0;
        const eligibleForThisPotLayer: Position[] = [];

        // 5. Iterate through ALL players who made any contribution to the hand
        //    to sum up money for this pot layer.
        for (const player of allPlayerContributions) { // Iterate over ALL players
            const playerPosition = player.position;
            const totalPlayerBet = player.amount;
            const alreadyAllocatedToPots = amountContributedToPriorPotsThisFunction[playerPosition] || 0;

            // Amount this player can contribute beyond what they've put in prior pots (in this function)
            const playerRemainingTotalContribution = totalPlayerBet - alreadyAllocatedToPots;

            // How much this player actually contributes to *this specific layer*
            // It's the minimum of what they have left to contribute, and the size of this layer.
            // The size of this layer is (currentContributionLevel - previousPotLevelBet).
            const contributionToThisLayer = Math.min(
                playerRemainingTotalContribution,
                currentContributionLevel - previousPotLevelBet
            );

            if (contributionToThisLayer > 0) {
                currentPotLayerAmount += contributionToThisLayer;
                amountContributedToPriorPotsThisFunction[playerPosition] += contributionToThisLayer;

                // Only add to eligiblePositions if they are still active (eligible: true)
                if (player.eligible) {
                    eligibleForThisPotLayer.push(playerPosition);
                }
            }
        }

        if (currentPotLayerAmount > 0) {
            pots.push({ potAmount: currentPotLayerAmount, eligiblePositions: eligibleForThisPotLayer });
        }

        previousPotLevelBet = currentContributionLevel; // Update the "high water mark" for contributions

        // 6. Remove active players whose total contribution has been fully accounted for at this level
        //    from consideration for defining *future* pot levels.
        sortedActivePlayersByContribution = sortedActivePlayersByContribution.filter(p => p.amount > currentContributionLevel);
    }

    return pots;
}