import { Tabs } from 'expo-router';
import { MaterialIcons, FontAwesome5, Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { getAuth, subscribeAuth } from '../../stores/authStore';

export default function TabLayout() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Estado inicial
    setIsAdmin(!!getAuth()?.isAdmin);
    
    // Suscripción a cambios
    const unsubscribe = subscribeAuth((data) => {
      setIsAdmin(!!data?.isAdmin);
    });
    return unsubscribe;
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#0a0e27' },
        headerTintColor: '#fff',
        tabBarStyle: { 
          backgroundColor: '#0a0e27',
          borderTopColor: '#1e2a5a',
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: '#f5a623',
        tabBarInactiveTintColor: '#666',
        sceneStyle: { backgroundColor: '#0a0e27' }
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }) => <MaterialIcons name="dashboard" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="results"
        options={{
          title: 'Resultados',
          tabBarIcon: ({ color }) => <Ionicons name="football" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarIcon: ({ color }) => <FontAwesome5 name="comment-dots" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="predictions"
        options={{
          title: 'Predicciones',
          tabBarIcon: ({ color }) => <MaterialIcons name="sports-soccer" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="pool"
        options={{
          title: 'El Muro',
          tabBarIcon: ({ color }) => <MaterialIcons name="format-list-bulleted" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color }) => <MaterialIcons name="person" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: 'Admin',
          tabBarIcon: ({ color }) => <MaterialIcons name="admin-panel-settings" size={24} color={color} />,
          href: isAdmin ? '/(tabs)/admin' : null,
        }}
      />
    </Tabs>
  );
}
