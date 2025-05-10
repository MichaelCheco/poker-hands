import * as React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';

interface StackChangeDisplayProps {
    /** The player's stack size before the hand or change. */
    initialStack: number;
    /** The player's stack size after the hand or change. */
    finalStack: number;
    /** Optional style for the container View. */
    containerStyle?: object;
    /** Optional style for the change amount Text. */
    changeTextStyle?: object;
    /** Optional style for the final stack Text. */
    finalStackTextStyle?: object;
    /** Color for positive changes (wins). Defaults to 'green'. */
    winColor?: string;
    /** Color for negative changes (losses). Defaults to 'red'. */
    lossColor?: string;
    /** Color for no change. Defaults to 'gray'. */
    noChangeColor?: string;
    /** Font size for the change amount. Defaults to 16. */
    changeTextFontSize?: number;
    /** Font size for the final stack amount. Defaults to 14. */
    finalStackTextFontSize?: number;
}

const StackChangeDisplay: React.FC<StackChangeDisplayProps> = ({
    initialStack,
    finalStack,
    containerStyle,
    changeTextStyle,
    finalStackTextStyle,
    winColor = '#28a745', // A common green color
    lossColor = '#dc3545', // A common red color
    noChangeColor = '#6c757d', // A common gray color
    changeTextFontSize = 16,
    finalStackTextFontSize = 14,
}) => {
    const changeAmount = finalStack - initialStack;
    const isWin = changeAmount > 0;
    const isLoss = changeAmount < 0;

    let displayChange: string;
    let textColor: string;

    if (isWin) {
        displayChange = `+${changeAmount.toLocaleString()}`; // Add '+' for wins, format number
        textColor = winColor;
    } else if (isLoss) {
        displayChange = `${changeAmount.toLocaleString()}`; // Minus sign is automatic, format number
        textColor = lossColor;
    } else {
        displayChange = '0'; // Or '--' or 'Ev'
        textColor = noChangeColor;
    }

    return (
        <View style={[styles.container, containerStyle]}>
            <Text
                style={[
                    styles.changeText,
                    { color: textColor, fontSize: changeTextFontSize },
                    changeTextStyle,
                ]}
            >
                {displayChange}
            </Text>
            <Text
                style={[
                    styles.finalStackText,
                    { fontSize: finalStackTextFontSize },
                    finalStackTextStyle,
                ]}
            >
                {finalStack.toLocaleString()} {/* Format final stack number */}
            </Text>
        </View>
    );
};

export default StackChangeDisplay;

const styles = StyleSheet.create({
    container: {
        alignItems: 'center', // Center numbers horizontally
        justifyContent: 'center',
        paddingVertical: 4, // Add some vertical padding
    },
    changeText: {
        fontWeight: 'bold',
        marginBottom: 2, // Small space between the two numbers
    },
    finalStackText: {
        color: '#4A4A4A', // A slightly softer black/grey for the final stack
    },
});