# Telegram Bot Module

Module Telegram Bot để gửi thông báo và cảnh báo cho admin.

## Cấu hình

Thêm các biến môi trường sau vào file `.env`:

```env
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_ADMIN_CHAT_IDS=123456789,987654321
```

### Cách lấy Bot Token:

1. Mở Telegram và tìm [@BotFather](https://t.me/botfather)
2. Gửi lệnh `/newbot` và làm theo hướng dẫn
3. Copy Bot Token và dán vào biến `TELEGRAM_BOT_TOKEN`

### Cách lấy Chat ID:

1. Mở bot [@userinfobot](https://t.me/userinfobot)
2. Gửi bất kỳ tin nhắn nào
3. Bot sẽ trả về Chat ID của bạn
4. Thêm Chat ID vào `TELEGRAM_ADMIN_CHAT_IDS` (có thể thêm nhiều ID, phân cách bằng dấu phẩy)

## Sử dụng

### Import vào module của bạn:

```typescript
import { TelegramModule } from './telegram/telegram.module';

@Module({
  imports: [TelegramModule],
  // ...
})
export class YourModule {}
```

### Inject service và sử dụng:

```typescript
import { Injectable } from '@nestjs/common';
import { TelegramService } from './telegram/telegram.service';

@Injectable()
export class YourService {
  constructor(private readonly telegramService: TelegramService) {}

  async someMethod() {
    // Gửi thông báo thông thường
    await this.telegramService.sendNotice(
      'Đăng ký mới',
      'Có người dùng mới đăng ký vào hệ thống',
    );

    // Gửi cảnh báo
    await this.telegramService.sendAlert('Hệ thống quá tải', 'CPU usage: 95%');

    // Gửi thông báo lỗi
    try {
      // some code
    } catch (error) {
      await this.telegramService.sendError(error, 'Payment processing');
    }

    // Gửi tin nhắn có định dạng
    await this.telegramService.sendFormattedMessage({
      title: 'Báo cáo hàng ngày',
      fields: [
        { name: 'Người dùng mới', value: '150' },
        { name: 'Doanh thu', value: '$1,234' },
        { name: 'Lỗi', value: '3' },
      ],
      footer: 'Ngày 5/1/2026',
    });
  }
}
```

## API Methods

### `sendToAdmin(message: string, options?: TelegramMessageOptions)`

Gửi tin nhắn đến tất cả admin chat IDs đã cấu hình.

### `sendAlert(title: string, details: string)`

Gửi cảnh báo với icon 🚨 và định dạng đặc biệt.

### `sendNotice(title: string, message: string)`

Gửi thông báo thông thường với icon 📢.

### `sendError(error: Error, context?: string)`

Gửi thông báo lỗi với stack trace (giới hạn 500 ký tự).

### `sendFormattedMessage(data: object)`

Gửi tin nhắn với các trường dữ liệu được format đẹp.

### `isConfigured(): boolean`

Kiểm tra xem bot đã được cấu hình chưa.
