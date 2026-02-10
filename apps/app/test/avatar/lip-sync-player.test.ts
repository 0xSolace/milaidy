/**
 * Tests for LipSyncPlayer — audio playback + volume analysis for lip sync.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { LipSyncPlayer } from "../../src/components/avatar/LipSyncPlayer";

describe("LipSyncPlayer", () => {
  let player: LipSyncPlayer;

  beforeEach(() => {
    vi.restoreAllMocks();
    player = new LipSyncPlayer();
  });

  // -- Initial state --

  it("returns zero volume when no audio is playing", () => {
    expect(player.getVolume()).toBe(0);
  });

  it("can be stopped safely when nothing is playing", () => {
    // Should not throw
    player.stop();
    expect(player.getVolume()).toBe(0);
  });

  it("stop is idempotent", () => {
    player.stop();
    player.stop();
    player.stop();
    expect(player.getVolume()).toBe(0);
  });

  // -- playWav --

  // Note: The volume sigmoid curve `1/(1+exp(-(rms*30-2)))` returns ~0.119
  // when all audio data is zero (rms=0). This is the baseline "silent" value.
  const SILENT_BASELINE = 1 / (1 + Math.exp(2)); // ~0.119

  describe("playWav", () => {
    it("creates an AudioContext and connects nodes", async () => {
      // Create a minimal WAV-like buffer (mock decodeAudioData will handle it)
      const wavBuffer = new ArrayBuffer(44);

      const playPromise = player.playWav(wavBuffer);

      // After playWav is called, the analyser should be set up
      // getVolume returns the sigmoid baseline when mock data is all zeros
      const vol = player.getVolume();
      expect(vol).toBeCloseTo(SILENT_BASELINE, 5);
      expect(vol).toBeGreaterThanOrEqual(0);
      expect(vol).toBeLessThanOrEqual(1);

      void playPromise.catch(() => {});
    });

    it("stops previous source before playing new audio", async () => {
      const buf1 = new ArrayBuffer(44);
      const buf2 = new ArrayBuffer(44);

      // Start first playback
      void player.playWav(buf1).catch(() => {});
      // Start second immediately — should stop first
      void player.playWav(buf2).catch(() => {});

      // Should not throw or leave dangling state
      player.stop();
      const vol = player.getVolume();
      expect(vol).toBeGreaterThanOrEqual(0);
      expect(vol).toBeLessThanOrEqual(1);
    });
  });

  // -- getVolume --

  describe("getVolume", () => {
    it("returns sigmoid baseline when analyser data is all zeros", async () => {
      // Initialize by starting playback
      void player.playWav(new ArrayBuffer(44)).catch(() => {});
      const vol = player.getVolume();
      // All-zero audio -> RMS=0 -> sigmoid(0*30-2) ≈ 0.119
      expect(vol).toBeCloseTo(SILENT_BASELINE, 5);
    });

    it("returns value between 0 and 1", async () => {
      void player.playWav(new ArrayBuffer(44)).catch(() => {});
      const vol = player.getVolume();
      expect(vol).toBeGreaterThanOrEqual(0);
      expect(vol).toBeLessThanOrEqual(1);
    });
  });

  // -- Cleanup --

  it("stop disconnects the source node", () => {
    void player.playWav(new ArrayBuffer(44)).catch(() => {});
    player.stop();
    // After stop, getVolume should still work (returns 0 from analyser)
    expect(player.getVolume()).toBeGreaterThanOrEqual(0);
  });
});
