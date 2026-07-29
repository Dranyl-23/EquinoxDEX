import { createAudioPlayer } from 'expo-audio';
import * as SecureStore from 'expo-secure-store';

export async function isSoundEnabled(): Promise<boolean> {
  try {
    const val = await SecureStore.getItemAsync('equinox_sound_enabled');
    return val !== 'false';
  } catch {
    return true;
  }
}

/**
 * Modern SDK 54 Sound Engine using expo-audio.
 * Respects user preferences in Settings.
 */
class SoundEngine {
  async playOrderSubmitted() {
    if (!(await isSoundEnabled())) return;
    try {
      const player = createAudioPlayer({
        uri: 'https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3',
      });
      player.play();
    } catch {
      // Fallback
    }
  }

  async playPositionClosed() {
    if (!(await isSoundEnabled())) return;
    try {
      const player = createAudioPlayer({
        uri: 'https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3',
      });
      player.play();
    } catch {
      // Fallback
    }
  }

  async playError() {
    if (!(await isSoundEnabled())) return;
    try {
      const player = createAudioPlayer({
        uri: 'https://assets.mixkit.co/active_storage/sfx/2955/2955-preview.mp3', // Error/Alert sound
      });
      player.play();
    } catch {
      // Fallback
    }
  }
}

export const soundEngine = new SoundEngine();
