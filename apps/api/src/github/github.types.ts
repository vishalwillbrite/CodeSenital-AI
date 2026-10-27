export interface GitHubAppConfig {
  appId: string | null;
  appSlug: string | null;
  privateKey: string | null;
  webhookSecret: string | null;
}

export interface GitHubInstallationToken {
  token: string;
  expiresAt: number; // Unix timestamp in milliseconds
}

export interface GitHubApiInstallation {
  id: number;
  account: {
    id: number;
    login: string;
    type: string;
    avatar_url?: string;
  };
  app_id: number;
  target_id: number;
  target_type: string;
  permissions: Record<string, string>;
  created_at: string;
  updated_at: string;
}

export interface GitHubApiRepository {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  description: string | null;
  default_branch: string;
  owner: {
    login: string;
    id: number;
    avatar_url?: string;
  };
}

export interface GitHubTreeNode {
  path: string;
  mode: string;
  type: 'blob' | 'tree' | 'commit';
  sha: string;
  size?: number;
  url?: string;
}

export interface GitHubPullRequest {
  number: number;
  title: string;
  state: string;
  html_url: string;
  created_at: string;
  updated_at: string;
  user: {
    login: string;
    avatar_url?: string;
  };
  head: {
    ref: string;
    sha: string;
  };
  base: {
    ref: string;
    sha: string;
  };
}

export interface GitHubPullRequestFile {
  sha: string;
  filename: string;
  status: 'added' | 'removed' | 'modified' | 'renamed' | 'copied' | 'changed' | 'unchanged';
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
}

export interface RepositoryFileContent {
  path: string;
  language: string;
  size: number;
  content: string;
  commitSha: string;
  isTruncated?: boolean;
}

export interface PullRequestReviewPayload {
  pullNumber: number;
  title: string;
  headSha: string;
  headRef: string;
  filesReviewed: number;
  totalChanges: number;
  sourceCode: string;
  language: string;
}
