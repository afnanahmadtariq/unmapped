import { NextResponse } from 'next/server';

// World Bank Human Capital Index — No auth required
// Docs: https://datatopics.worldbank.org/human-capital/
// Key indicators: HD.HCI.OVRL, HD.HCI.EYRS, HD.HCI.LAYS, HD.HCI.MORT
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const indicator = searchParams.get('indicator') || 'HD.HCI.OVRL';
  const country = searchParams.get('country') || 'all';
  const perPage = searchParams.get('perPage') || '20';

  const url = `https://api.worldbank.org/v2/country/${country}/indicator/${indicator}?format=json&per_page=${perPage}&mrv=1`;

  try {
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) return NextResponse.json({ error: `WB HCI API error: ${res.status}` }, { status: res.status });

    const raw = await res.json();
    const [meta, records] = Array.isArray(raw) ? raw : [raw, []];

    const hciData = (records || [])
      .filter((r: any) => r.value !== null)
      .map((r: any) => ({
        country: r.country?.value,
        countryCode: r.countryiso3code,
        year: r.date,
        hciScore: r.value ? Number(r.value.toFixed(3)) : null
      }))
      .sort((a: any, b: any) => (b.hciScore || 0) - (a.hciScore || 0));

    return NextResponse.json({
      source: 'World Bank Human Capital Index',
      indicator,
      indicatorName: records?.[0]?.indicator?.value || 'Human Capital Index',
      lastUpdated: meta?.lastupdated,
      totalCountries: hciData.length,
      topCountries: hciData.slice(0, 10),
      data: hciData
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
