// --- Constants and Types ---

import { HandEvaluation, HandRank, ParsedCard, PokerPlayerInput, Rank, RankChar, Suit, WinnerInfo } from "./types";

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
    return { rank: RANK_MAP[rankChar], suit: suit, str: cardStr };
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

    // Combinations that include the first element
    const combosWithFirst = combinations(rest, k - 1);
    combosWithFirst.forEach(combo => {
        combos.push([firstElement, ...combo]);
    });

    // Combinations that do not include the first element
    const combosWithoutFirst = combinations(rest, k);
    combos.push(...combosWithoutFirst);

    return combos;
}


// --- 5-Card Hand Evaluation ---

function evaluate5Cards(hand5Str: string[]): HandEvaluation | null {
    const cards = parseCards(hand5Str); 
    if (cards.length !== 5) return null;

    // Sort cards by rank (descending) for easier processing
    cards.sort((a, b) => b.rank - a.rank);
    const ranks = cards.map(c => c.rank);
    const suits = cards.map(c => c.suit);

    // Check for Flush
    const isFlush = suits.every(s => s === suits[0]);

    // Check for Straight
    // Special case: A-2-3-4-5 (ranks are 14, 5, 4, 3, 2)
    const isAceLowStraight = ranks.join(',') === '14,5,4,3,2';
    // General case: ranks are sequential
    let isStraight = true;
    for (let i = 0; i < 4; i++) {
        if (ranks[i] !== ranks[i + 1] + 1) {
            isStraight = false;
            break;
        }
    }
    isStraight = isStraight || isAceLowStraight;
    const straightHighCard = isAceLowStraight ? 5 : ranks[0]; // High card is 5 for A-5 straight

    // Check for Straight Flush
    if (isStraight && isFlush) {
        return { rank: HandRank.STRAIGHT_FLUSH, values: [straightHighCard] };
    }

    // Group ranks to find pairs, trips, quads
    const rankCounts: { [rank: number]: number } = {};
    ranks.forEach(rank => {
        rankCounts[rank] = (rankCounts[rank] || 0) + 1;
    });
    const counts = Object.values(rankCounts);
    const distinctRanks = Object.keys(rankCounts).map(Number).sort((a, b) => b - a); // Ranks present, sorted high-low

    // Check for Four of a Kind
    if (counts.includes(4)) {
        const quadRank = distinctRanks.find(r => rankCounts[r] === 4)!;
        const kicker = distinctRanks.find(r => rankCounts[r] === 1)!;
        return { rank: HandRank.FOUR_OF_A_KIND, values: [quadRank, kicker] };
    }

    // Check for Full House
    if (counts.includes(3) && counts.includes(2)) {
        const tripRank = distinctRanks.find(r => rankCounts[r] === 3)!;
        const pairRank = distinctRanks.find(r => rankCounts[r] === 2)!;
        return { rank: HandRank.FULL_HOUSE, values: [tripRank, pairRank] };
    }

    // Check for Flush (if not Straight Flush)
    if (isFlush) {
        return { rank: HandRank.FLUSH, values: ranks }; // Use all 5 ranks as tie-breaker
    }

    // Check for Straight (if not Straight Flush)
    if (isStraight) {
        return { rank: HandRank.STRAIGHT, values: [straightHighCard] };
    }

    // Check for Three of a Kind
    if (counts.includes(3)) {
        const tripRank = distinctRanks.find(r => rankCounts[r] === 3)!;
        const kickers = distinctRanks.filter(r => rankCounts[r] === 1).sort((a, b) => b - a); // Should be 2 kickers
        return { rank: HandRank.THREE_OF_A_KIND, values: [tripRank, kickers[0], kickers[1]] };
    }

    // Check for Two Pair
    if (counts.filter(c => c === 2).length === 2) {
        const pairRanks = distinctRanks.filter(r => rankCounts[r] === 2).sort((a, b) => b - a);
        const kicker = distinctRanks.find(r => rankCounts[r] === 1)!;
        return { rank: HandRank.TWO_PAIR, values: [pairRanks[0], pairRanks[1], kicker] };
    }

    // Check for One Pair
    if (counts.includes(2)) {
        const pairRank = distinctRanks.find(r => rankCounts[r] === 2)!;
        const kickers = distinctRanks.filter(r => rankCounts[r] === 1).sort((a, b) => b - a); // Should be 3 kickers
        return { rank: HandRank.ONE_PAIR, values: [pairRank, kickers[0], kickers[1], kickers[2]] };
    }

    // High Card
    return { rank: HandRank.HIGH_CARD, values: ranks }; // Use all 5 ranks as tie-breaker
}

// --- Comparison Function ---

function compareEvaluations(evalA: HandEvaluation, evalB: HandEvaluation): number {
    // Compare by rank first
    if (evalA.rank !== evalB.rank) {
        return evalA.rank - evalB.rank; // Higher rank wins
    }
    // If ranks are equal, compare tie-breaking values
    for (let i = 0; i < evalA.values.length; i++) {
        if (evalA.values[i] !== evalB.values[i]) {
            return evalA.values[i] - evalB.values[i]; // Higher value wins
        }
    }
    // If all values are equal, it's a tie
    return 0;
}

// --- Map Rank to Description ---

function mapRankToDescription(rank: HandRank): string {
    switch (rank) {
        case HandRank.STRAIGHT_FLUSH: return "Straight Flush";
        case HandRank.FOUR_OF_A_KIND: return "Four of a Kind";
        case HandRank.FULL_HOUSE: return "Full House";
        case HandRank.FLUSH: return "Flush";
        case HandRank.STRAIGHT: return "Straight";
        case HandRank.THREE_OF_A_KIND: return "Three of a Kind";
        case HandRank.TWO_PAIR: return "Two Pair";
        case HandRank.ONE_PAIR: return "One Pair";
        case HandRank.HIGH_CARD: return "High Card";
        default: return "Unknown Hand";
    }
}

// --- Main Winner Determination Function ---

interface PlayerEvaluationResult extends PokerPlayerInput {
    bestEvaluation: HandEvaluation | null;
    best5Cards: string[]; // Store the actual best 5 cards found
}

export function determinePokerWinnerManual(
    players: PokerPlayerInput[],
    communityCardsStr: string[]
): WinnerInfo | null {
    if (!players || players.length === 0) {
        console.error("No players provided.");
        return null;
    }
    // Community cards can be 3, 4, or 5. Need at least 3.
    if (!communityCardsStr || communityCardsStr.length < 3) {
        console.error("Not enough community cards (minimum 3 required).");
        return null;
    }

    const communityCards = parseCards(communityCardsStr);
    if (communityCards.length !== communityCardsStr.length) {
        console.error("Invalid community cards detected.");
        return null; // Stop if any community card was invalid
    }


    const evaluatedPlayers: PlayerEvaluationResult[] = players.map(player => {
        const holeCards = parseCards(player.holeCards);
        if (holeCards.length !== player.holeCards.length || holeCards.length !== 2) {
            console.error(`Invalid hole cards for player ${player.playerId}`);
            // You might want to exclude this player or handle this case differently
            return { ...player, bestEvaluation: null, best5Cards: [] };
        }


        const availableCardsStr = [...player.holeCards, ...communityCardsStr];
        // Ensure we only try to combine if we have at least 5 cards total
        if (availableCardsStr.length < 5) {
            return { ...player, bestEvaluation: null, best5Cards: [] };
        }

        // Generate all 5-card combinations from the player's available cards
        const all5CardHands = combinations(availableCardsStr, 5);

        let bestEvalForPlayer: HandEvaluation = { rank: -1, values: [] }; // Initialize worse than High Card
        let bestCardsForPlayer: string[] = [];

        for (const hand5 of all5CardHands) {
            const currentEval = evaluate5Cards(hand5);
            if (currentEval) {
                if (bestEvalForPlayer.rank === -1 || compareEvaluations(currentEval, bestEvalForPlayer) > 0) {
                    bestEvalForPlayer = currentEval;
                    bestCardsForPlayer = hand5; // Store the cards that made this hand
                }
            }
        }

        return {
            ...player,
            bestEvaluation: bestEvalForPlayer.rank !== -1 ? bestEvalForPlayer : null,
            best5Cards: bestCardsForPlayer
        };

    }).filter(p => p.bestEvaluation !== null); // Filter out players whose hands failed evaluation


    if (evaluatedPlayers.length === 0) {
        console.error("No valid hands could be evaluated.");
        return null;
    }

    // Sort players by their best hand evaluation (descending)
    evaluatedPlayers.sort((a, b) => compareEvaluations(b.bestEvaluation!, a.bestEvaluation!));

    // The best evaluation is from the first player after sorting
    const winningEvaluation = evaluatedPlayers[0].bestEvaluation!;

    // Find all players who tie with this best evaluation
    const winnersData = evaluatedPlayers.filter(
        p => compareEvaluations(p.bestEvaluation!, winningEvaluation) === 0
    );

    // Get the cards from one of the winners (they all have the same rank/value)
    const winningHandCards = evaluatedPlayers[0].best5Cards;


    return {
        winners: winnersData.map(({ playerId, holeCards }) => ({ playerId, holeCards })),
        winningHandDescription: mapRankToDescription(winningEvaluation.rank),
        bestHandCards: winningHandCards, // Return the specific 5 cards
    };
}


// --- Example Usage (same as before) ---
/*
const players: PokerPlayerInput[] = [
    { playerId: "Alice", holeCards: ["Ac", "Ad"] },
    { playerId: "Bob", holeCards: ["Kh", "Qh"] },
    { playerId: "Charlie", holeCards: ["7s", "8s"] },
];
const community: string[] = ["Ah", "Ks", "5h", "Jh", "9s"];

const result = determinePokerWinnerManual(players, community);

if (result) {
    console.log("--- Manual Implementation Result ---");
    console.log("Winner(s):", result.winners.map(w => w.playerId).join(', '));
    // Expected: Winner(s): Alice
    console.log("Winning Hand:", result.winningHandDescription);
    // Expected: Winning Hand: Three of a Kind
    console.log("Best 5 Cards:", result.bestHandCards.sort()); // Sort for consistent comparison
    // Expected: Best 5 Cards: [ 'Ac', 'Ad', 'Ah', 'Jh', 'Ks' ] (Sorted Ace, Ace, Ace, King, Jack)
} else {
    console.log("Could not determine winner.");
}

const players2: PokerPlayerInput[] = [
     { playerId: "Player1", holeCards: ["Ah", "Kh"] },
     { playerId: "Player2", holeCards: ["Ad", "Kd"] },
 ];
 const community2: string[] = ["As", "Ks", "Qh", "Qd", "Js"];

 const result2 = determinePokerWinnerManual(players2, community2);
 if (result2) {
      console.log("\n--- Manual Implementation Result 2 (Split Pot) ---");
      console.log("Winner(s):", result2.winners.map(w => w.playerId).join(', '));
      // Expected: Winner(s): Player1, Player2
      console.log("Winning Hand:", result2.winningHandDescription);
      // Expected: Winning Hand: Two Pair
      console.log("Best 5 Cards:", result2.bestHandCards.sort());
      // Expected: Best 5 Cards: [ 'Ad', 'Ah', 'Kd', 'Kh', 'Js' ] (Sorted Ace, Ace, King, King, Jack)
 }
*/