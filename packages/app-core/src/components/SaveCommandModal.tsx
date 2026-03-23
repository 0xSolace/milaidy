/**
 * Modal for naming and saving a custom /command from selected text.
 */

import {
<<<<<<< Updated upstream
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
=======
  Dialog,
  DialogContent,
>>>>>>> Stashed changes
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
<<<<<<< Updated upstream
  Label,
=======
>>>>>>> Stashed changes
} from "@miladyai/ui";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useApp } from "../state";

interface SaveCommandModalProps {
  open: boolean;
  text: string;
  onSave: (name: string) => void;
  onClose: () => void;
}

const NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9-]*$/;

export function SaveCommandModal({
  open,
  text,
  onSave,
  onClose,
}: SaveCommandModalProps) {
  const { t } = useApp();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const inputLabelId = useId();
  const inputErrorId = useId();

  useEffect(() => {
    if (open) {
      setName("");
      setError("");
      const focusTimeout = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(focusTimeout);
    }
  }, [open]);

  const validate = useCallback((value: string) => {
    if (!value) return t("savecommandmodal.nameRequired");
    if (!NAME_PATTERN.test(value))
      return t("savecommandmodal.nameFormat");
    return "";
  }, []);

  const handleSubmit = useCallback(() => {
    const err = validate(name);
    if (err) {
      setError(err);
      return;
    }
    onSave(name);
  }, [name, validate, onSave]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.nativeEvent.isComposing) return;
      if (e.key === "Enter") handleSubmit();
    },
    [handleSubmit],
  );

  const preview = text.length > 120 ? `${text.slice(0, 120)}...` : text;

  return (
<<<<<<< Updated upstream
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="w-full max-w-md p-0 overflow-hidden rounded-xl">
        <DialogHeader className="px-5 py-3 shrink-0 border-b border-border">
          <DialogTitle className="font-bold text-sm">
            {t("savecommandmodal.SaveAsCommand")}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t("savecommandmodal.CommandName")}
          </DialogDescription>
=======
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md rounded-xl p-0 overflow-hidden">
        <DialogHeader
          className="px-5 py-3 shrink-0"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <DialogTitle className="font-bold text-sm">
            {t("savecommandmodal.SaveAsCommand")}
          </DialogTitle>
>>>>>>> Stashed changes
        </DialogHeader>

        <div className="px-5 py-4 flex flex-col gap-3">
          <Label
            id={inputLabelId}
            htmlFor={inputId}
            className="text-xs text-muted font-normal"
          >
            {t("savecommandmodal.CommandName")}
          </Label>
          <div className="flex items-center gap-1">
            <span className="text-sm text-muted">
              /
            </span>
            <Input
              id={inputId}
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError("");
              }}
              onKeyDown={handleKeyDown}
              placeholder={t("savecommandmodal.myCommand")}
              aria-labelledby={inputLabelId}
              aria-describedby={error ? inputErrorId : undefined}
              aria-invalid={error ? "true" : undefined}
              className="flex-1 h-8 text-sm shadow-sm"
              style={{
                background: "var(--bg-hover)",
                border: "1px solid var(--border)",
                color: "var(--text)",
              }}
            />
          </div>
          {error && (
            <p
              id={inputErrorId}
              className="text-xs"
              style={{ color: "#ef4444" }}
            >
              {error}
            </p>
          )}

          <span className="text-xs mt-1 text-muted">
            {t("savecommandmodal.Preview")}
          </span>
          <pre
            className="text-xs px-3 py-2 whitespace-pre-wrap break-words max-h-24 overflow-y-auto rounded-lg"
            style={{
              color: "var(--muted)",
              background: "var(--bg-hover)",
              border: "1px solid var(--border)",
            }}
          >
            {preview}
          </pre>
        </div>

<<<<<<< Updated upstream
        <DialogFooter className="px-5 py-3 border-t border-border">
          <Button
            variant="outline"
            size="sm"
=======
        <DialogFooter
          className="flex justify-end gap-2 px-5 py-3"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <button
            type="button"
            className="px-3 py-1.5 h-8 text-xs font-medium rounded cursor-pointer transition-colors"
            style={{
              background: "transparent",
              border: "1px solid var(--border)",
              color: "var(--muted)",
            }}
>>>>>>> Stashed changes
            onClick={onClose}
          >
            {t("common.cancel")}
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleSubmit}
          >
            {t("apikeyconfig.save")}
<<<<<<< Updated upstream
          </Button>
=======
          </button>
>>>>>>> Stashed changes
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
