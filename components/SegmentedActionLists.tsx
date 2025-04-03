import { DispatchActionType, Stage } from '@/types';
import * as React from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { SegmentedButtons } from 'react-native-paper';

const defaultButtonProps = {
    uncheckedColor: "#0000009C",
    value: `${Stage.Preflop}`,
    style: { 'borderRadius': 0, backgroundColor: 'none', borderColor: 'rgb(202, 196, 208)' },
    checkedColor: '#000000',
}

function getValueForLabel(label: string) {
    const values = { 'PRE': Stage.Preflop, 'FLOP': Stage.Flop, 'TURN': Stage.Turn, 'RIVER': Stage.River }
    return values[label];
}

function getButtonProps(label: string) {
    return { ...defaultButtonProps, label, value: getValueForLabel(label) };
}

const SegmentedActionLists = ({ stageDisplayed, dispatch }) => {
    return (
        <SafeAreaView style={styles.container}>
            <SegmentedButtons
                value={`${stageDisplayed}`}
                onValueChange={(val) => {
                    const newStage = Number(val)
                    dispatch({ type: DispatchActionType.kSetVisibleStage, payload: { newStage } })
                }}
                density='small'
                buttons={[
                    getButtonProps('PRE'),
                    getButtonProps('FLOP'),
                    getButtonProps('TURN'),
                    getButtonProps('RIVER'),
                ]}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        marginBottom: 6
    },
});

export default SegmentedActionLists;