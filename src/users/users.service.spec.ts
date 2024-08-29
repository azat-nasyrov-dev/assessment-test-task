import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { getModelToken } from '@nestjs/mongoose';
import { HttpService } from '@nestjs/axios';
import { MailService } from './mail.service';
import { ClientProxy } from '@nestjs/microservices';
import { UserModel } from './models/user.model';
import { AvatarModel } from './models/avatar.model';
import { of } from 'rxjs';
import { RABBITMQ_SERVICE } from './constants';
import { HttpException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('fs');

describe('UsersService', () => {
  let service: UsersService;
  let mailService: MailService;
  let rabbitClient: ClientProxy;

  const mockUserModel = {
    find: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue([]),
    }),
    create: jest.fn((dto) => ({
      ...dto,
      _id: 'someUserId',
      save: jest.fn().mockResolvedValue({
        _id: 'someUserId',
        ...dto,
      }),
    })),
  };

  const mockAvatarModel = {
    findOne: jest.fn().mockImplementation(() => {
      const result = {
        exec: jest.fn().mockResolvedValue(null),
      };
      console.log('mockAvatarModel.findOne called, returning:', result);
      return result;
    }),
    create: jest.fn((dto) => ({
      ...dto,
      save: jest.fn().mockResolvedValue(dto),
    })),
    deleteOne: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue({}),
    }),
  };

  const mockHttpService = {
    get: jest.fn().mockReturnValue(of({ data: { data: {} } })),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        MailService,
        {
          provide: getModelToken(UserModel.name),
          useValue: mockUserModel,
        },
        {
          provide: getModelToken(AvatarModel.name),
          useValue: mockAvatarModel,
        },
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
        {
          provide: MailService,
          useValue: {
            sendMail: jest.fn(),
          },
        },
        {
          provide: RABBITMQ_SERVICE,
          useValue: {
            emit: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    mailService = module.get<MailService>(MailService);
    rabbitClient = module.get<ClientProxy>(RABBITMQ_SERVICE);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createUser', () => {
    it('should create a user and send email and RabbitMQ event', async () => {
      const createUserDto = { email: 'test@test.com', name: 'Test' };
      await service.createUser(createUserDto);

      expect(mockUserModel.find).toHaveBeenCalledWith({ email: createUserDto.email });
      expect(mockUserModel.create).toHaveBeenCalledWith(createUserDto);
      expect(mailService.sendMail).toHaveBeenCalledWith({
        to: createUserDto.email,
        subject: 'Confirm your email',
        text: 'Please confirm your email by clicking on the link',
      });
      expect(rabbitClient.emit).toHaveBeenCalledWith('user.created', {
        userId: 'someUserId',
        email: createUserDto.email,
      });
    });

    it('should throw error if user already exists', async () => {
      mockUserModel.find.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([{}]),
      });

      const createUserDto = { email: 'test@test.com', name: 'Test' };

      await expect(service.createUser(createUserDto)).rejects.toThrowError(
        'This user has already been registered',
      );
    });
  });

  describe('getUserById', () => {
    it('should return user data from external API', async () => {
      mockHttpService.get.mockReturnValue(
        of({ data: { data: { id: '1', email: 'test@test.com' } } }),
      );

      const result = await service.getUserById('1');

      expect(mockHttpService.get).toHaveBeenCalledWith('https://reqres.in/api/users/1');
      expect(result).toEqual({ id: '1', email: 'test@test.com' });
    });

    it('should throw error if external API call fails', async () => {
      mockHttpService.get.mockReturnValue(Promise.reject(new Error('API error')));

      await expect(service.getUserById('1')).rejects.toThrow(HttpException);
    });
  });

  describe('getUserAvatar', () => {
    const mockUploadsDir = path.join(process.cwd(), 'uploads');

    beforeAll(() => {
      (fs.existsSync as jest.Mock).mockImplementation((path) => path === mockUploadsDir);
      (fs.mkdirSync as jest.Mock).mockImplementation();
    });

    it('should return avatar from file if exists', async () => {
      mockAvatarModel.findOne.mockResolvedValue({ hash: '12345' });
      const mockFilePath = path.join(mockUploadsDir, '12345.jpg');
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(Buffer.from('image-data'));

      const result = await service.getUserAvatar('1');

      expect(fs.readFileSync).toHaveBeenCalledWith(mockFilePath);
      expect(result).toBe(Buffer.from('image-data').toString('base64'));
    });

    it('should fetch avatar from external API and save it if not exists', async () => {
      mockAvatarModel.findOne.mockResolvedValue(null);
      mockHttpService.get.mockReturnValue(of({ data: 'binary-image-data' }));
      (fs.writeFileSync as jest.Mock).mockImplementation();
      const mockSave = jest.fn().mockResolvedValue({});
      mockAvatarModel.create.mockReturnValue({ save: mockSave });

      const result = await service.getUserAvatar('1');

      expect(mockHttpService.get).toHaveBeenCalled();
      expect(fs.writeFileSync).toHaveBeenCalled();
      expect(mockSave).toHaveBeenCalled();
      expect(result).toBe(Buffer.from('binary-image-data', 'binary').toString('base64'));
    });

    it('should throw error if there is an issue processing avatar', async () => {
      mockAvatarModel.findOne.mockRejectedValue(new Error('DB error'));

      await expect(service.getUserAvatar('1')).rejects.toThrow(HttpException);
    });
  });

  describe('deleteUserAvatar', () => {
    const mockUploadsDir = path.join(process.cwd(), 'uploads');

    beforeAll(() => {
      (fs.existsSync as jest.Mock).mockImplementation((path) => path === mockUploadsDir);
      (fs.unlinkSync as jest.Mock).mockImplementation();
    });

    it('should delete avatar and file if they exist', async () => {
      mockAvatarModel.findOne.mockResolvedValue({ hash: '12345' });
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      await service.deleteUserAvatar('1');

      expect(fs.unlinkSync).toHaveBeenCalled();
      expect(mockAvatarModel.deleteOne).toHaveBeenCalledWith({ userId: '1' });
    });

    it('should log a warning if file does not exist', async () => {
      mockAvatarModel.findOne.mockResolvedValue({ hash: '12345' });
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const loggerWarnSpy = jest.spyOn(service['logger'], 'warn');

      await service.deleteUserAvatar('1');

      expect(loggerWarnSpy).toHaveBeenCalledWith(expect.stringContaining('does not exist'));
    });

    it('should log a warning if avatar record is not found', async () => {
      mockAvatarModel.findOne.mockResolvedValue(null);

      const loggerWarnSpy = jest.spyOn(service['logger'], 'warn');

      await service.deleteUserAvatar('1');

      expect(loggerWarnSpy).toHaveBeenCalledWith(expect.stringContaining('not found'));
    });

    it('should throw error if there is an issue deleting avatar', async () => {
      mockAvatarModel.findOne.mockRejectedValue(new Error('DB error'));

      await expect(service.deleteUserAvatar('1')).rejects.toThrow(HttpException);
    });
  });
});
