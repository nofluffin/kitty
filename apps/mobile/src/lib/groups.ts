import type { Diet } from '@kitty/core';

import type { DraftPerson } from './draft-kitty';
import { supabase } from './supabase';

/** Saved groups (Raj, 20 Nov 2026): people an organiser often splits with, added to a new kitty in one tap. */
export interface GroupPerson {
  name: string;
  phone: string | null;
  diet: Diet;
  drinks: boolean;
  /** Who pays for this person, as a place in the group's list. */
  paidByIndex: number | null;
}

export interface SavedGroup {
  id: string;
  name: string;
  people: GroupPerson[];
}

export async function loadGroups(): Promise<SavedGroup[]> {
  const { data, error } = await supabase
    .from('groups')
    .select('id, name, group_members(name, phone, diet, drinks, paid_by_index, sort_order)')
    .order('name');
  if (error) throw error;
  return data.map((g) => ({
    id: g.id,
    name: g.name,
    people: [...g.group_members]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((p) => ({ name: p.name, phone: p.phone, diet: p.diet as Diet, drinks: p.drinks, paidByIndex: p.paid_by_index })),
  }));
}

/** Saves the kitty's people (not the organiser) as a group. Saving with an existing name replaces that group. */
export async function saveGroup(name: string, people: DraftPerson[]) {
  const others = people.filter((p) => !p.isOrganiser);
  const index = new Map(others.map((p, i) => [p.key, i]));
  const { error } = await supabase.rpc('save_group', {
    p_name: name,
    p_people: others.map((p) => ({
      name: p.name,
      phone: p.phone,
      diet: p.diet,
      drinks: p.drinks,
      // Paid for by the organiser can't be kept: the organiser isn't in the group.
      ...(p.paidByKey && index.has(p.paidByKey) ? { paid_by_index: index.get(p.paidByKey) } : {}),
    })),
  });
  return error;
}

export async function deleteGroup(id: string) {
  const { error } = await supabase.from('groups').delete().eq('id', id);
  return error;
}
