import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { HomeScreen } from './src/screens/HomeScreen';
import { ProjectsScreen } from './src/screens/ProjectsScreen';
import { SiteReportScreen } from './src/screens/SiteReportScreen';
import { CalculatorScreen } from './src/screens/CalculatorScreen';
import { SyncScreen } from './src/screens/SyncScreen';

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Tab.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: '#0f172a' },
          headerTintColor: '#fff',
          tabBarStyle: { backgroundColor: '#0f172a', borderTopColor: '#334155' },
          tabBarActiveTintColor: '#38bdf8',
          tabBarInactiveTintColor: '#94a3b8',
        }}
      >
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen name="Projects" component={ProjectsScreen} />
        <Tab.Screen name="Report" component={SiteReportScreen} />
        <Tab.Screen name="Calc" component={CalculatorScreen} />
        <Tab.Screen name="Sync" component={SyncScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
