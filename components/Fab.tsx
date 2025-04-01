import * as React from 'react';
import { StyleSheet } from 'react-native';
import { FAB, useTheme } from 'react-native-paper';

const Fab = ({ onPress }) => {
    const theme = useTheme();
    return (
        <FAB
        icon="plus"
        color="#FFF"
        style={{...styles.fab, backgroundColor: theme.colors.fabButton}}
        onPress={onPress}
    />
    )
};

const styles = StyleSheet.create({
    fab: {
        position: 'absolute',
        margin: 16,
        right: 0,
        bottom: 0,
    },
})

export default Fab;