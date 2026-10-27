export type OverallRisk = 'high' | 'medium' | 'low' | 'none';

export type FindingSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export interface FindingOutput {
  title: string;
  description: string;
  severity: FindingSeverity;
  category: string;
  lineStart: number | null;
  lineEnd: number | null;
  suggestedFix: string | null;
}

export interface ReviewOutput {
  summary: string;
  overallRisk: OverallRisk;
  findings: FindingOutput[];
  disclaimer: string;
}

export interface AiReviewRequest {
  sourceCode: string;
  language: string;
}

export interface ModelRawFinding {
  title?: unknown;
  description?: unknown;
  severity?: unknown;
  category?: unknown;
  lineStart?: unknown;
  lineEnd?: unknown;
  suggestedFix?: unknown;
}

export interface ModelRawResponse {
  summary?: unknown;
  overallRisk?: unknown;
  findings?: unknown;
}
