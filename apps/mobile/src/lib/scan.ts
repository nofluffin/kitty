import type { BillCategory } from '@kitty/core';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { supabase } from './supabase';

/** Bill scan helpers (spec section 8, screens 9 to 11 and 25). */

export const MAX_PHOTOS = 3;
const MAX_WIDTH = 1600;

export interface Photo {
  uri: string;
  width: number;
}

/** Screen 9: "Take photo" or "Choose from gallery". Returns null if the organiser cancelled. */
export async function pickPhotos(source: 'camera' | 'gallery', room: number): Promise<Photo[] | null> {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new Error('camera_permission');
  }
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 0.9,
    ...(source === 'gallery' ? { allowsMultipleSelection: true, selectionLimit: Math.max(room, 1) } : {}),
  };
  const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled) return null;
  return result.assets.slice(0, room).map((a) => ({ uri: a.uri, width: a.width }));
}

/** Shrinks a photo so bills upload quickly and scans cost less. Text stays sharp at 1600 px. */
async function shrink(photo: Photo): Promise<string> {
  const context = ImageManipulator.manipulate(photo.uri);
  if (photo.width > MAX_WIDTH) context.resize({ width: MAX_WIDTH });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
  return saved.uri;
}

export interface ScanOutcome {
  billId: string | null;
  status: 'needs_review' | 'failed';
  reason?: string;
}

/** Uploads the photos to the kitty's private folder and runs the scan. */
export async function uploadAndScan(kittyId: string, photos: Photo[]): Promise<ScanOutcome> {
  const stamp = Date.now();
  const paths: string[] = [];
  for (const [i, photo] of photos.entries()) {
    const uri = await shrink(photo);
    const bytes = await (await fetch(uri)).arrayBuffer();
    const path = `${kittyId}/${stamp}-${i + 1}.jpg`;
    const { error } = await supabase.storage.from('bills').upload(path, bytes, { contentType: 'image/jpeg' });
    if (error) throw error;
    paths.push(path);
  }
  const { data, error } = await supabase.functions.invoke('scan-bill', { body: { kitty_id: kittyId, paths } });
  if (error) throw error;
  return { billId: data.bill_id ?? null, status: data.status, reason: data.reason };
}

export interface BillLine {
  id: string;
  rawText: string;
  label: string;
  amountPaise: number;
  category: BillCategory;
  addedByHand: boolean;
}

export interface ScannedBill {
  id: string;
  status: string;
  totalPaise: number;
  extrasPaise: number;
  mismatchPaise: number;
  lines: BillLine[];
}

export async function loadBill(billId: string): Promise<ScannedBill> {
  const { data, error } = await supabase
    .from('bills')
    .select('id, status, total_paise, extras_paise, mismatch_paise, bill_lines(id, raw_text, label, amount_paise, category, added_by_hand, created_at)')
    .eq('id', billId)
    .single();
  if (error) throw error;
  return {
    id: data.id,
    status: data.status,
    totalPaise: data.total_paise ?? 0,
    extrasPaise: data.extras_paise,
    mismatchPaise: data.mismatch_paise ?? 0,
    lines: [...data.bill_lines]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((l) => ({
        id: l.id,
        rawText: l.raw_text,
        label: l.label,
        amountPaise: l.amount_paise,
        category: l.category,
        addedByHand: l.added_by_hand,
      })),
  };
}

/** The kitty's checked bill, if it has one: the latest confirmed scan. */
export async function loadConfirmedBill(kittyId: string): Promise<ScannedBill | null> {
  const { data, error } = await supabase
    .from('bills')
    .select('id')
    .eq('kitty_id', kittyId)
    .eq('status', 'confirmed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? loadBill(data.id) : null;
}

export async function updateLine(lineId: string, change: { label?: string; category?: BillCategory; amountPaise?: number }) {
  const { error } = await supabase
    .from('bill_lines')
    .update({
      ...(change.label !== undefined ? { label: change.label } : {}),
      ...(change.category !== undefined ? { category: change.category } : {}),
      ...(change.amountPaise !== undefined ? { amount_paise: change.amountPaise } : {}),
    })
    .eq('id', lineId);
  return error;
}

/** Screen 10: "Add a line Kitty missed". */
export async function addLine(billId: string, label: string, amountPaise: number, category: BillCategory) {
  const { error } = await supabase
    .from('bill_lines')
    .insert({ bill_id: billId, raw_text: '', label, amount_paise: amountPaise, category, added_by_hand: true, confidence: 1 });
  return error;
}
