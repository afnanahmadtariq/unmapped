import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IscoOccupationEntity } from './isco.entity';
import { IscoService } from './isco.service';
import { IscoController } from './isco.controller';

@Module({
  imports: [TypeOrmModule.forFeature([IscoOccupationEntity])],
  controllers: [IscoController],
  providers: [IscoService],
  exports: [IscoService],
})
export class IscoModule {}
