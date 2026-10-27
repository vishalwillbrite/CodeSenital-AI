"use client";

import { useState } from "react";
import { Finding, Severity } from "../types/review";

interface FindingCardProps {
  finding: Finding;
  index: number;
}

const severityConfig: Record<
  Severity,
  {
    label: string;
    badgeBg: string;
    badgeText: string;
    border: string;
    glow: string;
  }
> = {
  CRITICAL: {
    label: "Critical",
    badgeBg: "bg-[var(--severity-critical-tint)]",
    badgeText: "text-[var(--severity-critical)]",
    border: "border-[var(--severity-critical-border)]",
    glow: "",
  },
  HIGH: {
    label: "High",
    badgeBg: "bg-[var(--severity-high-tint)]",
    badgeText: "text-[var(--severity-high)]",
    border: "border-[var(--severity-high-border)]",
    glow: "",
  },
  MEDIUM: {
    label: "Medium",
    badgeBg: "bg-[var(--severity-medium-tint)]",
    badgeText: "text-[var(--severity-medium)]",
    border: "border-[var(--severity-medium-border)]",
    glow: "",
  },
  LOW: {
    label: "Low",
    badgeBg: "bg-[var(--severity-low-tint)]",
    badgeText: "text-[var(--severity-low)]",
    border: "border-[var(--severity-low-border)]",
    glow: "",
  },
  INFO: {
    label: "Info",
    badgeBg: "bg-[var(--surface-raised)]",
    badgeText: "text-[var(--text-muted)]",
    border: "border-[var(--border)]",
    glow: "",
  },
};

const categoryLabels: Record<string, string> = {
  security: "Security Risk",
  bug: "Bug / Defect",
  performance: "Performance",
  readability: "Readability",
  "best-practice": "Best Practice",
};

export function FindingCard({ finding, index }: FindingCardProps) {
  const [copied, setCopied] = useState(false);
  const severity = finding.severity || "MEDIUM";
  const config = severityConfig[severity] || severityConfig.MEDIUM;

  const handleCopyFix = async () => {
    if (!finding.suggestedFix) return;
    await navigator.clipboard.writeText(finding.suggestedFix);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lineReference =
    finding.lineStart !== null && finding.lineStart !== undefined
      ? finding.lineEnd && finding.lineEnd !== finding.lineStart
        ? `Lines ${finding.lineStart}–${finding.lineEnd}`
        : `Line ${finding.lineStart}`
      : null;

  return (
    <div
      className={`rounded-lg border bg-[var(--surface)] p-5 transition-colors hover:border-[var(--accent-green)] ${config.border}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${config.badgeBg} ${config.badgeText}`}
          >
            {config.label}
          </span>
          <span className="inline-flex items-center rounded-md bg-[var(--surface-raised)] border border-[var(--border)] px-2.5 py-0.5 text-xs font-medium text-[var(--text-secondary)]">
            {categoryLabels[finding.category.toLowerCase()] || finding.category}
          </span>
          {lineReference && (
            <span className="inline-flex items-center gap-1 rounded-md bg-[var(--surface-raised)] px-2.5 py-0.5 font-mono text-xs font-medium text-[var(--text-secondary)] border border-[var(--border)]">
              <svg
                className="h-3 w-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 20l4-16m2 16l4-16"
                />
              </svg>
              {lineReference}
            </span>
          )}
        </div>
        <span className="text-xs font-mono text-[var(--text-muted)]">#{index + 1}</span>
      </div>

      <div className="mt-3">
        <h3 className="text-base font-semibold text-[var(--text)]">{finding.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)] whitespace-pre-wrap">
          {finding.description}
        </p>
      </div>

      {finding.suggestedFix && (
        <div className="mt-4 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface-raised)]">
          <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-3.5 py-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-[var(--accent-green-light)]">
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
              Suggested Correction
            </span>
            <button
              onClick={handleCopyFix}
              type="button"
              className="btn-secondary inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium hover:border-[var(--accent-green)]"
              title="Copy suggested fix to clipboard"
            >
              {copied ? (
                <>
                  <svg
                    className="h-3 w-3 text-[var(--accent-green)]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span className="text-[var(--accent-green)]">Copied!</span>
                </>
              ) : (
                <>
                  <svg
                    className="h-3 w-3 text-[var(--text-muted)]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                  <span>Copy Fix</span>
                </>
              )}
            </button>
          </div>
          <pre className="overflow-x-auto p-3.5 font-mono text-xs text-[var(--accent-green-light)] leading-relaxed selection:bg-[var(--accent-tint)]">
            <code>{finding.suggestedFix}</code>
          </pre>
        </div>
      )}
    </div>
  );
}
