/**
 * Full-width character editor — replaces the narrow notebook-style CharacterView.
 *
 * Two-panel layout: left panel has roster + identity + bio + system prompt,
 * right panel has style rules + examples. Footer has voice + save + reset.
 */

import { client } from "@elizaos/app-core/api";
import {
  dispatchWindowEvent,
  VOICE_CONFIG_UPDATED_EVENT,
} from "@elizaos/app-core/events";
import { getVrmPreviewUrl, useApp } from "@elizaos/app-core/state";
import { PREMADE_VOICES, sanitizeApiKey } from "@elizaos/app-core/voice";
import { Button, Input, Textarea, ThemedSelect } from "@elizaos/ui";
/* Inline SVG icon helpers – avoids adding lucide-react as a dependency. */
const svgBase = { xmlns: "http://www.w3.org/2000/svg", width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const Icon = ({ className, d }: { className?: string; d: string }) => <svg {...svgBase} className={className}><path d={d} /></svg>;
const Lock = ({ className }: { className?: string }) => <svg {...svgBase} className={className}><rect width="18" x="3" y="11" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>;
const LockOpen = ({ className }: { className?: string }) => <svg {...svgBase} className={className}><rect width="18" x="3" y="11" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 9.9-1" /></svg>;
const RotateCcw = ({ className }: { className?: string }) => <Icon className={className} d="M1 4v6h6M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />;
const Volume2 = ({ className }: { className?: string }) => <svg {...svgBase} className={className}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" /></svg>;
const VolumeX = ({ className }: { className?: string }) => <svg {...svgBase} className={className}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" /></svg>;
import { useCallback, useEffect, useState } from "react";
import { AvatarSelector } from "@elizaos/app-core/components/AvatarSelector";
import "./CharacterEditor.css";

/* ── Constants ─────────────────────────────────────────────────────── */

const DEFAULT_ELEVEN_FAST_MODEL = "eleven_flash_v2_5";
const STYLE_SECTION_KEYS = ["all", "chat", "post"] as const;
const STYLE_SECTION_PLACEHOLDERS: Record<string, string> = {
  all: "Add shared rule",
  chat: "Add chat rule",
  post: "Add post rule",
};
const STYLE_SECTION_EMPTY_STATES: Record<string, string> = {
  all: "No shared rules yet.",
  chat: "No chat rules yet.",
  post: "No post rules yet.",
};

const VOICE_SELECT_GROUPS = [
  {
    label: "Female",
    items: PREMADE_VOICES.filter((p) => p.gender === "female").map((p) => ({
      id: p.id,
      text: p.name,
    })),
  },
  {
    label: "Male",
    items: PREMADE_VOICES.filter((p) => p.gender === "male").map((p) => ({
      id: p.id,
      text: p.name,
    })),
  },
  {
    label: "Character",
    items: PREMADE_VOICES.filter((p) => p.gender === "character").map((p) => ({
      id: p.id,
      text: p.name,
    })),
  },
];

// Mirrored from CharacterView — patched at install time with Milady catalog data.
const CHARACTER_PRESET_META: Record<
  string,
  { name: string; avatarIndex: number; voicePresetId?: string }
> = {
  "uwu~": { name: "Chen", avatarIndex: 1, voicePresetId: "sarah" },
  "hell yeah": { name: "Jin", avatarIndex: 2, voicePresetId: "adam" },
  "lol k": { name: "Kei", avatarIndex: 3, voicePresetId: "lily" },
  Noted: { name: "Momo", avatarIndex: 4, voicePresetId: "alice" },
  "hehe~": { name: "Rin", avatarIndex: 5, voicePresetId: "gigi" },
  "...": { name: "Ryu", avatarIndex: 6, voicePresetId: "daniel" },
  "lmao kms": { name: "Satoshi", avatarIndex: 7, voicePresetId: "callum" },
};

/* ── Helpers (copied from CharacterView internals) ─────────────────── */

interface OnboardingPreset {
  catchphrase: string;
  bio: string[];
  system: string;
  adjectives: string[];
  style: { all: string[]; chat: string[]; post: string[] };
  messageExamples: Array<
    Array<{ user: string; content: { text: string } }>
  >;
  postExamples: string[];
}

interface RosterEntry {
  id: string;
  name: string;
  avatarIndex: number;
  voicePresetId?: string;
  preset: OnboardingPreset;
}

function replaceCharacterToken(value: string, name: string) {
  return value.replaceAll("{{name}}", name).replaceAll("{{agentName}}", name);
}

function buildCharacterDraftFromPreset(entry: RosterEntry) {
  const p = entry.preset;
  const name = entry.name;
  return {
    name,
    username: name,
    bio: p.bio.map((l) => replaceCharacterToken(l, name)).join("\n"),
    system: replaceCharacterToken(p.system, name),
    adjectives: [...p.adjectives],
    style: { all: [...p.style.all], chat: [...p.style.chat], post: [...p.style.post] },
    messageExamples: p.messageExamples.map((convo) => ({
      examples: convo.map((msg) => ({
        name:
          msg.user === "{{agentName}}"
            ? name
            : replaceCharacterToken(msg.user, name),
        content: { text: replaceCharacterToken(msg.content.text, name) },
      })),
    })),
    postExamples: p.postExamples.map((ex) => replaceCharacterToken(ex, name)),
  };
}

function resolveRosterEntries(
  styles: OnboardingPreset[],
): RosterEntry[] {
  return styles.map((preset, index) => {
    const meta = CHARACTER_PRESET_META[preset.catchphrase];
    return {
      id: preset.catchphrase,
      name: meta?.name ?? `Character ${index + 1}`,
      avatarIndex: meta?.avatarIndex ?? (index % 8) + 1,
      voicePresetId: meta?.voicePresetId,
      preset,
    };
  });
}

/* ── Component ─────────────────────────────────────────────────────── */

export function CharacterEditor({
  sceneOverlay = false,
}: {
  sceneOverlay?: boolean;
} = {}) {
  const {
    tab,
    setTab,
    characterData,
    characterDraft,
    characterLoading,
    characterSaving,
    characterSaveSuccess,
    characterSaveError,
    handleCharacterFieldInput,
    handleCharacterArrayInput,
    handleCharacterStyleInput,
    handleSaveCharacter,
    loadCharacter,
    setState,
    onboardingOptions,
    selectedVrmIndex,
    t,
    registryStatus,
    registryLoading,
    registryRegistering,
    registryError,
    dropStatus,
    loadRegistryStatus,
    registerOnChain,
    syncRegistryProfile,
    loadDropStatus,
    walletConfig,
  } = useApp();

  useEffect(() => {
    void loadCharacter();
    void loadRegistryStatus();
    void loadDropStatus();
  }, [loadCharacter, loadRegistryStatus, loadDropStatus]);

  const handleFieldEdit = useCallback(
    (field: string, value: unknown) => {
      handleCharacterFieldInput(field as any, value as any);
    },
    [handleCharacterFieldInput],
  );

  const handleStyleEdit = useCallback(
    (key: string, value: string) => {
      handleCharacterStyleInput(key as any, value);
    },
    [handleCharacterStyleInput],
  );

  /* ── Generation ─────────────────────────────────────────────────── */
  const [generating, setGenerating] = useState<string | null>(null);
  const [mobilePage, setMobilePage] = useState<"identity" | "style">("identity");
  const [customizing, setCustomizing] = useState(false);

  /* ── Style entry state ──────────────────────────────────────────── */
  const [pendingStyleEntries, setPendingStyleEntries] = useState<
    Record<string, string>
  >({ all: "", chat: "", post: "" });
  const [styleEntryDrafts, setStyleEntryDrafts] = useState<
    Record<string, string[]>
  >({ all: [], chat: [], post: [] });

  /* ── Roster state ───────────────────────────────────────────────── */
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(
    null,
  );
  const [rosterStyles, setRosterStyles] = useState<OnboardingPreset[]>(
    (onboardingOptions as any)?.styles ?? [],
  );

  /* ── Voice config state ─────────────────────────────────────────── */
  const [voiceConfig, setVoiceConfig] = useState<Record<string, any>>({});
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [voiceSaving, setVoiceSaving] = useState(false);
  const [voiceSaveError, setVoiceSaveError] = useState<string | null>(null);
  const [voiceTesting, setVoiceTesting] = useState(false);
  const [voiceTestAudio, setVoiceTestAudio] = useState<HTMLAudioElement | null>(
    null,
  );
  const [selectedVoicePresetId, setSelectedVoicePresetId] = useState<
    string | null
  >(null);
  const [voiceSelectionLocked, setVoiceSelectionLocked] = useState(false);

  /* ── Load roster ────────────────────────────────────────────────── */
  useEffect(() => {
    if ((onboardingOptions as any)?.styles?.length) {
      setRosterStyles((onboardingOptions as any).styles);
      return;
    }
    let cancelled = false;
    void client
      .getOnboardingOptions()
      .then((opts: any) => {
        if (!cancelled) setRosterStyles(opts.styles ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [(onboardingOptions as any)?.styles]);

  const characterRoster = resolveRosterEntries(rosterStyles);
  const visibleCharacterRoster = characterRoster.slice(0, 7);

  const d = characterDraft;
  const bioText =
    typeof d.bio === "string"
      ? d.bio
      : Array.isArray(d.bio)
        ? (d.bio as string[]).join("\n")
        : "";

  const hasCharacterContent = (c: any) =>
    Boolean(c && Object.keys(c).length > 0);
  const currentCharacter = hasCharacterContent(characterDraft)
    ? characterDraft
    : characterData;

  /* ── Resolve active roster entry ────────────────────────────────── */
  const activeRosterEntry: RosterEntry | null = (() => {
    if (selectedCharacterId) {
      const found = characterRoster.find((e) => e.id === selectedCharacterId);
      if (found) return found;
    }
    if (!currentCharacter) return null;
    const currentName =
      typeof currentCharacter.name === "string"
        ? currentCharacter.name.trim()
        : "";
    const byName = characterRoster.find((e) => e.name === currentName);
    if (byName) return byName;
    return characterRoster[0] ?? null;
  })();

  /* ── Load voice config on mount ─────────────────────────────────── */
  useEffect(() => {
    void (async () => {
      setVoiceLoading(true);
      try {
        const cfg: any = await client.getConfig();
        const tts = cfg.messages?.tts;
        if (tts) {
          setVoiceConfig(tts);
          if (tts.elevenlabs?.voiceId) {
            const preset = PREMADE_VOICES.find(
              (p) => p.voiceId === tts.elevenlabs?.voiceId,
            );
            setSelectedVoicePresetId(preset?.id ?? null);
          }
        }
      } catch {}
      setVoiceLoading(false);
    })();
  }, []);

  /* ── Voice helpers ──────────────────────────────────────────────── */
  const handleSelectPreset = useCallback(
    (preset: (typeof PREMADE_VOICES)[0]) => {
      setSelectedVoicePresetId(preset.id);
      setVoiceConfig((prev) => ({
        ...prev,
        elevenlabs: { ...(prev.elevenlabs ?? {}), voiceId: preset.voiceId },
      }));
    },
    [],
  );

  const applyVoicePresetForEntry = useCallback(
    (entry: RosterEntry) => {
      setVoiceSaveError(null);
      if (!entry.voicePresetId) return;
      const voicePreset = PREMADE_VOICES.find(
        (p) => p.id === entry.voicePresetId,
      );
      if (voicePreset) handleSelectPreset(voicePreset);
    },
    [handleSelectPreset],
  );

  /* ── Character defaults ─────────────────────────────────────────── */
  const applyCharacterDefaults = useCallback(
    (entry: RosterEntry) => {
      const next = buildCharacterDraftFromPreset(entry);
      handleFieldEdit("name", next.name ?? "");
      handleFieldEdit("username", next.username ?? "");
      handleFieldEdit("bio", next.bio ?? "");
      handleFieldEdit("system", next.system ?? "");
      handleFieldEdit("adjectives", next.adjectives ?? []);
      handleFieldEdit("style", next.style ?? { all: [], chat: [], post: [] });
      handleFieldEdit("messageExamples", next.messageExamples ?? []);
      handleFieldEdit("postExamples", next.postExamples ?? []);
    },
    [handleFieldEdit],
  );

  const commitCharacterSelection = useCallback(
    (entry: RosterEntry, applyDefaults: boolean) => {
      setSelectedCharacterId(entry.id);
      setState("selectedVrmIndex", entry.avatarIndex);
      if (!voiceSelectionLocked && selectedCharacterId !== entry.id) {
        applyVoicePresetForEntry(entry);
      }
      if (applyDefaults) {
        applyCharacterDefaults(entry);
      }
    },
    [
      applyCharacterDefaults,
      applyVoicePresetForEntry,
      selectedCharacterId,
      setState,
      voiceSelectionLocked,
    ],
  );

  /* ── Select character from roster ───────────────────────────────── */
  const handleSelectCharacter = useCallback(
    (entry: RosterEntry) => {
      commitCharacterSelection(entry, true);
    },
    [commitCharacterSelection],
  );

  /* ── Auto-select on mount ───────────────────────────────────────── */
  useEffect(() => {
    if (
      characterLoading ||
      selectedCharacterId ||
      !characterRoster.length ||
      !currentCharacter
    )
      return;
    const entry = activeRosterEntry ?? characterRoster[0] ?? null;
    if (!entry) return;
    commitCharacterSelection(entry, true);
  }, [
    characterLoading,
    characterRoster,
    commitCharacterSelection,
    currentCharacter,
    selectedCharacterId,
    activeRosterEntry,
  ]);

  /* ── Sync customizing state with tab ─────────────────────────────── */
  useEffect(() => {
    if (tab === "character") {
      setCustomizing(true);
    }
  }, [tab]);

  /* ── Sync style entry drafts ────────────────────────────────────── */
  useEffect(() => {
    setStyleEntryDrafts({
      all: [...(d.style?.all ?? [])],
      chat: [...(d.style?.chat ?? [])],
      post: [...(d.style?.post ?? [])],
    });
  }, [d.style]);

  /* ── Voice test ─────────────────────────────────────────────────── */
  const handleTestVoice = useCallback(
    (previewUrl: string) => {
      if (voiceTestAudio) {
        voiceTestAudio.pause();
        voiceTestAudio.currentTime = 0;
      }
      setVoiceTesting(true);
      const audio = new Audio(previewUrl);
      setVoiceTestAudio(audio);
      audio.onended = () => setVoiceTesting(false);
      audio.onerror = () => setVoiceTesting(false);
      audio.play().catch(() => setVoiceTesting(false));
    },
    [voiceTestAudio],
  );

  const handleStopTest = useCallback(() => {
    if (voiceTestAudio) {
      voiceTestAudio.pause();
      voiceTestAudio.currentTime = 0;
    }
    setVoiceTesting(false);
  }, [voiceTestAudio]);

  /* ── Persist voice config ───────────────────────────────────────── */
  const persistVoiceConfig = useCallback(async () => {
    setVoiceSaveError(null);
    const normalized: any = {
      ...voiceConfig.elevenlabs,
      modelId: voiceConfig.elevenlabs?.modelId ?? DEFAULT_ELEVEN_FAST_MODEL,
    };
    const sanitizedKey = sanitizeApiKey(normalized?.apiKey);
    if (sanitizedKey) normalized.apiKey = sanitizedKey;
    else delete normalized.apiKey;
    const normalizedVoiceConfig = {
      ...voiceConfig,
      provider: voiceConfig.provider ?? "elevenlabs",
      elevenlabs: normalized,
    };
    await client.updateConfig({ messages: { tts: normalizedVoiceConfig } });
    dispatchWindowEvent(VOICE_CONFIG_UPDATED_EVENT, normalizedVoiceConfig);
  }, [voiceConfig]);

  /* ── Save all ───────────────────────────────────────────────────── */
  const handleSaveAll = useCallback(async () => {
    setVoiceSaving(true);
    setVoiceSaveError(null);
    try {
      await persistVoiceConfig();
    } catch (err) {
      setVoiceSaveError(
        err instanceof Error ? err.message : "Failed to save voice settings.",
      );
      setVoiceSaving(false);
      return;
    }
    setVoiceSaving(false);
    await handleSaveCharacter();
  }, [handleSaveCharacter, persistVoiceConfig]);

  /* ── Reset to defaults ──────────────────────────────────────────── */
  const handleResetToDefaults = useCallback(() => {
    if (!activeRosterEntry) return;
    applyCharacterDefaults(activeRosterEntry);
    applyVoicePresetForEntry(activeRosterEntry);
  }, [activeRosterEntry, applyCharacterDefaults, applyVoicePresetForEntry]);

  /* ── Generate field ─────────────────────────────────────────────── */
  const getCharContext = useCallback(
    () => ({
      name: d.name ?? "",
      system: d.system ?? "",
      bio: bioText,
      style: d.style ?? { all: [], chat: [], post: [] },
      postExamples: d.postExamples ?? [],
    }),
    [d, bioText],
  );

  const handleGenerate = useCallback(
    async (field: string, mode = "replace") => {
      setGenerating(field);
      try {
        const { generated } = await client.generateCharacterField(
          field,
          getCharContext(),
          mode,
        );
        if (field === "bio") {
          handleFieldEdit("bio", generated.trim());
        } else if (field === "system") {
          handleFieldEdit("system", generated.trim());
        } else if (field === "style") {
          try {
            const parsed = JSON.parse(generated);
            if (mode === "append") {
              handleStyleEdit(
                "all",
                [...(d.style?.all ?? []), ...(parsed.all ?? [])].join("\n"),
              );
              handleStyleEdit(
                "chat",
                [...(d.style?.chat ?? []), ...(parsed.chat ?? [])].join("\n"),
              );
              handleStyleEdit(
                "post",
                [...(d.style?.post ?? []), ...(parsed.post ?? [])].join("\n"),
              );
            } else {
              if (parsed.all) handleStyleEdit("all", parsed.all.join("\n"));
              if (parsed.chat) handleStyleEdit("chat", parsed.chat.join("\n"));
              if (parsed.post) handleStyleEdit("post", parsed.post.join("\n"));
            }
          } catch {}
        } else if (field === "chatExamples") {
          try {
            const parsed = JSON.parse(generated);
            if (Array.isArray(parsed)) {
              const formatted = parsed.map((convo: any) => ({
                examples: convo.map((msg: any) => ({
                  name: msg.user,
                  content: { text: msg.content.text },
                })),
              }));
              handleFieldEdit("messageExamples", formatted);
            }
          } catch {}
        } else if (field === "postExamples") {
          try {
            const parsed = JSON.parse(generated);
            if (Array.isArray(parsed)) {
              if (mode === "append") {
                handleCharacterArrayInput(
                  "postExamples",
                  [...(d.postExamples ?? []), ...parsed].join("\n"),
                );
              } else {
                handleCharacterArrayInput("postExamples", parsed.join("\n"));
              }
            }
          } catch {}
        }
      } catch {}
      setGenerating(null);
    },
    [getCharContext, d, handleFieldEdit, handleStyleEdit, handleCharacterArrayInput],
  );

  /* ── Style entry handlers ───────────────────────────────────────── */
  const handlePendingStyleEntryChange = useCallback(
    (key: string, value: string) => {
      setPendingStyleEntries((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleAddStyleEntry = useCallback(
    (key: string) => {
      const value = pendingStyleEntries[key].trim();
      if (!value) return;
      const nextItems = [...(d.style?.[key as "all" | "chat" | "post"] ?? [])];
      if (!nextItems.includes(value)) {
        nextItems.push(value);
        handleStyleEdit(key, nextItems.join("\n"));
      }
      setPendingStyleEntries((prev) => ({ ...prev, [key]: "" }));
    },
    [d.style, handleStyleEdit, pendingStyleEntries],
  );

  const handleRemoveStyleEntry = useCallback(
    (key: string, index: number) => {
      const nextItems = [...(d.style?.[key as "all" | "chat" | "post"] ?? [])];
      nextItems.splice(index, 1);
      handleStyleEdit(key, nextItems.join("\n"));
    },
    [d.style, handleStyleEdit],
  );

  const handleStyleEntryDraftChange = useCallback(
    (key: string, index: number, value: string) => {
      setStyleEntryDrafts((prev) => {
        const nextItems = [...(prev[key] ?? [])];
        nextItems[index] = value;
        return { ...prev, [key]: nextItems };
      });
    },
    [],
  );

  const handleCommitStyleEntry = useCallback(
    (key: string, index: number) => {
      const nextValue = styleEntryDrafts[key]?.[index]?.trim() ?? "";
      const nextItems = [...(d.style?.[key as "all" | "chat" | "post"] ?? [])];
      if (!nextValue) {
        nextItems.splice(index, 1);
      } else {
        nextItems[index] = nextValue;
      }
      handleStyleEdit(key, nextItems.join("\n"));
    },
    [d.style, handleStyleEdit, styleEntryDrafts],
  );

  const handleCustomVrmUpload = useCallback(
    (file: File) => {
      const url = URL.createObjectURL(file);
      setState("customVrmUrl", url);
      setState("selectedVrmIndex", 0);
    },
    [setState],
  );

  /* ── Derived ────────────────────────────────────────────────────── */
  const activeVoicePreset =
    PREMADE_VOICES.find((p) => p.id === selectedVoicePresetId) ?? null;
  const voiceSelectValue = selectedVoicePresetId ?? null;
  const combinedSaveError = voiceSaveError ?? characterSaveError;

  const rosterSlantClipPath =
    "polygon(32px 0, 100% 0, calc(100% - 32px) 100%, 0 100%)";

  /* ── Loading state ──────────────────────────────────────────────── */
  if (characterLoading && !characterData) {
    return (
      <div className="ce-root">
        <div className="ce-loading">Loading character data...</div>
      </div>
    );
  }

  /* ── Render ─────────────────────────────────────────────────────── */
  return (
    <div className="ce-root">
      {/* ── Character Roster (always visible) ──────────────────────── */}
      <section className="ce-section">
        <div className="ce-section-header">
          <span className="ce-label">Character</span>
          {customizing && (
            <button
              type="button"
              className="ce-back-btn"
              onClick={() => { setCustomizing(false); setTab("character-select"); }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              Back
            </button>
          )}
        </div>
        <div className="ce-roster" data-testid="character-roster-grid">
              {visibleCharacterRoster.length > 0 ? (
                visibleCharacterRoster.map((entry) => {
                  const isSelected = selectedCharacterId === entry.id;
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      className={`ce-roster-card ${isSelected ? "ce-roster-card--active" : ""}`}
                      onClick={() => handleSelectCharacter(entry)}
                      data-testid={`character-preset-${entry.id}`}
                    >
                      <div
                        className={`ce-roster-card-frame ${isSelected ? "ce-roster-card-frame--active" : ""}`}
                        style={{ clipPath: rosterSlantClipPath }}
                      >
                        <div
                          className="ce-roster-card-inner"
                          style={{ clipPath: rosterSlantClipPath }}
                        >
                          <img
                            src={getVrmPreviewUrl(entry.avatarIndex)}
                            alt={entry.name}
                            className={`ce-roster-card-img ${isSelected ? "ce-roster-card-img--active" : ""}`}
                          />
                          <div className="ce-roster-card-label">
                            <div
                              className={`ce-roster-card-name ${isSelected ? "ce-roster-card-name--active" : ""}`}
                              style={{
                                clipPath:
                                  "polygon(0px 0, 100% 0, calc(100% - 4px) 100%, -8px 100%)",
                              }}
                            >
                              {entry.name}
                            </div>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="ce-roster-empty">
                  Loading character presets...
                </div>
              )}
            </div>
          </section>

      {/* ── Customize button (only when not customizing) ────────────── */}
      {!customizing && (
        <div className="ce-customize-bar">
          <Button
            type="button"
            variant="default"
            size="sm"
            className="ce-customize-btn"
            onClick={() => { setCustomizing(true); setTab("character"); }}
          >
            Customize
          </Button>
        </div>
      )}

      {/* ── Editor panels (only when customizing) ──────────────────── */}
      {customizing && (<>
      {/* ── Mobile page tabs ──────────────────────────────────────── */}
      <div className="ce-page-tabs">
        <button
          type="button"
          className={`ce-page-tab ${mobilePage === "identity" ? "ce-page-tab--active" : ""}`}
          onClick={() => setMobilePage("identity")}
        >
          Identity
        </button>
        <button
          type="button"
          className={`ce-page-tab ${mobilePage === "style" ? "ce-page-tab--active" : ""}`}
          onClick={() => setMobilePage("style")}
        >
          Style & Examples
        </button>
      </div>

      <div className="ce-panels">
        {/* ── LEFT PANEL ────────────────────────────────────────────── */}
        <div className={`ce-panel ce-panel-left ${mobilePage !== "identity" ? "ce-panel--hidden" : ""}`}>
          {/* Avatar */}
          <section className="ce-section">
            <div className="ce-section-header">
              <span className="ce-label">Avatar</span>
            </div>
            <AvatarSelector
              selected={selectedVrmIndex}
              onSelect={(index: number) => setState("selectedVrmIndex", index)}
              onUpload={handleCustomVrmUpload}
              showUpload
              fullWidth
            />
          </section>

          {/* Name */}
          <section className="ce-section">
            <div className="ce-section-header">
              <span className="ce-label">Name</span>
            </div>
            <Input
              type="text"
              value={d.name ?? ""}
              placeholder="Agent name"
              onChange={(e: any) => handleFieldEdit("name", e.target.value)}
              className="ce-input"
            />
          </section>

          {/* Bio / About Me */}
          <section className="ce-section ce-section--grow">
            <div className="ce-section-header">
              <span className="ce-label">About Me</span>
              <Button
                variant="ghost"
                size="sm"
                className="ce-regen-btn"
                onClick={() => void handleGenerate("bio")}
                disabled={generating === "bio"}
              >
                {generating === "bio" ? "generating..." : "regenerate"}
              </Button>
            </div>
            <Textarea
              value={bioText}
              placeholder="Describe who your agent is..."
              onChange={(e: any) => handleFieldEdit("bio", e.target.value)}
              className="ce-textarea ce-textarea--grow"
            />
          </section>

          {/* System Prompt / Directions */}
          <section className="ce-section ce-section--grow">
            <div className="ce-section-header">
              <span className="ce-label">System Prompt</span>
              <Button
                variant="ghost"
                size="sm"
                className="ce-regen-btn"
                onClick={() => void handleGenerate("system")}
                disabled={generating === "system"}
              >
                {generating === "system" ? "generating..." : "regenerate"}
              </Button>
            </div>
            <Textarea
              value={d.system ?? ""}
              maxLength={10000}
              placeholder="Write in first person..."
              onChange={(e: any) => handleFieldEdit("system", e.target.value)}
              className="ce-textarea ce-textarea--grow"
            />
          </section>
        </div>

        {/* ── RIGHT PANEL ───────────────────────────────────────────── */}
        <div className={`ce-panel ce-panel-right ${mobilePage !== "style" ? "ce-panel--hidden" : ""}`}>
          {/* Style Rules */}
          <section className="ce-section">
            <div className="ce-section-header">
              <span className="ce-label">Style Rules</span>
              <Button
                variant="ghost"
                size="sm"
                className="ce-regen-btn"
                onClick={() => void handleGenerate("style", "replace")}
                disabled={generating === "style"}
              >
                {generating === "style" ? "generating..." : "regenerate"}
              </Button>
            </div>
            <div className="ce-style-sections">
              {STYLE_SECTION_KEYS.map((key) => {
                const items = d.style?.[key] ?? [];
                return (
                  <div
                    key={key}
                    className="ce-style-group"
                    data-testid={`style-section-${key}`}
                  >
                    <div className="ce-style-group-header">
                      <span className="ce-style-group-label">{key}</span>
                      <span className="ce-style-group-count">
                        {items.length} rule{items.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="ce-style-entries">
                      {items.length > 0 ? (
                        items.map((item, index) => (
                          <div
                            key={`${key}:${item}:${index}`}
                            className="ce-style-entry"
                          >
                            <span className="ce-style-entry-num">
                              {index + 1}
                            </span>
                            <Textarea
                              value={styleEntryDrafts[key]?.[index] ?? item}
                              rows={1}
                              onChange={(e: any) =>
                                handleStyleEntryDraftChange(
                                  key,
                                  index,
                                  e.target.value,
                                )
                              }
                              onBlur={() => handleCommitStyleEntry(key, index)}
                              className="ce-style-entry-input"
                            />
                            <button
                              type="button"
                              className="ce-style-entry-remove"
                              onClick={() => handleRemoveStyleEntry(key, index)}
                              title="Remove"
                            >
                              <svg
                                width="10"
                                height="10"
                                viewBox="0 0 10 10"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                              >
                                <path d="M2 2l6 6M8 2l-6 6" />
                              </svg>
                            </button>
                          </div>
                        ))
                      ) : (
                        <div className="ce-style-empty">
                          {STYLE_SECTION_EMPTY_STATES[key]}
                        </div>
                      )}
                    </div>
                    <div className="ce-style-add">
                      <Input
                        type="text"
                        value={pendingStyleEntries[key]}
                        placeholder={STYLE_SECTION_PLACEHOLDERS[key]}
                        onChange={(e: any) =>
                          handlePendingStyleEntryChange(key, e.target.value)
                        }
                        onKeyDown={(e: any) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddStyleEntry(key);
                          }
                        }}
                        className="ce-input ce-input--sm"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ce-regen-btn"
                        onClick={() => handleAddStyleEntry(key)}
                        disabled={!pendingStyleEntries[key].trim()}
                      >
                        + add
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Chat Examples */}
          <section className="ce-section">
            <div className="ce-section-header">
              <span className="ce-label">Chat Examples</span>
              <Button
                variant="ghost"
                size="sm"
                className="ce-regen-btn"
                onClick={() => void handleGenerate("chatExamples", "replace")}
                disabled={generating === "chatExamples"}
              >
                {generating === "chatExamples" ? "generating..." : "generate"}
              </Button>
            </div>
            <div className="ce-examples-list">
              {(d.messageExamples ?? []).map((convo, ci) => (
                <div
                  key={ci}
                  className="ce-example-convo"
                >
                  <div className="ce-example-convo-header">
                    <span className="ce-example-convo-label">
                      Conversation {ci + 1}
                    </span>
                    <button
                      type="button"
                      className="ce-style-entry-remove"
                      onClick={() => {
                        const updated = [...(d.messageExamples ?? [])];
                        updated.splice(ci, 1);
                        handleFieldEdit("messageExamples", updated);
                      }}
                    >
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 10 10"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      >
                        <path d="M2 2l6 6M8 2l-6 6" />
                      </svg>
                    </button>
                  </div>
                  <div className="ce-example-messages">
                    {convo.examples.map((msg, mi) => (
                      <div key={mi} className="ce-example-msg">
                        <span
                          className={`ce-example-msg-role ${msg.name === "{{user1}}" ? "" : "ce-example-msg-role--agent"}`}
                        >
                          {msg.name === "{{user1}}" ? "user" : "agent"}
                        </span>
                        <input
                          type="text"
                          value={msg.content?.text ?? ""}
                          onChange={(e) => {
                            const updated = [...(d.messageExamples ?? [])];
                            const convoClone = {
                              examples: [...updated[ci].examples],
                            };
                            convoClone.examples[mi] = {
                              ...convoClone.examples[mi],
                              content: { text: e.target.value },
                            };
                            updated[ci] = convoClone;
                            handleFieldEdit("messageExamples", updated);
                          }}
                          className="ce-example-msg-input"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {(d.messageExamples ?? []).length === 0 && (
                <div className="ce-style-empty">No chat examples yet.</div>
              )}
            </div>
          </section>

          {/* Post Examples */}
          <section className="ce-section">
            <div className="ce-section-header">
              <span className="ce-label">Post Examples</span>
              <Button
                variant="ghost"
                size="sm"
                className="ce-regen-btn"
                onClick={() => void handleGenerate("postExamples", "replace")}
                disabled={generating === "postExamples"}
              >
                {generating === "postExamples" ? "generating..." : "generate"}
              </Button>
            </div>
            <div className="ce-examples-list">
              {(d.postExamples ?? []).map((post, pi) => (
                <div key={pi} className="ce-example-post">
                  <input
                    type="text"
                    value={post}
                    onChange={(e) => {
                      const updated = [...(d.postExamples ?? [])];
                      updated[pi] = e.target.value;
                      handleFieldEdit("postExamples", updated);
                    }}
                    className="ce-example-msg-input"
                  />
                  <button
                    type="button"
                    className="ce-style-entry-remove"
                    onClick={() => {
                      const updated = [...(d.postExamples ?? [])];
                      updated.splice(pi, 1);
                      handleFieldEdit("postExamples", updated);
                    }}
                  >
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 10 10"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    >
                      <path d="M2 2l6 6M8 2l-6 6" />
                    </svg>
                  </button>
                </div>
              ))}
              {(d.postExamples ?? []).length === 0 && (
                <div className="ce-style-empty">No post examples yet.</div>
              )}
              <button
                type="button"
                className="ce-add-post-btn"
                onClick={() => {
                  const updated = [...(d.postExamples ?? []), ""];
                  handleFieldEdit("postExamples", updated);
                }}
              >
                + Add Post
              </button>
            </div>
          </section>
        </div>
      </div>
      </>)}

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <div className="ce-footer">
        {/* Status messages */}
        {(characterSaveSuccess || combinedSaveError) && (
          <div className="ce-footer-status">
            {characterSaveSuccess && (
              <span className="ce-status-success">{characterSaveSuccess}</span>
            )}
            {combinedSaveError && (
              <span className="ce-status-error">{combinedSaveError}</span>
            )}
          </div>
        )}

        <div className="ce-footer-actions">
          {/* Reset */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ce-reset-btn"
            onClick={handleResetToDefaults}
            disabled={!activeRosterEntry}
            title="Reset all fields to the selected character's defaults"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Reset to Defaults
          </Button>

          {/* Voice picker */}
          <div className="ce-voice-picker" data-testid="character-voice-picker">
            <Button
              type="button"
              variant={voiceSelectionLocked ? "default" : "outline"}
              size="icon"
              className="ce-voice-lock-btn"
              onClick={() => setVoiceSelectionLocked((v) => !v)}
              aria-label={
                voiceSelectionLocked
                  ? "Unlock voice selection"
                  : "Lock voice selection"
              }
              title={
                voiceSelectionLocked
                  ? "Voice stays pinned when switching characters"
                  : "Lock current voice"
              }
            >
              {voiceSelectionLocked ? (
                <Lock className="h-3.5 w-3.5" />
              ) : (
                <LockOpen className="h-3.5 w-3.5" />
              )}
            </Button>
            <ThemedSelect
              value={voiceSelectValue}
              groups={VOICE_SELECT_GROUPS}
              onChange={(id: string) => {
                const preset = PREMADE_VOICES.find((p) => p.id === id);
                if (preset) handleSelectPreset(preset);
              }}
              placeholder="Select a voice"
              menuPlacement="top"
              className="w-[11rem] max-w-[58vw]"
              triggerClassName="h-8 rounded-full border-border/50 bg-bg/65 px-4 py-0 text-[11px] shadow-inner backdrop-blur-sm"
              menuClassName="border-border/60 bg-bg/92 shadow-2xl backdrop-blur-md"
            />
            <Button
              type="button"
              variant={voiceTesting ? "destructive" : "outline"}
              size="icon"
              className="ce-voice-lock-btn"
              onClick={() =>
                voiceTesting
                  ? handleStopTest()
                  : activeVoicePreset
                    ? handleTestVoice(activeVoicePreset.previewUrl)
                    : undefined
              }
              aria-label={voiceTesting ? "Stop voice preview" : "Preview voice"}
              disabled={!activeVoicePreset || voiceLoading}
            >
              {voiceTesting ? (
                <VolumeX className="h-3.5 w-3.5" />
              ) : (
                <Volume2 className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>

          {/* Save */}
          <Button
            size="lg"
            className="ce-save-btn"
            disabled={characterSaving || voiceSaving}
            onClick={() => void handleSaveAll()}
          >
            {characterSaving || voiceSaving ? "saving..." : "Save Character"}
          </Button>
        </div>
      </div>
    </div>
  );
}
