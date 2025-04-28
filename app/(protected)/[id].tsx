import React, { useEffect, useState, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import { View, ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams, Stack, useNavigation } from 'expo-router';
import { getHandDetailsById } from '@/api/hands';
import { formatAndGetTextToCopy, formatDateMMDDHHMM } from '@/utils/hand-utils';
import { DetailedHandData, HandSetupInfo } from '@/types';
import { IconButton, Text, Divider, Button, TextInput } from 'react-native-paper';
import Showdown from '@/components/Showdown';
import ActionListReview from '@/components/ActionListReview';
// import {
//     BottomSheetModal,
//     BottomSheetView,
//     BottomSheetModalProvider,
//     BottomSheetTextInput,
// } from '@gorhom/bottom-sheet';
// import { GestureHandlerRootView } from 'react-native-gesture-handler';

// style={{margin: 0, padding: 0, gap: 0}}
function HandActions({ date }) {
    return (
        <View style={{
            display: 'flex',
            // flexDirection: 'row',
            // gap: 0,
            justifyContent: 'center',
            alignItems: 'center',
            // marginInline: 0,
            // paddingBottom: 10
        }}>
            <Text variant='titleMedium'>{formatDateMMDDHHMM(date)}
                {/* {<IconButton icon="note-text-outline" size={17} style={{position: 'absolute', left: 25}}/>} 
            {<IconButton icon="delete-outline" size={17} iconColor='#DA3036' style={{position: 'absolute', left: 25, top : 40}}/>} */}
            </Text>
            {/* <View style={{display: 'flex', flexDirection: 'row',
            justifyContent: 'flex-end',
            // marginBottom: -10

            }}>
            <IconButton icon="note-text-outline" size={20} />
            <IconButton icon="delete-outline" size={20} iconColor='#DA3036' />
            </View> */}
        </View>
    )
}
export default function HandDetailScreen() {
    const [expanded, setExpanded] = useState(false);
    const [initial, setInitial] = useState(false);

    const navigation = useNavigation();
//     const bottomSheetModalRef = useRef<BottomSheetModal>(null);
//     // const { dismiss, dismissAll } = useBottomSheetModal();

//     // callbacks
//      // Callback to open the sheet
//   const handleOpenSheet = useCallback(() => {
//     console.log('here')
//     bottomSheetModalRef.current?.present(); 
//   }, []);

//   // Callback to close the sheet
//   const handleCloseSheet = useCallback(() => {
//     bottomSheetModalRef.current?.close();
//   }, []);
//     const handlePresentModalPress = useCallback(() => {
//         console.log('in handle present modal press')
//         // bottomSheetModalRef.current?.present();

//         // bottomSheetModalRef.current?.present();
//         if (!initial) {
//             handleOpenSheet()
//             setInitial(true);
//             setExpanded(true);
//         }

//         if (expanded) {
//             handleCloseSheet()
//             setExpanded(false);
//         } else {
//             handleOpenSheet()

//             setExpanded(true);
//         }
//     }, []);
//     const handleSheetChanges = useCallback((index: number) => {
//         console.log('handleSheetChanges', index);
//     }, []);
    // Get the dynamic 'id' parameter from the route
    const { id } = useLocalSearchParams<{ id: string }>();

    const [handDetails, setHandDetails] = useState<DetailedHandData | null>(null); // Replace 'any' with your detailed hand type
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    // const snapPoints = useMemo(() => ['40%', '85%'], []);

    useLayoutEffect(() => {
        const fetchDetails = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const details: DetailedHandData = await getHandDetailsById(id);
                let info: HandSetupInfo = {
                    bigBlind: details.big_blind,
                    hand: details.hero_cards as string,
                    location: details.location as string,
                    numPlayers: details.num_players,
                    relevantStacks: details.stacks,
                    position: details.hero_position as string,
                    smallBlind: details.small_blind,
                };
                setHandDetails(details);
                navigation.setOptions({
                    headerBackButtonDisplayMode: "default",
                    headerLeft: () => <Text variant='titleMedium'>{details.location} - ${details.small_blind}/${details.big_blind} {details.game_type} {details.num_players}-handed</Text>,
                    headerRight: () => <HandActions date={details.played_at} />,
                    headerTitle: '',
                });

            } catch (err: any) {
                setError(err.message || 'Failed to load hand details.');
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchDetails();
    }, [id]);
    function getGameInfo(): HandSetupInfo | null {
        if (!handDetails) {
            return null;
        }
        return {
            bigBlind: handDetails.big_blind,
            hand: handDetails.hero_cards as string,
            location: handDetails.location as string,
            numPlayers: handDetails.num_players,
            relevantStacks: '',
            position: handDetails.hero_position as string,
            smallBlind: handDetails.small_blind,
        };
    }
    // console.log(handDetails ?? "loading")
    return (
        // <GestureHandlerRootView>
        <View style={styles.container}>
            {isLoading && <ActivityIndicator size="large" style={styles.loader} />}
            {error && <Text style={styles.errorText}>Error: {error}</Text>}
            {!isLoading && !error && handDetails && (
                <ScrollView style={{
                    flex: 1, // Allow ScrollView to take available space
                    paddingHorizontal: 15,
                }}>
                    {/* <View style={{
                        display: 'flex', flexDirection: 'row',
                        justifyContent: 'flex-end',
                        marginVertical: -12,
                        // paddingVertical: -2
                    }}>
                        <IconButton icon="note-text-outline" size={21} style={{ position: 'relative', left: 10 }} />
                        <IconButton onPress={() => console.log("Press")} icon="delete-outline" size={21} iconColor='#DA3036' />
                    </View> */}
                    {/* <Divider /> */}
                    <Showdown
                                        smallBlind={handDetails.small_blind}
                                        bigBlind={handDetails.big_blind}
                        showdownHands={handDetails.showdown_hands}
                        finalStreet={handDetails.final_street}
                        actions={handDetails.actions}
                        pot={handDetails.final_pot_size as number} />
                    {/* {handDetails.actions.map((action) => (
                        <React.Fragment key={action.id}>
                        <Text>{action.position} - {action.text_description}</Text>
                        </React.Fragment>
                        ))} */}
                    <Divider bold />
                    <ActionListReview 
                    actionList={handDetails.actions}
                     communityCards={handDetails.community_cards}/>
                    {/* <TextInput
                        mode="outlined"
                        multiline
                        label="Notes"
                        style={{ minHeight: 90, flex: 1 }}
                        activeOutlineColor='#000000'
                        /> */}
                </ScrollView>
            )}
            {!isLoading && !error && !handDetails && (
                <Text>Hand not found.</Text>
            )}
        </View>
        // </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: 12,
    },
    loader: {
        marginTop: 50,
    },
    textInput: {
        // alignSelf: "stretch",
        // marginHorizontal: 12,
        // marginBottom: 12,
        // marginTop: 8,
        // padding: 8,
        // borderRadius: 4,
        // backgroundColor: "#F9FAFB",
        // color: "#00000082",
        // // height: 90,
        // textAlign: "center",
        // borderColor: '#000000',
        // borderWidth: 1,

    },
    contentContainer: {
        flex: 1,
        padding: 36,
        alignItems: 'center',
    },
    errorText: {
        color: 'red',
        textAlign: 'center',
        marginTop: 20,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 10,
    }
});

{/* <BottomSheetModalProvider>
<BottomSheetModal
//   snapPoints={snapPoints}
enablePanDownToClose={true} // Allow swiping down to close
    ref={bottomSheetModalRef}
    onChange={handleSheetChanges}
>
    <BottomSheetView style={styles.contentContainer}>
        <BottomSheetTextInput style={styles.textInput} placeholder='Notes' placeholderTextColor={"#00000057"}/>
        {/* <Button onPress={handleCloseSheet}>Close</Button> */}
// 
    // </BottomSheetView>
// </BottomSheetModal>
// </BottomSheetModalProvider> */}