import Ionicons from '@expo/vector-icons/Ionicons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AdminHomeScreen from '../screens/admin/AdminHomeScreen';
import AdminWebRedirectScreen from '../screens/admin/AdminWebRedirectScreen';
import { colors } from '../theme/colors';
import { tabBarScreenOptions } from './tabBarOptions';

const Tab = createBottomTabNavigator();

export default function AdminNavigator() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator screenOptions={tabBarScreenOptions(insets, false)}>
      <Tab.Screen
        name="Resumen"
        component={AdminHomeScreen}
        options={{
          title: 'Resumen',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="stats-chart" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="PanelWeb"
        component={AdminWebRedirectScreen}
        options={{
          title: 'Panel web',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="desktop-outline" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
