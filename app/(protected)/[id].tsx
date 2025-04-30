import React, { useState, useLayoutEffect } from 'react';
import { View, ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { getHandDetailsById } from '@/api/hands';
import { formatDateMMDDHHMM } from '@/utils/hand-utils';
import { DetailedHandData } from '@/types';
import { Text, Divider, IconButton } from 'react-native-paper';
import Showdown from '@/components/Showdown';
import ActionListReview from '@/components/ActionListReview';

function HandActions({ date }) {
    return (
        <TouchableOpacity style={{
            display: 'flex',
            flexDirection: 'row',
        }}>
            <IconButton
                onTouchEnd={() => console.log('note')}
                icon={"note-outline"} style={{ margin: 0, position: 'absolute', right: 42 }} size={26} />
            <IconButton
                icon={"delete"}
                style={{ margin: 0 }}
                onTouchEnd={() => console.log('delete')}
                size={26}
            />
        </TouchableOpacity>
    )
}
export default function HandDetailScreen() {
    const navigation = useNavigation();
    const { id } = useLocalSearchParams<{ id: string }>();

    const [handDetails, setHandDetails] = useState<DetailedHandData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useLayoutEffect(() => {
        const fetchDetails = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const details: DetailedHandData = await getHandDetailsById(id);
                setHandDetails(details);
                // console.log(details)
                navigation.setOptions({
                    headerBackButtonDisplayMode: "default",
                    headerLeft: () => <Text variant='titleMedium'>{details.location} - {formatDateMMDDHHMM(details.played_at)}</Text>,
                    // headerRight: () => (            <IconButton 
                    //     icon={"delete"} 
                    //     style={{margin:0,}} 
                    //     onTouchEnd={() => console.log('t')}
                    //     size={24}
                    //     />),
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
    }, [id, navigation]);
    return (
        <View style={styles.container}>
            {isLoading && <ActivityIndicator size="large" style={styles.loader} />}
            {error && <Text style={styles.errorText}>Error: {error}</Text>}
            {!isLoading && !error && handDetails && (
                <ScrollView style={{
                    flex: 1,
                    paddingHorizontal: 15,
                }}>
                    <Showdown
                        smallBlind={handDetails.small_blind}
                        bigBlind={handDetails.big_blind}
                        showdownHands={handDetails.showdown_hands}
                        finalStreet={handDetails.final_street}
                        actions={handDetails.actions}
                        pot={handDetails.final_pot_size as number} />
                    <Divider bold />
                    <ActionListReview
                        actionList={handDetails.actions}
                        communityCards={handDetails.community_cards}
                        smallBlind={handDetails.small_blind}
                        bigBlind={handDetails.big_blind}
                        gameType={handDetails.game_type}
                        numPlayers={handDetails.num_players}
                        location={handDetails.location as string}
                        hand={handDetails.hero_cards as string}
                        position={handDetails.hero_position as string}
                        pot={handDetails.final_pot_size as number}
                        showdown={handDetails.showdown_hands}
                    />
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
        paddingTop: 12,
    },
    loader: {
        marginTop: 50,
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