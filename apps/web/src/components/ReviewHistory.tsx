"use client";

import { useEffect, useState } from "react";
import { PaginatedReviewsResponse, ReviewHistoryItem } from "../types/review";

interface ReviewHistoryProps {
  apiBaseUrl: string;
  onSelectReview: (id: string) => void;
  onNewReview: () => void;
  isAuthenticated?: boolean;
  onSignIn?: () => void;
}

const riskBadgeConfig = {
  high: {
    label: "High Risk",
    textColor: "text-[var(--severity-critical)]",
    bgColor: "bg-[var(--severity-critical-tint)]",
    borderColor: "border-[var(--severity-critical-border)]",
  },
  medium: {
    label: "Medium Risk",
    textColor: "text-[var(--severity-medium)]",
    bgColor: "bg-[var(--severity-medium-tint)]",
    borderColor: "border-[var(--severity-medium-border)]",
  },
  low: {
    label: "Low Risk",
    textColor: "text-[var(--severity-low)]",
    bgColor: "bg-[var(--severity-low-tint)]",
    borderColor: "border-[var(--severity-low-border)]",
  },
  none: {
    label: "Clean",
    textColor: "text-[var(--severity-pass)]",
    bgColor: "bg-[var(--severity-pass-tint)]",
    borderColor: "border-[var(--severity-pass-border)]",
  },
};

export function ReviewHistory({
  apiBaseUrl,
  onSelectReview,
  onNewReview,
  isAuthenticated = false,
  onSignIn,
}: ReviewHistoryProps) {
  const [data, setData] = useState<PaginatedReviewsResponse | null>(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthError, setIsAuthError] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) {
      setIsLoading(false);
      setIsAuthError(true);
      return;
    }

    let isCancelled = false;
    const controller = new AbortController();

    async function loadHistory() {
      setIsLoading(true);
      setIsAuthError(false);
      try {
        const res = await fetch(
          `${apiBaseUrl}/reviews?page=${page}&limit=10`,
          {
            signal: controller.signal,
            credentials: "include",
          },
        );
        if (res.status === 401) {
          setIsAuthError(true);
          throw new Error("Authentication required to view your private review history.");
        }
        if (!res.ok) {
          throw new Error(`Failed to load review history (HTTP ${res.status})`);
        }
        const json = (await res.json()) as PaginatedReviewsResponse;
        if (!isCancelled) {
          setData(json);
          setError(null);
          setIsLoading(false);
        }
      } catch (err: unknown) {
        if (!isCancelled && (err as Error).name !== "AbortError") {
          setError(
            err instanceof Error
              ? err.message
              : "An unexpected error occurred while loading review history.",
          );
          setIsLoading(false);
        }
      }
    }

    loadHistory();

    return () => {
      isCancelled = true;
      controller.abort();
    };
  }, [apiBaseUrl, page, refreshTrigger]);

  const handleRefresh = () => {
    setIsLoading(true);
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div>
          <h2 className="text-lg font-bold text-[var(--text)] flex items-center gap-2">
            <span>Audit & Review History</span>
            {data?.meta && (
              <span className="rounded-full bg-[var(--surface-raised)] border border-[var(--border)] px-2.5 py-0.5 text-xs font-medium text-[var(--text-secondary)]">
                {data.meta.total} {data.meta.total === 1 ? "review" : "reviews"}
              </span>
            )}
          </h2>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Persisted code audits with findings, overall risk levels, and timestamps.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="btn-secondary inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium hover:border-[var(--accent-green)] disabled:opacity-50"
            title="Refresh history"
          >
            <svg
              className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Refresh
          </button>
          <button
            onClick={onNewReview}
            className="btn-primary inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold shadow-sm"
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
                d="M12 4v16m8-8H4"
              />
            </svg>
            New Review
          </button>
        </div>
      </div>

      {/* Unauthenticated State */}
      {(!isAuthenticated || isAuthError) && (
        <div className="mt-6 flex flex-col items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-8 sm:p-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--surface)] text-[var(--accent-green)] mb-4 border border-[var(--border)]">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h3 className="text-base font-bold text-[var(--text)]">
            Private Review History
          </h3>
          <p className="mt-2 max-w-md text-xs text-[var(--text-secondary)] leading-relaxed">
            Review history is protected and scoped strictly to your authenticated account.
            Sign in with GitHub to view your previous code security audits and findings.
          </p>
          <button
            type="button"
            onClick={onSignIn}
            className="btn-primary mt-6 inline-flex items-center gap-2.5 rounded-lg px-5 py-2 text-xs font-semibold shadow-sm"
          >
            <svg className="h-4 w-4 fill-[var(--text-on-green)]" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            <span>Continue with GitHub</span>
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && isAuthenticated && (
        <div className="mt-6 space-y-3">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="h-20 w-full animate-pulse rounded-xl border border-[var(--border)] bg-[var(--surface-raised)]"
            />
          ))}
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && isAuthenticated && !isAuthError && (
        <div className="mt-6 rounded-xl border border-[var(--severity-critical-border)] bg-[var(--severity-critical-tint)] p-5 text-center">
          <p className="text-xs text-[var(--severity-critical)]">{error}</p>
          <button
            onClick={handleRefresh}
            className="mt-3 inline-flex items-center rounded-lg bg-[var(--severity-critical)] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:opacity-90"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && data?.items.length === 0 && (
        <div className="mt-6 flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--surface-raised)] text-[var(--text-muted)] mb-3 border border-[var(--border)]">
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-[var(--text)]">
            No Code Reviews Recorded Yet
          </h3>
          <p className="mt-1 max-w-sm text-xs text-[var(--text-secondary)]">
            Submit your first code snippet in the Workspace tab to run an AI audit and persist the findings.
          </p>
          <button
            onClick={onNewReview}
            className="btn-primary mt-4 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold shadow-sm"
          >
            Start Your First Review
          </button>
        </div>
      )}

      {/* Reviews List */}
      {!isLoading && !error && data && data.items.length > 0 && (
        <div className="mt-5 space-y-3">
          {data.items.map((item: ReviewHistoryItem) => {
            const riskKey = (item.overallRisk?.toLowerCase() ||
              "medium") as keyof typeof riskBadgeConfig;
            const riskStyle = riskBadgeConfig[riskKey] || riskBadgeConfig.medium;
            const findingCount = item._count?.findings ?? 0;
            const formattedDate = new Date(item.createdAt).toLocaleString(
              undefined,
              {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              },
            );

            return (
              <div
                key={item.id}
                onClick={() => onSelectReview(item.id)}
                className="group relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 transition-colors hover:border-[var(--accent-green)] hover:bg-[var(--surface-raised)] cursor-pointer"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <span className="inline-flex items-center rounded-md bg-[var(--surface-raised)] border border-[var(--border)] px-2 py-0.5 font-mono text-[11px] font-medium text-[var(--text-secondary)] uppercase">
                      {item.language}
                    </span>

                    {/* Status badge */}
                    {item.status === "COMPLETED" && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-[var(--severity-pass-tint)] border border-[var(--severity-pass-border)] px-2 py-0.5 text-[11px] font-medium text-[var(--severity-pass)]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[var(--severity-pass)]" />
                        Completed
                      </span>
                    )}
                    {item.status === "FAILED" && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-[var(--severity-critical-tint)] border border-[var(--severity-critical-border)] px-2 py-0.5 text-[11px] font-medium text-[var(--severity-critical)]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[var(--severity-critical)]" />
                        Failed
                      </span>
                    )}
                    {item.status === "PENDING" && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-[var(--severity-medium-tint)] border border-[var(--severity-medium-border)] px-2 py-0.5 text-[11px] font-medium text-[var(--severity-medium)]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[var(--severity-medium)] animate-pulse" />
                        Pending
                      </span>
                    )}

                    {/* Overall Risk Badge */}
                    {item.overallRisk && (
                      <span
                        className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${riskStyle.bgColor} ${riskStyle.textColor} ${riskStyle.borderColor}`}
                      >
                        {riskStyle.label}
                      </span>
                    )}

                    {/* Findings Count */}
                    <span className="inline-flex items-center gap-1 rounded-md bg-[var(--surface-raised)] border border-[var(--border)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-secondary)]">
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
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                      </svg>
                      {findingCount} {findingCount === 1 ? "finding" : "findings"}
                    </span>

                    {/* Repository / PR metadata */}
                    {item.repository && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-[var(--surface-raised)] border border-[var(--border)] px-2 py-0.5 text-[11px] font-mono text-[var(--text-secondary)]">
                        <svg className="h-3 w-3 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                        <span>{item.repository.fullName}</span>
                        {item.filePath ? `:${item.filePath}` : item.pullNumber ? ` (PR #${item.pullNumber})` : ""}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-[var(--text)] line-clamp-1">
                    {item.summary ||
                      item.errorMessage ||
                      "Code review in progress or completed."}
                  </p>

                  <div className="mt-1 flex items-center gap-3 text-[11px] text-[var(--text-muted)]">
                    <span>{formattedDate}</span>
                    <span>•</span>
                    <span className="font-mono text-[var(--text-secondary)]">ID: {item.id.slice(0, 8)}...</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <span className="btn-secondary inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium group-hover:border-[var(--accent-green)] group-hover:text-[var(--accent-green-light)]">
                    <span>View Report</span>
                    <svg
                      className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </span>
                </div>
              </div>
            );
          })}

          {/* Pagination Controls */}
          {data.meta.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-[var(--border)] pt-4 mt-4">
              <span className="text-xs text-[var(--text-secondary)]">
                Page {data.meta.page} of {data.meta.totalPages} ({data.meta.total} total items)
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsLoading(true);
                    setPage((p) => Math.max(1, p - 1));
                  }}
                  disabled={data.meta.page <= 1 || isLoading}
                  className="btn-secondary rounded-lg px-3 py-1.5 text-xs font-medium hover:border-[var(--accent-green)] disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsLoading(true);
                    setPage((p) => Math.min(data.meta.totalPages, p + 1));
                  }}
                  disabled={data.meta.page >= data.meta.totalPages || isLoading}
                  className="btn-secondary rounded-lg px-3 py-1.5 text-xs font-medium hover:border-[var(--accent-green)] disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
