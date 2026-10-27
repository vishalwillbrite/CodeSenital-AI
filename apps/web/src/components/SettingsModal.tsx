"use client";

import { useEffect, useRef } from "react";
import { AuthUser } from "../types/review";
import { ThemeMode, AccentColor, ACCENT_PALETTES } from "./useThemePreferences";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: AuthUser | null;
  onSignIn: () => void;
  onSignOut: () => void;
  themeMode: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
  accentColor: AccentColor;
  onAccentChange: (accent: AccentColor) => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  user,
  onSignIn,
  onSignOut,
  themeMode,
  onThemeChange,
  accentColor,
  onAccentChange,
}: SettingsModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl animate-scaleIn max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-4 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--surface-raised)] border border-[var(--border)] text-[var(--accent-green)]">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
            </div>
            <div>
              <h2 id="settings-dialog-title" className="text-base font-bold text-[var(--text)]">
                Settings
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Preferences, GitHub identity, and appearance
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--surface-raised)] hover:text-[var(--text)] transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-6">
          {/* SECTION 1: GitHub Profile */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2.5 flex items-center gap-2">
              <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              <span>GitHub Profile</span>
            </h3>

            {user ? (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.username || "User avatar"}
                      className="h-12 w-12 rounded-full border-2 border-[var(--accent-green)] object-cover shadow-sm shrink-0"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface)] border-2 border-[var(--accent-green)] text-base font-bold text-[var(--text)] shrink-0">
                      {(user.name || user.username || "U").slice(0, 1).toUpperCase()}
                    </div>
                  )}

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-sm text-[var(--text)] truncate">
                        {user.name || user.username || "Developer"}
                      </h4>
                      <span className="rounded bg-[var(--accent-tint)] border border-[var(--accent-green)]/30 px-1.5 py-0.2 text-[10px] font-medium text-[var(--accent-green-light)]">
                        Connected
                      </span>
                    </div>

                    {user.username && (
                      <p className="text-xs text-[var(--text-secondary)] font-mono">
                        @{user.username}
                      </p>
                    )}

                    {user.username && (
                      <a
                        href={`https://github.com/${user.username}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--accent-green-light)] hover:underline mt-1"
                      >
                        <span>View GitHub Profile</span>
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                          />
                        </svg>
                      </a>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onSignOut();
                    onClose();
                  }}
                  className="rounded-lg border border-[var(--severity-critical-border)] bg-[var(--severity-critical-tint)] px-3 py-1.5 text-xs font-semibold text-[var(--severity-critical)] hover:opacity-90 transition-opacity self-start sm:self-center shrink-0"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--surface)] text-[var(--text-muted)] border border-[var(--border)]">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div>
                    <span className="font-medium text-[var(--text)] block">Not Signed In</span>
                    <span className="text-[var(--text-secondary)] text-[11px]">Sign in with GitHub to view your profile and reviews</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onSignIn();
                    onClose();
                  }}
                  className="btn-primary rounded-lg px-3.5 py-1.5 text-xs font-semibold shadow-sm shrink-0"
                >
                  Sign In
                </button>
              </div>
            )}
          </div>

          {/* SECTION 2: Theme (System, Light, Dark) */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2 flex items-center justify-between">
              <span>Theme</span>
              <span className="text-[11px] font-normal text-[var(--text-secondary)] font-mono capitalize">
                Active: {themeMode}
              </span>
            </h3>

            <div className="grid grid-cols-3 gap-2.5">
              {[
                {
                  id: "system" as ThemeMode,
                  label: "System",
                  description: "Match OS",
                  icon: (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  ),
                },
                {
                  id: "light" as ThemeMode,
                  label: "Light",
                  description: "Clean & bright",
                  icon: (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  ),
                },
                {
                  id: "dark" as ThemeMode,
                  label: "Dark",
                  description: "Deep navy",
                  icon: (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                  ),
                },
              ].map((option) => {
                const isActive = themeMode === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => onThemeChange(option.id)}
                    className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3 text-center transition-all ${
                      isActive
                        ? "border-[var(--accent-green)] bg-[var(--surface-raised)] text-[var(--accent-green-light)] shadow-sm ring-1 ring-[var(--accent-green)]"
                        : "border-[var(--border)] bg-[var(--surface-raised)] text-[var(--text-secondary)] hover:border-[var(--accent-green)]/40 hover:text-[var(--text)]"
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      {option.icon}
                      <span className="text-xs font-semibold">{option.label}</span>
                    </div>
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {option.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* SECTION 3: Accent Color */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2 flex items-center justify-between">
              <span>Accent Color</span>
              <span className="text-[11px] font-normal text-[var(--text-secondary)] font-mono capitalize">
                {ACCENT_PALETTES[accentColor]?.label || "Emerald Green"}
              </span>
            </h3>

            <div className="grid grid-cols-5 gap-2">
              {(Object.keys(ACCENT_PALETTES) as AccentColor[]).map((key) => {
                const item = ACCENT_PALETTES[key];
                const isSelected = accentColor === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onAccentChange(key)}
                    className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border p-2.5 transition-all ${
                      isSelected
                        ? "border-[var(--accent-green)] bg-[var(--surface-raised)] ring-1 ring-[var(--accent-green)] shadow-sm"
                        : "border-[var(--border)] bg-[var(--surface-raised)] hover:border-[var(--accent-green)]/40"
                    }`}
                    title={item.label}
                  >
                    <div
                      className="relative h-6 w-6 rounded-full shadow-sm flex items-center justify-center transition-transform hover:scale-110"
                      style={{ backgroundColor: item.swatchHex }}
                    >
                      {isSelected && (
                        <svg
                          className="h-3.5 w-3.5"
                          style={{ color: item.textOnAccent }}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={3}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </div>
                    <span className="text-[11px] font-medium text-[var(--text)] capitalize">
                      {key}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 border-t border-[var(--border)] pt-4 flex items-center justify-between">
          <span className="text-[11px] text-[var(--text-muted)]">
            Preferences are saved automatically
          </span>
          <button
            type="button"
            onClick={onClose}
            className="btn-primary rounded-lg px-4 py-1.5 text-xs font-semibold shadow-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
