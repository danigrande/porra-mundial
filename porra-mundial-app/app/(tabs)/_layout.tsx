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
          height: 65,
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarActiveTintColor: '#f5a623',
        tabBarInactiveTintColor: '#64748b',
        sceneStyle: { backgroundColor: '#0a0e27' }
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Clasificación',
          tabBarIcon: ({ color }) => <MaterialIcons name="leaderboard" size={26} color={color} />,
        }}
      />
      <Tabs.Screen
        name="results"
        options={{
          title: 'Resultados',
          tabBarIcon: ({ color }) => <Ionicons name="football" size={26} color={color} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarIcon: ({ color }) => <FontAwesome5 name="comment-dots" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="predictions"
        options={{
          title: 'Mi porra',
          tabBarIcon: ({ color }) => <MaterialIcons name="sports-soccer" size={26} color={color} />,
        }}
      />
      <Tabs.Screen
        name="menu"
        options={{
          title: 'Más',
          tabBarIcon: ({ color }) => <Ionicons name="menu" size={26} color={color} />,
        }}
      />

      {/* RUTAS OCULTAS DEL MENÚ INFERIOR */}
      <Tabs.Screen
        name="pool"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
