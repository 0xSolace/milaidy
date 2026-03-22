# Settings, i18n & Voice Fixes — Design Spec

**Date:** 2026-03-22
**Status:** Draft
**Approach:** Three sequential passes — Settings UX, i18n completeness, voice quality

---

## Overview

Three workstreams to improve the Milady app's settings experience, internationalization completeness, and voice streaming quality. Each pass is independent and can be reviewed/merged separately.

---

## Pass 1: Settings Page UX Redesign

### 1.1 Sidebar — Connectors-Style Cards

**Current state:** Flat monospace buttons (`font-mono text-[11px]`) with 14px icons, thin accent bar on active, `w-52` (208px) sidebar in `SettingsView.tsx`.

**Target state:** Rounded card items matching the connectors page (`ConnectorsPageView.tsx` / `PluginsView.tsx`) visual language.

Changes to `SettingsView.tsx` sidebar rendering (lines 184–214):

- **Card items:** Replace `<button>` styling with rounded card pattern:
  - Container: `flex items-center gap-2.5 rounded-2xl border px-3 py-2.5 transition-all`
  - Active: `border-accent/40 bg-accent/10 text-txt`
  - Inactive: `border-transparent text-muted hover:border-border/60 hover:bg-card/55 hover:text-txt`
- **Icon containers:** 32px square with border/background:
  - `flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border p-1.5`
  - Active: `border-accent/30 bg-accent/18`
  - Inactive: `border-border/50 bg-bg-accent/80`
- **Typography:** `text-sm font-semibold` (drop `font-mono text-[11px]`)
- **Sidebar width:** `w-52` → `w-[16rem]` (256px)
- **Remove** left accent bar (`w-0.5 bg-accent` absolute span)

### 1.2 Section Consolidation

**Merge Media + Voice:**
- Combine `MediaSettingsSection` and `VoiceConfigView` into a single "Media & Voice" settings section
- Render as two stacked subsections within one `SectionCard`, each with its own subheading
- Single sidebar entry with a unified icon

**Move Desktop Workspace under Advanced:**
- Remove `desktop` from `SETTINGS_SECTIONS` as a top-level entry
- Render `DesktopWorkspaceSection` as a subsection inside the Advanced section (only on Electrobun runtime)
- Desktop content remains unchanged, just re-parented

**New section order in `SETTINGS_SECTIONS`:**
1. `ai-model` — AI Model
2. `cloud` — Eliza Cloud
3. `coding-agents` — Coding Agents
4. `wallet-rpc` — Wallet & RPC
5. `media-voice` — Media & Voice (merged)
6. `permissions` — Permissions
7. `updates` — Updates
8. `advanced` — Advanced (now contains Desktop Workspace)

### 1.3 RPC Simplification (Cloud Mode)

**When Eliza Cloud is enabled:**
- Replace the full RPC provider form in `ConfigPageView.tsx` with a single disabled row
- Display: cloud icon + "Using Eliza Cloud" text, greyed-out styling (`text-muted bg-surface/50 border-border/30`)
- No dropdowns, no API key inputs visible
- Users can assume Cloud RPCs are managed — no override needed

**When Eliza Cloud is off:**
- Show current dropdown + credential UI as-is (no changes)

### 1.4 Field Condensing & Sizing

- Audit each `SectionCard` for inputs that can share a row (e.g., two related toggles, short text fields)
- Use `grid grid-cols-2 gap-3` for field pairs where appropriate
- Normalize input heights to `h-9` or `h-10` consistently
- Align spacing to the connectors page density

### 1.5 Light/Dark Mode Color Audit

- Grep all settings components for hardcoded colors: hex (`#xxx`), `rgb()`, `rgba()`, `hsl()`
- Replace with theme CSS variables: `text-txt`, `text-muted`, `bg-surface`, `bg-card`, `border-border`, `text-accent`
- Verify contrast and readability in both modes

**Key files:**
- `packages/app-core/src/components/SettingsView.tsx`
- `packages/app-core/src/components/ConfigPageView.tsx`
- `packages/app-core/src/components/MediaSettingsSection.tsx`
- `packages/app-core/src/components/VoiceConfigView.tsx`
- `packages/app-core/src/components/DesktopWorkspaceSection.tsx`

---

## Pass 2: i18n Completeness

### 2.1 Translation Key Audit

- Diff `zh-CN.json`, `ko.json`, `es.json`, `pt.json`, `vi.json` against `en.json` (~1,112 keys)
- Add any missing translations for all 6 languages
- Fix the hardcoded English strings in `SETTINGS_SECTIONS` array (e.g., `"Desktop Workspace"`, `"Native window, clipboard..."`) — add proper i18n keys like `settings.sections.desktop.label` and `settings.sections.desktop.desc`

### 2.2 Hardcoded String Sweep

- Grep `packages/app-core/src/components/` for string literals that should be translated:
  - Button labels, tooltips, placeholder text, error messages, status text
- Focus on recently added or modified components
- Add missing `t()` calls and corresponding keys to all 6 locale files

### 2.3 Multi-Language Chat Handling

- Verify `requestGreeting(convId, uiLanguage)` sends correct language to the backend
- Ensure chat requests pass `uiLanguage` so character responses honor the selected language
- Test chat input handling for:
  - CJK characters (Chinese, Japanese, Korean) — input composition, display, wrapping
  - Emoji and special Unicode — rendering, message boundaries
  - Long strings without spaces (common in CJK) — proper word-break/overflow

### 2.4 Voice Language Mapping

- Current: 6 UI languages → 2 TTS voices (`zh-CN` or `en-US`)
- Ensure non-Chinese/non-English languages gracefully fall back to `en-US` TTS with no errors
- No new TTS voices required in this pass — just verify no crashes or silent failures

**Key files:**
- `packages/app-core/src/i18n/locales/*.json` (all 6 locale files)
- `packages/app-core/src/i18n/messages.ts`
- `packages/app-core/src/components/SettingsView.tsx` (SETTINGS_SECTIONS hardcoded strings)
- `packages/app-core/src/state/AppContext.tsx` (translator context)
- `packages/app-core/src/components/ChatView.tsx` (language in chat/voice)

---

## Pass 3: Voice Quality Fixes

### 3.1 Garbled Streaming Diagnosis & Fix

**Streaming text merge (`streaming-text.ts`):**
- Fix `mergeStreamingText()` false overlap detection when:
  - Provider resends text with different casing or punctuation
  - Multiple providers send conflicting updates
  - Text contains Unicode normalization differences
- Add unit tests for edge cases

**Sentence splitting (`useVoiceChat.ts`):**
- Fix `splitFirstSentence()` regex edge cases:
  - Long URLs or code blocks confusing sentence boundary detection
  - Unpunctuated text hitting 180-char boundary prematurely
  - Text with ellipsis (`...`), abbreviations (`Dr.`, `etc.`), or decimal numbers (`3.14`)
- Ensure `queueableSpeechPrefix()` waits for proper sentence boundaries before queuing speech

**Text sanitization (`spoken-text.ts`):**
- Audit for over-stripping: removing punctuation that affects TTS prosody
- Audit for under-stripping: leaving markdown syntax, stage directions, or URLs that TTS reads aloud
- Ensure sanitization preserves sentence structure for natural-sounding output

### 3.2 Voice in Onboarding & Character Select

- Verify voice test button works in `VoiceConfigView.tsx` during onboarding flow
- Ensure voice preset selection (ElevenLabs / Edge TTS) persists correctly through onboarding → first chat
- Test that switching characters cleans up voice state (no wrong voice ID, no dangling audio playback)

### 3.3 Voice in New Chat

- Verify `useVoiceChat` hook initializes cleanly when a new conversation starts
- Ensure `stopSpeaking()` is called on conversation switch — old audio must not bleed into new chat
- Test interrupt-on-speech flow: user speaking cancels current TTS playback cleanly
- Verify mouth/lip sync animation (`useChatAvatarVoice`) resets properly between conversations

**Key files:**
- `packages/app-core/src/utils/streaming-text.ts`
- `packages/app-core/src/hooks/useVoiceChat.ts`
- `packages/app-core/src/utils/spoken-text.ts` (imports from `@elizaos/agent/utils/spoken-text`)
- `packages/app-core/src/hooks/useChatAvatarVoice.ts`
- `packages/app-core/src/components/VoiceConfigView.tsx`
- `packages/app-core/src/components/ChatView.tsx`

---

## Out of Scope

- Adding new TTS voices for Korean, Spanish, Portuguese, Vietnamese
- Redesigning the connectors page itself
- Backend changes to character response language selection
- Adding new languages beyond the existing 6
- Pixel-perfect mockups — this is a functional/structural redesign, not a visual rebrand
