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

/** Shape of a single commit extracted from a webhook payload */
export interface CommitInfo {
  id: string;
  message: string;
  timestamp: string;
  url: string;
  repoName: string;
  authorEmail: string;
  authorName: string;
}

export interface GitHubEvent {
  type: string;
  repo: { name: string };
  payload: {
    head?: string;
    before?: string;
    ref?: string;
    size?: number;
    /** Present for public repos only */
    commits?: Array<{
      sha: string;
      message: string;
      author?: { name?: string; email?: string };
    }>;
  };
  created_at: string;
}

export interface GitHubCompareCommit {
  sha: string;
  commit: {
    message: string;
    author?: { name?: string; email?: string; date?: string };
  };
}

export interface GitLabEvent {
  action_name: string;
  created_at: string;
  project_id?: number;
  push_data?: {
    commit_count?: number;
    commit_title?: string;
    commit_to?: string;
  };
}

export interface GitHubRepo {
  full_name: string;
  pushed_at: string | null;
}

export interface GitHubRepoCommit {
  sha: string;
  html_url?: string;
  commit: {
    message: string;
    author?: { name?: string; email?: string; date?: string };
    committer?: { date?: string };
  };
}
