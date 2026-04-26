import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EnvModule } from '../config/env.module';
import { EnvService } from '../config/env.service';

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [EnvModule],
      inject: [EnvService],
      useFactory: (env: EnvService) => ({
        type: 'postgres' as const,
        url: env.get('POSTGRES_URL'),
        ssl: { rejectUnauthorized: false },
        autoLoadEntities: true,
        synchronize: env.get('TYPEORM_SYNC'),
        logging: env.get('TYPEORM_LOGGING'),
        migrationsRun: false,
      }),
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
