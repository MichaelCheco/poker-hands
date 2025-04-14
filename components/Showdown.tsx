import React from 'react';
import { StyleSheet, View } from 'react-native';
import { List, Text, IconButton, Button, useTheme, TextInput } from 'react-native-paper';
import { MyHand } from './Cards';
import { PokerPlayerInput } from '@/hand-evaluator';
import { Decision, PlayerAction, PlayerStatus, ShowdownDetails, Stage } from '@/types';
import * as Clipboard from 'expo-clipboard';
import { PokerFormData } from './PokerHandForm';


function getStageName(stage: Stage): string {
    switch (stage) {
        case Stage.Preflop: return 'Preflop';
        case Stage.Flop: return 'Flop';
        case Stage.Turn: return 'Turn';
        case Stage.River: return 'River';
        case Stage.Showdown: return 'Showdown';
        default: return `Unknown Stage (${stage})`;
    }
}

function getStageCards(stage: Stage, communityCards: string[]): string {
    const flopCardStr = communityCards.slice(0, 3).join(', ');
    const turnCardStr = communityCards[3];
    const riverCardStr = communityCards[4];
    switch (stage) {
        case Stage.Preflop: return '';
        case Stage.Flop: return `: ${flopCardStr}`;
        case Stage.Turn: return `: ${turnCardStr}`;
        case Stage.River: return `: ${riverCardStr}`;
        case Stage.Showdown: return '';
        default: return `Unknown Stage (${stage})`;
    }
}

/**
 * Formats a poker hand history from actions and showdown info into a string
 * and copies it to the clipboard using Expo Clipboard.
 *
 * @param actions - Array of action objects for the hand.
 * @param showdown - Showdown information object, or null if no showdown.
 * @returns Promise<boolean> - True if copy was successful, false otherwise.
 */
export async function formatAndCopyHandHistory(
    actions: PlayerAction[],
    gameInfo: PokerFormData,
    communityCards: string[],
    showdown: ShowdownDetails | null,
    pot: number
): Promise<boolean> {
    if (!actions || actions.length === 0) {
        console.warn("No actions provided to format.");
        // Optionally set clipboard to empty or show user feedback
        // await Clipboard.setStringAsync("");
        return false;
    }

    const lines: string[] = [];
    lines.push(`${gameInfo.smallBlind}/${gameInfo.bigBlind} • ${gameInfo.location}`);
    lines.push(`\nHero: ${gameInfo.hand} ${gameInfo.position}`);

    // Group actions by stage
    const groupedActions: { [stage: number]: PlayerAction[] } = {};
    for (const action of actions) {
        // Only include stages relevant to betting rounds for action listing
        if (action.stage <= Stage.River) {
            if (!groupedActions[action.stage]) {
                groupedActions[action.stage] = [];
            }
            groupedActions[action.stage].push(action);
        }
    }
    const flopCardStr = communityCards.slice(0, 3).join(', ');
    const turnCardStr = communityCards[3];
    const riverCardStr = communityCards[4];

    // Define the order of stages
    const stageOrder: Stage[] = [Stage.Preflop, Stage.Flop, Stage.Turn, Stage.River];

    // Process stages in order
    for (const stageNum of stageOrder) {
        const stageActions = groupedActions[stageNum];

        if (stageActions && stageActions.length > 0) {
            lines.push(`\n${getStageName(stageNum).toUpperCase()}${getStageCards(stageNum, communityCards)}`);

            // Filter out actions typically hidden from UI for summary (e.g., folds)
            const visibleActions = stageActions.filter(a => !a.shouldHideFromUi);

            if (visibleActions.length === 0 && stageNum !== Stage.Preflop) {
                // If only hidden actions occurred (e.g. everyone folded pre-bet on flop)
                // Or if it was checked around (and checks aren't hidden)
                // You might want different logic here, but this indicates no major action shown.
                // We'll rely on visibleActions loop below instead.
            }

            if (visibleActions.length > 0) {
                visibleActions.forEach(action => {
                    // Use a consistent format: Position: text
                    // The 'text' field in your data seems quite descriptive already
                    lines.push(`${action.position}: ${action.text}`);
                });
            } else if (stageNum > Stage.Preflop) {
                // Check if the *only* actions were checks (which aren't hidden)
                const onlyChecks = stageActions.every(a => a.decision === 'X');
                if (onlyChecks) {
                    lines.push("(Checked around)");
                } else {
                    lines.push("(No significant action shown)"); // Or adjust as needed
                }

            }
        }
    }

    // Add Showdown info if available
    if (showdown) {
        lines.push("\nSHOWDOWN");

        // Note: The 'combination' field isn't clearly defined as board cards vs winning hand cards.
        // For clarity, we'll just show who showed cards and who won. Add board separately if you have that data.
        // lines.push(`Board: [ ${communityCardsArray.join(' ')} ]`); // <-- Add if you have board cards separately

        if (showdown.hands && showdown.hands.length > 0) {
            showdown.hands.forEach(handInfo => {
                const cardsString = Array.isArray(handInfo.holeCards) ? handInfo.holeCards.join(' ') : '??';
                lines.push(`- ${handInfo.playerId} shows [ ${cardsString} ]`);
            });
        }

        if (showdown.winner && showdown.text) {
            lines.push(`\nWinner: ${showdown.winner} wins ${pot} with ${showdown.text}`);
            lines.push(`\nCombination: ${showdown.combination.join(', ')}`)
        } else if (showdown.winner) {
            lines.push(`\nWinner: ${showdown.winner}`); // Fallback if description missing
        }
    } else {
        // Optional: Indicate how the hand ended if not by showdown (e.g. player won uncontested)
        // This would require analysing the last actions. For simplicity, we omit this for now.
    }

    // Join lines into a single string
    const historyString = lines.join('\n');
    console.log("Formatted History:\n", historyString); // For debugging

    // Copy to clipboard
    try {
        await Clipboard.setStringAsync(historyString);
        console.log("Hand history copied to clipboard.");
        // You could add user feedback here (e.g., a toast message)
        return true;
    } catch (error) {
        console.error("Failed to copy hand history to clipboard:", error);
        // Add user feedback for error
        return false;
    }
}

function getLastStageName(actionList: PlayerAction[]): string {
    return getStageName(actionList[actionList.length -1].stage);
}

function decisionToText(decision: Decision): string {
    switch (decision) {
        case Decision.kCheck: return 'checked';
        case Decision.kBet: return 'bet';
        case Decision.kCall: return 'called';
        case Decision.kFold: return 'folded';
        case Decision.kRaise: return 'raised';

    }
}

function getTextSummaryForLastStage(actionList: PlayerAction[]): string {
    const lastStagePlayed = actionList[actionList.length -1].stage;
    const lastStageActions = actionList.filter(action => action.stage === lastStagePlayed);
    let text = '';
    for (const action of lastStageActions) {
        text = text + `${action.position} ${decisionToText(action.decision)}, `
    }
    text = text.slice(0, -2);
    return `${text}.`
}

function getWinner(actionSequence: string[]): string {
    if (actionSequence.length > 1) {
        console.error(`action sequence should only contain 1 player. `, actionSequence)
    }
    return actionSequence[0];
}

function getHandSummary(actionList: PlayerAction[], actionSequence: string[], pot: number): string {
    let summary = `Hand ended on the ${getLastStageName(actionList)}.\n${getTextSummaryForLastStage(actionList)}.\n${getWinner(actionSequence)} wins $${pot}.`;
    return summary;
    // Hand ended on the River. Pot: $250. SB wins $250. CO folded.
}
const Showdown = ({ showdown, actionList, gameInfo, communityCards, pot, actionSequence }: {
    showdown: ShowdownDetails | null, actionList: PlayerAction[],
    gameInfo: PokerFormData,
    communityCards: string[],
    pot: number,
    actionSequence: PlayerStatus[],
}) => {
    const theme = useTheme();
    const handleCopyPress = async () => {
        const success = await formatAndCopyHandHistory(actionList, gameInfo, communityCards, showdown, pot);
        if (success) {
            console.log('success');
        } else {
            console.log('Could not copy history.');
        }
    };
    return (
        <View style={{ marginInline: 8 }}>
            <List.Section>
                {showdown ? showdown.hands.map((hand, index) => {
                    return (
                        <List.Item
                            contentStyle={{ flexGrow: 0, alignItems: 'center' }}
                            key={`${hand.playerId}-${hand.holeCards.join('')}-${index}`}
                            title={() => <MyHand cards={hand.holeCards.join('')} />}
                            left={() => <Text style={styles.actionPosition}>{hand.playerId}</Text>}
                            right={hand.playerId === showdown.winner ? () => <Text style={{ marginInlineStart: 8, alignSelf: 'center' }}>wins ${pot} with {showdown.text}</Text> : undefined}
                        />
                    )
                }
                ) : (
                    <Text style={{marginTop: 8}}>{getHandSummary(actionList, actionSequence.map(a => a.position), pot)}</Text>
                )}
            </List.Section>
            <TextInput
                mode="outlined"
                multiline
                label="Notes"
                style={{minHeight: 90, flex: 1, marginBottom: 16}}
                activeOutlineColor='#000000'
            />
            <View style={{ display: 'flex', flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginLeft: 8 }}>
                <Button onPress={handleCopyPress} mode="contained" buttonColor="#000000" textColor='#FFFFFF'>Copy</Button>
                <Button mode="contained" buttonColor="#000000" textColor='#FFFFFF'>Save</Button>
            </View>

        </View>
    );
};
{/* <IconButton
    icon="content-copy"
    size={24}
    onPress={handleCopyPress}
    iconColor='#000000'
/> */}
const styles = StyleSheet.create({
    actionText: {
        fontSize: 16,
        marginRight: 0,
    },
    actionItem: {
        paddingVertical: 4,
        paddingLeft: 2,
        paddingInlineStart: 0,
        paddingInline: 0,
        padding: 0,
    },
    actionPosition: {
        fontWeight: 'bold',
        marginLeft: 8,
        minWidth: 24,
        textAlign: 'center',
        alignSelf: 'center',
        color: '#555',
    },
});

export default Showdown;