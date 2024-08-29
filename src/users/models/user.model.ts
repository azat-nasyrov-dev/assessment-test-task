import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class UserModel extends Document {
  @Prop({ unique: true, required: true })
  name: string;

  @Prop({ unique: true, required: true })
  email: string;
}

export const UserSchema = SchemaFactory.createForClass(UserModel);
