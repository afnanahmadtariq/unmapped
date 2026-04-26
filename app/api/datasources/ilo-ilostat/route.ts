import { NextResponse } from 'next/server';

// ILO ILOSTAT Public API — No auth required
// Docs: https://rplumber.ilo.org/__docs__/
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const indicator = searchParams.get('indicator') || 'EMP_TEMP_SEX_AGE_NB';
  const country = searchParams.get('country') || 'PAK';
  const lang = searchParams.get('lang') || 'en';
  const limit = searchParams.get('limit') || '10';

  // ILO returns CSV by default; request JSON via Accept header
  const url = `https://rplumber.ilo.org/data/indicator?id=${indicator}&ref_area=${country}&lang=${lang}&limit=${limit}`;

  try {
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 3600 }
    });

    const contentType = res.headers.get('content-type') || '';

    if (!res.ok) {
      return NextResponse.json({ error: `ILO API error: ${res.status} ${res.statusText}` }, { status: res.status });
    }

    // ILO returns JSON or CSV depending on content negotiation
    if (contentType.includes('json')) {
      const data = await res.json();
      return NextResponse.json({ source: 'ILO ILOSTAT', indicator, country, data });
    } else {
      // Parse CSV text into structured data
      const text = await res.text();
      const lines = text.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
      const rows = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.replace(/"/g, '').trim());
        return Object.fromEntries(headers.map((h, i) => [h, values[i]]));
      });
      return NextResponse.json({ source: 'ILO ILOSTAT', indicator, country, totalRows: rows.length, data: rows.slice(0, 20) });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
