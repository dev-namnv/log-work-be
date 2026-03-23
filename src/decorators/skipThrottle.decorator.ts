import { SetMetadata } from '@nestjs/common';

export const SKIP_THROTTLE = 'throttler_skip';

export const SkipThrottle = () => SetMetadata(SKIP_THROTTLE, true);
