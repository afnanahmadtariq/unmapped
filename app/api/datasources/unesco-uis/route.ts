import { NextResponse } from 'next/server';

// UNESCO UIS via World Bank API — No auth required for WB mirror
// UNESCO data is mirrored in World Bank source 12 (Education Stats)
// Direct UNESCO UIS API: https://api.uis.unesco.org — requires API key
// Key WB UNESCO indicators: SE.ADT.LITR.ZS (Literacy), SE.PRM.ENRR (Primary enrollment), SE.TER.ENRR (Tertiary)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const indicator = searchParams.get('indicator') || 'SE.ADT.LITR.ZS';
  const country = searchParams.get('country') || 'all';
  const perPage = searchParams.get('perPage') || '15';

  const url = `https://api.worldbank.org/v2/country/${country}/indicator/${indicator}?format=json&per_page=${perPage}&mrv=1&source=12`;

  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return NextResponse.json({ error: `UNESCO/WB API error: ${res.status}` }, { status: res.status });

    const raw = await res.json();
    const [meta, records] = Array.isArray(raw) ? raw : [raw, []];

    return NextResponse.json({
      source: 'UNESCO Institute for Statistics (via World Bank)',
      note: 'Data sourced from WB Education Stats (Source 12) which mirrors UNESCO UIS data. For direct UNESCO UIS API access visit https://apiportal.uis.unesco.org/',
      indicator,
      indicatorName: records?.[0]?.indicator?.value || indicator,
      totalCountries: meta?.total || 0,
      data: (records || [])
        .filter((r: any) => r.value !== null)
        .map((r: any) => ({
          country: r.country?.value,
          countryCode: r.countryiso3code,
          year: r.date,
          value: r.value
        }))
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
