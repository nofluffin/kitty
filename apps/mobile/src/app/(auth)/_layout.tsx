import { Stack } from 'expo-router';

import { colors } from '@/ui/theme';

export const unstable_settings = { anchor: 'sign-up' };

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.page } }} />;
}
