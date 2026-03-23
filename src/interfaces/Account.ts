export enum AccountRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
}

export interface AccountMetadata {
  sendMail?: boolean;
  telegramChatId?: string;
  sendTelegram?: boolean;
  invitedCode?: string;
  myCode?: string;
  otpCode?: string;
  otpExpiry?: Date;
  otpVerified?: boolean;
  pendingLoginIp?: string;
  [key: string]: any;
}
