import Ionicons from '@expo/vector-icons/Ionicons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AdminHomeScreen from '../screens/admin/AdminHomeScreen';
import { tabBarScreenOptions } from './tabBarOptions';

const Tab = createBottomTabNavigator();

/** Admin opera en el panel web; la app solo muestra resumen + acceso. */
export default function AdminNavigator() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={{
        ...tabBarScreenOptions(insets, false),
        tabBarStyle: { display: 'none' },
      }}
    >
      <Tab.Screen
        name="Resumen"
        component={AdminHomeScreen}
        options={{
          title: 'Resumen',
          tabBarAccessibilityLabel: 'Resumen',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="stats-chart" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
