import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { IdentityService } from './identity.service';
import { CreateUserDto, UserResponseDto } from '../common/dto/user.dto';

@Controller('v1/auth')
export class IdentityController {
  constructor(private readonly identityService: IdentityService) {}

  @Post('register')
  async register(@Body() createUserDto: CreateUserDto): Promise<UserResponseDto> {
    const user = await this.identityService.register(createUserDto);
    return {
      userId: user.userId,
      email: user.email,
      accountStatus: user.accountStatus,
      createdAt: user.createdAt,
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() credentials: { email: string; password: string }) {
    const user = await this.identityService.validateUser(
      credentials.email,
      credentials.password,
    );

    if (!user) {
      throw new Error('Invalid credentials');
    }

    return {
      userId: user.userId,
      email: user.email,
      accountStatus: user.accountStatus,
      message: 'Login successful',
    };
  }
}
