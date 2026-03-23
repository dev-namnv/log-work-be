import { IsNotEmpty, Matches, MinLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class ChangePasswordDto {
  @ApiProperty()
  @MinLength(6, { message: 'Password must be greater than 6 characters' })
  @Matches(/^[^\s\r\n\t]+$/, {
    message: 'Password contains invalid characters'
  })
  @IsNotEmpty({
    message: 'Password cannot be empty'
  })
  password: string

  @ApiProperty()
  @MinLength(6, { message: 'Password must be greater than 6 characters' })
  @Matches(/^[^\s\r\n\t]+$/, {
    message: 'Password contains invalid characters'
  })
  @IsNotEmpty({
    message: 'New password cannot be empty'
  })
  newPassword: string

  @ApiProperty()
  @IsNotEmpty({
    message: 'Password confirm cannot be empty'
  })
  newPasswordConfirm: string
}
