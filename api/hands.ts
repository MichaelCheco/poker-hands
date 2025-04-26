import { GameState, HandSetupInfo, Position, SavedHandSummary } from "@/types";
import { parsePokerHandString } from "@/utils/hand-utils";
import { supabase } from "@/utils/supabase";

export async function getHandDetailsById(handId: string) {
    try {
        // Use relational query to fetch hand and related actions/showdown hands
        const { data, error } = await supabase
            .from('hands')
            .select(`
                *,
                actions ( * ),
                showdown_hands ( * )
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

export async function saveHandToSupabase(
    handHistoryData: GameState,
    setupInfo: HandSetupInfo
): Promise<{ success: boolean; message: string; handId: string; }> {

    console.log("Attempting to save hand...", handHistoryData, setupInfo);

    // 1. Get Authenticated User ID
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) throw new Error(`Authentication error: ${authError.message}`);
    if (!user) throw new Error('User not found. Cannot save hand.');
    const userId = user.id;

    const { data: handData, error: handError } = await supabase
        .from('hands')
        .insert({
            user_id: userId,
            played_at: setupInfo.playedAt ? new Date(setupInfo.playedAt).toISOString() : new Date().toISOString(),
            game_type: 'NLHE',
            small_blind: setupInfo.smallBlind,
            big_blind: setupInfo.bigBlind,
            location: setupInfo.location,
            num_players: setupInfo.numPlayers,
            hero_position: handHistoryData.hero.position,
            hero_cards: handHistoryData.hero.hand,
            final_pot_size: handHistoryData.pot,
            currency: setupInfo.currency || '$',
            notes: setupInfo.notes,
            stacks: setupInfo.relevantStacks,
            community_cards: handHistoryData.cards,
            final_street: handHistoryData.playerActions[handHistoryData.playerActions.length - 1].stage,
        })
        .select('id') // Select the ID of the newly inserted row
        .single(); // Expect only one row back

    if (handError) {
        console.error("Supabase hand insert error:", handError);
        return {handId: '', success: false, message: `Failed to insert hand: ${handError.message}`};
    }
    if (!handData) {
        return {handId: '', success: false, message: `Failed to insert hand: No data returned`};
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
            decision: action.decision.toUpperCase(),
            action_amount: action.amount,
            player_stack_before: action.playerStackBefore,
            pot_size_before: action.potSizeBefore,
            text_description: action.text,
        }));

        const { error: actionsError } = await supabase
            .from('actions')
            .insert(actionsToInsert);

        if (actionsError) {
            console.error("Supabase actions insert error:", actionsError);
            // Consider deleting the hand record if actions fail? (Or use transaction)
            return {success: false,
                    message: `Failed to insert actions: ${actionsError.message}`,
                    handId};
        }
        console.log(`Inserted ${actionsToInsert.length} actions.`);
    }

    // 4. Insert into 'showdown_hands' table (if showdown occurred)
    if (handHistoryData.showdown && handHistoryData.showdown.hands && handHistoryData.showdown.hands.length > 0) {
        const showdownHandsToInsert = handHistoryData.showdown.hands.map(playerHand => {
             const isWinner = playerHand.playerId === handHistoryData.showdown?.winner; // Basic winner check
             return {
                 hand_id: handId,
                 position: playerHand.playerId,
                 hole_cards: typeof playerHand.holeCards === "string" ? playerHand.holeCards : playerHand.holeCards.join(''),
                 is_winner: isWinner,
                 hand_description: isWinner ? handHistoryData.showdown?.text : '',
             };
        });

         const { error: showdownError } = await supabase
            .from('showdown_hands')
            .insert(showdownHandsToInsert);

        if (showdownError) {
            console.error("Supabase showdown_hands insert error:", showdownError);
             // Consider deleting the hand record if actions fail? (Or use transaction)
             return {handId: '', success: false, message: `Failed to insert showdown hands: ${showdownError.message}`};
        }
         console.log(`Inserted ${showdownHandsToInsert.length} showdown hands.`);
    }

    console.log("Hand saved successfully!");
    return {success: true, message: '', handId};
    // No return value needed if using void promise, caller handles success/error
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