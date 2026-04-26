import { NextResponse } from 'next/server';

// ITU Digital Development — Public via World Bank API
// ITU data is mirrored in World Bank WDI (no auth required)
// Key indicators:
//   IT.NET.USER.ZS - Individuals using the Internet (%)
//   IT.CEL.SETS.P2 - Mobile subscriptions per 100 people
//   IT.NET.BBND.P2 - Fixed broadband subscriptions per 100 people
//   IT.MLT.MAIN.P2 - Fixed telephone subscriptions per 100 people
//   ITU also publishes the ICT Development Index (IDI)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const indicator = searchParams.get('indicator') || 'IT.NET.USER.ZS';
  const country = searchParams.get('country') || 'all';
  const perPage = searchParams.get('perPage') || '15';
  const mrv = searchParams.get('mrv') || '1';

  const url = `https://api.worldbank.org/v2/country/${country}/indicator/${indicator}?format=json&per_page=${perPage}&mrv=${mrv}`;

  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return NextResponse.json({ error: `ITU/WB API error: ${res.status}` }, { status: res.status });

    const raw = await res.json();
    const [meta, records] = Array.isArray(raw) ? raw : [raw, []];

    const processed = (records || [])
      .filter((r: any) => r.value !== null)
      .map((r: any) => ({
        country: r.country?.value,
        countryCode: r.countryiso3code,
        year: r.date,
        value: r.value ? Number(r.value.toFixed(2)) : null,
        unit: indicator.includes('ZS') || indicator.includes('P2') ? '%' : 'per 100'
      }))
      .sort((a: any, b: any) => (b.value || 0) - (a.value || 0));

    return NextResponse.json({
      source: 'ITU Digital Development (via World Bank)',
      indicator,
      indicatorName: records?.[0]?.indicator?.value || indicator,
      note: 'ITU data mirrored via World Bank WDI. For direct ITU data portal visit https://www.itu.int/en/ITU-D/Statistics/Pages/stat/default.aspx',
      lastUpdated: meta?.lastupdated,
      totalCountries: processed.length,
      topCountries: processed.slice(0, 10),
      data: processed
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
