import { ActionRecord, ShowdownHandRecord, Stage } from '@/types';
import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { IconButton, List, Snackbar, Text } from 'react-native-paper';
import { ShowdownCard } from './Cards';
import { copyHand } from '@/utils/hand_utils';

function getFlopCards(cards: string[]) {
    let [card1, card2, card3, ...rest] = cards;
    return [card1, card2, card3];
}

function FlopCards({ cards }: { cards: string[] }) {
    return (

        <View style={{ display: 'flex', flexDirection: 'row', gap: 2, alignItems: 'center', justifyContent: 'center' }} >
            {cards.map(c => (
                <ShowdownCard card={c} key={c} />
            ))}
        </View>
    )
}
export default function ActionListReview({
    actionList,
    communityCards,
    smallBlind,
    bigBlind,
    gameType,
    numPlayers,
    location,
    hand,
    position,
    pot,
    showdown
}: {
    actionList: ActionRecord[],
    communityCards: string[],
    smallBlind: number;
    bigBlind: number;
    gameType: string;
    numPlayers: number;
    location: string;
    hand: string;
    position: string;
    pot: number;
    showdown: ShowdownHandRecord[];
}) {
    const [snackbarVisible, setSnackbarVisible] = React.useState(false);
    const groupedActions: Record<Stage, ActionRecord[]> = React.useMemo(() => {
        return actionList.filter(a => !(a.was_auto_folded)).reduce((acc: Record<Stage, ActionRecord[]>, action: ActionRecord) => {
            const stage: Stage = action.stage;
            acc[stage].push(action);
            return acc;
        }, {
            [Stage.Preflop]: [],
            [Stage.Flop]: [],
            [Stage.Turn]: [],
            [Stage.River]: [],
            [Stage.Showdown]: [],
        });
    }, [actionList]);

    const groupedPotSizes: Record<Stage, number> = React.useMemo(() => {
        return actionList.filter(a => !(a.was_auto_folded)).reduce((acc: Record<Stage, number>, action: ActionRecord) => {
            const stage: Stage = action.stage;
            acc[stage] = acc[stage] + (action?.action_amount || 0);
            return acc;
        }, {
            [Stage.Preflop]: 0,
            [Stage.Flop]: 0,
            [Stage.Turn]: 0,
            [Stage.River]: 0,
            [Stage.Showdown]: 0,
        });
    }, [actionList]);
    const flopPotSize = groupedPotSizes[Stage.Preflop];
    const turnPotSize = flopPotSize + groupedPotSizes[Stage.Flop];
    const riverPotSize = turnPotSize + groupedPotSizes[Stage.Turn];
    const sortedStages = Object.keys(groupedActions).map(Number).filter(a => (a !== Stage.Showdown && groupedActions[a as Stage].length > 0)).sort((a, b) => a - b);
    const stageToPotSizeMap: Partial<Record<Stage, number>> = {
        [Stage.Preflop]: 0,
        [Stage.Flop]: flopPotSize,
        [Stage.Turn]: turnPotSize,
        [Stage.River]: riverPotSize,
    }
    return (
        <List.Section style={{ paddingBottom: 32, marginTop: 24 }}>
            <Snackbar
                visible={snackbarVisible}
                onDismiss={() => setSnackbarVisible(false)}
                duration={1000}>
                Hand Copied! ✅
            </Snackbar>
            <View style={styles.subheaderContainer}>
                <List.Subheader
                    style={[
                        styles.subheaderText,
                        { color: '#000000E8' }
                    ]}
                >
                    <Text variant="titleMedium" style={{
                        color: '#000000E8',
                    }}>
                        The Hand - ${smallBlind}/${bigBlind} {gameType} {numPlayers}-handed
                    </Text>
                </List.Subheader>

                <IconButton
                    icon="content-copy"
                    size={20}
                    onPress={async () => {
                        const success = await copyHand(
                            actionList,
                            communityCards,
                            smallBlind,
                            bigBlind,
                            location,
                            hand,
                            position,
                            pot,
                            showdown);
                        setSnackbarVisible(success);
                    }}
                    style={styles.subheaderIcon}
                />
            </View>
            {sortedStages.map((stage: Stage) => (
                <View key={`stage-container-${stage}`}>
                    <List.Subheader variant='bodyLarge' style={{
                        marginLeft: -10,
                        marginInline: 0, padding: 0,
                        fontWeight: '500',
                        color: '#0000009A',
                    }}>
                        <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                            <Text variant='bodyLarge' style={{ fontWeight: '500' }}>{`${getStageName2(stage)}  `}</Text>
                            {stage === Stage.Flop && <FlopCards cards={getFlopCards(communityCards)} />}
                            {stage === Stage.Turn && <FlopCards cards={[communityCards[3]]} />}
                            {stage === Stage.River && <FlopCards cards={[communityCards[4]]} />}
                            {stage !== Stage.Preflop && <Text style={{ marginLeft: 4, fontWeight: '600' }}>(${stageToPotSizeMap[stage]})</Text>}
                        </View>

                    </List.Subheader>
                    {groupedActions[stage].map((item: ActionRecord, index: number) => {
                        const uniqueItemKey = item.id || `action-${stage}-${item.position}-${index}`;
                        return (
                            <React.Fragment key={uniqueItemKey}>
                                <List.Item
                                    title={item.text_description}
                                    titleStyle={{ ...styles.actionText, fontSize: 15 }}

                                    left={() => <Text style={styles.actionPosition}>{item.position}</Text>}
                                    style={styles.actionItem}
                                />
                            </React.Fragment>
                        );
                    })}
                </View>
            ))}
        </List.Section>
    );
}


const getStageName2 = (stage: Stage) => {
    switch (stage) {
        case Stage.Preflop: return 'PREFLOP';
        case Stage.Flop: return 'FLOP';
        case Stage.Turn: return 'TURN';
        case Stage.River: return 'RIVER';
        default: return '';
    }
};

const styles = StyleSheet.create({
    actionItem: {
        paddingVertical: 4,
        padding: 0,
        marginLeft: 8
    },
    actionPosition: {
        fontWeight: '400',
        marginLeft: 6,
        textAlign: 'center',
        alignSelf: 'center',
        width: 30,
    },
    actionText: {
    },
    subheaderContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginLeft: 4,
    },
    subheaderText: {
        marginLeft: 0,
        marginRight: 0,
        marginVertical: 0,
        paddingVertical: 0,
        paddingHorizontal: 0,
        fontWeight: '600',
        flexShrink: 1,
    },
    subheaderIcon: {
        margin: 0,
    },
});