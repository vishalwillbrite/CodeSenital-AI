export interface GithubInstallation {
  id: string;
  installationId: string;
  accountLogin: string;
  accountType: string;
  targetId: string;
  createdAt: string;
  _count?: {
    repositories: number;
  };
}

export interface GithubRepository {
  id: string;
  installationId: string;
  githubRepoId: string;
  owner: string;
  name: string;
  fullName: string;
  isPrivate: boolean;
  defaultBranch: string;
  htmlUrl?: string;
  description?: string;
  installation?: {
    accountLogin: string;
    accountType: string;
  };
}

export interface GitHubTreeNode {
  path: string;
  mode: string;
  type: 'blob' | 'tree' | 'commit';
  sha: string;
  size?: number;
}

export interface GitHubPullRequest {
  number: number;
  title: string;
  state: string;
  htmlUrl: string;
  createdAt: string;
  updatedAt: string;
  author: string;
  headRef: string;
  headSha: string;
  baseRef: string;
}

export interface GitHubPullRequestFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
}
