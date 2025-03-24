import { DispatchActionType } from '@/app/add-hand';
import { Stage } from '@/types';
import * as React from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { SegmentedButtons } from 'react-native-paper';
const SegmentedActionLists = ({stageDisplayed, dispatch}) => {
    return (
        <SafeAreaView style={styles.container}>
            <SegmentedButtons
                value={`${stageDisplayed}`}
                onValueChange={(val) => {
                    const newStage = Number(val)
                    dispatch({type: DispatchActionType.kSetVisibleStage, payload: { newStage }})
                }}
                density='small'
                buttons={[
                    {   uncheckedColor: "#0000009C",
                        value: `${Stage.Preflop}`,
                        label: 'PRE',
                        style: { 'borderRadius': 0, backgroundColor: 'none', borderColor: 'rgb(202, 196, 208)' },
                        checkedColor: '#000000E8',
                    },
                    {
                        value:`${Stage.Flop}`,
                        uncheckedColor: "#0000009C",
                        label: 'FLOP',
                        style: { 'borderRadius': 0, backgroundColor: 'none', borderColor: 'rgb(202, 196, 208)' },

                        checkedColor: '#000000E8',
                    },
                    {
                        value:`${Stage.Turn}`,
                        uncheckedColor: "#0000009C",
                        label: 'TURN',
                        style: { 'borderRadius': 0, backgroundColor: 'none', borderColor: 'rgb(202, 196, 208)' },

                        checkedColor: '#000000E8',
                    },
                    {
                        value:`${Stage.River}`,
                        uncheckedColor: "#0000009C",
                        label: 'RIVER',
                        style: { 'borderRadius': 0, backgroundColor: 'none', borderColor: 'rgb(202, 196, 208)' },

                        checkedColor: '#000000E8',

                    },
                ]}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        marginBottom: 6
        // alignItems: 'center',
    },
});

export default SegmentedActionLists;