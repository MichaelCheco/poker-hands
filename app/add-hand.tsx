import * as React from 'react';
import { Text, View, Button, StyleSheet, ScrollView } from 'react-native';
import { Divider, List, TextInput } from 'react-native-paper';

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

interface Step {
    placeholder: string;
    shouldTransitionAfterStep: boolean; // Now required
    validate: () => { success: boolean; message?: string };
    dataKey: string; // Key to store the input data in the state
}

const stageSteps: Record<Stage, Step[]> = {
    [Stage.Preflop]: [
      {
        placeholder: 'Blinds (e.g., 10/20)',
        shouldTransitionAfterStep: false,
        validate: () => ({ success: true }),
        dataKey: 'blinds',
      },
      {
        placeholder: 'Location',
        shouldTransitionAfterStep: false,
        validate: () => ({ success: true }),
        dataKey: 'location',
      },
      {
        placeholder: 'Position (e.g., BTN, CO)',
        shouldTransitionAfterStep: false,
        validate: () => ({ success: true }),
        dataKey: 'position',
      },
      {
        placeholder: 'Starting Hand (e.g., AhKd)',
        shouldTransitionAfterStep: true,
        validate: () => ({ success: true }),
        dataKey: 'startingHand',
      },
      // ... more preflop steps
    ],
    [Stage.Flop]: [
      {
        placeholder: 'Flop Cards (e.g., AsTc7h)',
        shouldTransitionAfterStep: true,
        validate: () => ({ success: true }), // Add actual validation
        dataKey: 'flopCards',
      },
      // ... flop steps
    ],
    [Stage.Turn]: [
      {
        placeholder: 'Turn Card (e.g., Qd)',
        shouldTransitionAfterStep: true,
        validate: () => ({ success: true }), // Add actual validation
        dataKey: 'turnCard',
      }
      // ... Turn steps
    ],
    [Stage.River]: [
      {
        placeholder: 'River Card (e.g., Ks)',
        shouldTransitionAfterStep: true,
        validate: () => ({ success: true }), // Add actual validation
        dataKey: 'riverCard',
      }
      // ... River steps
    ],
    [Stage.Showdown]: [
        {
            placeholder: 'Showdown Actions',
            shouldTransitionAfterStep: true,
            validate: () => ({success: true}),
            dataKey: 'showdownActions'
        }
    ]
  };
const initialState = {
  handHistory: [],
  currentAction: '',
  stage: Stage.Preflop,
  input: '',
  inputError: '',
  blinds: '',
  location: '',
  position: '',
  flopCards: '',
  hand: '',
  queue: [...stageSteps[Stage.Preflop]],
  currentStepIndex: 0,
//   currentStep: {...stageSteps[Stage.Preflop][0]},
};

const reducer = (state, action) => {
  switch (action.type) {
    case 'SET_INPUT':
      return { ...state, input: action.payload};
    case 'ADD_ACTION':
      const {text} = action.payload;
      const currentStep = state.queue[state.currentStepIndex];
      const nextIndex = state.currentStepIndex + 1;
      if (nextIndex === state.queue.length) {
        const stage = getNextStage(state.stage) as Stage;
        return {...state, queue: [...stageSteps[stage]], currentStepIndex: 0, stage, input: ''}
      }
      return { ...state, [currentStep.dataKey]: text, currentStepIndex: nextIndex, input: '' };

    default:
      return state;
  }
};

export default function App() {
  const [state, dispatch] = React.useReducer(reducer, initialState);

  const handleInputChange = (text) => {
    console.log(text, 'TEXT')
    const shouldAddAction = text.endsWith('.');
    if (shouldAddAction) {
        dispatch({type: 'ADD_ACTION', payload: {text}})
    } else {
        dispatch({type: 'SET_INPUT', payload: text });
    }
  };
//   console.log(state.queue[state.currentStepIndex].placeholder, ' = ', state.queue[state.currentStepIndex])

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
        <Text variant="displayMedium">Blinds: {state.blinds}</Text>
        <Text variant="displayMedium">Location: {state.location}</Text>
        <Text variant="displayMedium">Position: {state.position}</Text>
        <Text variant="displayMedium">Hand: {state.hand}</Text>

        <Divider />
        {state.inputError ? <Text style={styles.errorText}>{state.inputError}</Text> : null}
        <Text variant="displayMedium">{Stage[state.stage].toUpperCase()}</Text>
        <Text variant="bodyLarge">Flop: {state.flopCards}</Text>
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
          label={state.queue[state.currentStepIndex].placeholder}
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


//   const handleInputChange = (text) => {
//     dispatch({ type: 'SET_INPUT', payload: text });
//     if (text.endsWith(',')) {
//       if (state.currentAction.length > 0) {
//         dispatch({ type: 'ADD_ACTION', payload: text.slice(0, -1) });
//         dispatch({ type: 'RECORD_ACTION' });
//       }
//     } else if (text.endsWith('.')) {
//       if (state.currentAction.length > 0) {
//         dispatch({ type: 'ADD_ACTION', payload: text.slice(0, -1) });
//         dispatch({ type: 'RECORD_ACTION' });
//         if (validateNextStage()) {
//           let nextStage;
//           switch (state.stage) {
//             case Stage.Preflop:
//               nextStage = Stage.Flop;
//               break;
//             case Stage.Flop:
//               nextStage = Stage.Turn;
//               break;
//             case Stage.Turn:
//               nextStage = Stage.River;
//               break;
//             case Stage.River:
//               nextStage = Stage.Showdown;
//               break;
//             default:
//               nextStage = state.stage;
//           }
//           dispatch({ type: 'NEXT_STAGE', payload: nextStage });
//         }
//       }
//     } else {
//       if (state.input.length > state.currentAction.length) {
//         dispatch({ type: 'ADD_ACTION', payload: text.slice(-1) });
//       }
//     }
//   };
function getNextStage(stage: Stage) {
    switch (stage) {
    case Stage.Preflop:
        return Stage.Flop;
    case Stage.Flop:
        return Stage.Turn;
    case Stage.Turn:
        return Stage.River;
    case Stage.River:
        return Stage.Showdown;
    }
    }