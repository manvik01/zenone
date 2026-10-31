import { IsEmail, IsString, MinLength, IsEnum, IsDate } from 'class-validator';

export enum AccountStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  DELETED = 'DELETED',
}

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}

export class User {
  userId: string;
  email: string;
  passwordHash: string;
  accountStatus: AccountStatus;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class UserResponseDto {
  userId: string;
  email: string;
  accountStatus: AccountStatus;
  emailVerified: boolean;
  createdAt: Date;
}
