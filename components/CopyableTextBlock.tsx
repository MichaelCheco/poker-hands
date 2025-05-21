import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, ActivityIndicator } from 'react-native';
import { useTheme, IconButton, Surface } from 'react-native-paper';
import * as Clipboard from 'expo-clipboard';

interface CopyableTextBlockProps {
  /** The text content to display and copy. */
  textToCopy: string;
  /** Optional title to display above the block. */
  title?: string;
  /** Optional style for the outer container. */
  style?: any;
}

/**
 * A component that displays text in a block, similar to a code snippet,
 * with a button to copy the text to the clipboard.
 */
const CopyableTextBlock: React.FC<CopyableTextBlockProps> = ({
  textToCopy,
  title,
  style,
}) => {
  const theme = useTheme();
  const [copied, setCopied] = useState(false);
  const [isCopying, setIsCopying] = useState(false); // To show activity indicator

  const copyToClipboard = useCallback(async () => {
    if (isCopying || !textToCopy) return; // Prevent multiple rapid copies

    setIsCopying(true); // Show loading state
    setCopied(false); // Reset copied state if re-copying

    try {
      await Clipboard.setStringAsync(textToCopy);
      setCopied(true);
      // Hide the 'copied' checkmark after a short delay
      setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      console.error('Failed to copy text:', error);
      // Optionally show an error message to the user
      alert('Failed to copy text.');
    } finally {
      // Ensure loading state is turned off even if there's an error
      // Add a small delay to make the loading indicator visible briefly
       setTimeout(() => setIsCopying(false), 100);
    }
  }, [textToCopy, isCopying]);

  // Determine icon based on state
  const iconName = copied ? 'check' : 'content-copy';
  const iconColor = copied ? theme.colors.primary : theme.colors.onSurfaceVariant;

  return (
    <View style={[styles.outerContainer, style]}>
      {title && <Text style={[styles.title, { color: theme.colors.onSurfaceVariant }]}>{title}</Text>}
      {/* Use Surface for elevation and background */}
      <>
      <Surface style={[styles.surface]} elevation={1}>
        {/* Use Pressable for the main body copy action */}
        <Pressable onPress={copyToClipboard} style={styles.pressableContent}>
          <Text
            style={[
              styles.textBlock,
              { color: theme.colors.onSurfaceVariant },
              // Use monospace font for code-like appearance
              Platform.OS === 'ios' ? { fontFamily: 'Menlo' } : { fontFamily: 'monospace' }
            ]}
            selectable // Allow user to select text if needed
          >
            {textToCopy}
          </Text>
        </Pressable>

        {/* Copy Button - positioned absolutely */}
        <View style={styles.iconContainer}>
           {isCopying ? (
                <ActivityIndicator size="small" color={theme.colors.onSurfaceVariant} style={styles.iconButtonPadding} />
           ) : (
                <IconButton
                    icon={iconName}
                    size={18}
                    iconColor={iconColor}
                    onPress={copyToClipboard}
                    style={styles.iconButton} // Remove default margins
                    // Ensure ripple fits correctly
                    rippleColor={theme.dark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'}
                />
           )}
        </View>
      </Surface>
      </>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    marginVertical: 8,
  },
  title: {
    fontSize: 12,
    marginBottom: 4,
    marginLeft: 4,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  surface: {
    borderRadius: 8, // Use theme.roundness?
    position: 'relative', // Needed for absolute positioning of the button
    overflow: 'hidden', // Keep content and ripple within bounds
  },
  pressableContent: {
     padding: 12,
     paddingRight: 40, // Add padding to prevent text overlapping the button
  },
  textBlock: {
    fontSize: 13,
    lineHeight: 18,
  },
  iconContainer: {
    position: 'absolute',
    top: 0,
    right: 0,
    // Add some padding/margin if needed, handled by IconButton style below
  },
  iconButton: {
    // Reduce default margins/padding of IconButton to fit snugly
    margin: 0,
    width: 36, // Adjust size as needed
    height: 36, // Adjust size as needed
  },
   iconButtonPadding: { // Style for ActivityIndicator to mimic IconButton spacing
    padding: (36 - 20) / 2, // Roughly center the small indicator in the button area
    width: 36,
    height: 36,
  }
});

export default CopyableTextBlock;

    