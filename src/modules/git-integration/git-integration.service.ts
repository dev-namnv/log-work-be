import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import axios from 'axios';
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'crypto';
import { startOfDay } from 'date-fns';
import { Model, Types } from 'mongoose';
import environment from 'src/config/environment';
import { Account } from 'src/schemas/account';
import { GitIntegration, GitProvider } from 'src/schemas/git-integration';
import { WorkLog } from 'src/schemas/work-log';

/** Shape of a single commit extracted from a webhook payload */
interface CommitInfo {
  id: string;
  message: string;
  timestamp: string;
  url: string;
  repoName: string;
  authorEmail: string;
  authorName: string;
}

const ALGORITHM = 'aes-256-gcm';

@Injectable()
export class GitIntegrationService {
  private readonly logger = new Logger(GitIntegrationService.name);

  constructor(
    @InjectModel(GitIntegration.name)
    private gitIntegrationModel: Model<GitIntegration>,
    @InjectModel(WorkLog.name)
    private workLogModel: Model<WorkLog>,
    private jwtService: JwtService,
  ) {}

  // ─── Encryption helpers ───────────────────────────────────────────────────

  private getEncryptionKey(): Buffer {
    const { secret } = environment().jwt;
    // Derive a 32-byte key from the JWT secret via SHA-256
    const hash = require('crypto').createHash('sha256').update(secret).digest();
    return hash;
  }

  private encrypt(plaintext: string): string {
    const key = this.getEncryptionKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  private decrypt(ciphertext: string): string {
    const [ivHex, tagHex, dataHex] = ciphertext.split(':');
    const key = this.getEncryptionKey();
    const decipher = createDecipheriv(
      ALGORITHM,
      key,
      Buffer.from(ivHex, 'hex'),
    );
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return (
      decipher.update(Buffer.from(dataHex, 'hex'), undefined, 'utf8') +
      decipher.final('utf8')
    );
  }

  // ─── OAuth state helpers ──────────────────────────────────────────────────

  /** Generate a short-lived signed state token embedding the accountId */
  generateOAuthState(accountId: string): string {
    return this.jwtService.sign(
      { accountId },
      { secret: environment().jwt.secret, expiresIn: '10m' },
    );
  }

  /** Verify state and return the accountId */
  verifyOAuthState(state: string): string {
    try {
      const payload = this.jwtService.verify<{ accountId: string }>(state, {
        secret: environment().jwt.secret,
      });
      return payload.accountId;
    } catch {
      throw new UnauthorizedException('Invalid or expired OAuth state');
    }
  }

  // ─── OAuth URL builders ───────────────────────────────────────────────────

  getOAuthUrl(provider: GitProvider, state: string): string {
    const env = environment();
    const callbackBase = `${env.host}:${env.port}`;

    if (provider === GitProvider.GITHUB) {
      const params = new URLSearchParams({
        client_id: env.github.clientId,
        redirect_uri: `${callbackBase}/git-integration/github/callback`,
        scope: 'read:user,user:email',
        state,
      });
      return `https://github.com/login/oauth/authorize?${params}`;
    }

    if (provider === GitProvider.GITLAB) {
      const params = new URLSearchParams({
        client_id: env.gitlab.appId,
        redirect_uri: `${callbackBase}/git-integration/gitlab/callback`,
        response_type: 'code',
        scope: 'read_user',
        state,
      });
      return `https://gitlab.com/oauth/authorize?${params}`;
    }

    throw new BadRequestException(`Unsupported provider: ${provider}`);
  }

  // ─── OAuth callbacks ──────────────────────────────────────────────────────

  async handleGitHubCallback(code: string, state: string): Promise<string> {
    const accountId = this.verifyOAuthState(state);
    const env = environment();

    // Exchange code for access token
    const tokenRes = await axios.post<{
      access_token: string;
      refresh_token?: string;
      error?: string;
    }>(
      'https://github.com/login/oauth/access_token',
      {
        client_id: env.github.clientId,
        client_secret: env.github.clientSecret,
        code,
      },
      { headers: { Accept: 'application/json' } },
    );

    if (tokenRes.data.error) {
      throw new BadRequestException(
        `GitHub OAuth error: ${tokenRes.data.error}`,
      );
    }

    const accessToken = tokenRes.data.access_token;

    // Fetch user profile
    const userRes = await axios.get<{
      id: number;
      login: string;
      name?: string;
    }>('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const { id, login, name } = userRes.data;

    await this.upsertIntegration({
      accountId,
      provider: GitProvider.GITHUB,
      providerUserId: String(id),
      username: login,
      displayName: name ?? login,
      accessToken,
      refreshToken: tokenRes.data.refresh_token ?? null,
    });

    // Redirect to web frontend after successful link
    return `${env.webHost}/settings/integrations?linked=github`;
  }

  async handleGitLabCallback(code: string, state: string): Promise<string> {
    const accountId = this.verifyOAuthState(state);
    const env = environment();
    const callbackBase = `${env.host}:${env.port}`;

    const tokenRes = await axios.post<{
      access_token: string;
      refresh_token?: string;
      error?: string;
    }>('https://gitlab.com/oauth/token', {
      client_id: env.gitlab.appId,
      client_secret: env.gitlab.appSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: `${callbackBase}/git-integration/gitlab/callback`,
    });

    if (tokenRes.data.error) {
      throw new BadRequestException(
        `GitLab OAuth error: ${tokenRes.data.error}`,
      );
    }

    const accessToken = tokenRes.data.access_token;

    const userRes = await axios.get<{
      id: number;
      username: string;
      name?: string;
    }>('https://gitlab.com/api/v4/user', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const { id, username, name } = userRes.data;

    await this.upsertIntegration({
      accountId,
      provider: GitProvider.GITLAB,
      providerUserId: String(id),
      username,
      displayName: name ?? username,
      accessToken,
      refreshToken: tokenRes.data.refresh_token ?? null,
    });

    return `${env.webHost}/settings/integrations?linked=gitlab`;
  }

  // ─── Internal upsert ─────────────────────────────────────────────────────

  private async upsertIntegration(params: {
    accountId: string;
    provider: GitProvider;
    providerUserId: string;
    username: string;
    displayName: string;
    accessToken: string;
    refreshToken: string | null;
  }): Promise<GitIntegration> {
    const { accountId, provider, providerUserId } = params;

    const existing = await this.gitIntegrationModel.findOne({
      account: new Types.ObjectId(accountId),
      provider,
      providerUserId,
    });

    const encryptedAccess = this.encrypt(params.accessToken);
    const encryptedRefresh = params.refreshToken
      ? this.encrypt(params.refreshToken)
      : null;

    if (existing) {
      existing.username = params.username;
      existing.displayName = params.displayName;
      existing.accessToken = encryptedAccess;
      existing.refreshToken = encryptedRefresh;
      existing.isActive = true;
      return existing.save();
    }

    const webhookSecret = randomBytes(32).toString('hex');

    return this.gitIntegrationModel.create({
      account: new Types.ObjectId(accountId),
      provider,
      providerUserId,
      username: params.username,
      displayName: params.displayName,
      accessToken: encryptedAccess,
      refreshToken: encryptedRefresh,
      webhookSecret,
      isActive: true,
    });
  }

  // ─── List / delete ────────────────────────────────────────────────────────

  async listForAccount(account: Account): Promise<Partial<GitIntegration>[]> {
    const integrations = await this.gitIntegrationModel
      .find({ account: account._id, isActive: true })
      .lean();

    // Strip encrypted tokens from the response, expose only safe fields
    return integrations.map(({ accessToken, refreshToken, ...safe }) => safe);
  }

  async deleteIntegration(account: Account, id: string): Promise<void> {
    const integration = await this.gitIntegrationModel.findById(id);
    if (!integration) throw new NotFoundException('Integration not found');
    if (integration.account.toString() !== account._id.toString()) {
      throw new ForbiddenException('Access denied');
    }
    await integration.deleteOne();
  }

  // ─── Webhook handlers ─────────────────────────────────────────────────────

  async handleGitHubWebhook(
    integrationId: string,
    signature: string,
    rawBody: Buffer,
    payload: GitHubPushPayload,
  ): Promise<void> {
    const integration = await this.gitIntegrationModel.findById(integrationId);
    if (!integration || !integration.isActive) return;

    // Verify HMAC-SHA256 signature: "sha256=<hex>"
    const expected = `sha256=${createHmac('sha256', integration.webhookSecret)
      .update(rawBody)
      .digest('hex')}`;

    let sigBuf: Buffer;
    let expBuf: Buffer;
    try {
      sigBuf = Buffer.from(signature);
      expBuf = Buffer.from(expected);
    } catch {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      throw new UnauthorizedException('Webhook signature mismatch');
    }

    const repoName = payload.repository?.full_name ?? 'unknown';
    const commits: CommitInfo[] = (payload.commits ?? []).map((c) => ({
      id: c.id.slice(0, 7),
      message: c.message.split('\n')[0].trim(),
      timestamp: c.timestamp,
      url: c.url,
      repoName,
      authorEmail: c.author?.email ?? '',
      authorName: c.author?.name ?? '',
    }));

    await this.appendCommitsToWorkLogs(integration, commits);
  }

  async handleGitLabWebhook(
    integrationId: string,
    token: string,
    payload: GitLabPushPayload,
  ): Promise<void> {
    const integration = await this.gitIntegrationModel.findById(integrationId);
    if (!integration || !integration.isActive) return;

    // GitLab sends the secret as a plain token header — compare securely
    const secretBuf = Buffer.from(integration.webhookSecret);
    const tokenBuf = Buffer.from(token ?? '');
    if (
      secretBuf.length !== tokenBuf.length ||
      !timingSafeEqual(secretBuf, tokenBuf)
    ) {
      throw new UnauthorizedException('Webhook token mismatch');
    }

    const repoName =
      payload.project?.path_with_namespace ??
      payload.repository?.name ??
      'unknown';
    const commits: CommitInfo[] = (payload.commits ?? []).map((c) => ({
      id: c.id.slice(0, 7),
      message: c.message.split('\n')[0].trim(),
      timestamp: c.timestamp,
      url: c.url,
      repoName,
      authorEmail: c.author?.email ?? '',
      authorName: c.author?.name ?? '',
    }));

    await this.appendCommitsToWorkLogs(integration, commits);
  }

  // ─── Core: append commit notes to WorkLog ─────────────────────────────────

  private async appendCommitsToWorkLogs(
    integration: GitIntegration,
    commits: CommitInfo[],
  ): Promise<void> {
    if (!commits.length) return;

    const providerLabel =
      integration.provider === GitProvider.GITHUB ? 'GitHub' : 'GitLab';

    for (const commit of commits) {
      const commitDate = new Date(commit.timestamp);
      if (isNaN(commitDate.getTime())) continue;

      const dayStart = startOfDay(commitDate);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

      const workLog = await this.workLogModel.findOne({
        account: integration.account,
        date: { $gte: dayStart, $lt: dayEnd },
      });

      if (!workLog) {
        this.logger.debug(
          `No WorkLog for account ${integration.account} on ${dayStart.toISOString().slice(0, 10)} — skipping commit ${commit.id}`,
        );
        continue;
      }

      const line = `[${providerLabel}] ${commit.message} (${commit.id}) — ${commit.repoName}`;
      const currentNote = workLog.note ?? '';
      // Avoid duplicates: check if this exact commit line is already present
      if (currentNote.includes(commit.id)) continue;

      workLog.note = currentNote ? `${currentNote}\n${line}` : line;
      await workLog.save();

      this.logger.log(`Appended commit ${commit.id} to WorkLog ${workLog._id}`);
    }
  }
}

// ─── Provider payload types ────────────────────────────────────────────────

interface GitHubCommit {
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

interface GitLabCommit {
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
