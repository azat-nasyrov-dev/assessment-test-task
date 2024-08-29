import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserModel, UserSchema } from './models/user.model';
import { AvatarModel, AvatarSchema } from './models/avatar.model';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserModel.name, schema: UserSchema },
      { name: AvatarModel.name, schema: AvatarSchema },
    ]),
  ],
})
export class UsersModule {}
