export const AUTH_TYPES_VERSION = '1.0.0';

export interface JwtPayload {
  sub: string;
  username?: string | null;
  email?: string | null;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedUser {
  id: string;
  githubId?: string | null;
  username?: string | null;
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface GitHubTokenResponse {
  access_token?: string;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

export interface GitHubUserProfile {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
  bio?: string | null;
}

export interface GitHubUserEmail {
  email: string;
  primary: boolean;
  verified: boolean;
  visibility: string | null;
}
