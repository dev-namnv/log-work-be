import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import environment from 'src/config/environment';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      useFactory: async () => ({
        uri: environment().database,
        autoCreate: true,
      }),
    }),
  ],
})
export class DatabaseModule {}
