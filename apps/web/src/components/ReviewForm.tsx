"use client";

import { useState } from "react";
import { SAMPLE_SNIPPETS } from "./sample-snippets";

interface ReviewFormProps {
  onSubmit: (sourceCode: string, language: string) => Promise<void>;
  isLoading: boolean;
  isAuthenticated?: boolean;
  onSignIn?: () => void;
}

const LANGUAGES = [
  { value: "typescript", label: "TypeScript (.ts, .tsx)" },
  { value: "javascript", label: "JavaScript (.js, .jsx)" },
  { value: "python", label: "Python (.py)" },
  { value: "go", label: "Go (.go)" },
  { value: "rust", label: "Rust (.rs)" },
  { value: "java", label: "Java (.java)" },
  { value: "cpp", label: "C++ (.cpp, .h)" },
  { value: "c", label: "C (.c, .h)" },
  { value: "csharp", label: "C# (.cs)" },
  { value: "php", label: "PHP (.php)" },
  { value: "ruby", label: "Ruby (.rb)" },
  { value: "swift", label: "Swift (.swift)" },
  { value: "kotlin", label: "Kotlin (.kt)" },
  { value: "scala", label: "Scala (.scala)" },
  { value: "sql", label: "SQL (.sql)" },
  { value: "html", label: "HTML (.html)" },
  { value: "css", label: "CSS (.css)" },
  { value: "shell", label: "Shell / Bash (.sh)" },
];

const MAX_CHARS = 65536;

export function ReviewForm({
  onSubmit,
  isLoading,
  isAuthenticated = false,
  onSignIn,
}: ReviewFormProps) {
  const [sourceCode, setSourceCode] = useState(SAMPLE_SNIPPETS[0].code);
  const [language, setLanguage] = useState(SAMPLE_SNIPPETS[0].language);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSelectSample = (sampleId: string) => {
    const sample = SAMPLE_SNIPPETS.find((s) => s.id === sampleId);
    if (sample) {
      setSourceCode(sample.code);
      setLanguage(sample.language);
      setValidationError(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Tab key support in textarea
    if (e.key === "Tab") {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const updated =
        sourceCode.substring(0, start) + "  " + sourceCode.substring(end);
      setSourceCode(updated);
      requestAnimationFrame(() => {
        target.selectionStart = target.selectionEnd = start + 2;
      });
    }

    // Ctrl/Cmd + Enter submit shortcut
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setValidationError(null);

    // If user is not authenticated, prompt sign in directly
    if (!isAuthenticated) {
      if (onSignIn) {
        onSignIn();
      } else {
        setValidationError("Please sign in with GitHub to submit a code review.");
      }
      return;
    }

    const trimmed = sourceCode.trim();
    if (!trimmed) {
      setValidationError("Please paste or type source code to review.");
      return;
    }

    if (sourceCode.length > MAX_CHARS) {
      setValidationError(
        `Source code exceeds maximum allowed size of ${MAX_CHARS.toLocaleString()} characters (~64 KB).`,
      );
      return;
    }

    onSubmit(sourceCode, language);
  };

  const lineCount = sourceCode ? sourceCode.split("\n").length : 0;
  const charPercent = Math.min(100, (sourceCode.length / MAX_CHARS) * 100);

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6 shadow-sm"
    >
      <div className="flex flex-col gap-4">
        {/* Sample Snippet Selector */}
        <div>
          <div className="flex items-center justify-between text-xs font-medium text-[var(--text-secondary)] mb-2">
            <span>Quick Samples:</span>
            <span className="text-[var(--text-muted)] font-mono text-[11px]">Click to load test scenario</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {SAMPLE_SNIPPETS.map((sample) => (
              <button
                key={sample.id}
                type="button"
                onClick={() => handleSelectSample(sample.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  sourceCode === sample.code
                    ? "chip-btn-active shadow-sm"
                    : "chip-btn-inactive"
                }`}
              >
                {sample.name}
              </button>
            ))}
          </div>
        </div>

        {/* Language selector & Header controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-3">
            <label
              htmlFor="language-select"
              className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider"
            >
              Language:
            </label>
            <select
              id="language-select"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              disabled={isLoading}
              className="input-theme rounded-md px-3 py-1.5 text-xs font-medium shadow-sm disabled:opacity-60"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.value} value={lang.value} className="bg-[var(--surface)] text-[var(--text)]">
                  {lang.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono text-[var(--text-muted)]">
            <span>{lineCount} lines</span>
            <span>
              {sourceCode.length.toLocaleString()} / {MAX_CHARS.toLocaleString()}{" "}
              chars
            </span>
          </div>
        </div>

        {/* Source Code Textarea */}
        <div className="input-theme relative rounded-lg font-mono text-sm overflow-hidden bg-[var(--surface-raised)]">
          <textarea
            id="source-code-editor"
            value={sourceCode}
            onChange={(e) => {
              setSourceCode(e.target.value);
              if (validationError) setValidationError(null);
            }}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            rows={14}
            placeholder="// Paste your code here to begin AI security, quality, and performance review..."
            className="w-full resize-y bg-transparent p-4 font-mono text-xs sm:text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none leading-relaxed"
            spellCheck={false}
          />

          {/* Size indicator bar at the bottom */}
          <div className="h-1 w-full bg-[var(--border)]">
            <div
              className={`h-full transition-all duration-300 ${
                charPercent > 90
                  ? "bg-[var(--severity-critical)]"
                  : charPercent > 70
                    ? "bg-[var(--severity-medium)]"
                    : "bg-[var(--accent-green)]"
              }`}
              style={{ width: `${charPercent}%` }}
            />
          </div>
        </div>

        {/* Validation Error Message */}
        {validationError && (
          <div className="flex items-center gap-2 rounded-lg border border-[var(--severity-critical-border)] bg-[var(--severity-critical-tint)] px-3.5 py-2.5 text-xs text-[var(--severity-critical)]">
            <svg
              className="h-4 w-4 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span>{validationError}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <kbd className="rounded border border-[var(--border)] bg-[var(--surface-raised)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--text)]">
              Ctrl
            </kbd>{" "}
            +{" "}
            <kbd className="rounded border border-[var(--border)] bg-[var(--surface-raised)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--text)]">
              Enter
            </kbd>{" "}
            to run review
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setSourceCode("");
                setValidationError(null);
              }}
              disabled={isLoading || !sourceCode}
              className="rounded-lg px-3.5 py-2 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-raised)] hover:text-[var(--text)] disabled:opacity-40"
            >
              Clear
            </button>

            <button
              id="submit-review-button"
              type="submit"
              disabled={isLoading}
              className="btn-primary inline-flex items-center gap-2 rounded-lg px-5 py-2 text-xs font-semibold shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <svg
                    className="h-4 w-4 animate-spin text-[var(--text-on-green)]"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.37 0 0 5.37 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span>Analyzing Code...</span>
                </>
              ) : !isAuthenticated ? (
                <>
                  <svg
                    className="h-4 w-4 fill-[var(--text-on-green)]"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                  </svg>
                  <span>Sign In with GitHub to Review</span>
                </>
              ) : (
                <>
                  <svg
                    className="h-4 w-4 text-[var(--text-on-green)]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                  </svg>
                  <span>Start AI Review</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
