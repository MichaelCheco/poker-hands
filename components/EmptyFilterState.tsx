import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import NoMatchingHandsSvg from './NoMatchingHandsSvg';

const EmptyFilterState = () => {
    return (
        <View style={styles.container}>
            {/* Render the SVG, optionally adjust size */}
            <NoMatchingHandsSvg width={300} height={140} />
            <Text style={styles.message}>No matching hands</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    message: {
        marginTop: 20,
        fontSize: 18,
        color: 'grey',
    },
});

export default EmptyFilterState;