import * as Notifications from 'expo-notifications';
import { router, Stack } from 'expo-router';
import { useEffect } from 'react';

import { confirmShare } from '@/lib/feed';
import { CONFIRM_ACTION, pushSupported, registerForPush } from '@/lib/push';
import { colors } from '@/ui/theme';

export default function AppLayout() {
  return (
    <>
      {pushSupported ? <PushHandler /> : null}
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.page } }} />
    </>
  );
}

/** Registers this phone if notifications are already allowed, and opens the right screen when one is tapped. */
function PushHandler() {
  const last = Notifications.useLastNotificationResponse();

  useEffect(() => {
    registerForPush({ ask: false });
  }, []);

  useEffect(() => {
    if (!last) return;
    Notifications.clearLastNotificationResponse();
    openFromNotification(last);
  }, [last]);

  return null;
}

async function openFromNotification(response: Notifications.NotificationResponse) {
  const data = response.notification.request.content.data as { url?: string; memberId?: string; kittyId?: string } | undefined;
  if (!data?.url || !data.url.startsWith('/')) return;
  // "Confirm it arrived" on "Kabir marked ₹1,000 as paid": confirm straight away, then show the kitty.
  if (response.actionIdentifier === CONFIRM_ACTION && data.memberId && data.kittyId) {
    const error = await confirmShare(data.memberId);
    if (!error) {
      router.push({ pathname: '/kitty/[id]', params: { id: data.kittyId } });
      return;
    }
  }
  router.push(data.url as never);
}
