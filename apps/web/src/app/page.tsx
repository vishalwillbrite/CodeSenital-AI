"use client";

import { useEffect, useState } from "react";
import { ReviewForm } from "../components/ReviewForm";
import { ReviewResults } from "../components/ReviewResults";
import { ReviewHistory } from "../components/ReviewHistory";
import { RepositoryList } from "../components/RepositoryList";
import { FileTreeExplorer } from "../components/FileTreeExplorer";
import { PullRequestList } from "../components/PullRequestList";
import { SettingsModal } from "../components/SettingsModal";
import { useThemePreferences } from "../components/useThemePreferences";
import { ReviewResponse, ReviewErrorResponse, AuthUser } from "../types/review";
import { GithubRepository } from "../types/github";
import { Logo, CodeSentinelIcon } from "../components/Logo";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type ActiveTab = "workspace" | "repositories" | "history";

export default function Home() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("workspace");
  const [review, setReview] = useState<ReviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMissingApiKey, setIsMissingApiKey] = useState(false);

  // Repository exploration state
  const [selectedRepoForFiles, setSelectedRepoForFiles] = useState<GithubRepository | null>(null);
  const [selectedRepoForPRs, setSelectedRepoForPRs] = useState<GithubRepository | null>(null);

  // Authentication state
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Settings modal & theme preferences
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { themeMode, setThemeMode, accentColor, setAccentColor } = useThemePreferences();

  // On initial mount: extract OAuth callback errors and verify authenticated user session
  useEffect(() => {
    // 1. Check for ?auth_error in URL query
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const errorParam = urlParams.get("auth_error");
      if (errorParam) {
        setAuthError(decodeURIComponent(errorParam));
        // Clean URL to prevent error banner lingering on page refreshes
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
      }
    }

    // 2. Query /auth/me with credentials to check active session
    async function checkAuthSession() {
      try {
        const res = await fetch(`${API_BASE_URL}/auth/me`, {
          credentials: "include",
        });
        if (res.ok) {
          const data = (await res.json()) as { user: AuthUser };
          setUser(data.user);
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      } finally {
        setIsAuthLoading(false);
      }
    }

    checkAuthSession();
  }, []);

  const handleSignIn = () => {
    const returnPath = typeof window !== "undefined" ? window.location.pathname : "/";
    window.location.href = `${API_BASE_URL}/auth/github?returnTo=${encodeURIComponent(returnPath)}`;
  };

  const handleSignOut = async () => {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // ignore
    }
    setUser(null);
    setReview(null);
  };

  // Handles review submission from workspace
  const handleReviewSubmit = async (sourceCode: string, language: string) => {
    if (!user) {
      handleSignIn();
      return;
    }

    setIsLoading(true);
    setError(null);
    setIsMissingApiKey(false);
    setReview(null);

    try {
      const response = await fetch(`${API_BASE_URL}/reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          sourceCode,
          language,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorData = data as ReviewErrorResponse;
        let errorMsg = "Failed to complete AI review.";

        if (Array.isArray(errorData.message)) {
          errorMsg = errorData.message.join(", ");
        } else if (typeof errorData.message === "string") {
          errorMsg = errorData.message;
        }

        if (
          errorMsg.toLowerCase().includes("gemini_api_key") ||
          errorMsg.toLowerCase().includes("not configured")
        ) {
          setIsMissingApiKey(true);
        }

        if (response.status === 401) {
          setUser(null);
          errorMsg = "Your session has expired. Please sign in with GitHub again.";
        }

        throw new Error(errorMsg);
      }

      setReview(data as ReviewResponse);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  // Handles selecting a past review from history
  const handleSelectHistoricalReview = async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/reviews/${id}`, {
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 401) {
          setUser(null);
          throw new Error("Session expired. Please sign in with GitHub.");
        }
        if (res.status === 404) {
          throw new Error("Review not found or you do not have permission to access it.");
        }
        throw new Error(`Failed to load review details (HTTP ${res.status})`);
      }
      const data = (await res.json()) as ReviewResponse;
      setReview(data);
      setActiveTab("workspace");
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load historical review details.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Handles reviewing an individual repository file
  const handleReviewRepoFile = async (
    repoId: string,
    filePath: string,
    ref?: string,
  ) => {
    if (!user) {
      handleSignIn();
      return;
    }

    setIsLoading(true);
    setError(null);
    setIsMissingApiKey(false);
    setReview(null);
    setActiveTab("workspace");

    try {
      const response = await fetch(`${API_BASE_URL}/reviews/repository-file`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          repositoryId: repoId,
          filePath,
          ref,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorData = data as ReviewErrorResponse;
        let errorMsg = "Failed to complete AI review.";

        if (Array.isArray(errorData.message)) {
          errorMsg = errorData.message.join(", ");
        } else if (typeof errorData.message === "string") {
          errorMsg = errorData.message;
        }

        if (
          errorMsg.toLowerCase().includes("gemini_api_key") ||
          errorMsg.toLowerCase().includes("not configured")
        ) {
          setIsMissingApiKey(true);
        }

        if (response.status === 401) {
          setUser(null);
          errorMsg = "Your session has expired. Please sign in with GitHub again.";
        }

        throw new Error(errorMsg);
      }

      setReview(data as ReviewResponse);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  // Handles reviewing a pull request
  const handleReviewPR = async (repoId: string, pullNumber: number) => {
    if (!user) {
      handleSignIn();
      return;
    }

    setIsLoading(true);
    setError(null);
    setIsMissingApiKey(false);
    setReview(null);
    setActiveTab("workspace");

    try {
      const response = await fetch(`${API_BASE_URL}/reviews/pull-request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          repositoryId: repoId,
          pullNumber,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorData = data as ReviewErrorResponse;
        let errorMsg = "Failed to complete pull request AI review.";

        if (Array.isArray(errorData.message)) {
          errorMsg = errorData.message.join(", ");
        } else if (typeof errorData.message === "string") {
          errorMsg = errorData.message;
        }

        if (
          errorMsg.toLowerCase().includes("gemini_api_key") ||
          errorMsg.toLowerCase().includes("not configured")
        ) {
          setIsMissingApiKey(true);
        }

        if (response.status === 401) {
          setUser(null);
          errorMsg = "Your session has expired. Please sign in with GitHub again.";
        }

        throw new Error(errorMsg);
      }

      setReview(data as ReviewResponse);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] selection:bg-[var(--accent-tint)] selection:text-[var(--text)]">
      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-8 sm:px-6 lg:px-8">
        {/* Navigation / Header */}
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] pb-5">
          <Logo variant="header" size="md" showAiBadge={true} showSubtitle={true} />

          <div className="flex items-center gap-3">
            {/* Tab Navigation */}
            <div className="flex items-center rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab("workspace")}
                className={`flex items-center gap-1.5 rounded-md px-3.5 py-1.5 font-medium transition-all ${
                  activeTab === "workspace" ? "tab-btn-active" : "tab-btn-inactive"
                }`}
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
                    d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                  />
                </svg>
                <span>Workspace</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab("repositories");
                  setSelectedRepoForFiles(null);
                  setSelectedRepoForPRs(null);
                }}
                className={`flex items-center gap-1.5 rounded-md px-3.5 py-1.5 font-medium transition-all ${
                  activeTab === "repositories" ? "tab-btn-active" : "tab-btn-inactive"
                }`}
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
                    d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                  />
                </svg>
                <span>Repositories</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("history")}
                className={`flex items-center gap-1.5 rounded-md px-3.5 py-1.5 font-medium transition-all ${
                  activeTab === "history" ? "tab-btn-active" : "tab-btn-inactive"
                }`}
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
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>Review History</span>
              </button>
            </div>

            {/* Authenticated User / Sign In Button */}
            {isAuthLoading ? (
              <div className="h-8 w-24 rounded-lg bg-[var(--surface-raised)] animate-pulse border border-[var(--border)]" />
            ) : user ? (
              <div className="flex items-center gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs shadow-sm">
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.username || "User avatar"}
                    className="h-5 w-5 rounded-full border border-[var(--border)] object-cover"
                  />
                ) : (
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--surface-raised)] border border-[var(--border)] text-[10px] font-bold text-[var(--text)]">
                    {(user.name || user.username || "U").slice(0, 1).toUpperCase()}
                  </div>
                )}
                <span className="font-medium text-[var(--text)] hidden sm:inline">
                  {user.name || (user.username ? `@${user.username}` : "Developer")}
                </span>
                <button
                  type="button"
                  onClick={handleSignOut}
                  title="Sign out of CodeSentinel AI"
                  className="ml-1 rounded px-1.5 py-0.5 text-[var(--text-muted)] hover:bg-[var(--surface-raised)] hover:text-[var(--text)] transition-colors text-[11px]"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleSignIn}
                className="btn-primary flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold shadow-sm active:scale-[0.99]"
              >
                <svg className="h-4 w-4 fill-[var(--text-on-green)]" viewBox="0 0 24 24">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
                <span>Continue with GitHub</span>
              </button>
            )}

            {/* Settings Gear Button */}
            <button
              id="settings-gear-button"
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              title="Open Settings (Theme, Accents & Profile)"
              aria-label="Settings"
              className="flex items-center justify-center h-8 w-8 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text)] hover:border-[var(--accent-green)] hover:bg-[var(--surface-raised)] transition-all shadow-sm active:scale-95 shrink-0"
            >
              <svg
                className="h-4 w-4 transition-transform hover:rotate-45"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </button>
          </div>
        </header>

        {/* Hero Section */}
        <div className="py-7 text-center sm:py-9">
          <h2 className="text-2xl font-bold tracking-tight text-[var(--text)] sm:text-3xl">
            Static Security & AI Code Review
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
            Automated AST analysis, security vulnerability scanning, and Gemini-powered remediation recommendations.
          </p>
        </div>

        {/* Main Content Area */}
        <main className="flex flex-1 flex-col gap-8 pb-16">
          {/* OAuth Notification / Error Banner */}
          {authError && (
            <div className="flex items-center justify-between rounded-lg border border-[var(--severity-medium-border)] bg-[var(--severity-medium-tint)] px-4 py-3 text-xs text-[var(--severity-medium)]">
              <div className="flex items-center gap-2.5">
                <svg
                  className="h-4 w-4 shrink-0 text-[var(--severity-medium)]"
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
                <span>{authError}</span>
              </div>
              <button
                type="button"
                onClick={() => setAuthError(null)}
                className="text-[var(--severity-medium)] hover:text-[var(--text)] text-xs font-semibold"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Unauthenticated Workspace Banner */}
          {!user && !isAuthLoading && activeTab === "workspace" && (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-xs text-[var(--text-secondary)]">
              <div className="flex items-center gap-2.5">
                <svg className="h-4 w-4 shrink-0 text-[var(--text-muted)]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
                <span>
                  <strong>Sign in with GitHub</strong> to run AI code reviews and maintain private audit history.
                </span>
              </div>
              <button
                type="button"
                onClick={handleSignIn}
                className="btn-primary rounded-md px-3 py-1.5 text-xs font-semibold shadow-sm transition-colors shrink-0"
              >
                Sign in with GitHub
              </button>
            </div>
          )}

          {/* TAB 1: Code Review Workspace */}
          {activeTab === "workspace" && (
            <>
              {/* If viewing an existing review result, allow going back or submitting another */}
              {review && (
                <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-xs text-[var(--text-secondary)]">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-[var(--text)]">
                      Viewing Review Results:
                    </span>
                    <span className="font-mono text-[var(--text-muted)]">ID: {review.id}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReview(null)}
                    className="inline-flex items-center gap-1.5 rounded-md bg-[var(--surface-raised)] border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text)] hover:border-[var(--accent-green)] transition-colors"
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
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                    <span>Submit New Code</span>
                  </button>
                </div>
              )}

              {/* Submission Form (shown when no review is active) */}
              {!review && (
                <ReviewForm
                  onSubmit={handleReviewSubmit}
                  isLoading={isLoading}
                  isAuthenticated={Boolean(user)}
                  onSignIn={handleSignIn}
                />
              )}

              {/* Loading State */}
              {isLoading && (
                <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] p-12 text-center shadow-lg">
                  <div className="relative mb-5 flex h-12 w-12 items-center justify-center">
                    <div className="absolute inset-0 rounded-full border-2 border-[var(--border)]" />
                    <div className="absolute inset-0 rounded-full border-t-2 border-[var(--accent-green)] animate-spin" />
                    <CodeSentinelIcon className="h-5 w-5" shieldColor="var(--accent-green)" codeColor="var(--text)" />
                  </div>
                  <h3 className="text-sm font-semibold text-[var(--text)] tracking-wide">
                    Scanning Source Code
                  </h3>
                  <p className="mt-1.5 max-w-sm text-xs text-[var(--text-secondary)] leading-relaxed font-mono">
                    Evaluating AST patterns, attack surfaces, memory safety, and best practices...
                  </p>
                </div>
              )}

              {/* Error Banner */}
              {error && !isLoading && (
                <div className="rounded-xl border border-[var(--severity-critical-border)] bg-[var(--surface)] p-5">
                  <div className="flex items-start gap-3">
                    <svg
                      className="h-5 w-5 shrink-0 text-[var(--severity-critical)] mt-0.5"
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
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-[var(--severity-critical)]">
                        Review Request Failed
                      </h3>
                      <p className="mt-1 text-xs text-[var(--severity-critical)] leading-relaxed">
                        {error}
                      </p>

                      {isMissingApiKey && (
                        <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-4">
                          <h4 className="text-xs font-semibold text-[var(--text)]">
                            How to Configure Your Gemini API Key:
                          </h4>
                          <ol className="mt-2 list-decimal list-inside space-y-1 text-xs text-[var(--text-secondary)]">
                            <li>
                              Open <code className="text-[var(--text)]">apps/api/.env</code> or root <code className="text-[var(--text)]">.env</code>.
                            </li>
                            <li>
                              Set your key:
                              <pre className="mt-2 overflow-x-auto rounded-lg bg-[var(--surface)] p-2.5 font-mono text-[11px] text-[var(--accent-green-light)] border border-[var(--border)]">
                                GEMINI_API_KEY=your_actual_gemini_api_key_here
                              </pre>
                            </li>
                            <li>Retry your review.</li>
                          </ol>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Results View */}
              {review && !isLoading && (
                <ReviewResults
                  review={review}
                  onBack={() => {
                    const hadRepo = Boolean(review.repository);
                    setReview(null);
                    if (hadRepo) {
                      setActiveTab("repositories");
                    }
                  }}
                />
              )}
            </>
          )}

          {/* TAB 2: Review History */}
          {activeTab === "history" && (
            <ReviewHistory
              apiBaseUrl={API_BASE_URL}
              onSelectReview={handleSelectHistoricalReview}
              onNewReview={() => {
                setReview(null);
                setActiveTab("workspace");
              }}
              isAuthenticated={Boolean(user)}
              onSignIn={handleSignIn}
            />
          )}

          {/* TAB 3: GitHub Repositories */}
          {activeTab === "repositories" && (
            <>
              {selectedRepoForFiles ? (
                <FileTreeExplorer
                  apiBaseUrl={API_BASE_URL}
                  repository={selectedRepoForFiles}
                  onBack={() => setSelectedRepoForFiles(null)}
                  onReviewFile={handleReviewRepoFile}
                  isReviewLoading={isLoading}
                />
              ) : selectedRepoForPRs ? (
                <PullRequestList
                  apiBaseUrl={API_BASE_URL}
                  repository={selectedRepoForPRs}
                  onBack={() => setSelectedRepoForPRs(null)}
                  onReviewPR={handleReviewPR}
                  isReviewLoading={isLoading}
                />
              ) : (
                <RepositoryList
                  apiBaseUrl={API_BASE_URL}
                  onSelectRepoForFiles={(repo) => setSelectedRepoForFiles(repo)}
                  onSelectRepoForPRs={(repo) => setSelectedRepoForPRs(repo)}
                  isAuthenticated={Boolean(user)}
                  onSignIn={handleSignIn}
                />
              )}
            </>
          )}
        </main>

        {/* Footer */}
        <footer className="mt-auto border-t border-[var(--border)] pt-6 pb-2 text-center text-xs text-[var(--text-muted)] flex flex-col items-center gap-2">
          <div className="flex items-center gap-2">
            <CodeSentinelIcon className="h-4 w-4" shieldColor="var(--accent-green)" codeColor="var(--text)" />
            <span className="font-semibold text-[var(--text)]">
              Code<span className="text-[var(--accent-green-light)]">Sentinel</span> AI
            </span>
          </div>
          <p>
            &copy; 2026. Automated code review is an advisory
            tool and does not replace human peer review or formal security
            audits.
          </p>
        </footer>
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        user={user}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
        themeMode={themeMode}
        onThemeChange={setThemeMode}
        accentColor={accentColor}
        onAccentChange={setAccentColor}
      />
    </div>
  );
}
