import { Injectable } from '@nestjs/common';
import { SentMessageInfo, Transporter } from 'nodemailer';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';
import { CustomSendMailOptionsInterface } from './types/custom-send-mail-options.interface';

@Injectable()
export class MailService {
  private readonly transporter: Transporter<SentMessageInfo>;

  constructor(private readonly configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('MAIL_HOST'),
      port: this.configService.get<number>('MAIL_PORT'),
      secure: true,
      auth: {
        user: this.configService.get<string>('MAIL_USER'),
        pass: this.configService.get<string>('MAIL_PASSWORD'),
      },
    });
  }

  public async sendMail(mailOptions: CustomSendMailOptionsInterface): Promise<SentMessageInfo> {
    return await this.transporter.sendMail(mailOptions);
  }
}
