import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from './user.entity';
import { UserProfileEntity } from './user-profile.entity';
import { UserAuthService } from './user-auth.service';
import { UserAuthGuard } from './user-auth.guard';
import { UsersService } from './users.service';
import { UserProfilesService } from './user-profiles.service';
import { UserAuthController } from './user-auth.controller';
import { MeController } from './me.controller';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity, UserProfileEntity])],
  controllers: [UserAuthController, MeController],
  providers: [
    UserAuthService,
    UserAuthGuard,
    UsersService,
    UserProfilesService,
  ],
  exports: [
    UserAuthService,
    UserAuthGuard,
    UsersService,
    UserProfilesService,
  ],
})
export class UsersModule {}
