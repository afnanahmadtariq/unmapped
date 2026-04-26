import { Injectable } from '@nestjs/common';
import { TavilyClient, TavilyHit } from '../external/tavily.client';
import { CountryService } from '../country/country.service';

/** Country-specific job-board hints (matches the original web SITE_HINTS map). */
const SITE_HINTS: Record<string, string> = {
  GH: 'site:jobberman.com.gh OR site:brightermonday.com.gh OR site:linkedin.com/jobs',
  BD: 'site:bdjobs.com OR site:chakri.com OR site:linkedin.com/jobs',
  KE: 'site:brightermonday.co.ke OR site:fuzu.com OR site:linkedin.com/jobs',
  NG: 'site:jobberman.com OR site:hotnigerianjobs.com OR site:linkedin.com/jobs',
  ZA: 'site:careerjunction.co.za OR site:pnet.co.za OR site:linkedin.com/jobs',
  EG: 'site:wuzzuf.net OR site:bayt.com OR site:linkedin.com/jobs',
  PK: 'site:rozee.pk OR site:mustakbil.com OR site:linkedin.com/jobs',
  IN: 'site:naukri.com OR site:shine.com OR site:linkedin.com/jobs',
  ID: 'site:jobstreet.co.id OR site:linkedin.com/jobs',
  PH: 'site:jobstreet.com.ph OR site:linkedin.com/jobs',
  VN: 'site:vietnamworks.com OR site:linkedin.com/jobs',
  BR: 'site:catho.com.br OR site:vagas.com.br OR site:linkedin.com/jobs',
  MX: 'site:occ.com.mx OR site:computrabajo.com.mx OR site:linkedin.com/jobs',
  TR: 'site:kariyer.net OR site:secretcv.com OR site:linkedin.com/jobs',
  RU: 'site:hh.ru OR site:linkedin.com/jobs',
};

/**
 * Live job search — port of apps/web/app/api/find-jobs/route.ts. Tavily is
 * the upstream; if the key is unset we return [] so the UI degrades gracefully.
 */
@Injectable()
export class JobsService {
  constructor(
    private readonly tavily: TavilyClient,
    private readonly countries: CountryService,
  ) {}

  async search(title: string, countryCode: string): Promise<TavilyHit[]> {
    const country = this.countries.getOrDefault(countryCode);
    const hint = SITE_HINTS[country.code] ?? 'site:linkedin.com/jobs';
    const query = `${title} jobs ${country.name} ${hint}`.trim();
    return this.tavily.search(query, 4);
  }
}
