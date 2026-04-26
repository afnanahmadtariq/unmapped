import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from './user.entity';
import { UserAuthService } from './user-auth.service';

export interface CreateUserInput {
  email: string;
  password: string;
  displayName?: string;
}

export interface PublicUser {
  id: string;
  email: string;
  displayName: string | null;
  createdAt: string;
}

/**
 * Sign-up + login orchestration.
 *
 * Errors are deliberately vague at the auth surface (UnauthorizedException
 * for any wrong-credentials path) so the controller can render a generic
 * "invalid email or password" without leaking which half failed.
 */
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    private readonly auth: UserAuthService,
  ) {}

  async signup(input: CreateUserInput): Promise<{ user: PublicUser; token: string }> {
    if (!this.auth.isEnabled()) {
      throw new ForbiddenException('User auth not configured');
    }
    if (!this.auth.isSignupEnabled()) {
      throw new ForbiddenException('Sign-ups are disabled');
    }
    const email = this.normalizeEmail(input.email);
    if (input.password.length < 8) {
      throw new ConflictException('Password must be at least 8 characters');
    }
    const existing = await this.users.findOne({ where: { email } });
    if (existing) {
      throw new ConflictException('An account with that email already exists');
    }
    const passwordHash = await this.auth.hashPassword(input.password);
    const created = await this.users.save(
      this.users.create({
        email,
        displayName: input.displayName?.trim() || null,
        passwordHash,
      }),
    );
    this.logger.log(`Created user ${created.id} (${email}).`);
    const token = this.auth.signToken({ userId: created.id, email });
    return { user: this.toPublic(created), token };
  }

  async login(email: string, password: string): Promise<{ user: PublicUser; token: string }> {
    if (!this.auth.isEnabled()) {
      throw new ForbiddenException('User auth not configured');
    }
    const user = await this.users.findOne({
      where: { email: this.normalizeEmail(email) },
    });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const ok = await this.auth.comparePassword(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const token = this.auth.signToken({ userId: user.id, email: user.email });
    return { user: this.toPublic(user), token };
  }

  async findById(id: string): Promise<PublicUser> {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return this.toPublic(user);
  }

  async updateDisplayName(id: string, displayName: string | null): Promise<PublicUser> {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    user.displayName = displayName?.trim() || null;
    const saved = await this.users.save(user);
    return this.toPublic(saved);
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private toPublic(user: UserEntity): PublicUser {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
