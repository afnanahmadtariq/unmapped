import { Injectable, Logger } from '@nestjs/common';
import { EscoIngestService } from '../taxonomies/esco/esco-ingest.service';
import { OnetIngestService } from '../signals/onet-ingest.service';
import {
  CorporaIngestService,
  type CorpusDocumentInput,
} from '../corpora/corpora-ingest.service';
import type { DocumentCorpus } from '../corpora/corpora.collection';
import {
  CustomDocumentsService,
  type CustomDocumentInput,
} from './custom-documents.service';
import type { DatasetLoader, DatasetLoaderContext } from './loader.types';
import type { HarvestedDataset } from '../types/dataset.types';

/**
 * Vector strategy — used by harvesters whose payload is *text* worth
 * embedding (ESCO skills, O*NET tasks, future policy-report / training
 * corpora). It writes to Postgres AND embeds into Milvus, so the system
 * can do RAG retrieval the moment harvest finishes.
 *
 * Every embedded record is tagged with `ctx.runId` (Postgres + Milvus
 * metadata) so a run deletion fans out cleanly to the vector store.
 */
@Injectable()
export class VectorLoader implements DatasetLoader {
  readonly name = 'vector';
  private readonly logger = new Logger(VectorLoader.name);

  constructor(
    private readonly escoIngest: EscoIngestService,
    private readonly onetIngest: OnetIngestService,
    private readonly corporaIngest: CorporaIngestService,
    private readonly customDocs: CustomDocumentsService,
  ) {}

  async load(dataset: HarvestedDataset, ctx: DatasetLoaderContext = {}) {
    if (dataset.sourceId === 'esco') {
      return this.loadEsco(dataset, ctx);
    }
    if (dataset.sourceId === 'onet') {
      return this.loadOnet(dataset, ctx);
    }
    if (
      dataset.sourceId === 'policy_reports' ||
      dataset.sourceId === 'training_programs'
    ) {
      return this.loadCorpus(dataset.sourceId, dataset, ctx);
    }
    return this.loadCustomCorpus(dataset, ctx);
  }

  /**
   * Generic vector ingest for any admin-defined source whose payload is
   * text. Each upload becomes a set of `document_chunks` rows + Milvus
   * embeddings in `unmapped_custom_<slug>`. Cascade-delete is handled
   * uniformly by `LineageService.deleteRun` via `corpus = sourceSlug`.
   */
  private async loadCustomCorpus(
    dataset: HarvestedDataset,
    ctx: DatasetLoaderContext,
  ) {
    const docs: CustomDocumentInput[] = [];
    (dataset.records ?? []).forEach((r: any, idx: number) => {
      const body =
        (typeof r.body === 'string' && r.body) ||
        (typeof r.text === 'string' && r.text) ||
        (typeof r.content === 'string' && r.content) ||
        '';
      if (!body || body.trim().length === 0) return;
      const documentId = String(
        r.documentId ?? r.id ?? r.slug ?? `doc-${idx + 1}`,
      );
      const title = String(r.title ?? r.name ?? r.heading ?? '');
      const {
        body: _b,
        text: _t,
        content: _c,
        title: _ti,
        name: _n,
        heading: _h,
        id: _i,
        slug: _s,
        documentId: _d,
        ...rest
      } = r as Record<string, unknown>;
      docs.push({
        documentId,
        title,
        body,
        metadata: Object.keys(rest).length > 0 ? rest : undefined,
      });
    });

    if (docs.length === 0) {
      return {
        persisted: 0,
        note: `vector upload for ${dataset.sourceId} had no usable text records (expected body/text/content field).`,
      };
    }

    const result = await this.customDocs.ingest(dataset.sourceId, docs, {
      runId: ctx.runId,
    });
    return {
      persisted: result.chunks,
      note: `custom corpus=${dataset.sourceId} ingested ${result.documents} docs / ${result.chunks} chunks (embedded ${result.embedded}).`,
    };
  }

  private async loadCorpus(
    corpus: DocumentCorpus,
    dataset: HarvestedDataset,
    ctx: DatasetLoaderContext,
  ) {
    const docs: CorpusDocumentInput[] = [];
    (dataset.records ?? []).forEach((r: any, idx: number) => {
      const body =
        (typeof r.body === 'string' && r.body) ||
        (typeof r.text === 'string' && r.text) ||
        (typeof r.content === 'string' && r.content) ||
        '';
      if (!body || body.trim().length === 0) return;
      const documentId = String(
        r.documentId ?? r.id ?? r.slug ?? `doc-${idx + 1}`,
      );
      const title = String(r.title ?? r.name ?? r.heading ?? '');
      const {
        body: _b,
        text: _t,
        content: _c,
        title: _ti,
        name: _n,
        heading: _h,
        id: _i,
        slug: _s,
        documentId: _d,
        ...rest
      } = r as Record<string, unknown>;
      docs.push({
        documentId,
        title,
        body,
        metadata: Object.keys(rest).length > 0 ? rest : undefined,
      });
    });

    if (docs.length === 0) {
      return {
        persisted: 0,
        note: `corpus=${corpus} upload had no usable text records (expected body/text/content field).`,
      };
    }

    const result = await this.corporaIngest.ingestDocuments(corpus, docs, {
      runId: ctx.runId,
    });
    return {
      persisted: result.chunks,
      note: `corpus=${corpus} ingested ${result.documents} docs / ${result.chunks} chunks (embedded ${result.embedded}).`,
    };
  }

  private async loadOnet(
    dataset: HarvestedDataset,
    ctx: DatasetLoaderContext,
  ) {
    const tasks = (dataset.records ?? [])
      .map((r: any) => {
        const onetCode = String(
          r.onetCode ?? r['O*NET-SOC Code'] ?? r['onet_code'] ?? '',
        ).trim();
        const taskId = String(r.taskId ?? r['Task ID'] ?? '').trim();
        const statement = String(r.statement ?? r['Task'] ?? '').trim();
        if (!onetCode || !taskId || !statement) return null;
        const importance =
          r.importance === undefined || r.importance === null
            ? null
            : Number(r.importance);
        const level =
          r.level === undefined || r.level === null ? null : Number(r.level);
        return {
          onetCode,
          taskId,
          statement,
          importance: Number.isFinite(importance as number)
            ? (importance as number)
            : null,
          level: Number.isFinite(level as number) ? (level as number) : null,
          taskType: String(r.taskType ?? r['Task Type'] ?? ''),
          iscoCode: r.iscoCode ?? null,
          source: 'onet',
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    const result = await this.onetIngest.ingestRows(tasks, {
      runId: ctx.runId,
    });
    return {
      persisted: result.inserted,
      note: `embedded ${result.embedded} into Milvus`,
    };
  }

  private async loadEsco(
    dataset: HarvestedDataset,
    ctx: DatasetLoaderContext,
  ) {
    // ESCO harvester emits {recordType: 'skill' | 'occupation'} for every row.
    // We only embed *skills*; occupations go through PostgresLoader→ISCO once
    // the mapping table lands. Until then we skip them silently.
    const skills = (dataset.records ?? [])
      .filter((r: any) => r.recordType !== 'occupation')
      .map((r: any) => {
        const code =
          r.code ??
          r.uri?.split('/').pop() ??
          (typeof r.uri === 'string' ? r.uri.replace(/^.*\//, '') : '');
        const label = r.label ?? r.title ?? '';
        if (!code || !label) return null;
        return {
          code: String(code),
          label: String(label),
          description: r.description ?? r.altLabels?.[0] ?? undefined,
          category: r.skillType ?? r.category ?? 'general',
          iscoLinks: r.iscoLinks ?? (r.iscoGroup ? [r.iscoGroup] : []),
          source: 'esco',
          uri: r.uri,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    const result = await this.escoIngest.ingestRows(skills, {
      runId: ctx.runId,
    });
    return {
      persisted: result.inserted,
      note: `embedded ${result.embedded} into Milvus`,
    };
  }
}
