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
}

export async function loadGroups(): Promise<SavedGroup[]> {
  const { data, error } = await supabase
    .from('groups')
    .select('id, name, profile_id, created_by_name, share_token, group_members(name, phone, diet, drinks, paid_by_index, sort_order, profile_id)')
    .order('name');
  if (error) throw error;
  return data.map((g) => ({
    id: g.id,
    name: g.name,
    createdBy: { id: g.profile_id, name: g.created_by_name },
    shareToken: g.share_token,
    people: [...g.group_members]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((p) => ({ name: p.name, phone: p.phone, diet: p.diet as Diet, drinks: p.drinks, paidByIndex: p.paid_by_index, profileId: p.profile_id })),
  }));
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

/** Takes the group out of your login only. Others keep it. */
export async function leaveGroup(id: string) {
  const { error } = await supabase.from('group_holders').delete().eq('group_id', id);
  return error;
}

/** From a "Share group" link. */
export async function joinGroup(token: string): Promise<{ name: string } | Error> {
  const { data, error } = await supabase.rpc('join_group', { p_token: token });
  if (error) return error;
  return { name: data.name };
}
