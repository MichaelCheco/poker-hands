import * as React from 'react';
import { List } from 'react-native-paper';

export default function ActionList({ stage, preflopAction }) {
  return (
      <List.Section>
        {preflopAction.map((item, index) => (
          <List.Item key={index} title={item} style={{ padding: 0 }} />
        ))}
      </List.Section>
  );
}
