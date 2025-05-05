import { numPlayersToActionSequenceList } from "@/constants";
import { ActionTextToken, ActionType, Decision, DispatchActionType, GameAppState, GameQueueItemType, GameState, HandSetupInfo, PlayerAction, PlayerStatus, PokerPlayerInput, Position, Stage, WinnerInfo } from "@/types";
import { getLastAction, getNewActionSequence, getNumBetsForStage, getPlayerAction, getPlayerActionsWithAutoFolds, getUpdatedBettingInfo, hasActionBeenAddedAlready, removeAfterLastComma } from "@/utils/action_utils";
import { AddVillainsToGameQueue, didAllInAndACallOccurOnStreet, filterNewCardsFromDeck, formatCommunityCards, getCards, getRemainingCardActions, getVillainCards, isMuck, parsePokerHandString } from "@/utils/card_utils";
import { determinePokerWinnerManual } from "@/utils/hand_evaluator";
import { formatHeroHand, getInitialGameState, moveFirstTwoToEnd, parseStackSizes } from "@/utils/hand_utils";
import { ImmutableStack } from "@/utils/immutable_stack";

export const initialAppState: GameAppState = {
    current: getInitialGameState(),
    history: ImmutableStack.create<GameState>([getInitialGameState()]),
};

export function createInitialAppState(state: GameAppState, gameInfo: HandSetupInfo) {
    const { position, hand, smallBlind, bigBlind, relevantStacks } = gameInfo;
    const actionSequence = numPlayersToActionSequenceList[gameInfo.numPlayers];
    const upperCasedHand = hand.toUpperCase();
    const initialPlayerStatuses: PlayerStatus[] = actionSequence.map((position: Position) => ({
        position,
        isAllIn: false,
    }));
    const initialSequence = moveFirstTwoToEnd(initialPlayerStatuses);
    const initialGameState: GameState = {
        ...state.current,
        actionSequence: initialSequence,
        preflopSequence: initialSequence.map(s => ({ ...s, hasActed: false })),
        pot: smallBlind + bigBlind,
        hero: { position, hand: parsePokerHandString(upperCasedHand) },
        deck: [...filterNewCardsFromDeck(parsePokerHandString(upperCasedHand), [...state.current.deck])],
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
            const currentGameState = state.current;
            const nextPlayerToActIndex = currentGameState.actionSequence.findIndex(a => !a.isAllIn);
            const playerToAct = currentGameState.actionSequence[nextPlayerToActIndex] as PlayerStatus

            const playerAction = getPlayerAction(playerToAct.position, getLastAction(action.payload.input), state.current.stage, currentGameState.playerActions.length + 1)
            // TODO, add this to transition?
            if (hasActionBeenAddedAlready(state.current.playerActions, playerAction)) {
                return {
                    current: { ...state.current, input: action.payload.input },
                    history: state.history,
                };
            }

            // Add new action to list of player actions
            const newPlayerActions = [...state.current.playerActions, playerAction];

            const actingPlayer = playerAction.position;
            const currentStack = state.current.stacks[playerAction.position];
            // Calculate betting information updates (if applicable) based on new player action
            const { amountToAdd, newPlayerBetTotal, newCurrentBetFacing } =
                getUpdatedBettingInfo(state.current.betsThisStreet, state.current.currentBetFacing, currentStack, playerAction);
            // Use betting information to populate `amount` and `text` on player action.
            playerAction.amount = newPlayerBetTotal;
            playerAction.potSizeBefore = currentGameState.pot;
            playerAction.playerStackBefore = currentStack;
            // Calculate the player's new stack size
            const newStackSize = currentStack - amountToAdd;

            playerAction.text = getMeaningfulTextToDisplay(
                playerAction,
                getNumBetsForStage(state.current.playerActions, state.current.stage),
                state.current.stage);

            let newActionSequence: PlayerStatus[] = [...state.current.actionSequence];
            let intermediateList = state.current.stage === Stage.Preflop ? [] : undefined;
            if (state.current.stage !== Stage.Preflop) {
                const remainingPlayers = [...state.current.actionSequence.slice(0, nextPlayerToActIndex), ...state.current.actionSequence.slice(nextPlayerToActIndex + 1)]
                const addPlayerBack = playerAction.decision !== Decision.kFold;
                const isAllIn = playerAction.decision === Decision.kAllIn || newStackSize === 0;
                newActionSequence = [
                    ...remainingPlayers,
                    ...(addPlayerBack ? [{ position: actingPlayer, isAllIn }] : [])
                ];
            } else {
                const actionIndex = currentGameState.preflopSequence.findIndex(({ position }) => playerAction.position === position);
                const p = currentGameState.preflopSequence[actionIndex];
                intermediateList = [...currentGameState.preflopSequence.slice(actionIndex + 1)];
                const isAllIn = playerAction.decision === Decision.kAllIn || newStackSize === 0;
                const addPlayerBack = playerAction.decision !== Decision.kFold && !isAllIn;
                if (addPlayerBack) {
                    intermediateList.push({ ...p, hasActed: true })
                    // hasActed
                }
            }
            // Pre-flop: Action sequence is handled differently, often based on who is left
            // after the betting round, so we don't modify it here per-action.
            // It gets recalculated during the transition from Preflop.
            const addActionState: GameState = {
                ...state.current,
                input: action.payload.input,
                playerActions: newPlayerActions,
                actionSequence: newActionSequence,
                preflopSequence: intermediateList,
                pot: state.current.pot + amountToAdd,
                currentBetFacing: newCurrentBetFacing,
                betsThisStreet: {
                    ...state.current.betsThisStreet,
                    [actingPlayer]: newPlayerBetTotal,
                },
            };

            // update player's stack size
            addActionState.stacks = {
                ...addActionState.stacks,
                [actingPlayer]: newStackSize
            };
            const newHistory = state.history.push(currentGameState);
            const newStateAfterAdd = {
                current: addActionState,
                history: newHistory,
            };
            return newStateAfterAdd;
        }
        case DispatchActionType.kTransition: {
            const currentState = state.current;
            const initialStage = currentState.stage;
            // We don't always move to the next stage after a transition (turn card --> turn action)
            const nextStage = currentState.currentAction.shouldTransitionAfterStep ? getNextStage(currentState.stage) : currentState.stage;
            // Next step in the overall game flow
            let nextAction = currentState.gameQueue[0];
            let updatedGameQueue = currentState.gameQueue.slice(1);
            // Contains properties to update based on the current action type.
            let propertyUpdates: Partial<GameState> = {};
            // Get current actions and sequence before any potential modifications
            let finalPlayerActions = [...currentState.playerActions];
            let finalActionSequence = [...currentState.actionSequence];

            if (currentState.currentAction.actionType === ActionType.kCommunityCard) {
                const inputCards = action.payload.input.slice(0, -1).trim().toUpperCase();
                const newCards = getCards([...currentState.cards], [...currentState.deck], inputCards);
                propertyUpdates = {
                    cards: [...newCards],
                    deck: [...filterNewCardsFromDeck(newCards, [...currentState.deck])]
                };
            } else if (currentState.currentAction.actionType === ActionType.kVillainCards) {
                const handText = action.payload.input.slice(0, -1).trim().toUpperCase();
                const position = currentState.currentAction.position as Position;
                const villainHand = isMuck(handText) ? { playerId: position, holeCards: "muck" } as PokerPlayerInput : getVillainCards(action.payload.input.slice(0, -1).trim().toUpperCase(), position);
                const hands = [...currentState.showdownHands, villainHand];
                // All hands have been collected, determine winner information.
                if (!nextAction) {
                    const showdownHands = [formatHeroHand(currentState.hero), ...hands];
                    const result = determinePokerWinnerManual(
                        showdownHands.filter(hand => !(typeof hand.holeCards === "string")),
                        formatCommunityCards(currentState.cards)) as WinnerInfo;
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
                const currentGameState = state.current;
                const nextPlayerToActIndex = currentGameState.actionSequence.findIndex(a => !a.isAllIn);
                const playerToAct = currentGameState.actionSequence[nextPlayerToActIndex] as PlayerStatus
                const playerAction = getPlayerAction(playerToAct.position, getLastAction(action.payload.input), currentGameState.stage, currentGameState.playerActions.length + 1)
                // Used to display a divider between stages in action list.
                // playerAction.id = getIdForPlayerAction(playerAction, ++currentGameState.playerActions.length);
                playerAction.isLastActionForStage = initialStage !== nextStage;
                const playerPos = playerAction.position;
                const currentStack = state.current.stacks[playerAction.position];
                const { amountToAdd, newPlayerBetTotal, newCurrentBetFacing } =
                    getUpdatedBettingInfo(currentState.betsThisStreet, currentState.currentBetFacing, currentStack, playerAction)
                playerAction.amount = newPlayerBetTotal;
                playerAction.potSizeBefore = currentGameState.pot;
                playerAction.playerStackBefore = currentStack;

                // Calculate the player's new stack size
                const newStackSize = currentStack - amountToAdd;

                playerAction.text = getMeaningfulTextToDisplay(
                    playerAction,
                    getNumBetsForStage(currentState.playerActions, initialStage),
                    initialStage);
                finalPlayerActions = [...finalPlayerActions, playerAction];
                // Update action sequence if post-flop (mirroring kAddAction logic)

                if (currentState.stage !== Stage.Preflop) {
                    const remainingPlayers = [
                        ...state.current.actionSequence.slice(0, nextPlayerToActIndex),
                        ...state.current.actionSequence.slice(nextPlayerToActIndex + 1)]

                    // If the player didn't fold, add them to the end of the remaining sequence
                    const addPlayerBack = playerAction.decision !== Decision.kFold;
                    const isAllIn = playerAction.decision === Decision.kAllIn || newStackSize === 0;
                    finalActionSequence = [
                        ...remainingPlayers,
                        ...(addPlayerBack ? [{ position: playerPos, isAllIn }] : [])
                    ];
                }

                // Update betting information
                propertyUpdates.pot = currentState.pot + amountToAdd;
                propertyUpdates.betsThisStreet = {
                    ...currentState.betsThisStreet,
                    [playerPos]: newPlayerBetTotal,
                };
                propertyUpdates.stacks = {
                    ...currentState.stacks,
                    [playerPos]: newStackSize
                };
                propertyUpdates.currentBetFacing = newCurrentBetFacing;
            }

            const newStateBase: GameState = {
                ...currentState,
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
                const originalPreflopSequence = currentState.actionSequence.map(v => v.position);
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
            if (currentState.currentAction.id === GameQueueItemType.kRiverAction) {
                // add villains to queue for card collection
                updatedGameQueue = AddVillainsToGameQueue(currentState.actionSequence.filter(v => v.position !== currentState.hero.position).map(v => v.position));
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
            const newHistory = state.history.push(currentState);
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
