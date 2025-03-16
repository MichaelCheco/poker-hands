import * as React from 'react';
import { Text, View, Button, StyleSheet, ScrollView } from 'react-native';
import { List, TextInput } from 'react-native-paper';

enum Stage {
  Preflop,
  Flop,
  Turn,
  River,
  Showdown,
}

const MyComponent = ({text}) => (
    <List.Item
      title={text}
    //   description="Item description"
      left={props => <List.Icon {...props} icon="alpha-p-circle" />}
    />
  );

function getStagePlaceholder(stage: Stage): string {
  switch (stage) {
    case Stage.Preflop:
      return 'Preflop Action';
    case Stage.Flop:
      return 'Flop Action';
    case Stage.Turn:
      return 'Turn Action';
    case Stage.River:
      return 'River Action';
    default:
      return 'Showdown';
  }
}

const initialState = {
  handHistory: [],
  currentAction: '',
  stage: Stage.Preflop,
  input: '',
  inputError: '',
};

const reducer = (state, action) => {
  switch (action.type) {
    case 'SET_INPUT':
      return { ...state, input: action.payload, inputError: '' };
    case 'SET_INPUT_ERROR':
      return { ...state, inputError: action.payload };
    case 'ADD_ACTION':
      return { ...state, currentAction: state.currentAction + action.payload };
    case 'RECORD_ACTION':
      return {
        ...state,
        handHistory: [
          ...state.handHistory,
          { stage: state.stage, action: state.currentAction },
        ],
        currentAction: '',
        input: '',
      };
    case 'NEXT_STAGE':
      return { ...state, stage: action.payload, currentAction: '', input: '' };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
};

export default function App() {
  const [state, dispatch] = React.useReducer(reducer, initialState);

  const handleInputChange = (text) => {
    dispatch({ type: 'SET_INPUT', payload: text });
    if (text.endsWith(',')) {
      if (state.currentAction.length > 0) {
        dispatch({ type: 'ADD_ACTION', payload: text.slice(0, -1) });
        dispatch({ type: 'RECORD_ACTION' });
      }
    } else if (text.endsWith('.')) {
      if (state.currentAction.length > 0) {
        dispatch({ type: 'ADD_ACTION', payload: text.slice(0, -1) });
        dispatch({ type: 'RECORD_ACTION' });
        if (validateNextStage()) {
          let nextStage;
          switch (state.stage) {
            case Stage.Preflop:
              nextStage = Stage.Flop;
              break;
            case Stage.Flop:
              nextStage = Stage.Turn;
              break;
            case Stage.Turn:
              nextStage = Stage.River;
              break;
            case Stage.River:
              nextStage = Stage.Showdown;
              break;
            default:
              nextStage = state.stage;
          }
          dispatch({ type: 'NEXT_STAGE', payload: nextStage });
        }
      }
    } else {
      if (state.input.length > state.currentAction.length) {
        dispatch({ type: 'ADD_ACTION', payload: text.slice(-1) });
      }
    }
  };

  const validateNextStage = () => {
    // Implement your custom validation logic here
    // Example: Check if the current action is not empty
    if (state.currentAction.trim() === '') {
      dispatch({ type: 'SET_INPUT_ERROR', payload: 'Action cannot be empty before changing stages.' });
      return false;
    }

    // Add more validation checks as needed
    // Example: check for raise amounts
    const regex = /raise to \d+/i
    if (state.stage === Stage.Preflop && !regex.test(state.currentAction)){
        dispatch({ type: 'SET_INPUT_ERROR', payload: 'Preflop actions must contain a raise amount' });
        return false;
    }

    return true; // Validation passed
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content}>
        {state.inputError ? <Text style={styles.errorText}>{state.inputError}</Text> : null}
        <Text variant="displayMedium">{Stage[state.stage].toUpperCase()}</Text>
        {/* <Text variant="bodyLarge">Current Action: {state.currentAction}</Text> */}
        {state.handHistory.map((item, index) => (
          <MyComponent key={index} stage={Stage[item.stage]} text={`${item.action}`}/>
        ))}
        {state.stage === Stage.Showdown && (
          <Button mode="contained" onPress={() => dispatch({ type: 'RESET' })}>
            Reset
          </Button>
        )}
      </ScrollView>

      <View style={styles.inputContainer}>
        <TextInput
          mode="outlined"
          label={getStagePlaceholder(state.stage)}
          onChangeText={handleInputChange}
          value={state.input}
          style={styles.input}
          autoFocus
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
    container: {
      flex: 1,
    },
    content: {
      flex: 1,
      padding: 16,
    },
    inputContainer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      padding: 16,
      backgroundColor: 'white', // or any background color
    },
    input: {
      alignSelf: 'center',
      width: '90%', // Adjust width as needed
    },
    errorText: {
      color: 'red',
      marginBottom: 8,
    },
  });