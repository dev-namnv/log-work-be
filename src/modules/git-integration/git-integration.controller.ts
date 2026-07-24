import {
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Query,
  RawBodyRequest,
  Redirect,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Auth } from 'src/decorators/auth.decorator';
import { CurrentAccount } from 'src/decorators/currentAccount.decorator';
import { SkipCache } from 'src/decorators/skip-cache.decorator';
import { MongoIdDto } from 'src/dto/mongoId.dto';
import {
  GitHubPushPayload,
  GitLabPushPayload,
} from 'src/interfaces/GitIntergration';
import { Account } from 'src/schemas/account';
import { GitProvider } from 'src/schemas/git-integration';
import { SyncGitDto } from './dto/syncGit.dto';
import { GitIntegrationService } from './git-integration.service';

@SkipCache()
@ApiTags('GitIntegration')
@Controller('git-integration')
export class GitIntegrationController {
  constructor(private readonly gitIntegrationService: GitIntegrationService) {}

  // ─── List linked accounts ────────────────────────────────────────────────

  @Auth()
  @Get()
  @ApiOperation({
    summary: 'List all linked Git accounts for the current user',
  })
  async list(@CurrentAccount() account: Account) {
    return this.gitIntegrationService.listForAccount(account);
  }

  // ─── Initiate OAuth ──────────────────────────────────────────────────────

  @Auth()
  @Get('github/oauth-url')
  @ApiOperation({ summary: 'Get GitHub OAuth redirect URL' })
  async githubOAuthUrl(@CurrentAccount() account: Account) {
    const state = this.gitIntegrationService.generateOAuthState(
      account._id.toString(),
    );
    const url = this.gitIntegrationService.getOAuthUrl(
      GitProvider.GitHub,
      state,
    );
    return { url };
  }

  @Auth()
  @Get('gitlab/oauth-url')
  @ApiOperation({ summary: 'Get GitLab OAuth redirect URL' })
  async gitlabOAuthUrl(@CurrentAccount() account: Account) {
    const state = this.gitIntegrationService.generateOAuthState(
      account._id.toString(),
    );
    const url = this.gitIntegrationService.getOAuthUrl(
      GitProvider.GitLab,
      state,
    );
    return { url };
  }

  // ─── OAuth callbacks (public, server-side redirect) ──────────────────────

  @Get('github/callback')
  @Redirect()
  @ApiOperation({ summary: 'GitHub OAuth callback' })
  async githubCallback(
    @Query('code') code: string,
    @Query('state') state: string,
  ) {
    const redirectUrl = await this.gitIntegrationService.handleGitHubCallback(
      code,
      state,
    );
    return { url: redirectUrl };
  }

  @Get('gitlab/callback')
  @Redirect()
  @ApiOperation({ summary: 'GitLab OAuth callback' })
  async gitlabCallback(
    @Query('code') code: string,
    @Query('state') state: string,
  ) {
    const redirectUrl = await this.gitIntegrationService.handleGitLabCallback(
      code,
      state,
    );
    return { url: redirectUrl };
  }

  // ─── Unlink ──────────────────────────────────────────────────────────────

  @Auth()
  @Delete(':id/delete')
  @ApiOperation({ summary: 'Unlink a Git account' })
  async delete(
    @CurrentAccount() account: Account,
    @Param() { id }: MongoIdDto,
  ) {
    await this.gitIntegrationService.deleteIntegration(account, id);
    return { message: 'Integration removed' };
  }

  // ─── Webhook endpoints (public, verified by HMAC / token) ────────────────

  /**
   * GitHub push webhook.
   * The integration ID is embedded in the URL so we can look up the right
   * webhook secret for HMAC verification without iterating all records.
   *
   * Configure the repo webhook as:
   *   URL: https://<your-domain>/git-integration/webhook/github/<integrationId>
   *   Content type: application/json
   *   Secret: <webhookSecret from GET /git-integration>
   */
  @Post('webhook/github/:id')
  @ApiOperation({ summary: 'GitHub push webhook receiver' })
  async githubWebhook(
    @Param() { id }: MongoIdDto,
    @Headers('x-hub-signature-256') signature: string,
    @Req() req: RawBodyRequest<Request>,
  ) {
    if (!signature) throw new UnauthorizedException('Missing signature header');
    const rawBody = req.rawBody;
    if (!rawBody) throw new UnauthorizedException('Missing raw body');

    const payload = req.body as GitHubPushPayload;
    await this.gitIntegrationService.handleGitHubWebhook(
      id,
      signature,
      rawBody,
      payload,
    );
    return { ok: true };
  }

  /**
   * GitLab push webhook.
   * Configure the repo webhook as:
   *   URL: https://<your-domain>/git-integration/webhook/gitlab/<integrationId>
   *   Secret token: <webhookSecret from GET /git-integration>
   */
  @Post('webhook/gitlab/:id')
  @ApiOperation({ summary: 'GitLab push webhook receiver' })
  async gitlabWebhook(
    @Param() { id }: MongoIdDto,
    @Headers('x-gitlab-token') token: string,
    @Req() req: Request,
  ) {
    if (!token) throw new UnauthorizedException('Missing token header');
    const payload = req.body as GitLabPushPayload;
    await this.gitIntegrationService.handleGitLabWebhook(id, token, payload);
    return { ok: true };
  }

  @ApiOperation({
    summary: 'Manually trigger syncing for all Git integrations by an account',
  })
  @Auth()
  @Post('sync')
  async syncAllIntegrations(
    @CurrentAccount() account: Account,
    @Query() { subDays }: SyncGitDto,
  ) {
    return this.gitIntegrationService.pollAllIntegrations(account, subDays);
  }
}
