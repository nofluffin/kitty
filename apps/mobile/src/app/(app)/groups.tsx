import { Screen } from '@/ui/components';
import { GroupsList } from '@/ui/groups-list';

/** Your groups, from Your details (Raj, 20 Nov 2026): star, share or leave them. */
export default function Groups() {
  return (
    <Screen title="Your groups" back>
      <GroupsList />
    </Screen>
  );
}
