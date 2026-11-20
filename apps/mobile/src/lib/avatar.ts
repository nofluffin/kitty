import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { supabase } from './supabase';

/** The You picture (Raj, 20 Nov 2026): a photo the organiser takes or picks, square and small. */

const SIZE = 400;

export function avatarUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
}

/** Takes or picks a photo, crops it square, uploads it and makes it the You picture. Null if cancelled. */
export async function changeAvatar(source: 'camera' | 'gallery', userId: string, oldPath: string | null): Promise<string | null> {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new Error('camera_permission');
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.9 };
  const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets[0]) return null;

  const context = ImageManipulator.manipulate(result.assets[0].uri);
  context.resize({ width: SIZE, height: SIZE });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
  const bytes = await (await fetch(saved.uri)).arrayBuffer();

  // A new random name each time, so the old picture can't linger in caches.
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.jpg`;
  const { error } = await supabase.storage.from('avatars').upload(path, bytes, { contentType: 'image/jpeg' });
  if (error) throw error;
  const { error: saveError } = await supabase.from('profiles').update({ avatar_path: path }).eq('id', userId);
  if (saveError) throw saveError;
  if (oldPath) await supabase.storage.from('avatars').remove([oldPath]);
  return path;
}

export async function removeAvatar(userId: string, oldPath: string | null) {
  const { error } = await supabase.from('profiles').update({ avatar_path: null }).eq('id', userId);
  if (error) throw error;
  if (oldPath) await supabase.storage.from('avatars').remove([oldPath]);
}

/** On account deletion: every file in the organiser's photo folder. */
export async function removeAllAvatars(userId: string) {
  const { data } = await supabase.storage.from('avatars').list(userId);
  const paths = (data ?? []).map((f) => `${userId}/${f.name}`);
  if (paths.length > 0) await supabase.storage.from('avatars').remove(paths);
}
