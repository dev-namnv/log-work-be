import { Request } from 'express';

export function getRealClientIp(req: Request): string {
  const headersToCheck = [
    'x-forwarded-for', // IP người dùng thật (qua nhiều proxy)
    'x-real-ip', // IP do Nginx truyền
    'cf-connecting-ip', // IP do Cloudflare cung cấp
  ];

  for (const header of headersToCheck) {
    const value = req.headers[header];
    if (typeof value === 'string' && value.trim().length > 0) {
      // Nếu x-forwarded-for có nhiều IP, IP thật là cái đầu tiên
      return value.split(',')[0].trim();
    }
  }

  // Fallback: lấy IP trực tiếp từ socket
  let ip = req.socket?.remoteAddress || req.connection?.remoteAddress || '';
  // Chuẩn hóa IPv6 -> IPv4
  if (ip.startsWith('::ffff:')) ip = ip.substring(7);
  if (ip === '::1') ip = '127.0.0.1';
  return ip;
}
