import { numPlayersToActionSequenceList } from "@/constants";
import { ActionType, Decision, DispatchActionType, GameAppState, GameQueueItemType, GameState, HandSetupInfo, PlayerAction, PlayerStatus, PokerPlayerInput, Position, PreflopStatus, Stage, WinnerInfo } from "@/types";
import { getLastAction, getNewActionSequence, getNumBetsForStage, getPlayerAction, getPlayerActionsWithAutoFolds, getUpdatedBettingInfo, hasActionBeenAddedAlready, isAggressiveAction, removeAfterLastComma } from "@/utils/action_utils";
import { assertIsArray } from "@/utils/assert";
import { AddVillainsToGameQueue, didAllInAndACallOccurOnStreet, filterNewCardsFromDeck, formatCommunityCards, getCards, getRemainingCardActions, getVillainCards, isMuck, parsePokerHandString } from "@/utils/card_utils";
import { determinePokerWinnerManual } from "@/utils/hand_evaluator";
import { decisionToText, formatHeroHand, getInitialGameState, moveFirstTwoToEnd, parseStackSizes } from "@/utils/hand_utils";
import { ImmutableStack } from "@/utils/immutable_stack";

export const initialAppState: GameAppState = {
    current: getInitialGameState(),
    history: ImmutableStack.create<GameState>([getInitialGameState()]),
};

function calculateNewActionSequence(actionSequence: PlayerStatus[], nextPlayerToActIndex: number, decision: Decision, stack: number, actingPlayer: Position) {
    console.log(`${actingPlayer} ${decisionToText(decision)}`)
    let newActionSequence: PlayerStatus[] = [...actionSequence];
    let remainingPlayers = [...actionSequence.slice(0, nextPlayerToActIndex), ...actionSequence.slice(nextPlayerToActIndex + 1)]
    const addPlayerBack = decision !== Decision.kFold;
    // player could be all in for less?
    if (isAggressiveAction(decision)) {
        remainingPlayers = remainingPlayers.map(player => ({...player, hasToAct: true}))
    }
    newActionSequence = [
        ...remainingPlayers,
        ...(addPlayerBack
            ? [{
            position: actingPlayer,
            isAllIn: decision === Decision.kAllIn || stack === 0,
            hasToAct: false }]
            : [])
    ];
    console.log('updated action sequence: ',newActionSequence)
    return newActionSequence;
}
function getIntermediatePreflopActionSequence(preflopSequence: PreflopStatus[] | undefined, playerAction: PlayerAction, stack: number) {
    let intermediateList: PreflopStatus[] = [];
    assertIsArray(preflopSequence);
    const actionIndex = preflopSequence.findIndex(({ position }) => playerAction.position === position);
    const p = preflopSequence[actionIndex];
    intermediateList = [...preflopSequence.slice(actionIndex + 1)];
    const isAllIn = playerAction.decision === Decision.kAllIn || stack === 0;
    const addPlayerBack = playerAction.decision !== Decision.kFold && !isAllIn;
    if (addPlayerBack) {
        intermediateList.push({ ...p, hasActed: true })
    }
    return intermediateList;
}

export function createInitialAppState(state: GameAppState, gameInfo: HandSetupInfo) {
    const { position, hand, smallBlind, bigBlind, relevantStacks } = gameInfo;
    const actionSequence = numPlayersToActionSequenceList[gameInfo.numPlayers];
    const upperCasedHand = hand.toUpperCase();
    const initialPlayerStatuses: PlayerStatus[] = actionSequence.map((position: Position) => ({
        position,
        isAllIn: false,
        hasToAct: false,
    }));
    const initialSequence = moveFirstTwoToEnd(initialPlayerStatuses);
    const handAsArray = parsePokerHandString(upperCasedHand);
    const initialGameState: GameState = {
        ...state.current,
        actionSequence: initialSequence,
        preflopSequence: initialSequence.map(s => ({ ...s, hasActed: false })),
        pot: smallBlind + bigBlind,
        hero: { position, hand: handAsArray },
        deck: [...filterNewCardsFromDeck(handAsArray, [...state.current.deck])],
        playerActions: [],
        stage: Stage.Preflop,
        input: '',
        betsThisStreet: { [Position.SB]: smallBlind, [Position.BB]: bigBlind },
        currentBetFacing: bigBlind,
        stacks: parseStackSizes(relevantStacks, actionSequence, smallBlind, bigBlind),
    };
    state.history.pop();
    state.history.push(initialGameState);
    return {
        current: { ...initialGameState },
        history: state.history,
    };
}

export function reducer(state: GameAppState, action: { type: DispatchActionType; payload: any }): GameAppState {
    switch (action.type) {
        case DispatchActionType.kUndo:
            if (state.history.isEmpty()) {
                return state;
            }
            const { stack: updatedHistory, value: previousState } = state.history.pop();
            return {
                current: { ...previousState as GameState, input: removeAfterLastComma(previousState?.input || '') },
                history: updatedHistory,
            };
        case DispatchActionType.kSetInput:
            return {
                current: { ...state.current, input: action.payload.input },
                history: state.history,
            };
        case DispatchActionType.kAddAction: {
            // input should validate action + more players left to act before getting here
            const curr = state.current;

            // 1. Get player info for the current action.
            const nextPlayerToActIndex = curr.actionSequence.findIndex(a => !a.isAllIn);
            const playerToAct = curr.actionSequence[nextPlayerToActIndex] as PlayerStatus;
            const playerAction = getPlayerAction(playerToAct.position, getLastAction(action.payload.input), curr.stage, curr.playerActions.length + 1);
            const actingPlayer = playerAction.position;
            // TODO, add this to transition? MOVE THIS TO VALIDATION STEP
            if (hasActionBeenAddedAlready(curr.playerActions, playerAction)) {
                return {
                    current: { ...curr, input: action.payload.input },
                    history: state.history,
                };
            }
            
            const currentStack = curr.stacks[actingPlayer] as number;
            // 3. Calculate betting information updates based on new player action
            const { amountToAdd, newPlayerBetTotal, newCurrentBetFacing } =
            getUpdatedBettingInfo(curr.betsThisStreet, curr.currentBetFacing, currentStack, playerAction);
            // Use betting information to populate `amount` and `text` on player action.
            playerAction.amount = newPlayerBetTotal;
            playerAction.potSizeBefore = curr.pot;
            playerAction.playerStackBefore = currentStack;
            // Calculate the player's new stack size
            const newStackSize = currentStack - amountToAdd;
            
            playerAction.text = getMeaningfulTextToDisplay(
                playerAction,
                getNumBetsForStage(curr.playerActions, curr.stage),
                curr.stage);
                
                const addActionState: GameState = {
                    ...state.current,
                    input: '',
                    // 2. Add new action to list of player actions
                    playerActions: [...curr.playerActions, playerAction],
                    // 4. Update action sequence
                    // Pre-flop: Action sequence is handled differently, often based on who is left
                    // after the betting round, so we don't modify it here per-action.
                    // It gets recalculated during the transition from Preflop.
                    actionSequence: curr.stage !== Stage.Preflop ? calculateNewActionSequence(curr.actionSequence, nextPlayerToActIndex, playerAction.decision, newStackSize, actingPlayer) : [...curr.actionSequence],
                    preflopSequence: curr.stage !== Stage.Preflop ? undefined : getIntermediatePreflopActionSequence(curr.preflopSequence, playerAction, newStackSize),
                    pot: curr.pot + amountToAdd,
                    currentBetFacing: newCurrentBetFacing,
                    betsThisStreet: {
                        ...curr.betsThisStreet,
                        [actingPlayer]: newPlayerBetTotal,
                    },
                    stacks: {
                        ...curr.stacks,
                        [actingPlayer]: newStackSize,
                    }
            };

            const newHistory = state.history.push(curr);
            const newStateAfterAdd = {
                current: addActionState,
                history: newHistory,
            };
            return newStateAfterAdd;
        }
        case DispatchActionType.kTransition: {
            const curr = state.current;
            const initialStage = curr.stage;
            // We don't always move to the next stage after a transition (turn card --> turn action)
            const nextStage = curr.currentAction.shouldTransitionAfterStep ? getNextStage(curr.stage) : curr.stage;
            // Next step in the overall game flow
            let nextAction = curr.gameQueue[0];
            let updatedGameQueue = curr.gameQueue.slice(1);
            // Contains properties to update based on the current action type.
            let propertyUpdates: Partial<GameState> = {};
            // Get current actions and sequence before any potential modifications
            let finalPlayerActions = [...curr.playerActions];
            let finalActionSequence = [...curr.actionSequence];

            if (curr.currentAction.actionType === ActionType.kCommunityCard) {
                const inputCards = action.payload.input.slice(0, -1).trim().toUpperCase();
                const newCards = getCards([...curr.cards], [...curr.deck], inputCards);
                propertyUpdates = {
                    cards: [...newCards],
                    deck: [...filterNewCardsFromDeck(newCards, [...curr.deck])]
                };
            } else if (curr.currentAction.actionType === ActionType.kVillainCards) {
                const handText = action.payload.input.slice(0, -1).trim().toUpperCase();
                const position = curr.currentAction.position as Position;
                const villainHand = isMuck(handText)
                ? { playerId: position, holeCards: "muck" } as PokerPlayerInput
                : getVillainCards(action.payload.input.slice(0, -1).trim().toUpperCase(), position);
                const hands = [...curr.showdownHands, villainHand];
                // All hands have been collected, determine winner information.
                if (!nextAction) {
                    const showdownHands = [formatHeroHand(curr.hero), ...hands];
                    const result = determinePokerWinnerManual(
                        showdownHands.filter(hand => !(typeof hand.holeCards === "string")),
                        formatCommunityCards(curr.cards)) as WinnerInfo;
                    propertyUpdates.showdown = {
                        combination: result.bestHandCards,
                        hands: result.details,
                        text: result.winningHandDescription,
                        winner: `${result.winners.map(w => w.playerId)[0]}`,
                    };
                } else {
                    propertyUpdates.showdownHands = hands;
                }
            } else if (action.payload.input.trim().length > 1) {
                const curr = state.current;
                const nextPlayerToActIndex = curr.actionSequence.findIndex(a => !a.isAllIn);
                const playerToAct = curr.actionSequence[nextPlayerToActIndex] as PlayerStatus
                const playerAction = getPlayerAction(playerToAct.position, getLastAction(action.payload.input), curr.stage, curr.playerActions.length + 1)
                // Used to display a divider between stages in action list.
                playerAction.isLastActionForStage = initialStage !== nextStage;
                const playerPos = playerAction.position;
                const currentStack = state.current.stacks[playerAction.position] as number;
                const { amountToAdd, newPlayerBetTotal, newCurrentBetFacing } =
                    getUpdatedBettingInfo(curr.betsThisStreet, curr.currentBetFacing, currentStack, playerAction)
                playerAction.amount = newPlayerBetTotal;
                playerAction.potSizeBefore = curr.pot;
                playerAction.playerStackBefore = currentStack;

                // Calculate the player's new stack size
                const newStackSize = currentStack - amountToAdd;

                playerAction.text = getMeaningfulTextToDisplay(
                    playerAction,
                    getNumBetsForStage(curr.playerActions, initialStage),
                    initialStage);
                finalPlayerActions = [...finalPlayerActions, playerAction];
                // Update action sequence if post-flop (mirroring kAddAction logic)

                if (curr.stage !== Stage.Preflop) {
                    const remainingPlayers = [
                        ...state.current.actionSequence.slice(0, nextPlayerToActIndex),
                        ...state.current.actionSequence.slice(nextPlayerToActIndex + 1)]

                    // If the player didn't fold, add them to the end of the remaining sequence
                    const addPlayerBack = playerAction.decision !== Decision.kFold;
                    const isAllIn = playerAction.decision === Decision.kAllIn || newStackSize === 0;
                    finalActionSequence = [
                        ...remainingPlayers,
                        ...(addPlayerBack ? [{ position: playerPos, isAllIn, hasToAct: true }] : [])
                    ];
                }

                // Update betting information
                propertyUpdates.pot = curr.pot + amountToAdd;
                propertyUpdates.betsThisStreet = {
                    ...curr.betsThisStreet,
                    [playerPos]: newPlayerBetTotal,
                };
                propertyUpdates.stacks = {
                    ...curr.stacks,
                    [playerPos]: newStackSize
                };
                propertyUpdates.currentBetFacing = newCurrentBetFacing;
            }

            const newStateBase: GameState = {
                ...curr,
                ...propertyUpdates,
                playerActions: finalPlayerActions,
                actionSequence: finalActionSequence,
                stage: nextStage,
                input: '',
                currentAction: nextAction,
                gameQueue: updatedGameQueue, // remove upcoming `currentAction` from queue
            };

            let finalState = newStateBase;

            // If transitioning away from* Preflop, apply auto-folds based on the original preflop sequence
            if (initialStage === Stage.Preflop && nextStage !== initialStage) {
                const originalPreflopSequence = curr.actionSequence.map(v => v.position);
                finalState = {
                    ...finalState,
                    playerActions: getPlayerActionsWithAutoFolds(originalPreflopSequence, finalState.playerActions)
                };
            }

            // If the stage actually changed, recalculate the action sequence for the new stage.
            if (initialStage !== nextStage && nextStage !== Stage.Showdown) {
                finalState = {
                    ...finalState,
                    actionSequence: getNewActionSequence(initialStage, finalState.playerActions, finalState.actionSequence),
                    // Update betting information for new stage
                    betsThisStreet: {},
                    potForStreetMap: { ...finalState.potForStreetMap, [nextStage]: finalState.pot },
                    currentBetFacing: 0,
                };
            }
            if (curr.currentAction.id === GameQueueItemType.kRiverAction) {
                // add villains to queue for card collection
                updatedGameQueue = AddVillainsToGameQueue(curr.actionSequence.filter(v => v.position !== curr.hero.position).map(v => v.position));
                nextAction = updatedGameQueue[0];
                updatedGameQueue = updatedGameQueue.slice(1);
                finalState = {
                    ...finalState,
                    currentAction: nextAction,
                    gameQueue: updatedGameQueue
                };
            }
            // Advance to showdown if necessary.
            const playersLeft = finalState.actionSequence.filter(player => !player.isAllIn).length;
            // Should this and the statement above be conditional and ordered?
            if (playersLeft <= 1) {
                const allInAndACall = didAllInAndACallOccurOnStreet(finalState.playerActions);
                if (allInAndACall) {
                    finalState.gameQueue = getRemainingCardActions(finalState.gameQueue)
                    if (!finalState.currentAction) {
                        finalState.stage = Stage.Showdown;
                    }
                } else {
                    finalState.stage = Stage.Showdown;
                }
            }
            const newHistory = state.history.push(curr);
            const newTransitionState = {
                current: { ...finalState },
                history: newHistory,
            }
            return newTransitionState;
        }
        case DispatchActionType.kReset:
            return {
                current: getInitialGameState(),
                history: ImmutableStack.create<GameState>([getInitialGameState()])
            };
        default:
            return state;
    }
}

function getMeaningfulTextToDisplay(action: PlayerAction, numBetsThisStreet: number, stage: Stage): string {
    const amountStr = `$${action.amount}`;
    if (numBetsThisStreet === 1 && stage === Stage.Preflop) {
        return `opens to ${amountStr}`;
    }
    switch (action.decision) {
        case Decision.kBet:
            return `bets ${amountStr}`
        case Decision.kCall:
            return 'calls'
        case Decision.kCheck:
            return 'checks'
        case Decision.kAllIn:
            return `all-in for ${amountStr}`
        case Decision.kFold:
            return 'folds'
        case Decision.kRaise: {
            if (numBetsThisStreet === 1) {
                return `raises to ${amountStr}`;
            }
            return `${++numBetsThisStreet}-bets to ${amountStr}`;
        }
    }
}

function getNextStage(stage: Stage) {
    const nextStages = {
        [Stage.Preflop]: Stage.Flop,
        [Stage.Flop]: Stage.Turn,
        [Stage.Turn]: Stage.River,
        [Stage.River]: Stage.Showdown,
        [Stage.Showdown]: Stage.Showdown,
    };
    return nextStages[stage];
}
