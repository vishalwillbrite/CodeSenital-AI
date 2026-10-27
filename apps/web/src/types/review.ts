export type OverallRisk = 'high' | 'medium' | 'low' | 'none';

export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export interface Finding {
  id?: string;
  reviewId?: string;
  title: string;
  description: string;
  severity: Severity;
  category: string;
  lineStart: number | null;
  lineEnd: number | null;
  suggestedFix: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ReviewResponse {
  id: string;
  userId?: string;
  language: string;
  sourceCode: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | string;
  summary?: string | null;
  overallRisk?: OverallRisk | null;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt?: string;
  repositoryId?: string | null;
  filePath?: string | null;
  commitSha?: string | null;
  branch?: string | null;
  pullNumber?: number | null;
  repository?: {
    id?: string;
    fullName: string;
    isPrivate?: boolean;
    defaultBranch?: string;
    htmlUrl?: string;
  } | null;
  findings: Finding[];
  disclaimer?: string;
}

export interface ReviewHistoryItem {
  id: string;
  userId: string;
  language: string;
  status: string;
  summary?: string | null;
  overallRisk?: OverallRisk | null;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt?: string;
  repositoryId?: string | null;
  filePath?: string | null;
  commitSha?: string | null;
  branch?: string | null;
  pullNumber?: number | null;
  repository?: {
    fullName: string;
    isPrivate?: boolean;
  } | null;
  _count?: {
    findings: number;
  };
}

export interface PaginatedReviewsResponse {
  items: ReviewHistoryItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ReviewErrorResponse {
  statusCode?: number;
  message: string | string[];
  error?: string;
}

export interface AuthUser {
  id: string;
  githubId?: string | null;
  username?: string | null;
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  createdAt?: string;
}
