import React from 'react';
import { StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
// Import Text from react-native-paper if you use its variants/theming
import { Text } from 'react-native-paper';
// Or import Text from 'react-native' if using standard RN Text
// import { Text } from 'react-native';

// Define the props for the component
interface AnimatedInstructionTextProps {
    text: string; // The dynamic text content to display and animate
    style?: object; // Style object to be applied to the Text component
    variant?: string; // Variant prop for react-native-paper Text (optional)
    duration?: number; // Duration for the fade animation in milliseconds (optional)
}

/**
 * A component that displays text and animates (fades)
 * when the text content changes.
 */
const AnimatedInstructionText: React.FC<AnimatedInstructionTextProps> = ({
    text,
    style,
    variant, // Pass variant down if using Paper Text
    duration = 250, // Default animation duration (adjust as needed)
}) => {
    return (
        // This Animated.View handles the animation.
        // The `key` prop is crucial. When `text` changes, React replaces
        // this component instance, triggering exit/enter animations.
        <Animated.View
            key={text} // Use the text content as the key
            entering={FadeIn.duration(duration)} // Apply fade-in animation
            exiting={FadeOut.duration(duration)} // Apply fade-out animation
            style={styles.animatedViewContainer} // Basic container style
        >
            {/* The actual Text component displaying the content */}
            <Text
                // Pass down variant and style props if they exist
                {...(variant && { variant })} // Conditionally add variant prop for Paper
                style={[styles.textBase, style]} // Combine base styles with passed styles
            >
                {text}
            </Text>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    animatedViewContainer: {
        // This view ensures the layout space is somewhat reserved during fade
        // Adjust minHeight based on your expected text line height to reduce layout jumps
        // minHeight: 20, // Example: uncomment and adjust if needed
        // alignItems: 'center', // Center text horizontally if container is wider
        // justifyContent: 'center', // Center text vertically if using minHeight
    },
    textBase: {
        // Add any base styles for the text here if needed
    }
});

export default AnimatedInstructionText;
