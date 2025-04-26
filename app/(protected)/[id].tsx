import React, { useEffect, useState, useLayoutEffect } from 'react';
import { View, Text, ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams, Stack, useNavigation } from 'expo-router';
import { getHandDetailsById } from '@/api/hands';
import CopyableTextBlock from '@/components/CopyableTextBlock';
import { formatAndGetTextToCopy } from '@/utils/hand-utils';
import { DetailedHandData, HandSetupInfo } from '@/types';
import { IconButton, List, TextInput } from 'react-native-paper';
import GameInfo from '@/components/GameInfo';
import HeroHandInfo from '@/components/HeroHandInfo';
import Showdown from '@/components/Showdown';


function HandActions() {
    return (
        <View style={{
            display: 'flex',
            flexDirection: 'row',
            gap: 0,
            justifyContent: 'center',
            alignItems: 'center',
            marginInline: 0,}}>
        <IconButton icon="content-copy" size={20} style={{padding: 0, marginRight: -5}}/>
        <IconButton icon="delete-outline" size={20} iconColor='#DA3036'/>
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
                    headerLeft: () => <GameInfo info={info} />,
                    headerRight: () => <HandActions />,
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
            {/* Use Stack.Screen to configure this screen's header */}
            {/* <Stack.Screen options={{ title: `Hand Detail ${id ? '- ' + id.substring(0, 8) : ''}` }} /> */}

            {isLoading && <ActivityIndicator size="large" style={styles.loader} />}
            {error && <Text style={styles.errorText}>Error: {error}</Text>}

            {!isLoading && !error && handDetails && (
                <ScrollView>
                    <Showdown 
                    showdownHands={handDetails.showdown_hands} 
                    finalStreet={handDetails.final_street} 
                    actions={handDetails.actions}
                    pot={handDetails.final_pot_size}/>
                    {/* <Text style={styles.title}>Hand Details</Text> */}
                    {/* <List.Section title="" >
                        <List.Accordion

                            title="Hand History"
                            left={props => <List.Icon {...props} icon="folder" />}>
                            <List.Item title="" descriptionNumberOfLines={50} description={`PREFLOP: \nCO: opens to $20 \nBB: calls\n \nFLOP: ak8ssx \nBB: checks \nCO: checks\n\nTURN: 9d \nBB: bets $40 \nCO: calls \n\nRIVER: Kd \nBB: checks \nCO: bets $80 \nBB: calls \n\nVillain: 2s2c`}/>
                        </List.Accordion>
                    </List.Section> */}

                    <CopyableTextBlock textToCopy={
                        `PREFLOP: \nCO: opens to $20 \nBB: calls\n \nFLOP: ak8ssx \nBB: checks \nCO: checks\n\nTURN: 9d \nBB: bets $40 \nCO: calls \n\nRIVER: Kd \nBB: checks \nCO: bets $80 \nBB: calls \n\nVillain: 2s2c`
                    } />
                    <TextInput
                    mode="outlined"
                    multiline
                    label="Notes"
                    style={{ minHeight: 90, flex: 1, marginBottom: 16 }}
                    activeOutlineColor='#000000'
                    />
                    {/* <Text>Hand ID: {handDetails.id}</Text> */}
                    {/* TODO: Render the actual hand details, actions, showdown info */}
                    {/* <Text>{JSON.stringify(handDetails, null, 2)}</Text> */}
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
        padding: 15,
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

// big_blind
// created_at
// currency
// final_pot_size
// game_type
// hero_cards
// hero_position
// id
// location
// notes
// num_players
// played_at
// showdown_hands
// small_blind