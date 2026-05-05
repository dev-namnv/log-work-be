import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { GitProvider } from 'src/schemas/git-integration';

export class OAuthUrlDto {
  @ApiProperty({
    enum: GitProvider,
    description: 'Git provider (github | gitlab)',
  })
  @IsEnum(GitProvider)
  @IsNotEmpty()
  provider: GitProvider;
}

export class OAuthCallbackDto {
  @ApiProperty({ description: 'Authorization code returned by the provider' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ description: 'State token to verify the OAuth flow' })
  @IsString()
  @IsNotEmpty()
  state: string;
}
