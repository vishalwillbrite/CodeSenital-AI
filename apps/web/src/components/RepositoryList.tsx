"use client";

import { useEffect, useState } from "react";
import { GithubInstallation, GithubRepository } from "../types/github";

interface RepositoryListProps {
  apiBaseUrl: string;
  onSelectRepoForFiles: (repo: GithubRepository) => void;
  onSelectRepoForPRs: (repo: GithubRepository) => void;
  isAuthenticated: boolean;
  onSignIn: () => void;
}

export function RepositoryList({
  apiBaseUrl,
  onSelectRepoForFiles,
  onSelectRepoForPRs,
  isAuthenticated,
  onSignIn,
}: RepositoryListProps) {
  const [installations, setInstallations] = useState<GithubInstallation[]>([]);
  const [repositories, setRepositories] = useState<GithubRepository[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAppConfigured, setIsAppConfigured] = useState<boolean | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  // Check GitHub App configuration status
  useEffect(() => {
    async function checkAppStatus() {
      try {
        const res = await fetch(`${apiBaseUrl}/github/status`);
        if (res.ok) {
          const data = await res.json();
          setIsAppConfigured(Boolean(data.configured));
        }
      } catch {
        setIsAppConfigured(false);
      }
    }
    checkAppStatus();
  }, [apiBaseUrl]);

  // Load installations and repositories
  useEffect(() => {
    if (!isAuthenticated) return;

    async function loadData() {
      setIsLoading(true);
      setError(null);
      try {
        const [instRes, repoRes] = await Promise.all([
          fetch(`${apiBaseUrl}/github/installations`, { credentials: "include" }),
          fetch(`${apiBaseUrl}/github/repositories?limit=100`, { credentials: "include" }),
        ]);

        if (instRes.ok) {
          const instData = await instRes.json();
          setInstallations(instData);
        }

        if (repoRes.ok) {
          const repoData = await repoRes.json();
          setRepositories(repoData.items || []);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load repositories");
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [apiBaseUrl, isAuthenticated]);

  const handleConnectApp = async () => {
    if (!isAuthenticated) {
      onSignIn();
      return;
    }

    setIsConnecting(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/github/connect-url`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Could not generate GitHub App installation URL");
      }
      window.location.href = data.url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to connect GitHub App");
      setIsConnecting(false);
    }
  };

  const handleDisconnectInstallation = async (instId: string) => {
    if (!confirm("Are you sure you want to disconnect this GitHub installation?")) {
      return;
    }

    try {
      const res = await fetch(`${apiBaseUrl}/github/installations/${instId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        setInstallations((prev) => prev.filter((i) => i.id !== instId));
        // Reload repositories
        const repoRes = await fetch(`${apiBaseUrl}/github/repositories?limit=100`, {
          credentials: "include",
        });
        if (repoRes.ok) {
          const data = await repoRes.json();
          setRepositories(data.items || []);
        }
      }
    } catch {
      // ignore
    }
  };

  const handleSyncInstallation = async (instId: string) => {
    setSyncingId(instId);
    try {
      const res = await fetch(`${apiBaseUrl}/github/installations/${instId}/sync`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        const repoRes = await fetch(`${apiBaseUrl}/github/repositories?limit=100`, {
          credentials: "include",
        });
        if (repoRes.ok) {
          const data = await repoRes.json();
          setRepositories(data.items || []);
        }
      }
    } catch {
      // ignore
    } finally {
      setSyncingId(null);
    }
  };

  const filteredRepos = repositories.filter((r) =>
    r.fullName.toLowerCase().includes(search.toLowerCase().trim()),
  );

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 sm:p-10 text-center shadow-sm">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--surface-raised)] border border-[var(--border)] text-[var(--accent-green)] mb-4">
          <svg className="h-6 w-6 fill-current" viewBox="0 0 24 24">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
          </svg>
        </div>
        <h3 className="text-base font-semibold text-[var(--text)]">Sign In Required</h3>
        <p className="mt-2 max-w-sm text-xs text-[var(--text-secondary)]">
          Sign in with your GitHub account to authorize repository access and audit pull requests.
        </p>
        <button
          type="button"
          onClick={onSignIn}
          className="btn-primary mt-6 rounded-lg px-5 py-2 text-xs font-semibold shadow-sm"
        >
          Sign in with GitHub
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
        <div>
          <h2 className="text-base font-semibold text-[var(--text)]">Connected Repositories</h2>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Browse files and audit Pull Requests directly from your authorized repositories.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={isConnecting}
            onClick={handleConnectApp}
            className="btn-primary inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold shadow-sm disabled:opacity-50"
          >
            <svg className="h-4 w-4 fill-[var(--text-on-green)]" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            <span>{isConnecting ? "Connecting..." : "+ Connect Repositories"}</span>
          </button>
        </div>
      </div>

      {/* GitHub App Not Configured Alert */}
      {isAppConfigured === false && (
        <div className="rounded-xl border border-[var(--severity-medium-border)] bg-[var(--severity-medium-tint)] p-4 text-xs text-[var(--severity-medium)]">
          <div className="flex items-start gap-2.5">
            <svg className="h-4 w-4 shrink-0 text-[var(--severity-medium)] mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="font-semibold text-[var(--text)]">GitHub App Credentials Not Configured</p>
              <p className="mt-1 text-[var(--text-secondary)]">
                To connect repositories, register a GitHub App in GitHub Developer Settings and add <code className="text-[var(--accent-green-light)]">GITHUB_APP_ID</code> and <code className="text-[var(--accent-green-light)]">GITHUB_APP_PRIVATE_KEY</code> to your <code className="text-[var(--accent-green-light)]">.env</code> file.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="rounded-xl border border-[var(--severity-critical-border)] bg-[var(--severity-critical-tint)] p-4 text-xs text-[var(--severity-critical)]">
          {error}
        </div>
      )}

      {/* Connected Installations List */}
      {installations.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-[var(--text-secondary)]">Installations:</span>
          {installations.map((inst) => (
            <div
              key={inst.id}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-1 text-xs text-[var(--text)]"
            >
              <span className="font-medium text-[var(--text)]">{inst.accountLogin}</span>
              <span className="rounded bg-[var(--surface)] border border-[var(--border)] px-1 text-[10px] text-[var(--text-secondary)]">
                {inst.accountType}
              </span>
              <button
                type="button"
                onClick={() => handleSyncInstallation(inst.id)}
                disabled={syncingId === inst.id}
                title="Sync repositories from GitHub"
                className="text-[var(--text-muted)] hover:text-[var(--accent-green)] transition-colors ml-1 disabled:opacity-50"
              >
                <svg
                  className={`h-3 w-3 ${syncingId === inst.id ? "animate-spin text-[var(--text-secondary)]" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => handleDisconnectInstallation(inst.id)}
                title="Disconnect installation"
                className="text-[var(--text-muted)] hover:text-[var(--severity-critical)] transition-colors"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Search Input */}
      {repositories.length > 0 && (
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search authorized repositories..."
            className="input-theme w-full rounded-lg px-4 py-2.5 pl-10 text-xs placeholder-[var(--text-muted)]"
          />
          <svg
            className="absolute left-3.5 top-3 h-4 w-4 text-[var(--text-muted)]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      )}

      {/* Repository Cards Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] animate-pulse" />
          ))}
        </div>
      ) : filteredRepos.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredRepos.map((repo) => (
            <div
              key={repo.id}
              className="flex flex-col justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 hover:border-[var(--accent-green)] transition-colors shadow-sm"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-sm text-[var(--text)] truncate" title={repo.fullName}>
                    {repo.fullName}
                  </h3>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                      repo.isPrivate
                        ? "bg-[var(--severity-medium-tint)] text-[var(--severity-medium)] border border-[var(--severity-medium-border)]"
                        : "bg-[var(--severity-pass-tint)] text-[var(--severity-pass)] border border-[var(--severity-pass-border)]"
                    }`}
                  >
                    {repo.isPrivate ? "Private" : "Public"}
                  </span>
                </div>

                {repo.description && (
                  <p className="mt-2 text-xs text-[var(--text-secondary)] line-clamp-2 leading-relaxed">
                    {repo.description}
                  </p>
                )}

                <div className="mt-3 flex items-center gap-3 text-[11px] text-[var(--text-muted)]">
                  <span className="flex items-center gap-1">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {repo.defaultBranch}
                  </span>
                </div>
              </div>

              <div className="mt-5 flex items-center gap-2 border-t border-[var(--border)] pt-4">
                <button
                  type="button"
                  onClick={() => onSelectRepoForFiles(repo)}
                  className="btn-secondary flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium hover:border-[var(--accent-green)]"
                >
                  <svg className="h-3.5 w-3.5 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  <span>Explore Files</span>
                </button>

                <button
                  type="button"
                  onClick={() => onSelectRepoForPRs(repo)}
                  className="btn-secondary flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold hover:border-[var(--accent-green)]"
                >
                  <svg className="h-3.5 w-3.5 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  <span>Pull Requests</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] p-10 text-center">
          <svg className="h-10 w-10 text-[var(--text-muted)] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          <p className="text-sm font-medium text-[var(--text)]">No repositories found</p>
          <p className="mt-1 text-xs text-[var(--text-secondary)] max-w-sm">
            {installations.length === 0
              ? "Click 'Connect Repositories' to install the CodeSentinel AI GitHub App and grant access to your repositories."
              : "No repositories matched your search query."}
          </p>
        </div>
      )}
    </div>
  );
}
