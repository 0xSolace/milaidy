/**
 * VoiceConfigView — TTS and transcription provider configuration.
 *
 * Allows users to select and configure:
 *   - TTS provider: Edge TTS (local), ElevenLabs, or Cloud
 *   - Transcription provider: Whisper (local), OpenAI Whisper, or Cloud
 */

import { useState, useEffect, useCallback } from "react";
import { useApp } from "../AppContext";

type TtsProvider = "edge" | "elevenlabs" | "cloud";
type TranscriptionProvider = "local" | "openai" | "cloud";

interface VoiceSettings {
  tts: {
    provider: TtsProvider;
    edge?: {
      voice?: string;
      rate?: string;
      pitch?: string;
    };
    elevenlabs?: {
      apiKey?: string;
      voiceId?: string;
      modelId?: string;
      stability?: number;
      similarityBoost?: number;
    };
  };
  transcription: {
    provider: TranscriptionProvider;
    openai?: {
      apiKey?: string;
      model?: string;
    };
  };
}

const TTS_PROVIDERS: Array<{ id: TtsProvider; name: string; description: string; requiresKey: boolean }> = [
  { id: "edge", name: "Edge TTS", description: "Free, local Microsoft Edge text-to-speech", requiresKey: false },
  { id: "elevenlabs", name: "ElevenLabs", description: "High-quality AI voices with emotion", requiresKey: true },
  { id: "cloud", name: "Eliza Cloud", description: "Use Eliza Cloud credits for TTS", requiresKey: false },
];

const TRANSCRIPTION_PROVIDERS: Array<{ id: TranscriptionProvider; name: string; description: string; requiresKey: boolean }> = [
  { id: "local", name: "Local Whisper", description: "Run Whisper locally (requires model download)", requiresKey: false },
  { id: "openai", name: "OpenAI Whisper", description: "Use OpenAI's Whisper API for transcription", requiresKey: true },
  { id: "cloud", name: "Eliza Cloud", description: "Use Eliza Cloud credits for transcription", requiresKey: false },
];

const EDGE_VOICES = [
  { id: "en-US-AriaNeural", name: "Aria (US)", gender: "Female" },
  { id: "en-US-GuyNeural", name: "Guy (US)", gender: "Male" },
  { id: "en-US-JennyNeural", name: "Jenny (US)", gender: "Female" },
  { id: "en-GB-SoniaNeural", name: "Sonia (UK)", gender: "Female" },
  { id: "en-GB-RyanNeural", name: "Ryan (UK)", gender: "Male" },
  { id: "en-AU-NatashaNeural", name: "Natasha (AU)", gender: "Female" },
  { id: "en-AU-WilliamNeural", name: "William (AU)", gender: "Male" },
];

export function VoiceConfigView() {
  const { config, handleConfigChange, cloudConnected, handleCloudLogin, cloudLoginBusy } = useApp();

  const [ttsProvider, setTtsProvider] = useState<TtsProvider>("edge");
  const [transcriptionProvider, setTranscriptionProvider] = useState<TranscriptionProvider>("local");

  // Edge TTS settings
  const [edgeVoice, setEdgeVoice] = useState("en-US-AriaNeural");
  const [edgeRate, setEdgeRate] = useState("0%");
  const [edgePitch, setEdgePitch] = useState("0%");

  // ElevenLabs settings
  const [elevenLabsKey, setElevenLabsKey] = useState("");
  const [elevenLabsVoiceId, setElevenLabsVoiceId] = useState("");
  const [elevenLabsModelId, setElevenLabsModelId] = useState("eleven_multilingual_v2");

  // OpenAI Whisper settings
  const [openaiKey, setOpenaiKey] = useState("");
  const [whisperModel, setWhisperModel] = useState("whisper-1");

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Load current settings from config
  useEffect(() => {
    if (config?.voice) {
      const voice = config.voice as VoiceSettings;
      if (voice.tts?.provider) setTtsProvider(voice.tts.provider);
      if (voice.tts?.edge?.voice) setEdgeVoice(voice.tts.edge.voice);
      if (voice.tts?.edge?.rate) setEdgeRate(voice.tts.edge.rate);
      if (voice.tts?.edge?.pitch) setEdgePitch(voice.tts.edge.pitch);
      if (voice.tts?.elevenlabs?.voiceId) setElevenLabsVoiceId(voice.tts.elevenlabs.voiceId);
      if (voice.tts?.elevenlabs?.modelId) setElevenLabsModelId(voice.tts.elevenlabs.modelId);
      if (voice.transcription?.provider) setTranscriptionProvider(voice.transcription.provider);
    }
  }, [config]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaved(false);

    const voiceConfig: Record<string, unknown> = {
      tts: {
        provider: ttsProvider,
        ...(ttsProvider === "edge" && {
          edge: {
            voice: edgeVoice,
            rate: edgeRate,
            pitch: edgePitch,
          },
        }),
        ...(ttsProvider === "elevenlabs" && elevenLabsKey && {
          elevenlabs: {
            apiKey: elevenLabsKey,
            voiceId: elevenLabsVoiceId,
            modelId: elevenLabsModelId,
          },
        }),
      },
      transcription: {
        provider: transcriptionProvider,
        ...(transcriptionProvider === "openai" && openaiKey && {
          openai: {
            apiKey: openaiKey,
            model: whisperModel,
          },
        }),
      },
    };

    await handleConfigChange({ voice: voiceConfig });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [
    ttsProvider,
    edgeVoice,
    edgeRate,
    edgePitch,
    elevenLabsKey,
    elevenLabsVoiceId,
    elevenLabsModelId,
    transcriptionProvider,
    openaiKey,
    whisperModel,
    handleConfigChange,
  ]);

  return (
    <div className="space-y-6">
      {/* TTS Section */}
      <section className="border border-border bg-card p-4">
        <h3 className="text-sm font-bold mb-1">Text-to-Speech</h3>
        <p className="text-xs text-muted mb-4">Choose how your agent speaks</p>

        <div className="grid grid-cols-3 gap-2 mb-4">
          {TTS_PROVIDERS.map((provider) => {
            const isActive = ttsProvider === provider.id;
            const needsCloud = provider.id === "cloud" && !cloudConnected;
            return (
              <button
                key={provider.id}
                className={`text-left p-3 border transition-colors ${
                  isActive
                    ? "border-accent bg-accent/5"
                    : "border-border bg-bg hover:border-accent/50"
                } ${needsCloud ? "opacity-60" : ""}`}
                onClick={() => {
                  if (provider.id === "cloud" && !cloudConnected) {
                    void handleCloudLogin();
                  } else {
                    setTtsProvider(provider.id);
                  }
                }}
                disabled={cloudLoginBusy && provider.id === "cloud"}
              >
                <div className="text-xs font-semibold">{provider.name}</div>
                <div className="text-[10px] text-muted mt-0.5">{provider.description}</div>
              </button>
            );
          })}
        </div>

        {/* Provider-specific settings */}
        {ttsProvider === "edge" && (
          <div className="space-y-3 pt-3 border-t border-border">
            <div>
              <label className="block text-xs font-medium mb-1">Voice</label>
              <select
                className="w-full text-xs px-3 py-1.5 border border-border bg-bg"
                value={edgeVoice}
                onChange={(e) => setEdgeVoice(e.target.value)}
              >
                {EDGE_VOICES.map((voice) => (
                  <option key={voice.id} value={voice.id}>
                    {voice.name} ({voice.gender})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">
                  Rate: {edgeRate}
                </label>
                <input
                  type="range"
                  min="-50"
                  max="50"
                  value={parseInt(edgeRate)}
                  onChange={(e) => setEdgeRate(`${e.target.value}%`)}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">
                  Pitch: {edgePitch}
                </label>
                <input
                  type="range"
                  min="-50"
                  max="50"
                  value={parseInt(edgePitch)}
                  onChange={(e) => setEdgePitch(`${e.target.value}%`)}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        )}

        {ttsProvider === "elevenlabs" && (
          <div className="space-y-3 pt-3 border-t border-border">
            <div>
              <label className="block text-xs font-medium mb-1">API Key</label>
              <input
                type="password"
                className="w-full text-xs px-3 py-1.5 border border-border bg-bg"
                value={elevenLabsKey}
                onChange={(e) => setElevenLabsKey(e.target.value)}
                placeholder="xi_..."
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Voice ID</label>
              <input
                type="text"
                className="w-full text-xs px-3 py-1.5 border border-border bg-bg"
                value={elevenLabsVoiceId}
                onChange={(e) => setElevenLabsVoiceId(e.target.value)}
                placeholder="Enter ElevenLabs Voice ID"
              />
              <p className="text-[10px] text-muted mt-1">
                Find voice IDs in your ElevenLabs dashboard
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Model</label>
              <select
                className="w-full text-xs px-3 py-1.5 border border-border bg-bg"
                value={elevenLabsModelId}
                onChange={(e) => setElevenLabsModelId(e.target.value)}
              >
                <option value="eleven_multilingual_v2">Multilingual v2 (Recommended)</option>
                <option value="eleven_turbo_v2_5">Turbo v2.5 (Faster)</option>
                <option value="eleven_monolingual_v1">Monolingual v1 (English)</option>
              </select>
            </div>
          </div>
        )}

        {ttsProvider === "cloud" && (
          <div className="pt-3 border-t border-border">
            {cloudConnected ? (
              <div className="flex items-center gap-2 text-xs">
                <span className="w-2 h-2 rounded-full bg-success" />
                <span>Connected to Eliza Cloud</span>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted">Requires Eliza Cloud connection</span>
                <button
                  className="btn text-xs py-1 px-3"
                  onClick={() => void handleCloudLogin()}
                  disabled={cloudLoginBusy}
                >
                  {cloudLoginBusy ? "Connecting..." : "Log in"}
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Transcription Section */}
      <section className="border border-border bg-card p-4">
        <h3 className="text-sm font-bold mb-1">Transcription (Speech-to-Text)</h3>
        <p className="text-xs text-muted mb-4">Choose how to convert your voice to text</p>

        <div className="grid grid-cols-3 gap-2 mb-4">
          {TRANSCRIPTION_PROVIDERS.map((provider) => {
            const isActive = transcriptionProvider === provider.id;
            const needsCloud = provider.id === "cloud" && !cloudConnected;
            return (
              <button
                key={provider.id}
                className={`text-left p-3 border transition-colors ${
                  isActive
                    ? "border-accent bg-accent/5"
                    : "border-border bg-bg hover:border-accent/50"
                } ${needsCloud ? "opacity-60" : ""}`}
                onClick={() => {
                  if (provider.id === "cloud" && !cloudConnected) {
                    void handleCloudLogin();
                  } else {
                    setTranscriptionProvider(provider.id);
                  }
                }}
                disabled={cloudLoginBusy && provider.id === "cloud"}
              >
                <div className="text-xs font-semibold">{provider.name}</div>
                <div className="text-[10px] text-muted mt-0.5">{provider.description}</div>
              </button>
            );
          })}
        </div>

        {/* Provider-specific settings */}
        {transcriptionProvider === "local" && (
          <div className="pt-3 border-t border-border">
            <div className="text-xs text-muted">
              Local Whisper will download the model on first use (~1.5GB).
              Processing happens entirely on your machine.
            </div>
          </div>
        )}

        {transcriptionProvider === "openai" && (
          <div className="space-y-3 pt-3 border-t border-border">
            <div>
              <label className="block text-xs font-medium mb-1">OpenAI API Key</label>
              <input
                type="password"
                className="w-full text-xs px-3 py-1.5 border border-border bg-bg"
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                placeholder="sk-..."
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Model</label>
              <select
                className="w-full text-xs px-3 py-1.5 border border-border bg-bg"
                value={whisperModel}
                onChange={(e) => setWhisperModel(e.target.value)}
              >
                <option value="whisper-1">Whisper-1 (Recommended)</option>
              </select>
            </div>
          </div>
        )}

        {transcriptionProvider === "cloud" && (
          <div className="pt-3 border-t border-border">
            {cloudConnected ? (
              <div className="flex items-center gap-2 text-xs">
                <span className="w-2 h-2 rounded-full bg-success" />
                <span>Connected to Eliza Cloud</span>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted">Requires Eliza Cloud connection</span>
                <button
                  className="btn text-xs py-1 px-3"
                  onClick={() => void handleCloudLogin()}
                  disabled={cloudLoginBusy}
                >
                  {cloudLoginBusy ? "Connecting..." : "Log in"}
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Save button */}
      <div className="flex justify-end">
        <button
          className="btn text-xs py-1.5 px-4"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Saving..." : saved ? "Saved!" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
