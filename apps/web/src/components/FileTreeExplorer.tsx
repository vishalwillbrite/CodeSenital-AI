"use client";

import { useEffect, useState } from "react";
import { GithubRepository, GitHubTreeNode } from "../types/github";

interface FileTreeExplorerProps {
  apiBaseUrl: string;
  repository: GithubRepository;
  onBack: () => void;
  onReviewFile: (repoId: string, filePath: string, ref?: string) => Promise<void>;
  isReviewLoading: boolean;
}

export function FileTreeExplorer({
  apiBaseUrl,
  repository,
  onBack,
  onReviewFile,
  isReviewLoading,
}: FileTreeExplorerProps) {
  const [tree, setTree] = useState<GitHubTreeNode[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileLanguage, setFileLanguage] = useState<string>("typescript");
  const [fileSize, setFileSize] = useState<number>(0);
  const [isTreeLoading, setIsTreeLoading] = useState(true);
  const [isFileLoading, setIsFileLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState("");

  // Fetch repository tree
  useEffect(() => {
    async function loadTree() {
      setIsTreeLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `${apiBaseUrl}/github/repositories/${repository.id}/tree`,
          { credentials: "include" },
        );
        if (!res.ok) {
          throw new Error(`Failed to load file tree (HTTP ${res.status})`);
        }
        const data = await res.json();
        setTree(data.tree || []);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load repository tree");
      } finally {
        setIsTreeLoading(false);
      }
    }

    loadTree();
  }, [apiBaseUrl, repository.id]);

  // Fetch selected file content
  const handleSelectFile = async (path: string) => {
    setSelectedPath(path);
    setIsFileLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${apiBaseUrl}/github/repositories/${repository.id}/file?path=${encodeURIComponent(path)}`,
        { credentials: "include" },
      );
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Failed to fetch file content (HTTP ${res.status})`);
      }
      const data = await res.json();
      setFileContent(data.content);
      setFileLanguage(data.language);
      setFileSize(data.size);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load file content");
      setFileContent(null);
    } finally {
      setIsFileLoading(false);
    }
  };

  const codeFiles = tree.filter(
    (n) => n.type === "blob" && n.path.toLowerCase().includes(searchFilter.toLowerCase().trim()),
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Top Breadcrumb Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
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
              <span className="rounded bg-[var(--surface-raised)] border border-[var(--border)] px-1.5 py-0.5 text-[10px] text-[var(--text-secondary)]">
                {repository.defaultBranch}
              </span>
            </div>
            {selectedPath && (
              <p className="text-xs font-mono text-[var(--accent-green-light)] mt-0.5 truncate max-w-md">
                {selectedPath}
              </p>
            )}
          </div>
        </div>

        {selectedPath && fileContent && (
          <button
            type="button"
            disabled={isReviewLoading}
            onClick={() => onReviewFile(repository.id, selectedPath)}
            className="btn-primary inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold shadow-sm disabled:opacity-50 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span>{isReviewLoading ? "Auditing..." : "Audit File with AI"}</span>
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-[var(--severity-critical-border)] bg-[var(--severity-critical-tint)] p-4 text-xs text-[var(--severity-critical)]">
          {error}
        </div>
      )}

      {/* Explorer Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[500px]">
        {/* Left Column: File Tree */}
        <div className="lg:col-span-4 flex flex-col rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
          <div className="mb-3">
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Filter files (e.g. auth.ts)..."
              className="input-theme w-full rounded-lg px-3 py-1.5 text-xs placeholder-[var(--text-muted)]"
            />
          </div>

          <div className="flex-1 overflow-y-auto max-h-[550px] space-y-0.5 pr-1 text-xs">
            {isTreeLoading ? (
              <div className="space-y-2 p-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-6 rounded bg-[var(--surface-raised)] animate-pulse" />
                ))}
              </div>
            ) : codeFiles.length > 0 ? (
              codeFiles.map((node) => {
                const isSelected = selectedPath === node.path;
                return (
                  <button
                    key={node.path}
                    type="button"
                    onClick={() => handleSelectFile(node.path)}
                    className={`w-full flex items-center justify-between rounded-md px-2.5 py-1.5 text-left font-mono text-[11px] transition-colors ${
                      isSelected
                        ? "tab-btn-active"
                        : "text-[var(--text-secondary)] hover:bg-[var(--surface-raised)] hover:text-[var(--text)] border border-transparent"
                    }`}
                  >
                    <span className="truncate" title={node.path}>
                      {node.path}
                    </span>
                    {node.size && (
                      <span className="text-[10px] text-[var(--text-muted)] shrink-0 ml-2">
                        {Math.round(node.size / 1024)}k
                      </span>
                    )}
                  </button>
                );
              })
            ) : (
              <p className="text-center text-[var(--text-muted)] py-8">No code files matched.</p>
            )}
          </div>
        </div>

        {/* Right Column: File Preview */}
        <div className="lg:col-span-8 flex flex-col rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm min-h-[500px]">
          {selectedPath ? (
            isFileLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center p-12">
                <div className="h-7 w-7 rounded-full border-2 border-[var(--border)] border-t-[var(--accent-green)] animate-spin mb-3" />
                <p className="text-xs text-[var(--text-secondary)] font-mono">Fetching file from GitHub...</p>
              </div>
            ) : fileContent ? (
              <div className="flex flex-col h-full">
                <div className="flex items-center justify-between border-b border-[var(--border)] pb-3 mb-3 text-xs text-[var(--text-secondary)]">
                  <div className="flex items-center gap-3">
                    <span className="text-[var(--text)] font-mono text-[11px]">{selectedPath}</span>
                    <span className="rounded bg-[var(--surface-raised)] border border-[var(--border)] text-[var(--accent-green-light)] px-2 py-0.5 text-[10px] uppercase font-semibold">
                      {fileLanguage}
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-[var(--text-muted)]">{Math.round(fileSize / 1024)} KB</span>
                </div>

                <pre className="flex-1 overflow-x-auto overflow-y-auto max-h-[500px] rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] p-4 font-mono text-xs text-[var(--text)] leading-relaxed">
                  <code>{fileContent}</code>
                </pre>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-[var(--text-muted)] text-xs">
                Could not display file content.
              </div>
            )
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-12 text-[var(--text-muted)]">
              <svg className="h-10 w-10 text-[var(--text-muted)] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm font-medium text-[var(--text)]">Select a file to inspect</p>
              <p className="mt-1 text-xs text-[var(--text-secondary)] max-w-xs">
                Browse the repository tree on the left and select any source file to review security and code quality.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
