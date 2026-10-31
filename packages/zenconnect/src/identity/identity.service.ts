import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { CreateUserDto, User, AccountStatus } from '../common/dto/user.dto';

@Injectable()
export class IdentityService {
  private users: Map<string, User> = new Map();
  private emailIndex: Map<string, string> = new Map();

  async register(createUserDto: CreateUserDto): Promise<User> {
    if (this.emailIndex.has(createUserDto.email)) {
      throw new Error('Email already registered');
    }

    const userId = uuidv4();
    const passwordHash = await bcrypt.hash(createUserDto.password, 10);

    const user: User = {
      userId,
      email: createUserDto.email,
      passwordHash,
      accountStatus: AccountStatus.ACTIVE,
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.users.set(userId, user);
    this.emailIndex.set(user.email, userId);

    return user;
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    const userId = this.emailIndex.get(email);
    if (!userId) {
      return null;
    }

    const user = this.users.get(userId);
    if (!user) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return null;
    }

    return user;
  }

  async findById(userId: string): Promise<User | null> {
    return this.users.get(userId) || null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const userId = this.emailIndex.get(email);
    if (!userId) {
      return null;
    }
    return this.users.get(userId) || null;
  }

  async verifyEmail(userId: string): Promise<void> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    user.emailVerified = true;
    user.updatedAt = new Date();
    this.users.set(userId, user);
  }

  async updatePassword(userId: string, newPassword: string): Promise<void> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    user.passwordHash = passwordHash;
    user.updatedAt = new Date();
    this.users.set(userId, user);
  }
}
