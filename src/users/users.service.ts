import { HttpException, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { ClientProxy } from '@nestjs/microservices';
import { UserModel } from './models/user.model';
import { AvatarModel } from './models/avatar.model';
import { CreateUserDto } from './dto/create-user.dto';
import { UserResponseInterface } from './types/user-response.interface';
import { MailService } from './mail.service';
import { RABBITMQ_SERVICE } from './constants';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectModel(UserModel.name)
    private readonly userModel: Model<UserModel>,
    @InjectModel(AvatarModel.name)
    private readonly avatarModel: Model<AvatarModel>,
    private readonly httpService: HttpService,
    private readonly mailService: MailService,
    @Inject(RABBITMQ_SERVICE)
    private readonly rabbitClient: ClientProxy,
  ) {}

  public async createUser(createUserDto: CreateUserDto): Promise<UserModel> {
    try {
      const users = await this.userModel.find({ email: createUserDto.email }).exec();
      if (users.length) {
        throw new HttpException('This user has already been registered', HttpStatus.BAD_REQUEST);
      }

      const newUser = new this.userModel(createUserDto);
      await newUser.save();

      try {
        await this.mailService.sendMail({
          to: newUser.email,
          subject: 'Confirm your email',
          text: 'Please confirm your email by clicking on the link',
        });
        this.logger.log(`Email sent to ${newUser.email}`);
      } catch (err) {
        this.logger.error(`Failed to send confirmation email to ${newUser.email}`, err.stack);
      }

      try {
        this.rabbitClient.emit('user.created', { userId: newUser._id, email: newUser.email });
        this.logger.log(`RabbitMQ event sent for userId ${newUser._id}`);
      } catch (err) {
        this.logger.error(`Failed to send RabbitMQ event for userId ${newUser._id}`, err.stack);
      }

      return newUser;
    } catch (err) {
      this.logger.error('Error creating user', err.stack);
      throw err;
    }
  }

  public async getUserById(userId: string): Promise<UserResponseInterface> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`https://reqres.in/api/users/${userId}`),
      );
      return response.data.data;
    } catch (err) {
      this.logger.error(`Failed to fetch user with ID ${userId}`, err.stack);
      throw new HttpException('Failed to fetch user data', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  public async getUserAvatar(userId: string): Promise<string> {
    try {
      const uploadsDir = path.join(process.cwd(), 'uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const avatarRecord = await this.avatarModel.findOne({ userId }).exec();
      if (avatarRecord) {
        const filePath = path.join(uploadsDir, `${avatarRecord.hash}.jpg`);
        if (fs.existsSync(filePath)) {
          const fileBuffer = fs.readFileSync(filePath);
          return fileBuffer.toString('base64');
        }
      }

      const user = await this.getUserById(userId);
      const avatarUrl = user.avatar;

      const response = await firstValueFrom(
        this.httpService.get(avatarUrl, {
          responseType: 'arraybuffer',
        }),
      );

      const imageBuffer = Buffer.from(response.data, 'binary');
      const base64 = imageBuffer.toString('base64');

      const hash = crypto.createHash('sha256').update(imageBuffer).digest('hex');

      const filePath = path.join(uploadsDir, `${hash}.jpg`);
      fs.writeFileSync(filePath, imageBuffer);

      const newAvatar = new this.avatarModel({ userId, hash, base64 });
      await newAvatar.save();

      return base64;
    } catch (err) {
      this.logger.error(`Failed to get or save avatar for userId ${userId}`, err.stack);
      throw new HttpException('Failed to process avatar', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  public async deleteUserAvatar(userId: string): Promise<void> {
    try {
      const uploadsDir = path.join(process.cwd(), 'uploads');

      const avatarRecord = await this.avatarModel.findOne({ userId }).exec();
      if (avatarRecord) {
        const filePath = path.join(uploadsDir, `${avatarRecord.hash}.jpg`);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          this.logger.log(`File ${filePath} has been deleted`);
        } else {
          this.logger.warn(`File ${filePath} does not exist`);
        }

        await this.avatarModel.deleteOne({ userId }).exec();
        this.logger.log(`Avatar record for userId ${userId} has been deleted from the database`);
      } else {
        this.logger.warn(`Avatar record for userId ${userId} not found`);
      }
    } catch (err) {
      this.logger.error(`Failed to delete avatar for userId ${userId}`, err.stack);
      throw new HttpException('Failed to delete avatar', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
