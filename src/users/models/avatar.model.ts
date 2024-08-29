import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class AvatarModel extends Document {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  hash: string;

  @Prop({ required: true })
  base64: string;
}

export const AvatarSchema = SchemaFactory.createForClass(AvatarModel);
