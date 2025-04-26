import React from 'react';
import { StyleSheet, View } from 'react-native';
import { List, Text, Button, useTheme, TextInput, Portal, Snackbar } from 'react-native-paper';
import { MyHand } from './Cards';
import { HandSetupInfo, GameState, ShowdownHandRecord, Stage, ActionRecord } from '@/types';
import { formatAndCopyHandHistory, getHandSummary } from '@/utils/hand-utils';
import { useRouter } from 'expo-router';
import { saveHandToSupabase } from '@/api/hands';

async function handleOnSavePress(gameState: GameState, gameInfo: HandSetupInfo): Promise<{
    success: boolean; message: string; handId: string;
}> {
    const result = await saveHandToSupabase(gameState, gameInfo);
    return result;
}

const Showdown = ({ showdownHands, finalStreet, actions, pot }: {
    showdownHands: ShowdownHandRecord[],
    finalStreet: Stage,
    actions: ActionRecord[],
    pot: number
}) => {
    console.log(showdownHands, finalStreet, actions, pot)
    const theme = useTheme();
    const router = useRouter()
    const [portalSnackbarVisible, setPortalSnackbarVisible] = React.useState(false);
    // const showdown = gameState.gameQueue.length > 0 ? null : gameState.showdown;
    // const handleCopyPress = async () => {
    //     const success = await formatAndCopyHandHistory(gameState.playerActions, gameInfo, gameState.cards, gameState.showdown, gameState.pot);
    //     if (success) {
    //         setPortalSnackbarVisible(true)
    //         setTimeout(() => {
    //             router.back();
    //         }, 500);
    //     } else {
    //         console.log('Could not copy history.');
    //     }
    // };
    const winner = showdownHands.find(hand => hand.is_winner);
    return (
        <View style={{ marginInline: 8 }}>
            <List.Section>
                {showdownHands ? showdownHands.map((hand, index) => {
                    // const isHand = !(typeof hand.hole_cards === "string");
                    return (
                        <List.Item
                            contentStyle={{ flexGrow: 0, alignItems: 'center' }}
                            key={`${hand.position}-${hand.hole_cards}-${index}`}
                            title={() => {
                                if (hand.hole_cards !== "muck") {
                                  return (
                                    <MyHand cards={hand.hole_cards} />
                                  )
                                }
                                return (
                                  <Text style={{fontSize:16}}>Mucked</Text>
                                )
                            }}
                            left={() => <Text style={styles.actionPosition}>{hand.position}</Text>}
                            right={hand.is_winner ? () => <Text style={{ marginInlineStart: 8, alignSelf: 'center' }}>wins ${pot} with {hand.hand_description}</Text> : undefined}
                        />
                    )
                }
                ) : (
                    <Text style={{ marginTop: 8 }}>{getHandSummary(finalStreet, actions, winner?.position as string, pot)}</Text>
                )}
            </List.Section>
            {/* <TextInput
                mode="outlined"
                multiline
                label="Notes"
                style={{ minHeight: 90, flex: 1, marginBottom: 16 }}
                activeOutlineColor='#000000'
            />
            <View style={{ display: 'flex', flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginLeft: 8 }}>
                <Button onPress={handleCopyPress} mode="contained" buttonColor="#000000" textColor='#FFFFFF'>Copy</Button>
                <Button onPress={async () => {
                    const success = await handleOnSavePress(gameState, gameInfo);
                    setPortalSnackbarVisible(success);
                    if (success) {
                        setTimeout(() => {
                            router.push(`${item.id}`)
                        }, 1500);
                    }

                    }} mode="contained" buttonColor="#000000" textColor='#FFFFFF'>Save</Button>
            </View>
            <Portal>
            <Snackbar
              visible={portalSnackbarVisible}
              onDismiss={() => setPortalSnackbarVisible(false)}
              action={{
                label: 'close'
              }}
            >
              Successfully saved hand!
            </Snackbar>
          </Portal> */}
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
        // marginLeft: 8,
        minWidth: 24,
        textAlign: 'center',
        alignSelf: 'center',
        color: '#555',
    },
});

export default Showdown;