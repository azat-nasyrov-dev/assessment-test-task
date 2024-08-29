import { SendMailOptions } from 'nodemailer';

export interface CustomSendMailOptionsInterface extends SendMailOptions {
  locals?: Record<string, any>;
  template?: string;
}
