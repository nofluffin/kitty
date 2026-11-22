import type { Diet } from '@kitty/core';

import type { DraftPerson } from './draft-kitty';
import { supabase } from './supabase';

/**
 * Saved groups (Raj, 20 Nov 2026): people an organiser often splits with, added to a
 * new kitty in one tap. A group never changes once made; it can be shared with a link,
 * and anyone can leave it. It includes the organiser who saved it, so whoever uses it
 * gets everyone but themselves.
 */
export interface GroupPerson {
  name: string;
  phone: string | null;
  diet: Diet;
  drinks: boolean;
  /** Who pays for this person, as a place in the group's list. */
  paidByIndex: number | null;
  /** The organiser's own row in a group they saved. */
  profileId: string | null;
}

export interface SavedGroup {
  id: string;
  name: string;
  /** Who made it, e.g. "Rohan", and their id. */
  createdBy: { id: string; name: string };
  shareToken: string;
  people: GroupPerson[];
  /** Starred by you (your own setting, not shared). */
  favourite: boolean;
  /** When you last added it to a kitty. */
  lastUsedAt: string | null;
}

export async function loadGroups(): Promise<SavedGroup[]> {
  const { data, error } = await supabase
    .from('group_holders')
    .select(
      'favourite, last_used_at, groups(id, name, profile_id, created_by_name, share_token, group_members(name, phone, diet, drinks, paid_by_index, sort_order, profile_id))',
    );
  if (error) throw error;
  return data
    .filter((h) => h.groups)
    .map(({ groups: g, favourite, last_used_at }) => ({
      id: g!.id,
      name: g!.name,
      createdBy: { id: g!.profile_id, name: g!.created_by_name },
      shareToken: g!.share_token,
      favourite,
      lastUsedAt: last_used_at,
      people: [...g!.group_members]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((p) => ({ name: p.name, phone: p.phone, diet: p.diet as Diet, drinks: p.drinks, paidByIndex: p.paid_by_index, profileId: p.profile_id })),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function setFavourite(groupId: string, favourite: boolean) {
  const { error } = await supabase.from('group_holders').update({ favourite }).eq('group_id', groupId);
  return error;
}

/** For "Recent" on the groups screen. */
export async function markGroupUsed(groupId: string) {
  await supabase.from('group_holders').update({ last_used_at: new Date().toISOString() }).eq('group_id', groupId);
}

/** Saves the kitty's people, you included, as a new group. Your group with the same name is swapped for it. */
export async function saveGroup(name: string, people: DraftPerson[]) {
  const index = new Map(people.map((p, i) => [p.key, i]));
  const { error } = await supabase.rpc('save_group', {
    p_name: name,
    p_people: people.map((p) => ({
      name: p.name,
      phone: p.phone,
      diet: p.diet,
      drinks: p.drinks,
      ...(p.isOrganiser ? { is_me: true } : {}),
      ...(p.paidByKey && index.has(p.paidByKey) ? { paid_by_index: index.get(p.paidByKey) } : {}),
    })),
  });
  return error;
}

/**
 * Someone renamed in a group (Raj, 22 Nov 2026): the new name also goes to your other groups
 * (ones only you hold) and your kitties where nobody has paid yet. Matched by mobile number,
 * or by the old name when there's no number.
 */
export async function renamePeople(renames: { oldName: string; phone: string | null; newName: string }[]) {
  if (renames.length === 0) return null;
  const { error } = await supabase.rpc('rename_people', {
    p_renames: renames.map((r) => ({ old_name: r.oldName, phone: r.phone, new_name: r.newName })),
  });
  return error;
}

/** Takes the group out of your login only. Others keep it. */
export async function leaveGroup(id: string) {
  const { error } = await supabase.from('group_holders').delete().eq('group_id', id);
  return error;
}

/** Whoever made a group can delete it for everyone (Raj, 21 Nov 2026). */
export async function deleteGroup(id: string) {
  const { error } = await supabase.rpc('delete_group', { p_group: id });
  return error;
}

/** From a "Share group" link. */
export async function joinGroup(token: string): Promise<{ name: string } | Error> {
  const { data, error } = await supabase.rpc('join_group', { p_token: token });
  if (error) return error;
  return { name: data.name };
}
