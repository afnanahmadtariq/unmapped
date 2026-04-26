import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { z } from 'zod';
import * as fs from 'fs-extra';
import * as path from 'path';
import type { Response } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { AdminService } from './admin.service';
import { LineageService } from '../lineage/lineage.service';
import { HarvestService } from '../harvest/harvest.service';
import { AdminUploadService } from './admin-upload.service';

const createSourceSchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9_-]+$/, 'slug must be lowercase a-z, 0-9, _, -'),
  displayName: z.string().min(1).max(200),
  kind: z.enum(['harvester', 'upload']).default('upload'),
  sourceUrl: z.string().url().nullish(),
  cron: z.string().min(1).nullish(),
  category: z.string().max(32).nullish(),
  schemaSpec: z.record(z.string(), z.unknown()).nullish(),
  note: z.string().max(2000).nullish(),
});

const patchSourceSchema = z.object({
  displayName: z.string().min(1).max(200).optional(),
  sourceUrl: z.string().url().nullish().optional(),
  cron: z.string().min(1).nullish().optional(),
  category: z.string().max(32).nullish().optional(),
  isActive: z.boolean().optional(),
  note: z.string().max(2000).nullish().optional(),
  schemaSpec: z.record(z.string(), z.unknown()).nullish().optional(),
});

/**
 * Secured admin surface. Every route requires a valid admin JWT (cookie
 * or `Authorization: Bearer ...`). Read-only `config-summary` is kept for
 * the existing dashboard.
 */
@Controller('admin')
@UseGuards(AuthGuard)
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly lineage: LineageService,
    private readonly harvest: HarvestService,
    private readonly uploads: AdminUploadService,
  ) {}

  @Get('config-summary/:countryCode')
  getConfigSummary(@Param('countryCode') countryCode: string) {
    return this.admin.getConfigSummary(countryCode);
  }

  // ---------- Sources ----------

  @Get('sources')
  listSources() {
    return this.lineage.listSources();
  }

  @Post('sources')
  async createSource(@Body() body: unknown) {
    const parsed = createSourceSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues
          .map((i) => `${i.path.join('.') || 'body'}: ${i.message}`)
          .join('; '),
      );
    }
    const source = await this.lineage.createSource(parsed.data);
    return { id: source.id, slug: source.slug };
  }

  @Patch('sources/:id')
  async patchSource(@Param('id') id: string, @Body() body: unknown) {
    const parsed = patchSourceSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues
          .map((i) => `${i.path.join('.') || 'body'}: ${i.message}`)
          .join('; '),
      );
    }
    const updated = await this.lineage.patchSource(id, parsed.data);
    return { id: updated.id, slug: updated.slug };
  }

  @Delete('sources/:id')
  deleteSource(@Param('id') id: string) {
    return this.lineage.deleteSource(id);
  }

  @Get('sources/:id/runs')
  listRunsForSource(
    @Param('id') id: string,
    @Query('limit') limit?: string,
  ) {
    const max = Math.min(Number(limit) || 50, 200);
    return this.lineage.listRunsForSource(id, max);
  }

  /** Manually trigger a harvester source by id (slug-backed). */
  @Post('sources/:id/runs')
  async triggerRun(@Param('id') id: string) {
    const source = await this.lineage.getSourceById(id);
    if (!source) {
      throw new BadRequestException(`Source ${id} not found`);
    }
    if (source.kind !== 'harvester') {
      throw new BadRequestException(
        `Source ${source.slug} is upload-only — use /admin/sources/${id}/uploads`,
      );
    }
    return this.harvest.runOne(source.slug);
  }

  /** Multipart upload that becomes a `dataset_runs` row tagged kind=upload. */
  @Post('sources/:id/uploads')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))
  async uploadToSource(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('loader') loader?: string,
    @Body('category') category?: string,
    @Body('keyFields') keyFields?: string,
  ) {
    if (!file) {
      throw new BadRequestException('Missing "file" field in multipart body');
    }
    const loaderChoice =
      loader === 'postgres' || loader === 'vector' ? loader : undefined;
    const parsedKeyFields = keyFields
      ? keyFields
          .split(/[|,;\s]+/)
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
      : undefined;
    return this.uploads.uploadToSource(id, file, {
      loader: loaderChoice,
      category,
      keyFields: parsedKeyFields,
    });
  }

  // ---------- Runs ----------

  @Get('runs')
  listRuns(@Query('limit') limit?: string) {
    const max = Math.min(Number(limit) || 50, 200);
    return this.lineage.listRecentRuns(max);
  }

  @Delete('runs/:id')
  deleteRun(@Param('id') id: string) {
    return this.lineage.deleteRun(id);
  }

  /**
   * Streams the run's JSON archive back to the admin so they can download
   * the raw harvested / uploaded artifact. The archivePath is written by
   * StorageService.archive() and pinned on the dataset_runs row by the
   * harvester / upload pipeline.
   */
  @Get('runs/:id/archive')
  async downloadRunArchive(
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    const run = await this.lineage.getRun(id);
    if (!run) throw new NotFoundException(`Run ${id} not found`);
    if (!run.archivePath) {
      throw new NotFoundException(
        `Run ${id} has no archive on disk (status=${run.status})`,
      );
    }
    if (!(await fs.pathExists(run.archivePath))) {
      throw new NotFoundException(
        `Archive file ${run.archivePath} is missing on disk`,
      );
    }
    const filename = path.basename(run.archivePath);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`,
    );
    fs.createReadStream(run.archivePath).pipe(res);
  }
}
