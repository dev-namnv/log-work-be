import { formatInTimeZone } from 'date-fns-tz';

export class TimeUtil {
  static formatInTimeZone(date?: Date): string {
    return formatInTimeZone(
      date ? date : new Date(),
      'Asia/Ho_Chi_Minh',
      'yyyy-MM-dd HH:mm:ss',
    );
  }
}
