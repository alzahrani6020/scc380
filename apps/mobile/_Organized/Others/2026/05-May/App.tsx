import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet } from 'react-native';

function DashboardScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>SCC Mobile</Text>
      <Text style={styles.subtitle}>لوحة التحكم</Text>
    </View>
  );
}

function CrmScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>CRM</Text>
      <Text style={styles.subtitle}>العملاء والصفقات</Text>
    </View>
  );
}

function TasksScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>المهام</Text>
      <Text style={styles.subtitle}>المشاريع والمهام</Text>
    </View>
  );
}

function ProfileScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>الحساب</Text>
      <Text style={styles.subtitle}>الملف الشخصي</Text>
    </View>
  );
}

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: '#0f172a' },
          headerTintColor: '#fff',
          tabBarStyle: { backgroundColor: '#0f172a', borderTopColor: '#1e293b' },
          tabBarActiveTintColor: '#3b82f6',
          tabBarInactiveTintColor: '#94a3b8',
        }}
      >
        <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'الرئيسية' }} />
        <Tab.Screen name="CRM" component={CrmScreen} options={{ title: 'CRM' }} />
        <Tab.Screen name="Tasks" component={TasksScreen} options={{ title: 'المهام' }} />
        <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'الحساب' }} />
      </Tab.Navigator>
      <StatusBar style="light" />
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    marginTop: 8,
  },
});
