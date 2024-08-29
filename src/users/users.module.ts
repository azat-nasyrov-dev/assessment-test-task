import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HttpModule } from '@nestjs/axios';
import { UserModel, UserSchema } from './models/user.model';
import { AvatarModel, AvatarSchema } from './models/avatar.model';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { MailService } from './mail.service';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { RABBITMQ_SERVICE } from './constants';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: RABBITMQ_SERVICE,
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL],
          queue: 'users-queue',
        },
      },
    ]),
    MongooseModule.forFeature([
      { name: UserModel.name, schema: UserSchema },
      { name: AvatarModel.name, schema: AvatarSchema },
    ]),
    HttpModule,
  ],
  controllers: [UsersController],
  providers: [UsersService, MailService],
})
export class UsersModule {}
