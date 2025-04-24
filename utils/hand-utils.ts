import { initialState } from "../constants";
import { GameState, HandSetupInfo, PlayerStatus, Position } from "../types";
import { supabase } from './supabase';

export async function saveHandToSupabase(
    handHistoryData: GameState,
    setupInfo: HandSetupInfo
): Promise<{ success: boolean; }> { // Returns nothing on success, throws error on failure

    console.log("Attempting to save hand...", handHistoryData, setupInfo);

    // 1. Get Authenticated User ID
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) throw new Error(`Authentication error: ${authError.message}`);
    if (!user) throw new Error('User not found. Cannot save hand.');
    const userId = user.id;

    // 2. Insert into 'hands' table
    const heroHandCards = parsePokerHandString(handHistoryData.hero.hand.toUpperCase()); // Assuming this returns ['Card1', 'Card2']

    const { data: handData, error: handError } = await supabase
        .from('hands')
        .insert({
            user_id: userId,
            played_at: setupInfo.playedAt ? new Date(setupInfo.playedAt).toISOString() : new Date().toISOString(),
            game_type: 'NLHE', // Assuming default for now
            small_blind: setupInfo.smallBlind,
            big_blind: setupInfo.bigBlind,
            location: setupInfo.location,
            num_players: setupInfo.numPlayers,
            hero_position: handHistoryData.hero.position,
            hero_cards: handHistoryData.hero.hand, // Store raw 4-char string
            final_pot_size: handHistoryData.pot,
            currency: setupInfo.currency || '$',
            notes: setupInfo.notes,
            // Add winner info if showdown exists
            // winner_position: handHistoryData.showdown?.winner,
            // winning_hand_description: handHistoryData.showdown?.text,
        })
        .select('id') // Select the ID of the newly inserted row
        .single(); // Expect only one row back

    if (handError) {
        console.error("Supabase hand insert error:", handError);
        throw new Error(`Failed to insert hand: ${handError.message}`);
    }
    if (!handData) {
        throw new Error('Failed to insert hand: No data returned.');
    }

    const handId = handData.id;
    console.log("Hand inserted with ID:", handId);

    // 3. Insert into 'actions' table
    if (handHistoryData.playerActions && handHistoryData.playerActions.length > 0) {
        const actionsToInsert = handHistoryData.playerActions.map((action, index) => ({
            hand_id: handId,
            action_index: index,
            stage: action.stage,
            position: action.position,
            // Map decision codes to full words if DB uses words
            // decision: mapDecisionCode(action.decision), // Example: 'F' -> 'FOLD'
            decision: action.decision.toUpperCase(), // Or just store code 'F', 'C', 'B', 'R', 'X'
            action_amount: action.amount, // Store the amount associated with the action state object
            // $$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$
            player_stack_before: action.playerStackBefore, // Cannot derive from final state
            pot_size_before: action.potSizeBefore,     // Cannot derive from final state
            text_description: action.text, // Store the descriptive text
        }));

        const { error: actionsError } = await supabase
            .from('actions')
            .insert(actionsToInsert);

        if (actionsError) {
            console.error("Supabase actions insert error:", actionsError);
            // Consider deleting the hand record if actions fail? (Or use transaction)
            throw new Error(`Failed to insert actions: ${actionsError.message}`);
        }
        console.log(`Inserted ${actionsToInsert.length} actions.`);
    }

    // 4. Insert into 'showdown_hands' table (if showdown occurred)
    if (handHistoryData.showdown && handHistoryData.showdown.hands && handHistoryData.showdown.hands.length > 0) {
        const showdownHandsToInsert = handHistoryData.showdown.hands.map(playerHand => {
             const isWinner = playerHand.playerId === handHistoryData.showdown?.winner; // Basic winner check
             // $$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$
             // Basic check if holeCards seems valid (adjust if mucks are represented differently)
             const isValidHandArray = Array.isArray(playerHand.holeCards) && playerHand.holeCards.length === 2;

             return {
                 hand_id: handId,
                 position: playerHand.playerId,
                 hole_card1: isValidHandArray ? playerHand.holeCards[0] : null, // Handle potential mucks/invalid data
                 hole_card2: isValidHandArray ? playerHand.holeCards[1] : null,
                 is_winner: isWinner,
                 // Only add description/combo if they actually won
                 winning_hand_description: isWinner ? handHistoryData.showdown?.text : null,
                 best_5_cards: isWinner ? handHistoryData.showdown?.combination : null, // Store the combination if winner
             };
        });

         const { error: showdownError } = await supabase
            .from('showdown_hands')
            .insert(showdownHandsToInsert);

        if (showdownError) {
            console.error("Supabase showdown_hands insert error:", showdownError);
             // Consider deleting the hand record if actions fail? (Or use transaction)
            throw new Error(`Failed to insert showdown hands: ${showdownError.message}`);
        }
         console.log(`Inserted ${showdownHandsToInsert.length} showdown hands.`);
    }

    console.log("Hand saved successfully!");
    return {success: true};
    // No return value needed if using void promise, caller handles success/error
}

// Define the structure of the data returned from the 'hands' table
// Adjust based on your actual table columns and desired data
export interface SavedHandSummary {
    id: string;
    played_at: string;
    game_type: string;
    stake_level?: string | null;
    small_blind: number;
    big_blind: number;
    location?: string | null;
    num_players: number;
    hero_position?: string | null;
    hero_cards?: string | null;
    final_pot_size?: number | null;
    currency: string;
    notes?: string | null;
    created_at: string;
    // You might want to add a field indicating if it went to showdown,
    // or the winner if known without querying other tables, if useful for display.
}
/**
 * Retrieves a list of saved hand summaries for the currently logged-in user.
 *
 * @param supabase - Initialized Supabase client instance.
 * @param limit - Optional number of hands to retrieve per page.
 * @param offset - Optional number of hands to skip (for pagination).
 * @returns Object containing the list of hands or an error.
 */
export async function getSavedHands(
    limit: number = 10, // Default limit
    offset: number = 0 // Default offset
): Promise<{ hands: SavedHandSummary[] | null; error?: any; count?: number | null }> {

    // 1. Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
        console.error('Error getting user or user not logged in:', userError);
        return { hands: null, error: userError || new Error('User not authenticated') };
    }
    const userId = user.id;

    // 2. Query 'hands' table
    try {
        const { data, error, count } = await supabase
            .from('hands')
            .select('*', { count: 'exact' }) // Select all columns, get total count
            .eq('user_id', userId) // Filter by the logged-in user's ID
            .order('played_at', { ascending: false }) // Order by most recent first
            .range(offset, offset + limit - 1); // Apply pagination

        if (error) throw error;

        return { hands: data as SavedHandSummary[], error: null, count };

    } catch (error) {
        console.error('Error fetching saved hands:', error);
        return { hands: null, error };
    }
}

export function parseStackSizes(stackString: string, sequence: string[],
    smallBlind: number, bigBlind: number
): {[position: string]: number} {
    if (!stackString) {
        return {};
    }
    const stackObjects: {[position: string]: number} = {};
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

       card1 = rank1 + suit1; // e.g., "A" + "s"
       card2 = rank2 + suit2; // e.g., "Q" + "s"

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

       card1 = rank1 + suit1; // e.g., "A" + "s"
       card2 = rank2 + suit2; // e.g., "Q" + "s" or "9" + "h"

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