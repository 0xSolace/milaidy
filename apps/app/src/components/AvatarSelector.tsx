/**
 * Reusable avatar/character VRM selector.
 *
 * Shows a grid of the 8 built-in milady VRMs with preview images,
 * plus an upload option for custom VRM files.
 */

import { useRef } from "react";
import { VRM_COUNT, getVrmPreviewUrl } from "../AppContext";

export interface AvatarSelectorProps {
  /** Currently selected index (1-8 for built-in, 0 for custom) */
  selected: number;
  /** Called when a built-in avatar is selected */
  onSelect: (index: number) => void;
  /** Called when a custom VRM is uploaded */
  onUpload?: (file: File) => void;
  /** Whether to show the upload option */
  showUpload?: boolean;
  /** Optional label override */
  label?: string;
}

export function AvatarSelector({
  selected,
  onSelect,
  onUpload,
  showUpload = true,
  label,
}: AvatarSelectorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".vrm")) {
      alert("Please select a .vrm file");
      return;
    }
    onUpload?.(file);
    onSelect(0); // 0 = custom
  };

  const avatarIndices = Array.from({ length: VRM_COUNT }, (_, i) => i + 1);

  return (
    <div>
      {label && (
        <div className="text-[13px] font-bold text-txt-strong mb-3">{label}</div>
      )}
      <div className="grid grid-cols-8 gap-1.5">
        {avatarIndices.map((i) => (
          <button
            key={i}
            className={`relative aspect-square border-[1.5px] cursor-pointer bg-card overflow-hidden transition-all rounded-md ${
              selected === i
                ? "border-accent shadow-[0_0_0_2px_var(--accent-subtle)] scale-[1.04]"
                : "border-border hover:border-accent/50 hover:scale-[1.02]"
            }`}
            onClick={() => onSelect(i)}
            title={`Milady ${i}`}
          >
            <img
              src={getVrmPreviewUrl(i)}
              alt={`Milady ${i}`}
              className="w-full h-full object-cover"
              onError={(e) => {
                const target = e.currentTarget;
                target.style.display = "none";
                const parent = target.parentElement;
                if (parent && !parent.querySelector(".fallback")) {
                  const fallback = document.createElement("div");
                  fallback.className = "fallback absolute inset-0 flex items-center justify-center text-muted text-xs";
                  fallback.textContent = `${i}`;
                  parent.appendChild(fallback);
                }
              }}
            />
            {selected === i && (
              <div className="absolute top-0.5 right-0.5 w-3.5 h-3.5 bg-accent rounded-full flex items-center justify-center">
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Upload custom VRM */}
      {showUpload && (
        <div className="mt-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".vrm"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            className={`w-full py-2.5 border-2 border-dashed cursor-pointer transition-all rounded-lg text-sm ${
              selected === 0
                ? "border-accent bg-accent-subtle text-accent"
                : "border-border text-muted hover:border-accent/50 hover:text-txt"
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            {selected === 0 ? "Custom VRM uploaded" : "Upload custom .vrm file"}
          </button>
        </div>
      )}
    </div>
  );
}
