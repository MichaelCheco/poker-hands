import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import MyConvertedSvg from './MyConvertedSvg';

const EmptyState = () => {
  return (
    <View style={styles.container}>
      {/* Render the SVG, optionally adjust size */}
      <MyConvertedSvg width={250} height={113} />
      <Text style={styles.message}>No hands saved yet!</Text>
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

export default EmptyState;