import { applyDecorators } from '@nestjs/common';
import { ApiBearerAuth, ApiUnauthorizedResponse } from '@nestjs/swagger';

export const ApiJWTAuth = (required?: boolean) =>
  required
    ? applyDecorators(
        ApiBearerAuth('JWT'),
        ApiUnauthorizedResponse({ description: 'Unauthorized' }),
      )
    : applyDecorators(ApiBearerAuth('JWT'));
