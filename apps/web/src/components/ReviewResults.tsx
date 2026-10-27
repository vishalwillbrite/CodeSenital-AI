"use client";

import { useState } from "react";
import { ReviewResponse, Severity } from "../types/review";
import { FindingCard } from "./FindingCard";

interface ReviewResultsProps {
  review: ReviewResponse;
  onBack?: () => void;
}

const overallRiskBadgeConfig = {
  high: {
    label: "High Risk",
    textColor: "text-[var(--severity-critical)]",
    bgColor: "bg-[var(--severity-critical-tint)]",
    borderColor: "border-[var(--severity-critical-border)]",
    dotColor: "bg-[var(--severity-critical)]",
    glow: "",
    iconColor: "text-[var(--severity-critical)]",
  },
  medium: {
    label: "Medium Risk",
    textColor: "text-[var(--severity-medium)]",
    bgColor: "bg-[var(--severity-medium-tint)]",
    borderColor: "border-[var(--severity-medium-border)]",
    dotColor: "bg-[var(--severity-medium)]",
    glow: "",
    iconColor: "text-[var(--severity-medium)]",
  },
  low: {
    label: "Low Risk",
    textColor: "text-[var(--severity-low)]",
    bgColor: "bg-[var(--severity-low-tint)]",
    borderColor: "border-[var(--severity-low-border)]",
    dotColor: "bg-[var(--severity-low)]",
    glow: "",
    iconColor: "text-[var(--severity-low)]",
  },
  none: {
    label: "Clean / No Risk",
    textColor: "text-[var(--severity-pass)]",
    bgColor: "bg-[var(--severity-pass-tint)]",
    borderColor: "border-[var(--severity-pass-border)]",
    dotColor: "bg-[var(--severity-pass)]",
    glow: "",
    iconColor: "text-[var(--severity-pass)]",
  },
};

export function ReviewResults({ review, onBack }: ReviewResultsProps) {
  const [copied, setCopied] = useState(false);
  const [selectedSeverity, setSelectedSeverity] = useState<string>("ALL");
  const [showSourceCode, setShowSourceCode] = useState(false);

  const riskKey = (review.overallRisk?.toLowerCase() ||
    "medium") as keyof typeof overallRiskBadgeConfig;
  const riskBadge =
    overallRiskBadgeConfig[riskKey] || overallRiskBadgeConfig.medium;

  // Counts by severity
  const counts: Record<Severity, number> = {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
    INFO: 0,
  };

  review.findings?.forEach((f) => {
    const sev = (f.severity || "MEDIUM").toUpperCase() as Severity;
    if (counts[sev] !== undefined) {
      counts[sev]++;
    }
  });

  const filteredFindings = (review.findings || []).filter((f) => {
    if (selectedSeverity === "ALL") return true;
    return (f.severity || "MEDIUM").toUpperCase() === selectedSeverity;
  });

  const generateMarkdownReport = () => {
    let md = `# CodeSentinel AI Code Review Report\n\n`;
    md += `**Date:** ${new Date(review.createdAt).toLocaleString()}\n`;
    md += `**Language:** ${review.language}\n`;
    md += `**Overall Risk:** ${(review.overallRisk || "none").toUpperCase()}\n`;
    md += `**Total Findings:** ${review.findings?.length || 0}\n\n`;
    md += `## Executive Summary\n${review.summary || "No summary provided."}\n\n`;

    if (review.findings?.length) {
      md += `## Findings & Recommendations\n\n`;
      review.findings.forEach((f, idx) => {
        md += `### ${idx + 1}. [${f.severity}] ${f.title}\n`;
        md += `- **Category:** ${f.category}\n`;
        if (f.lineStart !== null && f.lineStart !== undefined) {
          md += `- **Lines:** ${f.lineStart}${
            f.lineEnd && f.lineEnd !== f.lineStart ? `-${f.lineEnd}` : ""
          }\n`;
        }
        md += `\n**Description:**\n${f.description}\n\n`;
        if (f.suggestedFix) {
          md += `**Suggested Fix:**\n\`\`\`${review.language}\n${f.suggestedFix}\n\`\`\`\n\n`;
        }
      });
    } else {
      md += `## Findings\nNo defects, vulnerabilities, or quality issues detected.\n\n`;
    }

    md += `---\n*Disclaimer: ${
      review.disclaimer ||
      "AI-generated review findings are advisory recommendations, not guaranteed vulnerabilities."
    }*\n`;
    return md;
  };

  const handleCopyReport = async () => {
    const reportText = generateMarkdownReport();
    await navigator.clipboard.writeText(reportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const lines = review.sourceCode ? review.sourceCode.split("\n") : [];

  return (
    <div className="flex flex-col gap-6 animate-fadeIn">
      {/* Header Overview Card */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] pb-5">
          <div className="flex flex-wrap items-center gap-3">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="btn-secondary inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold hover:border-[var(--accent-green)]"
              >
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
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
                <span>Back</span>
              </button>
            )}

            <div
              className={`flex items-center gap-2 rounded-lg border px-3.5 py-1.5 font-semibold text-xs ${riskBadge.bgColor} ${riskBadge.borderColor} ${riskBadge.textColor}`}
            >
              <span className={`inline-block h-2 w-2 rounded-full ${riskBadge.dotColor}`} />
              <span>{riskBadge.label}</span>
            </div>

            <span className="rounded-md bg-[var(--surface-raised)] border border-[var(--border)] px-2.5 py-1 text-xs font-mono font-medium text-[var(--text-secondary)] uppercase">
              {review.language}
            </span>

            <span className="text-xs font-mono text-[var(--text-muted)]">
              {review.findings?.length || 0} finding
              {review.findings?.length === 1 ? "" : "s"} identified
            </span>

            {review.repository && (
              <span className="flex items-center gap-1.5 rounded-md bg-[var(--surface-raised)] border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--text-secondary)] font-mono">
                <svg className="h-3.5 w-3.5 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                <span>{review.repository.fullName}</span>
              </span>
            )}

            {review.filePath && (
              <span className="rounded-md bg-[var(--surface-raised)] border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--text-secondary)] font-mono">
                {review.filePath}
              </span>
            )}

            {review.pullNumber && (
              <span className="rounded-md bg-[var(--accent-tint)] border border-[var(--accent-green)]/30 px-2.5 py-1 text-xs text-[var(--accent-green-light)] font-mono">
                PR #{review.pullNumber}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSourceCode(!showSourceCode)}
              className="btn-secondary inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold hover:border-[var(--accent-green)]"
            >
              <svg
                className="h-3.5 w-3.5 text-[var(--text-muted)]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                />
              </svg>
              <span>{showSourceCode ? "Hide Code" : "View Code"}</span>
            </button>

            <button
              id="copy-report-button"
              type="button"
              onClick={handleCopyReport}
              className="btn-secondary inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold hover:border-[var(--accent-green)]"
            >
              {copied ? (
                <>
                  <svg
                    className="h-4 w-4 text-[var(--accent-green)]"
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
                  <span className="text-[var(--accent-green)]">Report Copied!</span>
                </>
              ) : (
                <>
                  <svg
                    className="h-4 w-4 text-[var(--text-muted)]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                    />
                  </svg>
                  <span>Copy Report</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Expandable Source Code Viewer */}
        {showSourceCode && review.sourceCode && (
          <div className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-4 font-mono text-xs overflow-x-auto">
            <div className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Submitted Source ({review.language})</span>
              <span>{lines.length} lines</span>
            </div>
            <pre className="text-[var(--text)] leading-relaxed font-mono">
              {lines.map((line, idx) => (
                <div key={idx} className="flex">
                  <span className="w-10 select-none text-right pr-4 text-[var(--text-muted)]">
                    {idx + 1}
                  </span>
                  <span className="flex-1">{line || " "}</span>
                </div>
              ))}
            </pre>
          </div>
        )}

        {/* Summary text */}
        <div className="mt-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Executive Summary
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--text)]">
            {review.summary || "No executive summary provided."}
          </p>
        </div>

        {/* Severity Metrics Bar */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {(
            [
              {
                key: "CRITICAL",
                label: "Critical",
                text: "text-[var(--severity-critical)]",
                border: "border-[var(--severity-critical-border)]",
              },
              {
                key: "HIGH",
                label: "High",
                text: "text-[var(--severity-high)]",
                border: "border-[var(--severity-high-border)]",
              },
              {
                key: "MEDIUM",
                label: "Medium",
                text: "text-[var(--severity-medium)]",
                border: "border-[var(--severity-medium-border)]",
              },
              {
                key: "LOW",
                label: "Low",
                text: "text-[var(--severity-low)]",
                border: "border-[var(--severity-low-border)]",
              },
              {
                key: "INFO",
                label: "Info",
                text: "text-[var(--text-muted)]",
                border: "border-[var(--border)]",
              },
            ] as const
          ).map((item) => (
            <div
              key={item.key}
              className={`rounded-lg border bg-[var(--surface-raised)] p-3 text-center ${item.border}`}
            >
              <div className={`text-xl font-bold font-mono ${item.text}`}>
                {counts[item.key]}
              </div>
              <div className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider mt-0.5">
                {item.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Findings Section */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-[var(--text)] flex items-center gap-2">
            <span>Detailed Findings</span>
            <span className="rounded-full bg-[var(--surface-raised)] border border-[var(--border)] px-2.5 py-0.5 text-xs text-[var(--text-secondary)] font-mono">
              {filteredFindings.length}
            </span>
          </h2>

          {/* Severity filter tabs */}
          {review.findings?.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1 text-xs">
              {["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"].map(
                (sev) => (
                  <button
                    key={sev}
                    type="button"
                    onClick={() => setSelectedSeverity(sev)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      selectedSeverity === sev
                        ? "tab-btn-active"
                        : "tab-btn-inactive"
                    }`}
                  >
                    {sev}
                  </button>
                ),
              )}
            </div>
          )}
        </div>

        {/* Empty-result state: 0 findings */}
        {review.findings?.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] p-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent-tint)] border border-[var(--severity-pass-border)] text-[var(--accent-green)] mb-3">
              <svg
                className="h-6 w-6"
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
            </div>
            <h3 className="text-base font-semibold text-[var(--text)]">
              Clean Code Approved
            </h3>
            <p className="mt-1.5 max-w-md text-xs text-[var(--text-secondary)] leading-relaxed">
              No bugs, vulnerabilities, performance issues, or bad practices
              were detected in this snippet. The code adheres to standards.
            </p>
          </div>
        ) : filteredFindings.length === 0 ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--text-muted)]">
            No findings match the selected severity filter ({selectedSeverity}).
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {filteredFindings.map((finding, index) => (
              <FindingCard
                key={finding.id || `finding-${index}`}
                finding={finding}
                index={index}
              />
            ))}
          </div>
        )}
      </div>

      {/* Advisory Disclaimer Notice */}
      <div className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-4 text-xs text-[var(--text-secondary)]">
        <svg
          className="h-4 w-4 shrink-0 text-[var(--text-muted)] mt-0.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <p className="leading-relaxed">
          <strong className="text-[var(--text)]">Advisory Disclaimer:</strong>{" "}
          {review.disclaimer ||
            "AI-generated review findings are advisory recommendations and potential issues detected through automated heuristic analysis. They are not guaranteed vulnerabilities or certified security assessments."}
        </p>
      </div>
    </div>
  );
}
