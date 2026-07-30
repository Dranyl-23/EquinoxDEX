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
  private orderPlayer: any = null;
  private closePlayer: any = null;
  private errorPlayer: any = null;

  async playOrderSubmitted() {
    if (!(await isSoundEnabled())) return;
    try {
      if (!this.orderPlayer) {
        this.orderPlayer = createAudioPlayer({
          uri: 'https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3',
        });
      }
      this.orderPlayer.play();
    } catch {
      // Fallback
    }
  }

  async playPositionClosed() {
    if (!(await isSoundEnabled())) return;
    try {
      if (!this.closePlayer) {
        this.closePlayer = createAudioPlayer({
          uri: 'https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3',
        });
      }
      this.closePlayer.play();
    } catch {
      // Fallback
    }
  }

  async playError() {
    if (!(await isSoundEnabled())) return;
    try {
      if (!this.errorPlayer) {
        this.errorPlayer = createAudioPlayer({
          uri: 'https://assets.mixkit.co/active_storage/sfx/2955/2955-preview.mp3',
        });
      }
      this.errorPlayer.play();
    } catch {
      // Fallback
    }
  }
}

export const soundEngine = new SoundEngine();
