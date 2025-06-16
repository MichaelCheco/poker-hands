import { numPlayersToActionSequenceList } from "@/constants";
import { ActionType, BetsForStreetMap, CalculatedPot, Decision, DispatchActionType, GameAppState, GameQueueItemType, GameState, HandSetupInfo, PlayerAction, PlayerPotContribution, PlayerStatus, PokerPlayerInput, Position, PotType, PreflopStatus, ShowdownDetails, Stage, WinnerInfo } from "@/types";
import { getLastAction, getNewActionSequence, getNumBetsForStage, getPlayerAction, getPlayerActionsWithAutoFolds, getUpdatedBettingInfo, hasActionBeenAddedAlready, isAggressiveAction, removeAfterLastComma } from "@/utils/action_utils";
import { assertIsArray, assertIsDefined } from "@/utils/assert";
import { AddVillainsToGameQueue, didAllInAndACallOccurOnStreet, filterNewCardsFromDeck, formatCommunityCards, getCards, getRemainingCardActions, getVillainCards, isMuck, parsePokerHandString } from "@/utils/card_utils";
import { determineHandWinner } from "@/utils/hand_evaluator";
import { calculateSidePots, decisionToText, formatHeroHand, getInitialGameState, moveFirstTwoToEnd, parseStackSizes, positionToRank } from "@/utils/hand_utils";
import { ImmutableStack } from "@/utils/immutable_stack";

function getPotType(numberOfBetsAndRaisesThisStreet: number): PotType {
    switch (numberOfBetsAndRaisesThisStreet) {
        case 1:
            return PotType.kLimped;
        case 2:
            return PotType.kSrp;
        case 3:
            return PotType.kThreeBet;
        case 4:
        default:
            return PotType.kFourBet;
    }
}

export const initialAppState: GameAppState = {
    current: getInitialGameState(),
    history: ImmutableStack.create<GameState>([getInitialGameState()]),
};

function logActionSequence(s: PlayerStatus[]) {
    console.log('\n\n===== SEQUENCE INFO  ===== \n')
    for (let player of s) {
        console.log(`${player.position}: invested: ${player.amountInvestedThisStreet} || stack sz: ${player.stack} \n`)

    }
    console.log('\n===== SEQUENCE INFO =====\n')
}

function logOrder(s: PlayerStatus[] | undefined) {
    if (!s) { return }

    console.log('\n\n===== ORDER =====\n')
    console.log(s.map(p => p.position).join(', '))
    console.log('\n===== ORDER =====\n')
}

// console.log(`Action received: ${JSON.stringify(action)}`);
/**
 * Updates the action sequence after a player takes an action.
 * - Removes players before the actor who haven't yet acted (implicit folds).
 * - Keeps all other players who haven't explicitly folded, including those who are all-in.
 * - The acting player is updated and typically placed at the end of the sequence of players
 * who are still "pending" full resolution for the current betting round.
 *
 * @param action The action taken by the player.
 * @param currentActionSequence The current list of players in betting order for the street.
 * @param newStackSize The acting player's stack size after the action.
 * @param betTotalForStreet The total amount this player has now invested THIS STREET after their action.
 * @returns A new array representing the updated action sequence.
 */
function updateActionSequenceWithNewAction(
    action: PlayerAction,
    currentActionSequence: PlayerStatus[],
    newStackSize: number,
    betTotalForStreet: number
): PlayerStatus[] {
    const actionIndex = currentActionSequence.findIndex(a => a.position === action.position);
    if (actionIndex === -1) {
        console.error(`Player with position ${action.position} not found in currentActionSequence.`);
        // Return a copy of the original sequence to prevent mutation if desired, or throw
        return [...currentActionSequence];
    }

    const playerOriginalStatus = currentActionSequence[actionIndex];
    let playersBeforeActorWhoAreStillIn: PlayerStatus[] = [];
    let playersAfterActorWhoAreStillIn: PlayerStatus[] = [];

    // 1. Process players BEFORE the current actor
    for (let i = 0; i < actionIndex; i++) {
        const playerStatus = currentActionSequence[i];
        if (playerStatus.hasFolded) {
            continue; // Explicitly folded players are out
        }
        // If player has acted OR is all-in (even if hasActedThisStreet is false due to being all-in on a previous street), keep them.
        // The main condition from user: "remove players who've implicitly had a chance to act" (i.e., !hasActedThisStreet and were skipped)
        if (playerStatus.hasActedThisStreet) {
            playersBeforeActorWhoAreStillIn.push(playerStatus);
        }
        // Else (playerStatus.hasActedThisStreet is false and index < actionIndex):
        // This player is implicitly folded as per the requirement. They are NOT added.
    }

    // 2. Process players AFTER the current actor
    for (let i = actionIndex + 1; i < currentActionSequence.length; i++) {
        const playerStatus = currentActionSequence[i];
        if (!playerStatus.hasFolded) {
            // Keep all players after the actor who haven't folded (includes those who might be all-in already)
            playersAfterActorWhoAreStillIn.push(playerStatus);
        }
    }

    // 3. Determine the updated status of the ACTING player
    const isNowAllIn = newStackSize === 0 || action.decision === Decision.kAllIn;
    const hasNowFolded = action.decision === Decision.kFold;

    // Simplified 'canRaise' for the acting player's state.
    // The game engine will truly determine if they can raise if action returns.
    let canPlayerRaiseNextTime = !isNowAllIn && !hasNowFolded;
    if (action.decision === Decision.kBet || action.decision === Decision.kRaise) {
        canPlayerRaiseNextTime = false; // Cannot immediately raise their own aggressive action.
    }
    // If they called or checked, 'canPlayerRaiseNextTime' remains true (conditionally, based on !isNowAllIn).
    // The game engine will verify if they *actually* face a situation where raising is a valid option.

    const updatedPlayer: PlayerStatus = {
        ...playerOriginalStatus,
        amountInvestedThisStreet: betTotalForStreet,
        hasFolded: hasNowFolded,
        hasActedThisStreet: true, // They have completed their current turn for this "pass".
        isAllIn: isNowAllIn,
        stack: newStackSize,
        canRaise: canPlayerRaiseNextTime,
    };

    // 4. Construct the new sequence
    // Order: [Players before actor who already acted & are still in]
    //        + [Players after actor who are still in]
    //        + [The acting player if they haven't folded (all-in players ARE included)]
    // This order helps the game engine determine the next player to act by typically
    // starting after the current actor's original logical position and considering this new pool.
    let newActionSequence: PlayerStatus[] = [
        ...playersBeforeActorWhoAreStillIn,
        ...playersAfterActorWhoAreStillIn,
    ];

    if (!updatedPlayer.hasFolded) {
        newActionSequence.push(updatedPlayer); // Add the acting player if they haven't folded.
    }

    return newActionSequence;
}

export function createInitialAppState(state: GameAppState, gameInfo: HandSetupInfo) {
    // validate thirdBlind, 2 players
    const { position: heroPosition, hand, smallBlind, bigBlind, relevantStacks, thirdBlind, bigBlindAnte } = gameInfo;
    const actionSequence = numPlayersToActionSequenceList[gameInfo.numPlayers];
    let thirdBlindInfo = thirdBlind ? { position: actionSequence[2], amount: thirdBlind } : undefined;
    const upperCasedHand = hand.toUpperCase();
    const stacks = parseStackSizes(relevantStacks, actionSequence, smallBlind, bigBlind, bigBlindAnte, thirdBlindInfo);
    const initialPlayerStatuses: PlayerStatus[] = actionSequence.map((position: Position, index) => ({
        position,
        isAllIn: false,
        hasActedThisStreet: false,
        amountInvestedThisStreet: position === Position.SB ? smallBlind : position === Position.BB ? bigBlind : index === 2 && thirdBlind ? thirdBlind : 0,
        canRaise: true,
        hasFolded: false,
        stack: stacks[position] as number,
    }));
    const initialSequence = moveFirstTwoToEnd(initialPlayerStatuses);
    const handAsArray = parsePokerHandString(upperCasedHand);
    const initialGameState: GameState = {
        ...state.current,
        actionSequence: initialSequence,
        pot: smallBlind + (bigBlindAnte ? bigBlind * 2 : bigBlind) + (thirdBlind ?? 0),
        smallBlind,
        bigBlind,
        thirdBlind: thirdBlindInfo,
        hero: { position: heroPosition, hand: handAsArray },
        deck: [...filterNewCardsFromDeck(handAsArray, [...state.current.deck])],
        playerActions: [],
        stage: Stage.Preflop,
        input: '',
        betsThisStreet: { [Position.SB]: smallBlind, [Position.BB]: bigBlind, ...(thirdBlindInfo ? { [thirdBlindInfo.position]: thirdBlindInfo.amount } : {}) },
        currentBetFacing: thirdBlind || bigBlind,
        lastRaiseAmount: thirdBlind || bigBlind,
        numberOfBetsAndRaisesThisStreet: 1,
        stacks,
        playerWhoMadeLastAggressiveAction: thirdBlindInfo ? thirdBlindInfo.position : Position.BB,
    };
    state.history.pop();
    state.history.push(initialGameState);
    return {
        current: { ...initialGameState },
        history: state.history,
    };
}

function getUpdatedListOfPlayerContributions(contributions: PlayerPotContribution[], betsThisStreet: BetsForStreetMap): PlayerPotContribution[] {
    if (contributions.length === 0) {
        return Object.entries(betsThisStreet).map(([player, amount]) => ({ position: player as Position, amount, eligible: true }))
    }
    const playerPotContributionList: PlayerPotContribution[] = [];
    contributions.forEach((contribution: PlayerPotContribution) => {
        if (contribution.position in betsThisStreet) {
            let newContribution = betsThisStreet[contribution.position];
            assertIsDefined(newContribution);
            playerPotContributionList.push({ position: contribution.position, eligible: true, amount: contribution.amount + newContribution })
        } else {
            playerPotContributionList.push(contribution);
        }
    });

    return playerPotContributionList;
}

function determinePlayerEligibility(position: Position, playerActions: PlayerAction[]): boolean {
    let eligible = false;
    for (let action of playerActions) {
        if (action.decision === Decision.kFold && action.position === position) {
            return false;
        }
        if (action.position === position) {
            eligible = true;
        }

    }
    return eligible;
}
export function reducer(state: GameAppState, action: { type: DispatchActionType; payload: any }): GameAppState {
    switch (action.type) {
        case DispatchActionType.kUndo:
            // console.log('============== UNDO ===========\n\n')
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
            const updatedActionSequence = updateActionSequenceWithNewAction(playerAction, curr.actionSequence, newStackSize, newPlayerBetTotal)
            let newLastRaiseAmount = curr.lastRaiseAmount; // Default to the existing value
            if (isAggressiveAction(playerAction.decision)) {
                // curr.currentBetFacing is the amount the player had to call before making their aggressive action.
                // This correctly calculates the raise increment for both opening bets (where curr.currentBetFacing might be 0 or BB)
                // and re-raises.
                newLastRaiseAmount = newPlayerBetTotal - curr.currentBetFacing;
            }
            // If playerAction.decision was not aggressive, newLastRaiseAmount remains curr.lastRaiseAmount.
            const newPlayerWhoMadeLastAggressiveAction = isAggressiveAction(playerAction.decision) ? playerAction.position : curr.playerWhoMadeLastAggressiveAction;
            const newNumberOfBetsAndRaisesThisStreet = curr.numberOfBetsAndRaisesThisStreet + (isAggressiveAction(playerAction.decision) ? 1 : 0);

            playerAction.text = getMeaningfulTextToDisplay(
                playerAction,
                curr.numberOfBetsAndRaisesThisStreet,
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
                actionSequence: updatedActionSequence,
                pot: curr.pot + amountToAdd,
                betsThisStreet: {
                    ...curr.betsThisStreet,
                    [actingPlayer]: newPlayerBetTotal,
                },
                stacks: {
                    ...curr.stacks,
                    [actingPlayer]: newStackSize,
                },
                currentBetFacing: newCurrentBetFacing,
                lastRaiseAmount: newLastRaiseAmount,
                playerWhoMadeLastAggressiveAction: newPlayerWhoMadeLastAggressiveAction,
                numberOfBetsAndRaisesThisStreet: newNumberOfBetsAndRaisesThisStreet,
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
            let updatedActionSequence;
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
                    const pots = calculateSidePots(curr.allPlayerContributions.map(player => ({ ...player, eligible: determinePlayerEligibility(player.position, curr.playerActions) })));
                    const formattedCards = formatCommunityCards(curr.cards);
                    const showdownPots: CalculatedPot[] = pots.map((pot: CalculatedPot) => {
                        const eligibleHands = showdownHands.filter(hand => (pot.eligiblePositions.includes((hand.playerId as Position)) && !(typeof hand.holeCards === "string")));
                        const winnerInfo = determineHandWinner(eligibleHands, formattedCards) as WinnerInfo;
                        return {
                            winningPlayerPositions: winnerInfo.winners.map(w => w.playerId),
                            winningHandDescription: winnerInfo.winningHandDescription,
                            potAmount: pot.potAmount,
                            eligiblePositions: pot.eligiblePositions,
                        }
                    });
                    const preflopActions = curr.playerActions.filter(action => action.stage === Stage.Preflop);
                    const handInfo = determineHandWinner(
                        showdownHands.filter(hand => !(typeof hand.holeCards === "string")),
                        formattedCards) as WinnerInfo;
                    propertyUpdates.calculatedPots = showdownPots;
                    propertyUpdates.showdown = handInfo.details;
                    const showhands = curr.allPlayerContributions.filter(p => {
                        let a = p.position === Position.SB && p.amount === curr.smallBlind;
                        let b = p.position === Position.BB && p.amount === curr.bigBlind;
                        let c = curr.thirdBlind && curr.thirdBlind.position === p.position && p.amount === curr.thirdBlind.amount;
                        if (a || b || c) {
                            return false;
                        }
                        return true
                    }).filter((hand, i, a) => {
                        return !preflopActions.some(action => action.position === hand.position && action.decision === Decision.kFold)
                    }).map(p => ({
                        playerId: p.position,
                        holeCards: "muck",
                        description: '',
                    }));
                    propertyUpdates.showdownHands = showhands;
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
                updatedActionSequence = updateActionSequenceWithNewAction(playerAction, curr.actionSequence, newStackSize, newPlayerBetTotal).filter((p) => p.hasActedThisStreet).sort((a, b) => positionToRank(a.position) - positionToRank(b.position));
                playerAction.text = getMeaningfulTextToDisplay(
                    playerAction,
                    getNumBetsForStage(curr.playerActions, initialStage),
                    initialStage);
                finalPlayerActions = [...finalPlayerActions, playerAction];

                // Update betting information
                propertyUpdates.actionSequence = updatedActionSequence;
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
                stage: nextStage,
                input: '',
                currentAction: nextAction,
                gameQueue: updatedGameQueue, // remove upcoming `currentAction` from queue
            };

            let finalState = newStateBase;
            if (initialStage === Stage.Preflop && nextStage === Stage.Flop) {
                console.log(`transitioning away from preflop`);
                finalState.potType = getPotType(finalState.numberOfBetsAndRaisesThisStreet);
            }

            // If the stage actually changed, recalculate the action sequence for the new stage.
            const stageChanged = initialStage !== nextStage && nextStage !== Stage.Showdown;
            if (stageChanged) {
                finalState = {
                    ...finalState,
                    allPlayerContributions: getUpdatedListOfPlayerContributions(finalState.allPlayerContributions, { ...finalState.betsThisStreet }),
                    betsThisStreet: {},
                    potForStreetMap: { ...finalState.potForStreetMap, [nextStage]: finalState.pot },
                    currentBetFacing: 0,
                    lastRaiseAmount: 0,
                    playerWhoMadeLastAggressiveAction: null,
                    numberOfBetsAndRaisesThisStreet: 0,
                };
            }
            if (curr.currentAction.id === GameQueueItemType.kRiverAction ||
                (curr.currentAction.id === GameQueueItemType.kRiverCard && curr.gameQueue.length === 0)) {
                // add villains to queue for card collection
                updatedGameQueue = AddVillainsToGameQueue(updatedActionSequence.filter(v => v.position !== curr.hero.position).map(v => v.position));
                nextAction = updatedGameQueue[0];
                updatedGameQueue = updatedGameQueue.slice(1);
                finalState = {
                    ...finalState,
                    currentAction: nextAction,
                    gameQueue: updatedGameQueue,
                    allPlayerContributions: getUpdatedListOfPlayerContributions(finalState.allPlayerContributions, { ...finalState.betsThisStreet }),
                    input: '',
                };
            }
            // Advance to showdown if necessary.
            const playersLeft = finalState.actionSequence.filter(player => !player.isAllIn).length;
            // Should this and the statement above be conditional and ordered?
            if (playersLeft <= 1) {
                const allInAndACall = didAllInAndACallOccurOnStreet(finalState.playerActions);
                if (allInAndACall) {
                    finalState.gameQueue = getRemainingCardActions(finalState.gameQueue)
                    // river?
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
    if (numBetsThisStreet === 1 && stage === Stage.Preflop && isAggressiveAction(action.decision)) {
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
