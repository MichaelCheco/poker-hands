import { GameState, HandSetupInfo, SavedHandSummary } from "@/types";
import { transFormCardsToFormattedString } from "@/utils/card_utils";
import { supabase } from "@/utils/supabase";


export async function updateNotesForHand(handId: string, notes: string) {
    const { data, error } = await supabase
        .from('hands')
        .update({ notes })
        .eq('id', handId)
        .select()
    console.log(data, error);
}
export async function getHandDetailsById(handId: string) {
    try {
        // Use relational query to fetch hand and related actions/showdown hands
        const { data, error } = await supabase
            .from('hands')
            .select(`
                *,
                actions ( * ),
                showdown_hands ( * ),
                hand_pots ( * )
            `) // Select all from hands, embed all from actions and showdown_hands
            .eq('id', handId) // Filter by hand ID
            // .eq('user_id', auth.uid()) // RLS SHOULD handle this automatically if user is logged in
            .single(); // Expect only one result

        if (error) {
            // Log error but maybe return null to the UI layer unless it's a critical error
            console.error(`Error fetching hand details for ID ${handId}:`, error);
            // Distinguish between "not found" (RLS or non-existent ID) and actual DB errors
            if (error.code === 'PGRST116') { // PostgREST code for "relation does not exist or constraint violation" (often indicates not found/no access)
                console.warn(`Hand ${handId} not found or access denied.`);
                return null;
            }
            // Rethrow other potentially critical errors? Or just return null?
            // Returning null is often safer for the UI.
            return null;
        }

        if (!data) {
            console.warn(`Hand ${handId} not found.`);
            return null;
        }

        // Ensure related data is sorted if Supabase doesn't guarantee it
        // (Test needed - Supabase might respect default ordering or indexes)
        // Client-side sort as a fallback:
        const sortedActions = data.actions?.sort((a: any, b: any) => a.action_index - b.action_index) || [];

        // Cast and return the combined data
        const detailedHand: any = {
            ...(data as any), // Cast basic hand data (consider defining a HandRecord type too)
            actions: sortedActions,
            showdown_hands: data.showdown_hands || [], // Ensure array exists
        };

        return detailedHand;

    } catch (err) {
        // Catch unexpected errors during the process
        console.error(`Unexpected error in getHandDetailsById for ID ${handId}:`, err);
        return null;
    }
}

export async function deleteHand(handId: string): Promise<boolean> {
    const { error } = await supabase
        .from('hands')
        .delete()
        .eq('id', handId)
        return error === null
}

export async function saveHandToSupabase(
    handHistoryData: GameState,
    setupInfo: HandSetupInfo
): Promise<{ success: boolean; message: string; handId: string; }> {

    // 1. Get Authenticated User ID
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) throw new Error(`Authentication error: ${authError.message}`);
    if (!user) throw new Error('User not found. Cannot save hand.');
    const userId = user.id;

    // Calculate total pot from calculatedPots if available, otherwise use existing handHistoryData.pot
    let totalPotForHandRecord = handHistoryData.pot; // Fallback
    if (handHistoryData.calculatedPots && handHistoryData.calculatedPots.length > 0) {
        totalPotForHandRecord = handHistoryData.calculatedPots.reduce((sum, pot) => sum + pot.potAmount, 0);
    }

    // 2. Insert into 'hands' table
    const { data: handData, error: handError } = await supabase
        .from('hands')
        .insert({
            user_id: userId,
            played_at: setupInfo.playedAt ? new Date(setupInfo.playedAt).toISOString() : new Date().toISOString(),
            game_type: 'NLH', // Or from setupInfo if available
            small_blind: setupInfo.smallBlind,
            big_blind: setupInfo.bigBlind,
            location: setupInfo.location,
            num_players: setupInfo.numPlayers,
            hero_position: handHistoryData.hero.position, // Assumes this is a position string
            hero_cards: handHistoryData.hero.hand,
            final_pot_size: totalPotForHandRecord,
            currency: setupInfo.currency || '$',
            notes: setupInfo.notes,
            stacks: setupInfo.relevantStacks, // Make sure this is in JSONB compatible format
            community_cards: handHistoryData.cards.map(c => transFormCardsToFormattedString(c)),
            final_street: handHistoryData.playerActions[handHistoryData.playerActions.length - 1]?.stage,
        })
        .select('id')
        .single();

    if (handError) {
        console.error("Supabase hand insert error:", handError);
        return { handId: '', success: false, message: `Failed to insert hand: ${handError.message}` };
    }
    if (!handData) {
        return { handId: '', success: false, message: `Failed to insert hand: No data returned` };
    }

    const handId = handData.id;
    console.log("Hand inserted with ID:", handId);

    // 3. Insert into 'actions' table
    if (handHistoryData.playerActions && handHistoryData.playerActions.length > 0) {
        // const blinds = [
        //     {
        //         hand_id: handId,
        //         action_index: 0,
        //         stage: 0,
        //         position: 'SB',
        //         decision: 'B',
        //         action_amount: setupInfo.smallBlind,
        //         // player_stack_before: action.playerStackBefore,
        //         pot_size_before: 0,
        //         text_description: `SB posts $${setupInfo.smallBlind}`,
        //         was_auto_folded: true,
        //     },
        //     {
        //         hand_id: handId,
        //         action_index: 1,
        //         stage: 0,
        //         position: 'BB',
        //         decision: 'R',
        //         action_amount: setupInfo.bigBlind,
        //         // player_stack_before: action.playerStackBefore,
        //         pot_size_before: setupInfo.smallBlind,
        //         text_description: `BB posts $${setupInfo.bigBlind}`,
        //         was_auto_folded: true,
        //     },
        // ]
        const actionsToInsert = handHistoryData.playerActions.map((action, index) => ({
            hand_id: handId,
            action_index: index + 2,
            stage: action.stage,
            position: action.position, // This is a player's position string (e.g., "SB")
            decision: action.decision.toUpperCase(),
            action_amount: action.amount,
            player_stack_before: action.playerStackBefore,
            pot_size_before: action.potSizeBefore,
            text_description: action.text,
            was_auto_folded: action.shouldHideFromUi
        }));

        const { error: actionsError } = await supabase
            .from('actions')
            .insert(actionsToInsert);

        if (actionsError) {
            console.error("Supabase actions insert error:", actionsError);
            return {
                success: false,
                message: `Failed to insert actions: ${actionsError.message}`,
                handId
            };
        }
    }

    // 4. Insert into 'hand_pots' table (NEW SECTION - ALIGNED WITH TEXT[] SCHEMA)
    if (handHistoryData.calculatedPots && handHistoryData.calculatedPots.length > 0) {
        const potsToInsert = handHistoryData.calculatedPots.map((pot, index) => ({
            hand_id: handId,
            pot_number: index,
            amount: pot.potAmount,
            // Ensure these are arrays of position strings
            eligible_player_positions: pot.eligiblePositions,
            winning_player_positions: pot.winningPlayerPositions || null,
            winning_hand_description: pot.winningHandDescription || null,
        }));

        const { error: handPotsError } = await supabase
            .from('hand_pots')
            .insert(potsToInsert);

        if (handPotsError) {
            console.error("Supabase hand_pots insert error:", handPotsError);
            return {
                success: false,
                message: `Failed to insert hand pots: ${handPotsError.message}`,
                handId
            };
        }
        console.log(`${potsToInsert.length} pots inserted for hand ID: ${handId}`);
    } else {
        console.log("No side pots data provided or main pot handled differently for hand ID:", handId);
    }


    // 5. Insert into 'showdown_hands' table (if showdown occurred)
    if (handHistoryData.showdown && handHistoryData.showdown.length > 0) {
        const showdownHandsToInsert = handHistoryData.showdown.map(playerHand => {
            // playerHand.playerId is assumed to be the position string (e.g., "SB", "BB")
            let isWinnerOfAnyPot = false;
            if (handHistoryData.calculatedPots) {
                isWinnerOfAnyPot = handHistoryData.calculatedPots.some(pot =>
                    pot.winningPlayerPositions?.includes(playerHand.playerId) // Check against position strings
                );
            }

            return {
                hand_id: handId,
                position: playerHand.playerId, // This aligns with your 'showdown_hands' table schema (position: text)
                hole_cards: typeof playerHand.holeCards === "string" ? playerHand.holeCards : playerHand.holeCards.join(''),
                is_winner: isWinnerOfAnyPot,
                hand_description: playerHand.description,
            };
        });

        const { error: showdownError } = await supabase
            .from('showdown_hands')
            .insert(showdownHandsToInsert);

        if (showdownError) {
            console.error("Supabase showdown_hands insert error:", showdownError);
            return { success: false, message: `Failed to insert showdown hands: ${showdownError.message}`, handId };
        }
    }

    return { success: true, message: 'Hand saved successfully.', handId };
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