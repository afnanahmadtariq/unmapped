import { NextResponse } from 'next/server';

// World Bank WDI Public API — No auth required
// Docs: https://datahelpdesk.worldbank.org/knowledgebase/articles/898581
// Popular indicators: SP.POP.TOTL (Population), SL.UEM.TOTL.ZS (Unemployment), NY.GDP.MKTP.CD (GDP)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const indicator = searchParams.get('indicator') || 'SL.UEM.TOTL.ZS';
  const country = searchParams.get('country') || 'all';
  const perPage = searchParams.get('perPage') || '10';
  const mrv = searchParams.get('mrv') || '1'; // most recent value

  const url = `https://api.worldbank.org/v2/country/${country}/indicator/${indicator}?format=json&per_page=${perPage}&mrv=${mrv}`;

  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return NextResponse.json({ error: `World Bank API error: ${res.status}` }, { status: res.status });

    const raw = await res.json();
    // WB returns [metadata, dataArray]
    const [meta, records] = Array.isArray(raw) ? raw : [raw, []];

    return NextResponse.json({
      source: 'World Bank WDI',
      indicator,
      indicatorName: records?.[0]?.indicator?.value || indicator,
      country,
      metadata: meta,
      totalRecords: meta?.total || 0,
      data: (records || []).filter((r: any) => r.value !== null).map((r: any) => ({
        country: r.country?.value,
        countryCode: r.countryiso3code,
        date: r.date,
        value: r.value,
        unit: r.unit
      }))
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
