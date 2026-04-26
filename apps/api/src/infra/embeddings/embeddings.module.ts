import { Global, Module } from '@nestjs/common';
import { EnvService } from '../config/env.service';
import { EMBEDDER } from './embedder.interface';
import { VoyageEmbedder } from './voyage.embedder';

@Global()
@Module({
  providers: [
    VoyageEmbedder,
    {
      provide: EMBEDDER,
      inject: [EnvService, VoyageEmbedder],
      useFactory: (env: EnvService, voyage: VoyageEmbedder) => {
        const provider = env.get('EMBEDDINGS_PROVIDER');
        switch (provider) {
          case 'voyage':
            return voyage;
          default:
            throw new Error(
              `Unsupported EMBEDDINGS_PROVIDER='${provider}' — only 'voyage' is wired today.`,
            );
        }
      },
    },
  ],
  exports: [EMBEDDER],
})
export class EmbeddingsModule {}
