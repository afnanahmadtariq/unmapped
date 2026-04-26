import { NextResponse } from 'next/server';

// ILO Future of Work Datasets — No auth required
// Uses the ILO ILOSTAT Plumber API: https://rplumber.ilo.org/__docs__/
// Key indicators related to Future of Work:
//   EMP_TEMP_SEX_AGE_NB - Employment by sex and age
//   HOW_TEMP_SEX_NB - Hours of work by sex
//   SDG_0852_SEX_RT - Labour income share
//   EAR_INEE_SEX_ECO_NB - Mean earnings by sex/economic activity

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const indicator = searchParams.get('indicator') || 'SDG_0852_SEX_RT';
  const country = searchParams.get('country') || '';
  const sex = searchParams.get('sex') || 'SEX_T'; // SEX_T=Total, SEX_M=Male, SEX_F=Female
  const lang = searchParams.get('lang') || 'en';
  const limit = searchParams.get('limit') || '20';

  const countryParam = country ? `&ref_area=${country}` : '';
  const url = `https://rplumber.ilo.org/data/indicator?id=${indicator}${countryParam}&lang=${lang}&limit=${limit}`;

  try {
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json, text/csv, */*' },
      next: { revalidate: 3600 }
    });

    if (!res.ok) {
      return NextResponse.json({ error: `ILO Future of Work API error: ${res.status} ${res.statusText}` }, { status: res.status });
    }

    const contentType = res.headers.get('content-type') || '';
    let parsedData: any;

    if (contentType.includes('json')) {
      parsedData = await res.json();
    } else {
      const text = await res.text();
      try {
        parsedData = JSON.parse(text);
      } catch {
        const lines = text.trim().split('\n').filter(l => l.trim());
        if (lines.length < 2) {
          return NextResponse.json({
            source: 'ILO Future of Work',
            indicator,
            note: 'No data returned for these parameters. Try different indicator/country combinations.',
            availableIndicators: [
              { id: 'SDG_0852_SEX_RT', name: 'Labour income share (%)' },
              { id: 'EMP_TEMP_SEX_AGE_NB', name: 'Employment by sex and age (thousands)' },
              { id: 'HOW_TEMP_SEX_NB', name: 'Mean weekly hours actually worked per employed person' },
              { id: 'EAR_INEE_SEX_ECO_NB', name: 'Mean nominal monthly earnings' },
              { id: 'UNE_DEAP_SEX_AGE_RT', name: 'Unemployment rate by sex and age' },
            ]
          });
        }
        const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
        const rows = lines.slice(1).map(line => {
          const values = line.split(',').map(v => v.replace(/"/g, '').trim());
          return Object.fromEntries(headers.map((h, i) => [h, values[i]]));
        });
        parsedData = { totalRows: rows.length, records: rows };
      }
    }

    return NextResponse.json({
      source: 'ILO Future of Work Datasets',
      indicator,
      country: country || 'all',
      apiUrl: url,
      data: parsedData
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
