import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { EscoService } from './esco.service';
import { EscoSearchService } from './esco-search.service';
import { EscoIngestService } from './esco-ingest.service';

@Controller('taxonomies/esco')
export class EscoController {
  constructor(
    private readonly esco: EscoService,
    private readonly search: EscoSearchService,
    private readonly ingest: EscoIngestService,
  ) {}

  @Get()
  async list(
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ) {
    const [rows, total] = await Promise.all([
      this.esco.findAll(limit, offset),
      this.esco.count(),
    ]);
    return { total, limit, offset, rows };
  }

  @Get('search')
  async semantic(
    @Query('q') q: string,
    @Query('topK', new DefaultValuePipe(12), ParseIntPipe) topK: number,
  ) {
    if (!q?.trim()) return { query: q ?? '', hits: [] };
    const hits = await this.search.semanticSearch(q, topK);
    return { query: q, hits };
  }

  @Get(':code')
  async one(@Param('code') code: string) {
    const skill = await this.esco.findByCode(code);
    if (!skill) throw new NotFoundException(`Unknown ESCO code: ${code}`);
    return skill;
  }

  /** POST /taxonomies/esco/reembed — manual trigger after a model swap. */
  @Post('reembed')
  reembed() {
    return this.ingest.reembedAll();
  }

  /** POST /taxonomies/esco/ingest — bulk insert / update from external sources. */
  @Post('ingest')
  ingestRows(
    @Body()
    body: {
      rows: Array<{
        code: string;
        label: string;
        category?: string;
        iscoLinks?: string[];
        description?: string;
        source?: string;
        uri?: string;
      }>;
      skipEmbed?: boolean;
    },
  ) {
    return this.ingest.ingestRows(body.rows ?? [], {
      skipEmbed: body.skipEmbed,
    });
  }
}
