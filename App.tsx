import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { View, StyleSheet } from 'react-native';

import { WorkoutProvider } from './src/context/WorkoutContext';
import { getCustomExercises } from './src/utils/storage';
import { registerCustomExercises } from './src/data/exercises';
import { HomeScreen } from './src/screens/HomeScreen';
import { ActiveWorkoutScreen } from './src/screens/ActiveWorkoutScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { ExercisesScreen } from './src/screens/ExercisesScreen';
import { TemplatesScreen } from './src/screens/TemplatesScreen';
import { StatsScreen } from './src/screens/StatsScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { WorkoutDetailScreen } from './src/screens/WorkoutDetailScreen';
import { PlateCalculatorScreen } from './src/screens/PlateCalculatorScreen';
import { OneRepMaxScreen } from './src/screens/OneRepMaxScreen';
import { EditTemplateScreen } from './src/screens/EditTemplateScreen';
import { ExerciseHistoryScreen } from './src/screens/ExerciseHistoryScreen';
import { Colors } from './src/theme/colors';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const DarkTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    primary: Colors.primary,
    background: Colors.bg,
    card: Colors.bgCard,
    text: Colors.text,
    border: Colors.border,
    notification: Colors.accent,
  },
};

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.bgCard,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          height: 85,
          paddingTop: 8,
          paddingBottom: 28,
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textTertiary,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: string;
          switch (route.name) {
            case 'Home':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'History':
              iconName = focused ? 'time' : 'time-outline';
              break;
            case 'Templates':
              iconName = focused ? 'copy' : 'copy-outline';
              break;
            case 'Exercises':
              iconName = focused ? 'barbell' : 'barbell-outline';
              break;
            case 'Stats':
              iconName = focused ? 'stats-chart' : 'stats-chart-outline';
              break;
            case 'Profile':
              iconName = focused ? 'person' : 'person-outline';
              break;
            default:
              iconName = 'ellipse';
          }
          return <Ionicons name={iconName as any} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Templates" component={TemplatesScreen} />
      <Tab.Screen name="Exercises" component={ExercisesScreen} />
      <Tab.Screen name="History" component={HistoryScreen} />
      <Tab.Screen name="Stats" component={StatsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  useEffect(() => {
    getCustomExercises().then(custom => {
      if (custom.length > 0) registerCustomExercises(custom);
    });
  }, []);

  return (
    <SafeAreaProvider>
      <WorkoutProvider>
        <NavigationContainer theme={DarkTheme}>
          <StatusBar style="light" />
          <Stack.Navigator
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: Colors.bg },
              animation: 'slide_from_bottom',
            }}
          >
            <Stack.Screen name="Tabs" component={TabNavigator} />
            <Stack.Screen
              name="ActiveWorkout"
              component={ActiveWorkoutScreen}
              options={{ presentation: 'fullScreenModal' }}
            />
            <Stack.Screen name="WorkoutDetail" component={WorkoutDetailScreen} />
            <Stack.Screen
              name="PlateCalculator"
              component={PlateCalculatorScreen}
              options={{ presentation: 'modal' }}
            />
            <Stack.Screen
              name="OneRepMax"
              component={OneRepMaxScreen}
              options={{ presentation: 'modal' }}
            />
            <Stack.Screen
              name="EditTemplate"
              component={EditTemplateScreen}
              options={{ presentation: 'modal' }}
            />
            <Stack.Screen name="ExerciseHistory" component={ExerciseHistoryScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </WorkoutProvider>
    </SafeAreaProvider>
  );
}
