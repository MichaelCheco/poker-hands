import React from 'react';
import { StyleSheet, View } from 'react-native';
import { List, Text, Button, useTheme, TextInput, Portal, Snackbar, Icon } from 'react-native-paper';
import { MyHand } from './Cards';
import { HandSetupInfo, GameState, ShowdownHandRecord, Stage, ActionRecord, Position } from '@/types';
import { formatAndCopyHandHistory, getHandSummary } from '@/utils/hand-utils';
import { useRouter } from 'expo-router';
import { saveHandToSupabase } from '@/api/hands';

async function handleOnSavePress(gameState: GameState, gameInfo: HandSetupInfo): Promise<{
    success: boolean; message: string; handId: string;
}> {
    const result = await saveHandToSupabase(gameState, gameInfo);
    return result;
}
// wins ${pot} with 
const Showdown = ({ showdownHands, finalStreet, actions, pot, smallBlind, bigBlind }: {
    showdownHands: ShowdownHandRecord[],
    finalStreet: Stage,
    actions: ActionRecord[],
    pot: number,
    smallBlind: number,
    bigBlind: number,
}) => {
    // console.log(showdownHands, finalStreet, actions, pot)
        const stacksMap = actions.filter(a => !(a.was_auto_folded)).reduce((acc, action) => {
            if (!acc[action.position]) {
                let startVal = 
                action.position === Position.SB 
                ? smallBlind 
                : action.position === Position.BB 
                ? bigBlind 
                : 0;
                acc[action.position] = {start: action.player_stack_before + startVal, end: 0};
            }
            acc[action.position].end = acc[action.position].end + action.action_amount;
            return acc;
        }, {});
        console.log(stacksMap)
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
    const amt = Object.values(stacksMap).reduce((acc, val) => acc += val.end, 0);
    return (
        <View style={{  }}>
             {/* title='Hand Result' titleStyle={{marginLeft: 0, paddingLeft: 0}} */}
            <List.Section>
                <List.Subheader style={{
                    marginLeft: -10, marginInline: 0, padding: 0,
                    fontWeight: '700',
                    color: '#000000E8',
                }}>
                    Result
                </List.Subheader>
                {showdownHands ? showdownHands.map((hand, index) => {
                    // const isHand = !(typeof hand.hole_cards === "string");
                    return (
                        <List.Item
                            contentStyle={{ flexGrow: 0, alignItems: 'center', }}
                            key={`${hand.position}-${hand.hole_cards}-${index}`}
                            title={() => {
                                if (hand.hole_cards !== "muck") {
                                  return (
                                    <MyHand cards={hand.hole_cards} textStyle={{fontSize: 14, fontWeight: 400}}/>
                                  )
                                }
                                return (
                                  <Text style={{fontSize:16}}>Mucked</Text>
                                )
                            }}
                            left={() => <Text style={styles.actionPosition}>{hand.position}</Text>}
                            right={() => (
                                <View style={{display: 'flex', flexDirection: 'row', justifyContent: 'space-between', flex: 1}}>
                                    <Text style={{ marginInlineStart: 4, alignSelf: 'center' }} variant='bodyMedium'>- {hand.hand_description}</Text>
                                    <View style={{display: 'flex', flexDirection: 'row'}}>

                                    <Icon  source={hand.is_winner ? "plus" : "minus"} color={hand.is_winner ? '#388E4A' : "#DA3036"} size={15} /> 
                                    <Text variant='bodyMedium' style={{color: hand.is_winner ? '#388E4A' : "#DA3036", fontWeight: 700, position: 'relative', bottom: 2}}>{hand.is_winner ? amt : stacksMap[hand.position].end}</Text>
                                    </View>
                                </View>
                        )}
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
        marginLeft: 8,
        // minWidth: 20,
        textAlign: 'center',
        alignSelf: 'center',
        color: '#555',
    },
});

export default Showdown;