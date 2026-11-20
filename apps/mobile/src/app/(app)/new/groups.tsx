import { router } from 'expo-router';

import { useAuth } from '@/lib/auth';
import { useDraftKitty } from '@/lib/draft-kitty';
import { markGroupUsed } from '@/lib/groups';
import { Screen } from '@/ui/components';
import { GroupsList } from '@/ui/groups-list';

/** Pick a saved group for the kitty being made (Raj, 20 Nov 2026). */
export default function PickGroup() {
  const k = useDraftKitty();
  const { profile } = useAuth();
  return (
    <Screen title="Saved groups" back>
      <GroupsList
        onUse={(g) => {
          // You're already in as You: leave out your own row (by login, or by your mobile number).
          const added = k.addGroup(
            g.people.map(({ profileId, ...p }) => ({ ...p, isMe: profileId === profile?.id || (!!p.phone && p.phone === profile?.phone) })),
          );
          // Raj, 20 Nov 2026: people are copied in, so food and drink can change for this kitty only.
          k.setGroupNote(
            added > 0
              ? `Added ${added} from ${g.name}. Tap anyone to change their food or drink for this kitty; ${g.name} stays as it is.`
              : `Everyone in ${g.name} is already in.`,
          );
          markGroupUsed(g.id);
          router.back();
        }}
      />
    </Screen>
  );
}
