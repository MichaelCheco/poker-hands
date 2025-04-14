import * as React from 'react';
import { StyleSheet } from 'react-native';
import { FAB, useTheme } from 'react-native-paper';

const Fab = ({ onPress }) => {
    const theme = useTheme();
    return (
        <FAB
            icon="plus"
            color="#FFF"
            style={{ ...styles.fab, backgroundColor: theme.button.backgroundColor }}
            onPress={onPress}
        />
    )
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