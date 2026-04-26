import { Injectable, Logger } from '@nestjs/common';
import { EnvConfig, envSchema } from './env.schema';

@Injectable()
export class EnvService {
  private readonly logger = new Logger(EnvService.name);
  private readonly config: EnvConfig;

  constructor() {
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('\n');
      this.logger.error(`Invalid environment configuration:\n${issues}`);
      throw new Error('Invalid environment configuration');
    }
    this.config = parsed.data;
  }

  get<K extends keyof EnvConfig>(key: K): EnvConfig[K] {
    return this.config[key];
  }

  all(): EnvConfig {
    return this.config;
  }

  isProduction(): boolean {
    return this.config.NODE_ENV === 'production';
  }

  /**
   * Zilliz Cloud accepts either a cluster API key in MILVUS_TOKEN, or
   * database user auth as the token string "username:password" (MILVUS_USER +
   * MILVUS_PASSWORD if MILVUS_TOKEN is unset/empty).
   */
  getMilvusToken(): string | undefined {
    const raw = this.config.MILVUS_TOKEN;
    if (raw !== undefined && raw.trim() !== '') return raw.trim();
    const u = this.config.MILVUS_USER;
    const p = this.config.MILVUS_PASSWORD;
    if (u && p) return `${u}:${p}`;
    return undefined;
  }
}
