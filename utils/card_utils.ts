import { ActionType, Decision, GameQueueItem, GameQueueItemType, PlayerAction, PokerPlayerInput, Position } from "@/types";

export function isMuck(text: string): boolean {
    return text.toLowerCase().trim() === "muck";
}

export function didAllInAndACallOccurOnStreet(playerActions: PlayerAction[]): boolean {
    let allInIndex = playerActions.findIndex((action: PlayerAction) => action.decision === Decision.kAllIn);
    if (allInIndex === -1) {
        return false;
    }
    const decisions = Object.values(Decision).filter(d => d !== Decision.kFold);
    return playerActions.slice(allInIndex + 1).some(((action: PlayerAction) => decisions.includes(action.decision)));
}

export function getRemainingCardActions(gameQueue: GameQueueItem[]): GameQueueItem[] {
    return gameQueue.filter((item: GameQueueItem) => item.actionType !== ActionType.kActionSequence);
}

export function AddVillainsToGameQueue(villains: Position[]): GameQueueItem[] {
    const newQueueItems: GameQueueItem[] = villains.map(villain => ({
        placeholder: `${villain}'s cards`,
        shouldTransitionAfterStep: false,
        actionType: ActionType.kVillainCards,
        position: villain,
        id: GameQueueItemType.kVillainCard,
    }));
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
    const sortedQueueItems = newQueueItems.sort((a, b) => positionToRankMap[a.position as Position] - positionToRankMap[b.position as Position]);
    sortedQueueItems[sortedQueueItems.length - 1].shouldTransitionAfterStep = true;
    return sortedQueueItems;
}


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

export function transFormCardsToFormattedString(cards: string): string {
    return cards.split('').map((c, i) => i % 2 === 0 ? c.toUpperCase() : c.toLowerCase()).join('');
}

export function formatCommunityCards(cards: string[]): string[] {
    return cards.map(c => `${c[0].toUpperCase()}${c[1].toLowerCase()}`);
}

// Used to pick a random suit for a card (Ax).
function getRandomIndex(arrayLen: number): number {
    return Math.floor(Math.random() * arrayLen);
}

const cardHasDefinedSuit = (card: string) => card.charAt(1) !== "X";
export function getSuitForCard(card: string, currDeck: string[]): string {
    if (card.length !== 2) {
        console.error("Invalid card: ", card);
        return '';
    }

    if (cardHasDefinedSuit(card)) {
        return card;
    }

    const cardsInDeck = currDeck.filter(c => c.charAt(0) === card.charAt(0));
    return cardsInDeck[getRandomIndex(cardsInDeck.length)]
}

export function getVillainCards(inputCards: string, playerId: Position): PokerPlayerInput {
    const thirdCard = inputCards[2];
    const formattedCards = transFormCardsToFormattedString(isSuit(thirdCard) ? convertRRSS_to_RSRS(inputCards) : inputCards);
    const card1 = formattedCards.slice(0, 2);
    const card2 = formattedCards.slice(2);
    return { playerId, holeCards: [card1, card2] }
}

export function filterNewCardsFromDeck(newCards: string | string[], currDeck: string[]): string[] {
    const cards = typeof newCards === "string" ? extractCards(newCards.toUpperCase()) : newCards;
    return currDeck.filter(card => !cards.includes(card))
}

export function extractCards(str: string): string[] {
    const result = [];
    for (let i = 0; i < str.length; i += 2) {
        result.push(str.substring(i, i + 2));
    }
    return result;
}

export function getCards(communityCards: string[], currentDeck: string[], newCards: string) {
    const EMPTY_CARD = '';
    let deckToPickFrom = currentDeck;
    let cardsToAdd: string[] = newCards.length > 2 ? parseFlopString(newCards) : [newCards]
    for (let i = 0; i < communityCards.length; i++) {
        if (communityCards[i] === EMPTY_CARD) {
            const newCard = getSuitForCard(cardsToAdd.shift() as string, deckToPickFrom);
            deckToPickFrom = filterNewCardsFromDeck(newCard, deckToPickFrom);
            communityCards[i] = newCard;
            if (cardsToAdd.length === 0) {
                return communityCards;
            }
        }
    }
    return communityCards.map(c => `${c[0].toUpperCase()}${c[1].toLowerCase()}}`);
}