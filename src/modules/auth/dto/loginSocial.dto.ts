import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty } from 'class-validator'

export class LoginSocialDto {
  @ApiProperty()
  @IsNotEmpty({ message: 'Token cannot be empty' })
  accessToken: string
}
