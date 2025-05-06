import { ActionTextToken, Decision, PlayerAction, PlayerStatus, Position, Stage } from "@/types";

/**
 * Calculates the sequence of players for the *next* betting round based on actions from the completed stage.
 * It filters for players who did not fold in the given stage, sorts them by position rank,
 * and returns a unique list of their positions in that order.
 *
 * @param stage The stage that just completed (e.g., Stage.Flop to determine Turn sequence).
 * @param playerActions The list of all actions recorded so far.
 * @returns An ordered array of unique positions for the next round of action.
 */
export function getNewActionSequence(stage: Stage, playerActions: PlayerAction[], sequence: PlayerStatus[]): PlayerStatus[] {
    // 1. Filter actions for the relevant stage and remove players who folded
    const foldedOutPlayers = playerActions.filter(action => action.stage === stage && action.decision === Decision.kFold).map(a => a.position);

    const activeActions = playerActions
        .filter(action => action.stage === stage && action.decision !== Decision.kFold);
    const filteredActiveActions = activeActions.filter(a => !foldedOutPlayers.includes(a.position));
    const allInPlayers = sequence.filter(s => s.isAllIn);
    const allInPlayersPositions = allInPlayers.map(s => s.position);

    const positions: PlayerStatus[] = [...allInPlayers, ...filteredActiveActions.map(action => ({ position: action.position, isAllIn: allInPlayersPositions.includes(action.position) }))];
    const uniquePositionsSet = new Set<string>();
    const uniquePositions: PlayerStatus[] = [];
    positions.forEach(p => {
        if (!uniquePositionsSet.has(p.position)) {
            uniquePositionsSet.add(p.position);
            uniquePositions.push(p);
        }
    })
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
    return uniquePositions.sort((a, b) => positionToRankMap[a.position] - positionToRankMap[b.position]);
}

export function getUpdatedBettingInfo(
    betsThisStreet: { [key in Position]?: number },
    currentBetFacing: number,
    playerStack: number,
    playerAction: PlayerAction) {
    const actingPlayer = playerAction.position;
    // How much player already bet this street
    const alreadyBet = betsThisStreet[actingPlayer] || 0;
    // How much is ACTUALLY added to the pot by THIS action
    let amountToAdd = 0;
    // Player's new total bet this street
    let newPlayerBetTotal = alreadyBet;
    // The bet level facing others
    let newCurrentBetFacing = currentBetFacing;

    switch (playerAction.decision) {
        case Decision.kBet:
            // Assumes first bet on the street, 'alreadyBet' should be 0
            amountToAdd = playerAction.amount;
            newPlayerBetTotal = playerAction.amount;
            newCurrentBetFacing = playerAction.amount;
            break;

        case Decision.kRaise:
            // Amount to add is the raise amount MINUS what was already bet
            // Example: Raise to 60, already bet 20. Add 40.
            amountToAdd = playerAction.amount - alreadyBet;
            // Their total commitment is now the raise amount
            newPlayerBetTotal = playerAction.amount;
            // This sets the new bet level
            newCurrentBetFacing = playerAction.amount;
            break;

        case Decision.kCall:
            // Amount to add is the current bet level MINUS what was already bet
            // Example: Facing 60, already bet 20. Add 40.
            amountToAdd = currentBetFacing - alreadyBet;
            // Ensure amountToAdd isn't negative if something went wrong
            amountToAdd = Math.max(0, amountToAdd);
            // Handle all-ins: if amountToAdd > player's remaining stack, adjust amountToAdd
            amountToAdd = Math.min(amountToAdd, playerStack);

            // Their total commitment matches the facing bet
            newPlayerBetTotal = alreadyBet + amountToAdd;
            break;
        case Decision.kAllIn:
            // Calculate how much more is going in NOW compared to what's already bet
            const amountGoingInNow = playerStack - alreadyBet;
            amountToAdd = Math.max(0, amountGoingInNow); // Ensure non-negative

            // Player's total commitment this street after the all-in
            newPlayerBetTotal = alreadyBet + amountToAdd;
            // The bet level facing others is the MAX of the previous facing bet
            // and the total amount this player just committed.
            newCurrentBetFacing = Math.max(currentBetFacing, newPlayerBetTotal);
            break;
        case Decision.kCheck:
        case Decision.kFold:
            amountToAdd = 0;
            break;
    }
    return { amountToAdd, newPlayerBetTotal, newCurrentBetFacing };
}

function createPlayerActionForAutoFoldedPlayer(position: Position): PlayerAction {
    return {
        amount: 0,
        decision: Decision.kFold,
        position,
        shouldHideFromUi: true,
        isLastActionForStage: false,
        text: `${position} folds`,
        stage: Stage.Preflop,
        id: '',
    };
}

export function getPlayerActionsWithAutoFolds(actionSequence: Position[], playerActions: PlayerAction[]) {
    let index = -1;
    const newSequence = actionSequence.map((player) => {
        const foundIndex = playerActions.findIndex(action => action.position == player);
        index = foundIndex === -1 ? index : foundIndex;
        return foundIndex !== -1 ? playerActions[foundIndex] : createPlayerActionForAutoFoldedPlayer(player);
    });
    if (index !== playerActions.length - 1) {
        return [...newSequence, ...playerActions.slice(index + 1)];
    }
    return newSequence;
}

export function removeAfterLastComma(input: string): string {
    const lastIndex = input.lastIndexOf(",");
    return lastIndex !== -1 ? input.slice(0, lastIndex) : '';
}

export function hasActionBeenAddedAlready(playerActions: PlayerAction[], currentAction: PlayerAction): boolean {
    return playerActions.some(action => action.id === currentAction.id);
}

export function getNumBetsForStage(playerActions: PlayerAction[], stage: Stage): number {
    let numBets = playerActions.filter(a => a.stage === stage && (a.decision === Decision.kBet || a.decision === Decision.kRaise)).length;
    numBets = stage === Stage.Preflop ? numBets + 1 : numBets;
    return numBets;
}


function getIdForPlayerAction(action: PlayerAction, len: number): string {
    return `${action.position}-${action.decision}-${action.amount}-${action.stage}-${len}`;
}
function parseActionString(actionString: string, currentPosition: Position): ActionTextToken {
    const tokens = actionString.split(' ');
    let position: Position;
    // todo remove this default value
    let decision: Decision = Decision.kCheck;
    let amount = 0;

    let tokenIndex = 0;

    if (Object.values(Position).includes(tokens[tokenIndex] as Position)) {
        position = tokens[tokenIndex] as Position;
        tokenIndex++;
    } else {
        position = currentPosition;
    }

    if (tokens[tokenIndex] && Object.values(Decision).includes(tokens[tokenIndex] as Decision)) {
        decision = tokens[tokenIndex] as Decision;
        tokenIndex++;
    }

    if (tokens[tokenIndex] && !isNaN(parseInt(tokens[tokenIndex], 10))) {
        amount = parseInt(tokens[tokenIndex], 10);
        tokenIndex++;
    }

    return {
        decision,
        position,
        amount,
    };
}

export function isAggressiveAction(decision: Decision): boolean {
    return [Decision.kBet, Decision.kRaise, Decision.kAllIn].includes(decision);
}

export function isPassiveAction(decision: Decision): boolean {
    return [Decision.kCall, Decision.kFold, Decision.kCheck].includes(decision);
}

export function getPlayerAction(playerToAct: string, mostRecentActionText: string, stage: Stage, len: number): PlayerAction {
    const actionInfo = parseAction(mostRecentActionText, playerToAct);
    return buildBasePlayerAction(actionInfo, stage, len);
}
export function getLastAction(newVal: string): string {
    const actions: string[] = newVal.split(',').filter(Boolean);
    const lastAction = actions.pop() as string;
    const text = lastAction?.endsWith('.') ? lastAction.slice(0, -1) : lastAction;
    return text.trim().toUpperCase();
}
function buildBasePlayerAction(actionInfo: ActionTextToken, stage: Stage, len: number): PlayerAction {
    const action: PlayerAction = { text: '', stage, isLastActionForStage: false, shouldHideFromUi: false, ...actionInfo, id: '' };
    action.id = getIdForPlayerAction(action, len);
    return action;
}

function parseAction(action: string, currentPosition: string): ActionTextToken {
    return parseActionString(action, currentPosition as Position);
}
