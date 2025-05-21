import React from 'react';
import { StyleSheet, View } from 'react-native';
import { List, Text, useTheme, Icon } from 'react-native-paper';
import { ShowdownCard } from './Cards';
import { ShowdownHandRecord, Stage, ActionRecord, Position, Decision, HandPot, PlayerStacks } from '@/types';
import { getHandSummary } from '@/utils/hand_utils';
import { assertIsDefined } from '@/utils/assert';
import StackChangeDisplay from './StackChangeDisplay';

// '#388E4A' : "#DA3036"

/**
 * Generates a simplified textual summary of a player's winnings from various pots in a hand.
 *
 * @param playerPosition The position string (e.g., "SB", "BB") of the player to summarize.
 * @param allPotsInHand An array of HandPot objects representing all pots (main and side) in the hand.
 * @returns A string summarizing the player's winnings.
 */
export function getSimplifiedPlayerPotSummary(
    playerPosition: string,
    allPotsInHand: HandPot[]
): string {
    if (!allPotsInHand || allPotsInHand.length === 0) {
        return ""; // No pots, so effectively involved in 0 pots.
    }

    // 1. Filter for pots the player was eligible for
    const playerEligiblePots = allPotsInHand.filter(pot =>
        pot.eligible_player_positions.includes(playerPosition)
    );

    // 2. If player was eligible for 1 or fewer pots, return an empty string
    if (playerEligiblePots.length <= 1) {
        return "";
    }

    // 3. If eligible for more than 1 pot, detail the results
    const summaryParts: string[] = [];

    for (const pot of playerEligiblePots) {
        if (pot.winning_player_positions?.includes(playerPosition)) {
            // Player won this pot (or a share of it)
            const numberOfWinners = pot.winning_player_positions.length;
            const amountWonThisPot = numberOfWinners > 0 ? pot.amount / numberOfWinners : 0;

            if (amountWonThisPot > 0) { // Only add if they actually won a positive amount
                const potLabel = pot.pot_number === 0 ? "main" : `side ${pot.pot_number}`;
                summaryParts.push(`+${amountWonThisPot.toFixed(0)} ${potLabel}`);
            }
        }
        // Note: To display a loss for a pot (e.g., "-$30 Side Pot 1"), we would need to know
        // the player's specific contribution to THIS pot layer. This information is not
        // available in the current HandPot interface. So, this function only lists winnings.
    }

    if (summaryParts.length === 0) {
        // Player was eligible for multiple pots but won none of them.
        return "";
    }

    return `(${summaryParts.join(", ")})`;
}

const Showdown = ({ showdownHands, finalStreet, actions, pot, handPots, stacks, bigBlind }: {
    showdownHands: ShowdownHandRecord[],
    finalStreet: Stage,
    actions: ActionRecord[],
    pot: number,
    bigBlind: number,
    handPots: HandPot[],
    stacks: PlayerStacks,
}) => {
    type BetsPerStage = Record<Stage, number[]>;

    function getTotalWinningsFromPots(position: string) {
        let winnings = 0;
        handPots.forEach((handPot) => {
            if (handPot.winning_player_positions?.includes(position)) {
                winnings += Math.round(handPot.amount / handPot.winning_player_positions.length);
            }
        });
        return winnings;
    }
    function getPlayerTotalContribution(position: string): number {
        const actionsForPlayer = actions.filter(action => action.position === position);
        const initialBetsPerStage: BetsPerStage = {
            [Stage.Preflop]: [],
            [Stage.Flop]: [],
            [Stage.Turn]: [],
            [Stage.River]: [],
            [Stage.Showdown]: [],
        };
        const betsForPlayerEachStreet: BetsPerStage = actionsForPlayer.reduce(
            (accumulator: BetsPerStage, currentAction: ActionRecord) => {
                const stage: Stage = currentAction.stage;
                accumulator[stage].push(currentAction.action_amount);
                return accumulator;
            },
            initialBetsPerStage
        );
        return Object.values(betsForPlayerEachStreet).filter(b => b.length !== 0).reduce((accumulator, bets) => accumulator += bets[bets.length - 1], 0);
    }
    return (
        <List.Section>
            <List.Subheader
                variant='headlineLarge'
                style={{
                    marginLeft: -10, marginInline: 0, padding: 0,
                    fontWeight: '600',
                    color: '#000000E8',
                }}>
                <Text variant="titleMedium" style={{ fontWeight: '600', color: '#000000E8' }}>
                    Result
                </Text>
            </List.Subheader>
            {showdownHands.length > 0 ? showdownHands.map((hand, index) => {
                let initialStack = stacks[hand.position as Position] ?? bigBlind * 100;
                return (
                    <List.Item
                        contentStyle={{}}
                        description={`${hand.hand_description} ${getSimplifiedPlayerPotSummary(hand.position, handPots)}`}
                        descriptionStyle={{ color: '#00000082' }}
                        key={`${hand.position}-${hand.hole_cards}-${index}`}
                        title={() => {
                            if (hand.hole_cards !== "muck") {
                                return (
                                    <View style={{ display: 'flex', flexDirection: 'row', gap: 2 }} >
                                        <ShowdownCard card={hand.hole_cards.substring(0, 2)} />
                                        <ShowdownCard card={hand.hole_cards.substring(2)} />
                                    </View>
                                )
                            }
                            return (
                                <View style={{ display: 'flex', flexDirection: 'row', 
                                }} >
                                    <ShowdownCard card={"muck"} />
                                    <ShowdownCard card={"muck"} />
                                </View>
                            )
                        }}
                        left={() => <Text style={styles.actionPosition}>{hand.position}</Text>}
                        right={() => <StackChangeDisplay
                            initialStack={initialStack}
                            finalStack={initialStack - getPlayerTotalContribution(hand.position) + getTotalWinningsFromPots(hand.position)} />}
                    />
                )
            }
            ) : (
                <Text style={{ marginTop: 8 }}>{getHandSummary(finalStreet, actions, handPots, pot)}</Text>
            )}
        </List.Section>
    );
};

const styles = StyleSheet.create({
    actionText: {
        fontSize: 13,
        marginRight: 0,
    },
    actionItem: {
        paddingVertical: 0,
        paddingLeft: 0,
        paddingInlineStart: 0,
        paddingInline: 0,
        padding: 0,
    },
    actionPosition: {
        fontWeight: 'bold',
        marginLeft: 6,
        minWidth: 38,
        textAlign: 'center',
        alignSelf: 'center',
        color: '#555',
    },
});

export default Showdown;