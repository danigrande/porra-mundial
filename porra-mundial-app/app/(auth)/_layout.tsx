import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="forgot-password" options={{ headerShown: true, headerTitle: '', headerTintColor: '#fff', headerStyle: { backgroundColor: '#0a0e27' }, headerShadowVisible: false }} />
    </Stack>
  );
}
