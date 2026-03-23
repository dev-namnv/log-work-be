import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import { AccountRole } from 'src/interfaces/Account';
import { MongoId } from 'src/interfaces/MongoId';
import { Account } from 'src/schemas/account';
import { Notice, NoticeType, NoticeVariant } from 'src/schemas/notice';
import { TimeUtil } from 'src/utils/time.util';
import { MailService } from '../mail/mail.service';
import { TelegramAdminService } from '../telegram/telegram-admin.service';
import { TelegramUserService } from '../telegram/telegram-user.service';
import { NoticeCreateDto } from './dto/NoticeCreate.dto';
import { NoticeToAdminDto } from './dto/NoticeToAdmin.dto';
import { NoticeToSomeUsersDto } from './dto/NoticeToSomeUsers.dto';
import { NoticeToUserDto } from './dto/NoticeToUser.dto';
import { NoticeToUsersDto } from './dto/NoticeToUsers.dto';
import { NoticeGateway } from './notice.gateway';

@Injectable()
export class NoticeService {
  constructor(
    @InjectModel(Notice.name) private noticeModel: Model<Notice>,
    @InjectModel(Account.name) private accountModel: Model<Account>,
    private noticeGateway: NoticeGateway,
    private mailService: MailService,
    private telegramUserService: TelegramUserService,
    private telegramAdminService: TelegramAdminService,
  ) {}

  async create(arg: { dto: NoticeCreateDto; account: Account }) {
    const { dto, account } = arg;
    const { emailMessage, ...restDto } = dto;
    const params: FilterQuery<Notice> = restDto;
    if (typeof account === 'string') {
      params.account = new MongoId(account);
    } else {
      params.account = account._id;
    }
    return this.noticeModel.create(params);
  }

  async createAndSend(arg: {
    dto: NoticeCreateDto;
    account: string | Account;
    sendWithMail?: boolean;
  }) {
    const { dto, account, sendWithMail } = arg;
    const user =
      typeof account === 'string'
        ? await this.accountModel.findById(account)
        : account;
    const notice = await this.create({ dto, account: user });
    const noticePopulate = await this.noticeModel.findById(notice._id);

    this.noticeGateway.sendNoticeToAccount(noticePopulate);

    let canSendMail = true;

    const emailOptionalTypes: NoticeType[] = [NoticeType.APPLICATION];
    if (emailOptionalTypes.includes(dto.type)) {
      if (!user.metadata?.sendMail) {
        canSendMail = false;
      }
    }

    if (sendWithMail !== undefined) {
      if (sendWithMail) {
        canSendMail = true;
      } else {
        canSendMail = false;
      }
    }

    if (canSendMail) {
      if (dto.emailMessage) {
        void this.mailService.sendMailNormal({
          to: user.email,
          subject: dto.type,
          text: dto.emailMessage,
        });
      } else {
        void this.mailService.sendMail(user.email, notice);
      }
    }

    // Gửi thông báo qua Telegram nếu user đã cấu hình chatId
    if (user.metadata?.telegramChatId && user.metadata?.sendTelegram) {
      let title: string = dto.type;
      const message = dto.message;
      const time = TimeUtil.formatInTimeZone(notice.createdAt);
      switch (dto.variant) {
        case NoticeVariant.SUCCESS:
          title = `✅ ${dto.type}`;
          break;
        case NoticeVariant.ERROR:
          title = `❌ ${dto.type}`;
          break;
        case NoticeVariant.WARNING:
          title = `⚠️ ${dto.type}`;
          break;
        default:
          title = `📢 ${dto.type}`;
          break;
      }

      // Convert HTML message to Telegram-compatible format
      const telegramMessage = this.convertHtmlForTelegram(message);

      void this.telegramUserService.sendMessage(
        user.metadata.telegramChatId,
        `<b>${this.escapeHtml(title)}</b>\n\n${telegramMessage}\n\n⏰ ${time}`,
        { parseMode: 'HTML' },
      );
    }

    return;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Convert HTML message to Telegram-compatible HTML
   * Telegram only supports: <b>, <strong>, <i>, <em>, <u>, <a href="">, <code>, <pre>
   */
  private convertHtmlForTelegram(html: string): string {
    if (!html) return '';

    let text = html;

    // Store links temporarily with placeholders
    const links: Array<{ url: string; text: string }> = [];
    text = text.replace(
      /<a\s+href="([^"]+)"[^>]*>([^<]*)<\/a>/gi,
      (match, url, linkText) => {
        const index = links.length;
        links.push({ url, text: linkText });
        return `___LINK_${index}___`;
      },
    );

    // Remove all HTML tags
    text = text.replace(/<[^>]+>/g, ' ');

    // Decode common HTML entities
    text = text
      .replace(/&nbsp;/g, ' ')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');

    // Clean up whitespace
    text = text.replace(/\s+/g, ' '); // Multiple spaces to single space
    text = text.replace(/ +\n/g, '\n'); // Remove trailing spaces before newline
    text = text.replace(/\n +/g, '\n'); // Remove leading spaces after newline

    // Restore links with proper Telegram format
    links.forEach((link, index) => {
      const escapedText = link.text.trim() || 'here';
      text = text.replace(
        `___LINK_${index}___`,
        `<a href="${link.url}">${escapedText}</a>`,
      );
    });

    // Clean up multiple newlines/spaces created during processing
    text = text.replace(/\n{3,}/g, '\n\n');
    text = text.replace(/\s{2,}/g, ' ');

    return text.trim();
  }

  async maskAsRead(id: string) {
    return this.noticeModel.findByIdAndUpdate(
      id,
      { viewed: true },
      { new: true },
    );
  }

  async getNotViewedByAccount(account: Account) {
    return this.noticeModel
      .find({ account: account._id, viewed: false })
      .sort({ createdAt: 'desc' });
  }

  async clearAllByAccount(account: Account) {
    await this.noticeModel.updateMany(
      { account: account._id },
      { viewed: true },
      { new: true },
    );
  }

  async isExist(accountId: MongoId, type: NoticeType, before?: Date) {
    if (before) {
      const docBefore = await this.noticeModel.findOne({
        account: accountId,
        type,
        createdAt: before,
      });
      return !!docBefore;
    }
    const doc = await this.noticeModel.findOne({ account: accountId, type });
    return !!doc;
  }

  async existingNotices(accountIds: MongoId[], type: NoticeType) {
    return this.noticeModel.find({ account: { $in: accountIds }, type });
  }

  async noticeToAdmins(dto: NoticeToAdminDto) {
    const admins = await this.accountModel
      .find({ role: AccountRole.ADMIN })
      .lean();
    await Promise.allSettled(
      admins.map((admin) => this.create({ dto, account: admin })),
    );
    // send telegram to admins
    void this.telegramAdminService.sendNotice(dto.type, dto.message);
    return 'Notice sent';
  }

  async noticeToAllUsers(dto: NoticeToUsersDto) {
    const users = await this.accountModel
      .find({ role: AccountRole.USER })
      .lean();
    void Promise.allSettled(
      users.map((user) =>
        this.createAndSend({ dto, account: user, sendWithMail: false }),
      ),
    );

    return 'Notice sent';
  }

  async noticeToUser(userId: string, arg: NoticeToUserDto) {
    const user = await this.accountModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found!');
    }
    await this.createAndSend({
      dto: arg,
      account: user,
      sendWithMail: arg.sendWithMail,
    });

    return 'Notice sent';
  }

  async noticeToSomeUsers(ids: string[], arg: NoticeToSomeUsersDto) {
    const users = await this.accountModel.find({ _id: { $in: ids } });

    for (const user of users) {
      void this.createAndSend({
        dto: arg,
        account: user,
        sendWithMail: arg.sendWithMail,
      });
    }

    return 'Notice sent';
  }
}
