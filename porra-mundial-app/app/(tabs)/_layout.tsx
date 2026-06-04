import { Tabs } from 'expo-router';
import { MaterialIcons, FontAwesome5, Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { getAuth, subscribeAuth } from '../../stores/authStore';
import { useTranslation } from '../../i18n/i18n';

export default function TabLayout() {
  const [isAdmin, setIsAdmin] = useState(false);
  const { t } = useTranslation();

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
          title: t('tabs.leaderboard'),
          tabBarIcon: ({ color }) => <MaterialIcons name="leaderboard" size={26} color={color} />,
        }}
      />
      <Tabs.Screen
        name="results"
        options={{
          title: t('tabs.results'),
          tabBarIcon: ({ color }) => <Ionicons name="football" size={26} color={color} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: t('tabs.chat'),
          tabBarIcon: ({ color }) => <FontAwesome5 name="comment-dots" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="predictions"
        options={{
          title: t('tabs.predictions'),
          tabBarIcon: ({ color }) => <MaterialIcons name="sports-soccer" size={26} color={color} />,
        }}
      />
      <Tabs.Screen
        name="menu"
        options={{
          title: t('tabs.more'),
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
      <Tabs.Screen
        name="notifications"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="rules"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="feedback"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
