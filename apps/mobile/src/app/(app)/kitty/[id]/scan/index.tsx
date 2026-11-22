import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { explainFailure } from '@/lib/errors';
import { MAX_PHOTOS, pickPhotos, uploadAndScan, type Photo } from '@/lib/scan';
import { Body, Button, ErrorText, Screen, Small, TextLink, Title } from '@/ui/components';
import { colors, layout, type } from '@/ui/theme';

/**
 * Screen 9 (take the photo) and screen 25 (scan failed).
 * mode=settle: scanning the final bill to settle up (from the feed).
 * mode=draft: scanning before sharing, for exact shares (from screen 2).
 */
export default function ScanBill() {
  const { id, mode = 'settle' } = useLocalSearchParams<{ id: string; mode?: 'settle' | 'draft' }>();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const room = MAX_PHOTOS - photos.length;

  async function add(source: 'camera' | 'gallery') {
    setError(null);
    try {
      const picked = await pickPhotos(source, room);
      if (picked) setPhotos((p) => [...p, ...picked].slice(0, MAX_PHOTOS));
    } catch (e) {
      setError(e instanceof Error && e.message === 'camera_permission' ? 'Kitty needs the camera to photograph the bill. Allow it in Settings, or choose a photo from your gallery.' : 'Couldn’t open the photos. Try again.');
    }
  }

  async function scan() {
    setError(null);
    setBusy(true);
    try {
      const outcome = await uploadAndScan(id, photos);
      if (outcome.status === 'failed' || !outcome.billId) {
        setFailed(true);
        return;
      }
      router.replace({ pathname: '/kitty/[id]/scan/[billId]', params: { id, billId: outcome.billId, mode } });
    } catch (e) {
      setError(await explainFailure(e, 'scan the bill'));
    } finally {
      setBusy(false);
    }
  }

  const byHand = () =>
    mode === 'settle' ? router.replace({ pathname: '/kitty/[id]/final-bill', params: { id } }) : router.back();

  if (failed) {
    // Screen 25
    return (
      <Screen
        title="Scan the bill"
        back
        footer={
          <>
            <Button
              onPress={() => {
                setPhotos([]);
                setFailed(false);
              }}
            >
              Retake the photo
            </Button>
            <Button variant="secondary" onPress={byHand}>
              {mode === 'settle' ? 'Enter the total by hand' : 'Type the total instead'}
            </Button>
          </>
        }
      >
        {photos[0] ? <Image source={{ uri: photos[0].uri }} style={styles.failedPhoto} resizeMode="cover" /> : null}
        <Title>Kitty couldn’t read this bill</Title>
        <Body>It usually comes down to one of these.</Body>
        <View style={styles.reasons}>
          {['The photo is dark or blurry', 'Part of the bill is cut off or folded', 'The bill is handwritten'].map((r) => (
            <Text key={r} style={[type.bodyInk, styles.reason]}>
              ✕  {r}
            </Text>
          ))}
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      title="Scan the bill"
      back
      footer={
        <>
          <ErrorText>{error}</ErrorText>
          {photos.length > 0 ? (
            <Button onPress={scan} loading={busy}>
              {/* Raj, 22 Nov 2026: "Upload bill" once the photo is taken; "Scan" read like taking another. */}
              {busy ? 'Reading the bill…' : photos.length === 1 ? 'Upload bill' : `Upload bill (${photos.length} photos)`}
            </Button>
          ) : null}
          {room > 0 && !busy ? (
            <>
              {Platform.OS !== 'web' ? (
                <Button variant={photos.length > 0 ? 'secondary' : 'primary'} onPress={() => add('camera')}>
                  {photos.length > 0 ? 'Take another photo' : 'Take photo'}
                </Button>
              ) : null}
              <Button variant="secondary" onPress={() => add('gallery')}>
                Choose from gallery
              </Button>
            </>
          ) : null}
          <View style={styles.center}>
            <TextLink onPress={byHand}>
              {mode === 'settle' ? 'Skip the scan and enter the total by hand' : 'Skip the scan and type the total'}
            </TextLink>
          </View>
        </>
      }
    >
      <Body>Fit the whole bill in the frame, from the first dish to the total.</Body>
      <View style={styles.frame}>
        {photos.length === 0 ? (
          <Text style={type.label}>Your photo</Text>
        ) : (
          <View style={styles.thumbs}>
            {photos.map((p, i) => (
              <Pressable
                key={p.uri}
                onPress={() => setPhotos((all) => all.filter((_, j) => j !== i))}
                accessibilityRole="button"
                accessibilityLabel={`Remove photo ${i + 1}`}
              >
                <Image source={{ uri: p.uri }} style={styles.thumb} resizeMode="cover" />
                <Text style={[type.small, styles.center]}>Remove</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
      <Small>Long bill? Take up to {MAX_PHOTOS} photos and Kitty joins them.</Small>
    </Screen>
  );
}

// Measured from screens 9 and 25.
const styles = StyleSheet.create({
  frame: {
    marginTop: 16,
    marginBottom: 12,
    minHeight: 300,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.sunken,
    borderWidth: layout.border,
    borderStyle: 'dashed',
    borderColor: colors.line,
    padding: 12,
  },
  thumbs: { flexDirection: 'row', gap: 10 },
  thumb: { width: 96, height: 140, borderWidth: layout.border, borderColor: colors.line },
  center: { alignItems: 'center', textAlign: 'center' },
  failedPhoto: { height: 120, marginBottom: 20, borderWidth: layout.border, borderStyle: 'dashed', borderColor: colors.line },
  reasons: { marginTop: 16, backgroundColor: colors.surface, borderWidth: layout.border, borderColor: colors.line, padding: layout.cardPadding, gap: 6 },
  reason: { lineHeight: 26 },
});
