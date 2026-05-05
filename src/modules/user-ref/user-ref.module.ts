import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserRef, UserRefSchema } from 'src/schemas/user-ref';
import { UserRefController } from './user-ref.controller';
import { UserRefService } from './user-ref.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: UserRef.name, schema: UserRefSchema }]),
  ],
  controllers: [UserRefController],
  providers: [UserRefService],
  exports: [UserRefService],
})
export class UserRefModule {}
