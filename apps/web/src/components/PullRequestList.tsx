"use client";

import { useEffect, useState } from "react";
import { GithubRepository, GitHubPullRequest } from "../types/github";

interface PullRequestListProps {
  apiBaseUrl: string;
  repository: GithubRepository;
  onBack: () => void;
  onReviewPR: (repoId: string, pullNumber: number) => Promise<void>;
  isReviewLoading: boolean;
}

export function PullRequestList({
  apiBaseUrl,
  repository,
  onBack,
  onReviewPR,
  isReviewLoading,
}: PullRequestListProps) {
  const [pullRequests, setPullRequests] = useState<GitHubPullRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewingPrNumber, setReviewingPrNumber] = useState<number | null>(null);

  useEffect(() => {
    async function loadPRs() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `${apiBaseUrl}/github/repositories/${repository.id}/pulls`,
          { credentials: "include" },
        );
        if (!res.ok) {
          throw new Error(`Failed to load pull requests (HTTP ${res.status})`);
        }
        const data = await res.json();
        setPullRequests(data || []);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load pull requests");
      } finally {
        setIsLoading(false);
      }
    }

    loadPRs();
  }, [apiBaseUrl, repository.id]);

  const handleAuditPR = async (prNumber: number) => {
    setReviewingPrNumber(prNumber);
    try {
      await onReviewPR(repository.id, prNumber);
    } finally {
      setReviewingPrNumber(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Top Header */}
      <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-[var(--surface-raised)] hover:text-[var(--text)] transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[var(--text)] text-sm">{repository.fullName}</span>
              <span className="rounded bg-[var(--surface-raised)] border border-[var(--border)] text-[var(--text-secondary)] px-2 py-0.5 text-[10px] font-semibold uppercase">
                Pull Requests
              </span>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Select any open pull request to perform an automated code security audit.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-[var(--severity-critical-border)] bg-[var(--severity-critical-tint)] p-4 text-xs text-[var(--severity-critical)]">
          {error}
        </div>
      )}

      {/* Pull Requests List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] animate-pulse" />
          ))}
        </div>
      ) : pullRequests.length > 0 ? (
        <div className="space-y-3">
          {pullRequests.map((pr) => {
            const isAuditingThisPr = isReviewLoading && reviewingPrNumber === pr.number;
            return (
              <div
                key={pr.number}
                className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 hover:border-[var(--accent-green)] transition-colors shadow-sm"
              >
                <div className="flex-1 min-w-[280px]">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-xs text-[var(--accent-green-light)] font-semibold">
                      #{pr.number}
                    </span>
                    <h3 className="font-semibold text-sm text-[var(--text)]">
                      {pr.title}
                    </h3>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[var(--text-secondary)]">
                    <span>
                      by <strong className="text-[var(--text)]">@{pr.author}</strong>
                    </span>
                    <span>&bull;</span>
                    <span className="font-mono text-[11px] text-[var(--text-secondary)]">
                      {pr.headRef}
                    </span>
                    <span>&bull;</span>
                    <span className="text-[11px] text-[var(--text-muted)]">
                      Updated {new Date(pr.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <a
                    href={pr.htmlUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary rounded-lg px-3 py-1.5 text-xs font-medium hover:border-[var(--accent-green)] hover:text-[var(--accent-green-light)] transition-colors"
                  >
                    View on GitHub &rarr;
                  </a>

                  <button
                    type="button"
                    disabled={isReviewLoading}
                    onClick={() => handleAuditPR(pr.number)}
                    className="btn-primary inline-flex items-center gap-2 rounded-lg px-4 py-1.5 text-xs font-semibold shadow-sm disabled:opacity-50 transition-colors"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    <span>{isAuditingThisPr ? "Auditing..." : "Audit Pull Request"}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] p-10 text-center">
          <svg className="h-10 w-10 text-[var(--text-muted)] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          <p className="text-sm font-medium text-[var(--text)]">No open pull requests</p>
          <p className="mt-1 text-xs text-[var(--text-secondary)] max-w-sm">
            There are currently no open pull requests in {repository.fullName}.
          </p>
        </div>
      )}
    </div>
  );
}
