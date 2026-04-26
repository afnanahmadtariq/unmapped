import { NextResponse } from 'next/server';

// ILO ISCO-08 Occupation Classification — No auth required
// Docs: https://rplumber.ilo.org/__docs__/
// The ILO Plumber API provides occupation classifications via metadata endpoints
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lang = searchParams.get('lang') || 'en';
  const level = searchParams.get('level') || '1'; // 1=Major, 2=Sub-major, 3=Minor, 4=Unit

  // ILO classification endpoint for occupations
  const url = `https://rplumber.ilo.org/metadata/dic?lang=${lang}&id=classif1`;

  try {
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json, text/plain, */*' },
      next: { revalidate: 86400 }
    });

    if (!res.ok) {
      return NextResponse.json({ error: `ILO ISCO API error: ${res.status} ${res.statusText}` }, { status: res.status });
    }

    const contentType = res.headers.get('content-type') || '';
    let data: any;

    if (contentType.includes('json')) {
      data = await res.json();
    } else {
      const text = await res.text();
      // Try to parse as JSON anyway (some APIs set wrong content-type)
      try {
        data = JSON.parse(text);
      } catch {
        // Parse CSV if not JSON
        const lines = text.trim().split('\n').filter(l => l.trim());
        if (lines.length < 2) {
          return NextResponse.json({ error: 'ILO ISCO endpoint returned no data. The classification data may not be available via this API path.' }, { status: 422 });
        }
        const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
        const rows = lines.slice(1).map(line => {
          const values = line.split(',').map(v => v.replace(/"/g, '').trim());
          return Object.fromEntries(headers.map((h, i) => [h, values[i]]));
        });
        // Filter by ISCO-08 and level
        const filtered = rows.filter((r: any) => {
          const code = r.classif1 || r.code || '';
          return code.startsWith('ISCO08_') && (level === 'all' || (r.level || '').toString() === level);
        });
        data = { totalEntries: filtered.length, entries: filtered.slice(0, 50) };
      }
    }

    return NextResponse.json({
      source: 'ILO ISCO-08',
      description: 'International Standard Classification of Occupations 2008',
      lang,
      level: `Level ${level} (1=Major, 2=Sub-major, 3=Minor, 4=Unit Group)`,
      data
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
