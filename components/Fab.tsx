import * as React from 'react';
import { StyleSheet } from 'react-native';
import { FAB, Portal, useTheme, FABGroupProps } from 'react-native-paper';
import { SavedHandSummary } from '@/types';

const Fab = ({ fabVisible, setVisible, recentHands, setPreset }: { fabVisible: boolean, setVisible: () => void, recentHands: SavedHandSummary[], setPreset: any }) => {
    const [state, setState] = React.useState({ open: false });
    const onStateChange = ({ open }) => setState({ open });
    const { open } = state;
    const theme = useTheme();
    const gamesSet = new Set();
    const handsToShow: SavedHandSummary[] = [];
    if (recentHands.length === 0) {
        return (
            <FAB
                icon="plus"
                color="#FFF"
                style={{ ...styles.fab, backgroundColor: theme.button.backgroundColor }}
                onPress={setVisible}
            />
        );
    }
    for (let i = 0; i < recentHands.length; i++) {
        const hand = recentHands[i];
        const token = `${hand.small_blind}-${hand.big_blind}-${hand.third_blind || 0}-${Number(hand.big_blind_ante)}-${hand.location}`;
        if (handsToShow.length === 3) {
            break;
        }
        if (!gamesSet.has(token)) {
            gamesSet.add(token);
            handsToShow.push(hand)
        };
    }
    const fabActions = handsToShow.map((hand) => {
        return {
            icon: `alpha-${hand.location[0].toLowerCase()}`,
            color: theme.button.backgroundColor,
            style: {
                backgroundColor: '#FFF',
            },
            containerStyle: {
                alignItems: 'flex-end', position: 'relative', left: 10},
            labelStyle: {
                color: theme.colors.secondary
            },
            label: `$${hand.small_blind}/$${hand.big_blind}${hand.big_blind_ante ? ` (${hand.big_blind})` : ''}${hand.third_blind ? `/$${hand.third_blind}` : ''} ${hand.location.length > 14 ? hand.location.slice(0, 5) + '..' : hand.location}`,
                onPress: () => {
                    setPreset({
                        smallBlind: hand.small_blind,
                        bigBlind: hand.big_blind,
                        thirdBlind: hand.third_blind,
                        bigBlindAnte: hand.big_blind_ante,
                        location: hand.location,
                    });
                    setVisible();
                },
        }
    });
return (
    <Portal>
        <FAB.Group
            open={open}
            color='#FFF'
            fabStyle={{ backgroundColor: theme.button.backgroundColor }}
            visible={fabVisible}
            icon={open ? 'minus' : 'plus'}
            actions={[
                {
                    icon: 'plus', label: 'New game', color: '#FFF',
                    style: {
                        backgroundColor: theme.button.backgroundColor,
                    },
                    containerStyle: {
                        alignItems: 'flex-end', position: 'relative', left: 10
                    },
                    labelStyle: {
                        color: theme.colors.secondary
                    },
                    onPress: () => {
                        setPreset({
                            smallBlind: 2,
                            bigBlind: 5,
                            location: '',
                        });
                        setVisible()
                    },
                },
                ...fabActions
            ]}
            onStateChange={onStateChange}
            onPress={() => {
                if (open) {
                    // do something if the speed dial is open
                }
            }}
        />
    </Portal>
);
};

const styles = StyleSheet.create({
    fab: {
        position: 'absolute',
        margin: 16,
        right: 4,
        bottom: 24,
    },
})

export default Fab;