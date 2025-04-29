import React, { useState, useMemo } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { List, Card, Provider as PaperProvider, DefaultTheme } from 'react-native-paper';

// Helper to get stage name
const getStageName = (stage) => {
    switch (stage) {
        case 0: return 'Pre-flop';
        case 1: return 'Flop';
        case 2: return 'Turn';
        case 3: return 'River';
        default: return `Stage ${stage}`;
    }
};

// Helper to get an icon based on the decision
const getDecisionIcon = (decision) => {
    switch (decision) {
        case 'F': return 'cancel'; // Fold
        case 'R': return 'arrow-up-bold-circle-outline'; // Raise
        case 'C': return 'check-circle-outline'; // Call
        case 'B': return 'poker-chip'; // Bet
        case 'X': return 'checkbox-blank-circle-outline'; // Check
        default: return 'help-circle-outline'; // Unknown
    }
};

const PokerHandHistory = ({ actions }) => {
    // Group actions by stage
    const groupedActions = useMemo(() => {
        return actions.reduce((acc, action) => {
            const stage = action.stage;
            if (!acc[stage]) {
                acc[stage] = [];
            }
            // You might choose to filter out actions with shouldHideFromUi here
            // if you don't want them displayed at all.
            // For this example, we show all actions as provided by 'text'.
            acc[stage].push(action);
            return acc;
        }, {});
    }, [actions]);

    // Keep track of expanded accordions
    const [expandedStages, setExpandedStages] = useState({});

    const handlePress = (stage) => {
        setExpandedStages(prev => ({
            ...prev,
            [stage]: !prev[stage] // Toggle the specific stage
        }));
    };

    // Ensure stages are sorted numerically
    const sortedStages = Object.keys(groupedActions).map(Number).sort((a, b) => a - b);

    return (
        <Card style={styles.card}>
            <Card.Title title="Hand History" />
            <Card.Content>
                <ScrollView>
                    <List.Section>
                        {sortedStages.map((stage) => (
                            <List.Accordion
                                key={stage}
                                title={getStageName(stage)}
                                id={stage.toString()} // id prop is required
                                expanded={!!expandedStages[stage]} // Check if this stage is expanded
                                onPress={() => handlePress(stage)}
                                left={props => <List.Icon {...props} icon={stage === 0 ? "cards-outline" : `numeric-${stage}-box-multiple-outline`} />} // Example icons for stages
                            >
                                {groupedActions[stage].map((action, index) => (
                                    <List.Item
                                        key={`${stage}-${index}`} // Unique key for each action item
                                        title={`${action.position}: ${action.text}`} // Combine position and text
                                        description={action.amount > 0 ? `$${action.amount}` : null} // Show amount if > 0
                                        style={styles.listItem}
                                        titleStyle={action.shouldHideFromUi ? styles.hiddenActionTitle : null} // Optional: Dim hidden actions
                                        left={props => (
                                            <List.Icon
                                                {...props}
                                                icon={getDecisionIcon(action.decision)}
                                                color={action.shouldHideFromUi ? '#aaa' : undefined} // Optional: Dim icon too
                                            />
                                        )}
                                    />
                                ))}
                            </List.Accordion>
                        ))}
                    </List.Section>
                </ScrollView>
            </Card.Content>
        </Card>
    );
};

const styles = StyleSheet.create({
    card: {
        margin: 10,
        maxHeight: '80%', // Prevent card from taking full screen height
    },
    listItem: {
        paddingLeft: 25, // Indent action items slightly
    },
    hiddenActionTitle: { // Optional style to dim actions marked as hidden
        color: '#888',
    },
});

export default PokerHandHistory;