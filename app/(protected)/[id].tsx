import React, { useState, useLayoutEffect } from 'react';
import { View, ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { deleteHand, getHandDetailsById, updateNotesForHand } from '@/api/hands';
import { formatDateMMDDHHMM, parseStackSizes2 } from '@/utils/hand_utils';
import { DetailedHandData } from '@/types';
import { Text, Divider, IconButton } from 'react-native-paper';
import Showdown from '@/components/Showdown';
import ActionListReview from '@/components/ActionListReview';
import DeleteHandConfirmationDialog from '@/components/DeleteHandConfirmationDialog';
import HandNotesDialog from '@/components/HandNotesDialog';
import { supabase } from '@/utils/supabase';

function HandActions({ date, onDeleteClick, onNotesClick }) {
    return (
        <TouchableOpacity style={{
            display: 'flex',
            flexDirection: 'row',
        }}>
            <IconButton
                onTouchEnd={onNotesClick}
                icon={"note-text-outline"} style={{ margin: 0, position: 'absolute', right: 42 }} size={26} />
            <IconButton
                icon={"delete"}
                style={{ margin: 0 }}
                onTouchEnd={onDeleteClick}
                size={26}
            />
        </TouchableOpacity>
    )
}
export default function HandDetailScreen() {
    const navigation = useNavigation();
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const [handDetails, setHandDetails] = useState<DetailedHandData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
    const [notesDialogVisible, setNotesDialogVisible] = useState(false);

    const onDismissDialog = () => setDeleteDialogVisible(false);
    const onDismissNotesDialog = () => setNotesDialogVisible(false);
    const [error, setError] = useState<string | null>(null);


    const hands = supabase.channel('custom-filter-channel')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'hands', filter: `id=${id}` },
            (payload) => {
                // console.log('Change received!', payload)
                if (!handDetails) {
                    console.log('no hand details in subscription ...');
                    return;
                }
                const update = payload.new as DetailedHandData;
                setHandDetails({ ...handDetails, notes: update.notes})
            }
        )
        .subscribe()
    // console.log(hands)
    // hands.
    useLayoutEffect(() => {
        navigation.setOptions({
            headerBackButtonDisplayMode: "default",
            headerTitle: '',
        });
        const fetchDetails = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const details: DetailedHandData = await getHandDetailsById(id);
                // console.log(details);
                // console.log(`details.notes in parent: ${details.notes}`);
                setHandDetails(details);
                navigation.setOptions({
                    headerBackButtonDisplayMode: "default",
                    headerLeft: () => <Text variant='titleMedium'>{details.location} - {formatDateMMDDHHMM(details.played_at)}</Text>,
                    headerRight: () => <HandActions date={details.played_at} onDeleteClick={() => setDeleteDialogVisible(true)} onNotesClick={() => setNotesDialogVisible(true)} />,
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
            <HandNotesDialog 
              hideDialog={onDismissNotesDialog} 
              visible={notesDialogVisible} 
              initialNotes={handDetails?.notes}
              onSaveNotes={async (notes: string) => {
                  await updateNotesForHand(handDetails?.id, notes);
                }}/>
            <DeleteHandConfirmationDialog 
             hideDialog={onDismissDialog}
            visible={deleteDialogVisible} 
            onDeletePress={async () => {
                const success = await deleteHand(handDetails.id);
                if (success) {
                    onDismissDialog();
                    router.back();
                }
            }}
            />
            {isLoading && <ActivityIndicator size="large" style={styles.loader} />}
            {error && <Text style={styles.errorText}>Error: {error}</Text>}
            {!isLoading && !error && handDetails && (
                <ScrollView style={{
                    flex: 1,
                    paddingHorizontal: 15,
                }}>

                    <Showdown
                        showdownHands={handDetails.showdown_hands}
                        finalStreet={handDetails.final_street}
                        actions={handDetails.actions}
                        handPots={handDetails.hand_pots}
                        pot={handDetails.final_pot_size as number} 
                        bigBlind={handDetails.big_blind}
                        stacks={parseStackSizes2(handDetails.stacks)} />
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