import * as React from 'react';
import { List } from 'react-native-paper';

export default function ActionList({ stage, actionList }) {
    const filteredActions = actionList.filter(action => action.stage === stage);
  return (
      <List.Section>
        {filteredActions.map((item, index) => (
          <List.Item key={index} title={item.text} style={{ padding: 0 }} />
        ))}
      </List.Section>
  );
}
