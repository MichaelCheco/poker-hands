import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedProps,
    useAnimatedStyle,
    withTiming,
    Easing,
    interpolate,
    runOnJS
} from 'react-native-reanimated';
import Svg, { Path, Circle } from 'react-native-svg';

// Create an animated version of the SVG Path component
const AnimatedPath = Animated.createAnimatedComponent(Path);

/**
 * A simple success animation component featuring a drawing checkmark.
 * @param {object} props - Component props.
 * @param {boolean} props.visible - Controls the visibility and triggers the animation.
 * @param {number} [props.size=100] - The width and height of the animation container.
 * @param {number} [props.duration=1200] - The duration of the animation in milliseconds.
 * @param {string} [props.checkmarkColor='#FFFFFF'] - Color of the checkmark.
 * @param {string} [props.circleColor='#4CAF50'] - Color of the background circle.
 * @param {function} [props.onAnimationComplete] - Optional callback when animation finishes.
 */
const SuccessAnimation = ({
    visible,
    size = 100,
    duration = 1500,
    checkmarkColor = '#FFFFFF',
    circleColor = '#4CAF50',
    onAnimationComplete,
}) => {
    // Shared value to track animation progress (0 to 1)
    const progress = useSharedValue(0);
    const stableOnAnimationComplete = React.useCallback(() => {
        if (onAnimationComplete) {
            onAnimationComplete();
        }
    }, [onAnimationComplete]);
    // Define the checkmark path based on the size
    // Format: M(move) x y L(line) x y L(line) x y
    const checkmarkPath = `M${size * 0.3} ${size * 0.53} L${size * 0.45} ${size * 0.68} L${size * 0.75} ${size * 0.38}`;
    // Approximate length of the checkmark path. For complex paths, you might need
    // a library or manual calculation, but approximation works for simple shapes.
    const checkmarkLength = size * 0.75;

    // Trigger animation when 'visible' prop changes
    useEffect(() => {
        if (visible) {
            // Animate progress from 0 to 1 when visible
            progress.value = withTiming(
                1,
                {
                    duration: duration,
                    easing: Easing.out(Easing.quad), // Smooth easing out
                },
                (finished) => {
                    // Check if animation finished successfully and callback exists
                    if (finished && onAnimationComplete) {
                        runOnJS(stableOnAnimationComplete)();
                    }
                }
            );
        } else {
            // Reset progress to 0 instantly when not visible
            progress.value = 0;
        }
    }, [visible, duration, progress, onAnimationComplete]);

    // Animated style for the container View (controls scale and opacity)
    const animatedContainerStyle = useAnimatedStyle(() => {
        // Interpolate scale: 0 -> 1
        const scale = interpolate(
            progress.value,
            [0, 0.5, 1], // Input range
            [0.5, 1.1, 1]  // Output range (slight overshoot for bounce)
        );
        // Interpolate opacity: 0 -> 1
        const opacity = progress.value;

        return {
            opacity: opacity,
            transform: [{ scale: scale }],
        };
    });

    // Animated props for the checkmark Path (controls drawing)
    const animatedCheckmarkProps = useAnimatedProps(() => {
        // Calculate strokeDashoffset: starts fully offset (invisible), ends at 0 (fully drawn)
        // As progress goes 0 -> 1, offset goes length -> 0
        const strokeDashoffset = checkmarkLength * (1 - progress.value);
        return {
            strokeDashoffset,
        };
    });

    // Don't render anything if not visible and animation hasn't started
    if (!visible && progress.value === 0) {
        return null;
    }

    return (
        // Use Animated.View to apply scale and opacity animations
        <Animated.View style={[styles.container, { width: size, height: size }, animatedContainerStyle]}>
            <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                {/* Background Circle (static or could be animated too) */}
                <Circle
                    cx={size / 2}
                    cy={size / 2}
                    r={size / 2 * 0.95} // Slightly smaller radius than view bounds
                    fill={circleColor}
                />
                {/* Checkmark Path */}
                <AnimatedPath
                    d={checkmarkPath}
                    stroke={checkmarkColor}
                    strokeWidth={size * 0.09} // Stroke width relative to size
                    strokeLinecap="round" // Rounded ends
                    strokeLinejoin="round" // Rounded corners
                    strokeDasharray={checkmarkLength} // Set the dash pattern to the total length
                    animatedProps={animatedCheckmarkProps} // Apply the animated dash offset
                    fill="none" // Important: Path should not be filled
                />
            </Svg>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        // Position absolutely if it needs to overlay other content
        // position: 'absolute',
        // top: 0,
        // left: 0,
        // right: 0,
        // bottom: 0,
    },
});

export default SuccessAnimation;
