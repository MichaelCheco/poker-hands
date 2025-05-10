// --- Constants and Types ---

// Assuming these types are defined elsewhere, e.g., in ../types
export enum HandRank {
    HIGH_CARD = 0,
    ONE_PAIR = 1,
    TWO_PAIR = 2,
    THREE_OF_A_KIND = 3,
    STRAIGHT = 4,
    FLUSH = 5,
    FULL_HOUSE = 6,
    FOUR_OF_A_KIND = 7,
    STRAIGHT_FLUSH = 8
    // ROYAL_FLUSH is often treated as the highest Straight Flush
}

export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14; // 10=T, 11=J, 12=Q, 13=K, 14=A
export type RankChar = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'T' | 'J' | 'Q' | 'K' | 'A';
export type Suit = 's' | 'h' | 'd' | 'c'; // spades, hearts, diamonds, clubs

export interface ParsedCard {
    rank: Rank;
    suit: Suit;
    str: string; // Original card string e.g., "As", "Td"
}

export interface HandEvaluation {
    rank: HandRank | -1; // Use -1 for unevaluated or invalid
    values: Rank[]; // Tie-breaking card ranks, ordered by significance
    description?: string; // Optional rich description
}

export interface PokerPlayerInput {
    playerId: string; // Could be position string or UUID
    holeCards: string[]; // e.g., ["As", "Kd"]
}

export interface WinnerDetails {
    playerId: string;
    holeCards: string[];
    description?: string; // Rich hand description
}
export interface WinnerInfo {
    details: WinnerDetails[];
    winners: WinnerDetails[];
    winningHandDescription: string; // Rich description of the winning hand type
    bestHandCards: string[]; // The 5 cards that make the best hand
}


// --- Card Parsing ---

const RANK_MAP: { [key in RankChar]: Rank } = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
    'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
};
const RANK_CHAR_MAP: { [key in Rank]: RankChar } = {
    2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9',
    10: 'T', 11: 'J', 12: 'Q', 13: 'K', 14: 'A'
};
const SUITS: Suit[] = ['s', 'h', 'd', 'c'];

function parseCard(cardStr: string): ParsedCard | null {
    if (!cardStr || cardStr.length !== 2) return null;
    const rankChar = cardStr[0].toUpperCase() as RankChar;
    const suit = cardStr[1].toLowerCase() as Suit;

    if (!RANK_MAP[rankChar] || !SUITS.includes(suit)) {
        console.error(`Invalid card string: ${cardStr}`);
        return null;
    }
    return { rank: RANK_MAP[rankChar], suit: suit, str: cardStr.toUpperCase() }; // Store str consistently
}

function parseCards(cardStrings: string[]): ParsedCard[] {
    return cardStrings.map(parseCard).filter(c => c !== null) as ParsedCard[];
}

// --- Combinations Helper ---

function combinations<T>(arr: T[], k: number): T[][] {
    if (k < 0 || k > arr.length) {
        return [];
    }
    if (k === 0) {
        return [[]];
    }
    if (k === arr.length) {
        return [arr];
    }
    if (k === 1) {
        return arr.map(item => [item]);
    }

    const combos: T[][] = [];
    const firstElement = arr[0];
    const rest = arr.slice(1);

    const combosWithFirst = combinations(rest, k - 1);
    combosWithFirst.forEach(combo => {
        combos.push([firstElement, ...combo]);
    });

    const combosWithoutFirst = combinations(rest, k);
    combos.push(...combosWithoutFirst);

    return combos;
}


// --- 5-Card Hand Evaluation ---

function evaluate5Cards(hand5Str: string[]): HandEvaluation | null {
    const cards = parseCards(hand5Str);
    if (cards.length !== 5) return null;

    cards.sort((a, b) => b.rank - a.rank);
    const ranks = cards.map(c => c.rank);
    const suits = cards.map(c => c.suit);

    const isFlush = suits.every(s => s === suits[0]);
    const isAceLowStraight = ranks.join(',') === '14,5,4,3,2';
    // Check for general straight case (ranks are sequential after sorting)
    let isStraight = true;
    for (let i = 0; i < 4; i++) {
        if (ranks[i] !== ranks[i + 1] + 1) {
            isStraight = false;
            break;
        }
    }
    isStraight = isStraight || isAceLowStraight; // Combine general case with ace-low

    if (ranks.join(',') === '14,13,12,11,10' && isFlush) { // Royal Flush
        const evalResult: HandEvaluation = { rank: HandRank.STRAIGHT_FLUSH, values: [14] };
        return { ...evalResult, description: generateRichHandDescription(evalResult) };
    }
    const straightHighCard = isAceLowStraight ? 5 : ranks[0];

    if (isStraight && isFlush) {
        const evalResult: HandEvaluation = { rank: HandRank.STRAIGHT_FLUSH, values: [straightHighCard] };
        return { ...evalResult, description: generateRichHandDescription(evalResult) };
    }

    const rankCounts: { [rank: number]: number } = {};
    ranks.forEach(rank => { rankCounts[rank] = (rankCounts[rank] || 0) + 1; });
    const counts = Object.values(rankCounts);
    const distinctRanks = Object.keys(rankCounts).map(Number).sort((a, b) => b - a);

    if (counts.includes(4)) {
        const quadRank = distinctRanks.find(r => rankCounts[r] === 4)!;
        const kicker = distinctRanks.find(r => rankCounts[r] === 1)!;
        const evalResult: HandEvaluation = { rank: HandRank.FOUR_OF_A_KIND, values: [quadRank, kicker] };
        return { ...evalResult, description: generateRichHandDescription(evalResult) };
    }

    if (counts.includes(3) && counts.includes(2)) {
        const tripRank = distinctRanks.find(r => rankCounts[r] === 3)!;
        const pairRank = distinctRanks.find(r => rankCounts[r] === 2)!;
        const evalResult: HandEvaluation = { rank: HandRank.FULL_HOUSE, values: [tripRank, pairRank] };
        return { ...evalResult, description: generateRichHandDescription(evalResult) };
    }

    if (isFlush) {
        // For a flush, the 'values' are all 5 ranks sorted high to low.
        const evalResult: HandEvaluation = { rank: HandRank.FLUSH, values: ranks };
        return { ...evalResult, description: generateRichHandDescription(evalResult) };
    }

    if (isStraight) {
        const evalResult: HandEvaluation = { rank: HandRank.STRAIGHT, values: [straightHighCard] };
        return { ...evalResult, description: generateRichHandDescription(evalResult) };
    }

    if (counts.includes(3)) {
        const tripRank = distinctRanks.find(r => rankCounts[r] === 3)!;
        const kickers = distinctRanks.filter(r => rankCounts[r] === 1).sort((a, b) => b - a).slice(0, 2);
        const evalResult: HandEvaluation = { rank: HandRank.THREE_OF_A_KIND, values: [tripRank, ...kickers] };
        return { ...evalResult, description: generateRichHandDescription(evalResult) };
    }

    if (counts.filter(c => c === 2).length === 2) {
        const pairRanks = distinctRanks.filter(r => rankCounts[r] === 2).sort((a, b) => b - a);
        const kicker = distinctRanks.find(r => rankCounts[r] === 1)!;
        const evalResult: HandEvaluation = { rank: HandRank.TWO_PAIR, values: [pairRanks[0], pairRanks[1], kicker] };
        return { ...evalResult, description: generateRichHandDescription(evalResult) };
    }

    if (counts.includes(2)) {
        const pairRank = distinctRanks.find(r => rankCounts[r] === 2)!;
        const kickers = distinctRanks.filter(r => rankCounts[r] === 1).sort((a, b) => b - a).slice(0, 3);
        const evalResult: HandEvaluation = { rank: HandRank.ONE_PAIR, values: [pairRank, ...kickers] };
        return { ...evalResult, description: generateRichHandDescription(evalResult) };
    }

    const evalResult: HandEvaluation = { rank: HandRank.HIGH_CARD, values: ranks };
    return { ...evalResult, description: generateRichHandDescription(evalResult) };
}

// --- Comparison Function ---

function compareEvaluations(evalA: HandEvaluation, evalB: HandEvaluation): number {
    if (evalA.rank !== evalB.rank) {
        return evalA.rank - evalB.rank;
    }
    for (let i = 0; i < evalA.values.length; i++) {
        if (evalA.values[i] !== evalB.values[i]) {
            return evalA.values[i] - evalB.values[i];
        }
    }
    return 0;
}

// --- Generate Rich Hand Description ---
function getRankName(rank: Rank, plural: boolean = false): string {
    // For ranks T, J, Q, K, A, use their character representation if not pluralizing
    // or if it's for a high card context where the character is common.
    if (rank >= 10 && !plural && (rank !== 10 || plural)) { // Keep T, J, Q, K, A as chars unless plural or Ten
        // Special handling for Ten to be "Ten" not "T" if it's not plural
        if (rank === 10 && !plural) return 'Ten';
        return RANK_CHAR_MAP[rank];
    }
    if (rank < 10 && !plural) return RANK_CHAR_MAP[rank];


    const names: { [key in Rank]: string } = {
        2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six', 7: 'Seven', 8: 'Eight', 9: 'Nine',
        10: 'Ten', 11: 'Jack', 12: 'Queen', 13: 'King', 14: 'Ace'
    };
    let name = names[rank];
    if (plural) {
        if (name === 'Six') name = 'Sixes';
        else if (name === 'Ace') name = 'Aces'; // Ensure Aces for plural
        else if (name.endsWith('s') || name.endsWith('x')) name += 'es'; // e.g. Sixes (already handled), Tens
        else name += 's';
    }
    return name;
}


export function generateRichHandDescription(evaluation: HandEvaluation | null): string {
    if (!evaluation || evaluation.rank === -1) return "Unknown Hand";

    const { rank, values } = evaluation;
    // Use a more context-aware name for high cards in descriptions
    const cardName = (r: Rank) => getRankName(r, false); // Use singular form for card names
    const pluralRankName = (r: Rank) => getRankName(r, true); // Use plural for pairs, trips etc.

    switch (rank) {
        case HandRank.STRAIGHT_FLUSH:
            if (values[0] === 14) return "Royal Flush";
            return `Straight Flush, ${cardName(values[0])} high`;
        case HandRank.FOUR_OF_A_KIND:
            return `Four of a Kind, ${pluralRankName(values[0])} (Kicker: ${cardName(values[1])})`;
        case HandRank.FULL_HOUSE:
            return `Full House, ${pluralRankName(values[0])} full of ${pluralRankName(values[1])}`;
        case HandRank.FLUSH:
            // For Flush, values are all 5 cards of the flush, sorted.
            // We only need to state the high card of the flush.
            return `Flush, ${cardName(values[0])} high`;
        case HandRank.STRAIGHT:
            if (values[0] === 5 && values.includes(14)) return "Wheel (Straight, Five high)"; // A-2-3-4-5
            return `Straight, ${cardName(values[0])} high`;
        case HandRank.THREE_OF_A_KIND:
            return `Three of a Kind, ${pluralRankName(values[0])} (Kickers: ${values.slice(1).map(cardName).join(', ')})`;
        case HandRank.TWO_PAIR:
            return `Two Pair, ${pluralRankName(values[0])} and ${pluralRankName(values[1])} (Kicker: ${cardName(values[2])})`;
        case HandRank.ONE_PAIR:
            return `Pair of ${pluralRankName(values[0])} (Kickers: ${values.slice(1).map(cardName).join(', ')})`;
        case HandRank.HIGH_CARD:
            // For High Card, values are all 5 cards sorted.
            return `${cardName(values[0])} High (Kickers: ${values.slice(1).map(cardName).join(', ')})`;
        default:
            return "Unknown Hand";
    }
}


// --- Main Winner Determination Function ---

interface PlayerEvaluationResult extends PokerPlayerInput {
    bestEvaluation: HandEvaluation | null;
    best5Cards: string[];
}

export function determineHandWinner(
    players: PokerPlayerInput[],
    communityCardsStr: string[]
): WinnerInfo | null {
    if (!players || players.length === 0) {
        console.error("No players provided.");
        return null;
    }
    if (!communityCardsStr || communityCardsStr.length < 3) {
        // Allow for preflop all-ins where community cards might be < 3 when called
        // but for a full evaluation, we usually expect flop, turn, or river.
        // If the intent is to evaluate even with 0 community cards (e.g. preflop all-in),
        // this check needs adjustment. For now, assuming showdown on/after flop.
        console.warn("Not enough community cards for a standard showdown (minimum 3 expected). Evaluating based on available cards.");
    }

    const communityCardsParsed = parseCards(communityCardsStr);
    if (communityCardsParsed.length !== communityCardsStr.length && communityCardsStr.length > 0) {
        console.error("Invalid community cards detected during parsing.");
        return null; // Stop if any community card was invalid and cards were provided
    }

    const evaluatedPlayers: PlayerEvaluationResult[] = players.map(player => {
        const holeCardsParsed = parseCards(player.holeCards);
        if (holeCardsParsed.length !== player.holeCards.length || holeCardsParsed.length !== 2) {
            console.error(`Invalid hole cards for player ${player.playerId}. Found: ${player.holeCards.join(',')}`);
            return { ...player, bestEvaluation: null, best5Cards: [] };
        }

        // Combine hole cards and community cards (parsed versions)
        const availableParsedCards = [...holeCardsParsed, ...communityCardsParsed];
        // Convert back to string array for combinations function (as it expects string[])
        const availableCardsStr = availableParsedCards.map(c => c.str);


        if (availableCardsStr.length < 5) {
            // If less than 5 cards total, evaluate what's there (e.g., for incomplete boards)
            // This means evaluate5Cards needs to handle < 5 cards or we return a partial eval
            // For now, evaluate5Cards expects exactly 5. This path means no 5-card hand.
            console.warn(`Player ${player.playerId} has fewer than 5 total cards available. Cannot form a 5-card hand.`);
            return { ...player, bestEvaluation: null, best5Cards: [] };
        }

        const all5CardHands = combinations(availableCardsStr, 5);
        let bestEvalForPlayer: HandEvaluation = { rank: -1, values: [] };
        let bestCardsForPlayer: string[] = [];

        if (all5CardHands.length === 0 && availableCardsStr.length >= 5) {
            // This case should ideally not happen if combinations works correctly
            // and availableCardsStr.length >= 5. It might indicate an issue
            // if combinations returns empty for valid input.
            // However, if availableCardsStr.length is exactly 5, combinations should return [availableCardsStr]
            const currentEval = evaluate5Cards(availableCardsStr);
            if (currentEval) {
                bestEvalForPlayer = currentEval;
                bestCardsForPlayer = availableCardsStr;
            }
        } else {
            for (const hand5 of all5CardHands) {
                const currentEval = evaluate5Cards(hand5);
                if (currentEval) {
                    if (bestEvalForPlayer.rank === -1 || compareEvaluations(currentEval, bestEvalForPlayer) > 0) {
                        bestEvalForPlayer = currentEval;
                        bestCardsForPlayer = hand5;
                    }
                }
            }
        }

        return {
            ...player,
            bestEvaluation: bestEvalForPlayer.rank !== -1 ? bestEvalForPlayer : null,
            best5Cards: bestCardsForPlayer
        };
    }).filter(p => p.bestEvaluation !== null);


    if (evaluatedPlayers.length === 0) {
        console.error("No valid hands could be evaluated for any player.");
        return null;
    }

    evaluatedPlayers.sort((a, b) => compareEvaluations(b.bestEvaluation!, a.bestEvaluation!));

    const winningEvaluation = evaluatedPlayers[0].bestEvaluation!;
    const winnersData = evaluatedPlayers.filter(
        p => compareEvaluations(p.bestEvaluation!, winningEvaluation) === 0
    );

    // Ensure description is generated if not already on the evaluation object
    const finalWinningHandDescription = winningEvaluation.description || generateRichHandDescription(winningEvaluation);

    return {
        details: evaluatedPlayers.map((val) => ({
            playerId: val.playerId,
            holeCards: val.holeCards,
            description: val.bestEvaluation?.description || generateRichHandDescription(val.bestEvaluation)
        })),
        winners: winnersData.map(({ playerId, holeCards, bestEvaluation }) => ({
            playerId,
            holeCards,
            description: bestEvaluation?.description || generateRichHandDescription(bestEvaluation)
        })),
        winningHandDescription: finalWinningHandDescription,
        bestHandCards: evaluatedPlayers[0].best5Cards,
    };
}
