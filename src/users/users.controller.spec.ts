import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';

describe('UsersController', () => {
  let controller: UsersController;
  let service: UsersService;

  const mockUsersService = {
    createUser: jest.fn(),
    getUserById: jest.fn(),
    getUserAvatar: jest.fn(),
    deleteUserAvatar: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call createUser on UsersService', async () => {
    const createUserDto: CreateUserDto = { email: 'test@test.com', name: 'Test' };
    await controller.createUser(createUserDto);

    expect(service.createUser).toHaveBeenCalledWith(createUserDto);
  });

  it('should call getUserById on UsersService', async () => {
    const userId = '1';
    await controller.getUserById(userId);

    expect(service.getUserById).toHaveBeenCalledWith(userId);
  });

  it('should call getUserAvatar on UsersService', async () => {
    const userId = '1';
    await controller.getUserAvatar(userId);

    expect(service.getUserAvatar).toHaveBeenCalledWith(userId);
  });

  it('should call deleteUserAvatar on UsersService', async () => {
    const userId = '1';
    await controller.deleteUserAvatar(userId);

    expect(service.deleteUserAvatar).toHaveBeenCalledWith(userId);
  });
});
