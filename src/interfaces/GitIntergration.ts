// ─── Provider payload types ────────────────────────────────────────────────

export interface GitHubCommit {
  id: string;
  message: string;
  timestamp: string;
  url: string;
  author?: { name?: string; email?: string };
}

export interface GitHubPushPayload {
  ref?: string;
  repository?: { full_name?: string };
  commits?: GitHubCommit[];
}

export interface GitLabCommit {
  id: string;
  message: string;
  timestamp: string;
  url: string;
  author?: { name?: string; email?: string };
}

export interface GitLabPushPayload {
  ref?: string;
  project?: { path_with_namespace?: string };
  repository?: { name?: string };
  commits?: GitLabCommit[];
}
