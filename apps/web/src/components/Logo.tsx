"use client";

import React from "react";

interface LogoProps {
  variant?: "full" | "header" | "inline" | "icon";
  size?: "sm" | "md" | "lg";
  className?: string;
  showSubtitle?: boolean;
  showAiBadge?: boolean;
}

/**
 * CodeSentinel Shield Icon with embedded </> code syntax brackets.
 * Accurately matching the brand identity specifications.
 */
export function CodeSentinelIcon({
  className = "h-6 w-6",
  shieldColor = "var(--accent-green)",
  codeColor = "var(--text)",
}: {
  className?: string;
  shieldColor?: string;
  codeColor?: string;
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Outer Shield Outline */}
      <path
        d="M50 15 C66 18 80 22 84 27 C85 28.5 85 31 85 35 L85 49 C85 68.5 67.5 82.5 51.2 88.6 C50.4 88.9 49.6 88.9 48.8 88.6 C32.5 82.5 15 68.5 15 49 L15 35 C15 31 15 28.5 16 27 C20 22 34 18 50 15 Z"
        stroke={shieldColor}
        strokeWidth="6.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Left Code Bracket < */}
      <path
        d="M42 38 L30.5 50 L42 62"
        stroke={codeColor}
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Forward Slash / */}
      <path
        d="M46 65 L54 35"
        stroke={codeColor}
        strokeWidth="5.5"
        strokeLinecap="round"
      />
      {/* Right Code Bracket > */}
      <path
        d="M58 38 L69.5 50 L58 62"
        stroke={codeColor}
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({
  variant = "header",
  size = "md",
  className = "",
  showSubtitle = true,
  showAiBadge = true,
}: LogoProps) {
  if (variant === "icon") {
    const iconSizeClasses = {
      sm: "h-6 w-6",
      md: "h-8 w-8",
      lg: "h-12 w-12",
    }[size];

    return (
      <CodeSentinelIcon
        className={`${iconSizeClasses} ${className}`}
        shieldColor="var(--accent-green)"
        codeColor="var(--text)"
      />
    );
  }

  if (variant === "inline") {
    return (
      <div className={`inline-flex items-center gap-2.5 ${className}`}>
        <CodeSentinelIcon className="h-6 w-6 shrink-0" shieldColor="var(--accent-green)" codeColor="var(--text)" />
        <span className="font-bold tracking-tight text-[var(--text)] text-base">
          Code<span className="text-[var(--accent-green-light)]">Sentinel</span>
        </span>
      </div>
    );
  }

  // Header or full lockup
  const badgeSizeClasses = {
    sm: "h-8 w-8 rounded-lg",
    md: "h-9 w-9 rounded-xl",
    lg: "h-12 w-12 rounded-2xl",
  }[size];

  const iconInBadgeSize = {
    sm: "h-5 w-5",
    md: "h-6 w-6",
    lg: "h-8 w-8",
  }[size];

  const titleSizeClasses = {
    sm: "text-base",
    md: "text-lg",
    lg: "text-2xl",
  }[size];

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Rounded Squircle Badge with Shield Icon */}
      <div
        className={`flex ${badgeSizeClasses} items-center justify-center bg-[var(--surface)] border border-[var(--border)] shadow-sm shrink-0`}
      >
        <CodeSentinelIcon className={iconInBadgeSize} shieldColor="var(--accent-green)" codeColor="var(--text)" />
      </div>

      <div>
        <div className="flex items-center gap-1.5">
          <span className={`${titleSizeClasses} font-bold tracking-tight text-[var(--text)]`}>
            Code<span className="text-[var(--accent-green-light)]">Sentinel</span>
          </span>
          {showAiBadge && (
            <span className="font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded border border-[var(--border)] bg-[var(--surface-raised)] text-[var(--text-secondary)]">
              AI
            </span>
          )}
        </div>
        {showSubtitle && (
          <p className="text-[10px] font-semibold tracking-wider uppercase text-[var(--text-muted)] mt-0.5">
            Static Security &amp; AI Code Review
          </p>
        )}
      </div>
    </div>
  );
}
