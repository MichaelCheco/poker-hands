import React, { useEffect, useState, useLayoutEffect } from 'react';
import { View, ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams, Stack, useNavigation } from 'expo-router';
import { getHandDetailsById } from '@/api/hands';
import CopyableTextBlock from '@/components/CopyableTextBlock';
import { formatAndGetTextToCopy, formatDateMMDDHHMM } from '@/utils/hand-utils';
import { DetailedHandData, HandSetupInfo } from '@/types';
import { IconButton, List, TextInput, Text, Divider } from 'react-native-paper';
import GameInfo from '@/components/GameInfo';
import HeroHandInfo from '@/components/HeroHandInfo';
import Showdown from '@/components/Showdown';
import { CommunityCards, MyHand, ShowdownCards } from '@/components/Cards';
import ActionList from '@/components/ActionList';
import ActionListReview from '@/components/ActionListReview';
import { SafeAreaView } from 'react-native-safe-area-context';


function HandActions() {
    return (
        <View style={{
            display: 'flex',
            flexDirection: 'row',
            gap: 0,
            justifyContent: 'center',
            alignItems: 'center',
            marginInline: 0,
        }}>
            <IconButton icon="content-copy" size={20} style={{ padding: 0, marginRight: -5 }} />
            <IconButton icon="delete-outline" size={24} iconColor='#DA3036' />
        </View>
    )
}
export default function HandDetailScreen() {
    const [expanded, setExpanded] = useState(true);
    const navigation = useNavigation();

    // Get the dynamic 'id' parameter from the route
    const { id } = useLocalSearchParams<{ id: string }>();

    const [handDetails, setHandDetails] = useState<DetailedHandData | null>(null); // Replace 'any' with your detailed hand type
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // useLayoutEffect(() => {
    //     navigation.setOptions({
    //         headerLeft: () => <GameInfo info={gameInfo} />,
    //         headerRight: () => <HeroHandInfo info={gameInfo} />,
    //     });
    // }, [navigation]);

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
                console.log(details?.actions.filter((val) => val.decision !== "F"))
                setHandDetails(details);
                navigation.setOptions({
                    headerBackButtonDisplayMode: "default",
                    headerLeft: () => <Text variant='titleMedium'>{details.location} - ${details.small_blind}/${details.big_blind} {details.game_type} {details.num_players}-handed</Text>,
                    headerRight: () => <Text>{formatDateMMDDHHMM(details.played_at)}</Text>,
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
    console.log(handDetails ?? "loading")
    return (
        <View style={styles.container}>
            {isLoading && <ActivityIndicator size="large" style={styles.loader} />}
            {error && <Text style={styles.errorText}>Error: {error}</Text>}
            {!isLoading && !error && handDetails && (
                <ScrollView>
                <Showdown
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
                    <ActionListReview actionList={handDetails.actions}/>
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
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 12,
    },
    loader: {
        marginTop: 50,
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

{/* <Stack.Screen options={{ title: 'Hand Details', headerRight: () => <HandActions />,  }} /> */ }
{/* <View style={{display: 'flex', justifyContent: 'space-between', flexDirection: 'row'}}> */ }
{/* <View style={{display: 'flex',alignItems:'flex-start' }}> */ }
{/* <Text variant="labelMedium">{formatDateMMDDHHMM(handDetails.played_at)}</Text> */ }
{/* <Text variant="labelMedium">{handDetails.location} - ${handDetails.small_blind}/${handDetails.big_blind} {handDetails.game_type} {handDetails.num_players}-handed</Text> */ }
{/* <Text variant="titleSmall">{handDetails.stacks}</Text> */ }
{/* </View> */ }
{/* <HandActions /> */ }
{/* <ShowdownCards cards={handDetails.community_cards} style={{gap: 2, fontSize: 12}}/> */ }
{/* <MyHand cards={handDetails.hero_cards}/> */ }
{/* <View style={{display: 'flex',alignItems:'flex-end' }}> */ }
{/* <Text variant="titleSmall">{handDetails.location}</Text> */ }
{/* <Text variant="titleSmall">{formatDateMMDDHHMM(handDetails.played_at)}</Text> */ }
{/* </View> */ }
{/* </View> */ }
{/* <Divider bold/> */ }
{/* <Text style={styles.title}>Hand Details</Text> */ }
{/* <List.Section title="" >
    <List.Accordion

        title="Hand History"
        left={props => <List.Icon {...props} icon="folder" />}>
        <List.Item title="" descriptionNumberOfLines={50} description={`PREFLOP: \nCO: opens to $20 \nBB: calls\n \nFLOP: ak8ssx \nBB: checks \nCO: checks\n\nTURN: 9d \nBB: bets $40 \nCO: calls \n\nRIVER: Kd \nBB: checks \nCO: bets $80 \nBB: calls \n\nVillain: 2s2c`}/>
    </List.Accordion>
</List.Section> */}

{/* <CopyableTextBlock textToCopy={
    `PREFLOP: \nCO: opens to $20 \nBB: calls\n \nFLOP: ak8ssx \nBB: checks \nCO: checks\n\nTURN: 9d \nBB: bets $40 \nCO: calls \n\nRIVER: Kd \nBB: checks \nCO: bets $80 \nBB: calls \n\nVillain: 2s2c`
} /> */}