import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UserModel } from './models/user.model';
import { UserResponseInterface } from './types/user-response.interface';

@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('users')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  public async createUser(@Body() createUserDto: CreateUserDto): Promise<UserModel> {
    return await this.usersService.createUser(createUserDto);
  }

  @Get('user/:userId')
  public async getUserById(@Param('userId') userId: string): Promise<UserResponseInterface> {
    return await this.usersService.getUserById(userId);
  }

  @Get('user/:userId/avatar')
  public async getUserAvatar(@Param('userId') userId: string): Promise<string> {
    return await this.usersService.getUserAvatar(userId);
  }

  @Delete('user/:userId/avatar')
  public async deleteUserAvatar(@Param('userId') userId: string): Promise<void> {
    return await this.usersService.deleteUserAvatar(userId);
  }
}
