<<<<<<< Updated upstream
import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@miladyai/ui";
=======
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from "@miladyai/ui";
>>>>>>> Stashed changes
import { ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { client } from "../api";
import { useBranding } from "../config/branding";
import { useBugReport, useTimeout } from "../hooks";
import { useApp } from "../state";
import { openExternalUrl } from "../utils";

const ENV_OPTIONS = ["macOS", "Windows", "Linux", "Other"] as const;

interface BugReportForm {
  description: string;
  stepsToReproduce: string;
  expectedBehavior: string;
  actualBehavior: string;
  environment: string;
  nodeVersion: string;
  modelProvider: string;
  logs: string;
}

const EMPTY_FORM: BugReportForm = {
  description: "",
  stepsToReproduce: "",
  expectedBehavior: "",
  actualBehavior: "",
  environment: "",
  nodeVersion: "",
  modelProvider: "",
  logs: "",
};

export function BugReportModal() {
  const { setTimeout } = useTimeout();

  const { copyToClipboard, t } = useApp();
  const branding = useBranding();
  const { isOpen, close } = useBugReport();
  const [form, setForm] = useState<BugReportForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [copied, setCopied] = useState(false);
  const descRef = useRef<HTMLTextAreaElement>(null);

  // Fetch env info on open with cancellation guard
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    setForm(EMPTY_FORM);
    setSubmitting(false);
    setResultUrl(null);
    setErrorMsg(null);
    setShowLogs(false);
    setCopied(false);

    client
      .checkBugReportInfo()
      .then((info) => {
        if (cancelled) return;
        if (info.nodeVersion)
          setForm((f) => ({ ...f, nodeVersion: info.nodeVersion ?? "" }));
        if (info.platform)
          setForm((f) => ({
            ...f,
            environment:
              info.platform === "darwin"
                ? "macOS"
                : info.platform === "win32"
                  ? "Windows"
                  : info.platform === "linux"
                    ? "Linux"
                    : "Other",
          }));
      })
      .catch((err: unknown) => {
        console.warn("[BugReportModal] Failed to fetch bug report info:", err);
      });
    setTimeout(() => descRef.current?.focus(), 50);

    return () => {
      cancelled = true;
    };
  }, [isOpen, setTimeout]);

  const updateField = useCallback(
    <K extends keyof BugReportForm>(key: K, value: BugReportForm[K]) => {
      setForm((f) => ({ ...f, [key]: value }));
    },
    [],
  );

  const formatMarkdown = useCallback((): string => {
    const strip = (s: string, max = 10_000) =>
      s.replace(/<[^>]*>/g, "").slice(0, max);
    const lines: string[] = [];
    lines.push(`### Description\n${strip(form.description)}`);
    lines.push(`\n### Steps to Reproduce\n${strip(form.stepsToReproduce)}`);
    if (form.expectedBehavior)
      lines.push(`\n### Expected Behavior\n${strip(form.expectedBehavior)}`);
    if (form.actualBehavior)
      lines.push(`\n### Actual Behavior\n${strip(form.actualBehavior)}`);
    lines.push(
      `\n### Environment\n${strip(form.environment || "Not specified", 200)}`,
    );
    if (form.nodeVersion)
      lines.push(`\n### Node Version\n${strip(form.nodeVersion, 200)}`);
    if (form.modelProvider)
      lines.push(`\n### Model Provider\n${strip(form.modelProvider, 200)}`);
    if (form.logs)
      lines.push(`\n### Logs\n\`\`\`\n${strip(form.logs, 50_000)}\n\`\`\``);
    return lines.join("\n");
  }, [form]);

  const handleSubmit = useCallback(async () => {
    if (!form.description.trim() || !form.stepsToReproduce.trim()) {
      setErrorMsg(t("bugreportmodal.descriptionRequired"));
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const result = await client.submitBugReport({
        description: form.description,
        stepsToReproduce: form.stepsToReproduce,
        expectedBehavior: form.expectedBehavior,
        actualBehavior: form.actualBehavior,
        environment: form.environment,
        nodeVersion: form.nodeVersion,
        modelProvider: form.modelProvider,
        logs: form.logs,
      });
      if (result.url) {
        setResultUrl(result.url);
      } else if (result.fallback) {
        // No GITHUB_TOKEN on server — copy report and open GitHub manually
        let ok = false;
        try {
          await copyToClipboard(formatMarkdown());
          ok = true;
        } catch (err) {
          console.warn("[BugReportModal] Failed to copy bug report to clipboard:", err);
          ok = false;
        }
        setCopied(ok);
        await openExternalUrl(result.fallback);
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Failed to submit bug report",
      );
    } finally {
      setSubmitting(false);
    }
  }, [copyToClipboard, form, formatMarkdown]);

  const handleCopyAndOpen = useCallback(async () => {
    let ok = false;
    try {
      await copyToClipboard(formatMarkdown());
      ok = true;
    } catch (err) {
      console.warn("[BugReportModal] Failed to copy bug report to clipboard:", err);
      ok = false;
    }
    setCopied(ok);
    await openExternalUrl(branding.bugReportUrl);
  }, [copyToClipboard, formatMarkdown, branding.bugReportUrl]);

  const labelClass = "block text-[11px] font-bold mb-1";
  const labelStyle = { color: "var(--muted)" };
  const inputClass =
    "w-full h-9 px-3 py-2 text-sm shadow-sm transition-colors font-body";
  const inputStyle = {
    background: "var(--bg-hover)",
    color: "var(--text)",
    border: "1px solid var(--border)",
  };
  const textareaClass =
    "w-full px-3 py-2 text-sm shadow-sm focus-visible:ring-1 transition-colors font-body resize-y min-h-[60px]";
  const textareaStyle = {
    background: "var(--bg-hover)",
    color: "var(--text)",
    border: "1px solid var(--border)",
  };
  const canSubmit =
    form.description.trim() && form.stepsToReproduce.trim() && !submitting;

  // Success state
  if (resultUrl) {
    return (
      <Dialog open={isOpen} onOpenChange={(v) => { if (!v) close(); }}>
        <DialogContent className="max-w-md rounded-xl p-0">
          <DialogHeader className="px-5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
            <DialogTitle className="font-bold text-sm">
              {t("bugreportmodal.BugReportSubmitted")}
<<<<<<< Updated upstream
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="text-lg h-6 w-6"
              style={{ color: "var(--muted)" }}
              onClick={close}
            >
              {t("bugreportmodal.Times")}
            </Button>
          </div>
=======
            </DialogTitle>
          </DialogHeader>
>>>>>>> Stashed changes
          <div className="px-5 py-6 text-center">
            <p className="text-sm mb-3" style={{ color: "var(--text)" }}>
              {t("bugreportmodal.YourBugReportHas")}
            </p>
            <a
              href={resultUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm hover:underline break-all"
              style={{ color: "#f0b232" }}
            >
              {resultUrl}
            </a>
          </div>
          <DialogFooter
            className="flex justify-end px-5 py-3"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            <Button
              variant="outline"
              size="sm"
<<<<<<< Updated upstream
=======
              className="text-xs"
>>>>>>> Stashed changes
              onClick={close}
            >
              {t("bugreportmodal.Close")}
            </Button>
<<<<<<< Updated upstream
          </div>
        </div>
      </div>
=======
          </DialogFooter>
        </DialogContent>
      </Dialog>
>>>>>>> Stashed changes
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(v) => { if (!v) close(); }}>
      <DialogContent className="max-w-lg rounded-xl p-0 max-h-[85vh] flex flex-col">
        {/* Header */}
        <DialogHeader className="px-5 py-3 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <DialogTitle className="font-bold text-sm">
            {t("bugreportmodal.ReportABug")}
<<<<<<< Updated upstream
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="text-lg h-6 w-6"
            style={{ color: "var(--muted)" }}
            onClick={close}
          >
            {t("bugreportmodal.Times")}
          </Button>
        </div>
=======
          </DialogTitle>
        </DialogHeader>
>>>>>>> Stashed changes

        {/* Body */}
        <div className="px-5 py-4 flex flex-col gap-3 overflow-y-auto">
          {errorMsg && (
            <div
              className="text-xs px-3 py-2"
              style={{ color: "#ef4444", border: "1px solid #ef4444" }}
            >
              {errorMsg}
            </div>
          )}

          <label className={labelClass} style={labelStyle}>
            {t("skillsview.Description")}{" "}
            <span style={{ color: "#ef4444" }}>*</span>
            <textarea
              ref={descRef}
              className={textareaClass}
              style={textareaStyle}
              placeholder={t("bugreportmodal.DescribeTheIssueY")}
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
              rows={3}
            />
          </label>

          <label className={labelClass} style={labelStyle}>
            {t("bugreportmodal.StepsToReproduce")}{" "}
            <span style={{ color: "#ef4444" }}>*</span>
            <textarea
              className={textareaClass}
              style={textareaStyle}
              placeholder={t("bugreportmodal.stepsPlaceholder")}
              value={form.stepsToReproduce}
              onChange={(e) => updateField("stepsToReproduce", e.target.value)}
              rows={3}
            />
          </label>

          <label className={labelClass} style={labelStyle}>
            {t("bugreportmodal.ExpectedBehavior")}
            <textarea
              className={textareaClass}
              style={textareaStyle}
              placeholder={t("bugreportmodal.DescribeTheExpecte")}
              value={form.expectedBehavior}
              onChange={(e) => updateField("expectedBehavior", e.target.value)}
              rows={2}
            />
          </label>

          <label className={labelClass} style={labelStyle}>
            {t("bugreportmodal.ActualBehavior")}
            <textarea
              className={textareaClass}
              style={textareaStyle}
              placeholder={t("bugreportmodal.DescribeTheActual")}
              value={form.actualBehavior}
              onChange={(e) => updateField("actualBehavior", e.target.value)}
              rows={2}
            />
          </label>

          <div className="flex gap-3">
            <div className="flex-1">
              <span className={labelClass} style={labelStyle}>
                {t("bugreportmodal.Environment")}
              </span>
              <Select
                value={form.environment || "__none__"}
                onValueChange={(value) => updateField("environment", value === "__none__" ? "" : value)}
              >
                <SelectTrigger className={inputClass} style={inputStyle}>
                  <SelectValue placeholder={t("bugreportmodal.Select")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t("bugreportmodal.Select")}</SelectItem>
                  {ENV_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* biome-ignore lint/a11y/noLabelWithoutControl: Custom <Input> component is inside <label> */}
            <label className={`${labelClass} flex-1`} style={labelStyle}>
              {t("bugreportmodal.NodeVersion")}
              <Input
                className={inputClass}
                style={inputStyle}
                placeholder={t("bugreportmodal.22X")}
                value={form.nodeVersion}
                onChange={(e) => updateField("nodeVersion", e.target.value)}
              />
            </label>
          </div>

          {/* biome-ignore lint/a11y/noLabelWithoutControl: Custom <Input> component is inside <label> */}
          <label className={labelClass} style={labelStyle}>
            {t("bugreportmodal.ModelProvider")}
            <Input
              className={inputClass}
              style={inputStyle}
              placeholder={t("bugreportmodal.AnthropicOpenAI")}
              value={form.modelProvider}
              onChange={(e) => updateField("modelProvider", e.target.value)}
            />
          </label>

          {/* Collapsible Logs */}
          <div>
            <Button
              variant="ghost"
              className="h-auto p-0 text-[11px] font-bold flex items-center gap-1"
<<<<<<< Updated upstream
              style={{ color: "var(--muted)" }}
=======
>>>>>>> Stashed changes
              onClick={() => setShowLogs(!showLogs)}
            >
              <ChevronRight
                className="w-3 h-3 inline-block transition-transform"
                style={{ transform: showLogs ? "rotate(90deg)" : "none" }}
              />

              {t("bugreportmodal.Logs")}
            </Button>
            {showLogs && (
              <textarea
                className={`${textareaClass} mt-1 font-mono text-xs`}
                style={textareaStyle}
                placeholder={t("bugreportmodal.PasteRelevantError")}
                value={form.logs}
                onChange={(e) => updateField("logs", e.target.value)}
                rows={4}
              />
            )}
          </div>
        </div>

        {/* Footer */}
        <DialogFooter
          className="flex items-center justify-between gap-2 px-5 py-3 shrink-0"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <Button
            variant="outline"
            size="sm"
<<<<<<< Updated upstream
=======
            className="text-xs"
>>>>>>> Stashed changes
            onClick={close}
          >
            {t("common.cancel")}
          </Button>
          <div className="flex items-center gap-2">
            <Button
<<<<<<< Updated upstream
              variant="outline"
              size="sm"
              onClick={handleCopyAndOpen}
              disabled={!canSubmit}
            >
              {copied ? t("bugreportmodal.copied") : t("bugreportmodal.copyAndOpenGitHub")}
=======
              variant="secondary"
              size="sm"
              className="text-xs"
              onClick={handleCopyAndOpen}
              disabled={!canSubmit}
            >
              {copied ? "Copied!" : "Copy & Open GitHub"}
>>>>>>> Stashed changes
            </Button>
            <Button
              variant="default"
              size="sm"
<<<<<<< Updated upstream
              onClick={handleSubmit}
              disabled={!canSubmit}
            >
              {submitting ? t("bugreportmodal.submitting") : t("bugreportmodal.submit")}
=======
              className="text-xs font-medium"
              style={{ background: "#f0b232", color: "#000" }}
              onClick={handleSubmit}
              disabled={!canSubmit}
            >
              {submitting ? "Submitting..." : "Submit"}
>>>>>>> Stashed changes
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
