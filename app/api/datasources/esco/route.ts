import { NextResponse } from 'next/server';

// ESCO Skills Taxonomy (EU) — No auth required
// API docs: https://esco.ec.europa.eu/en/use-esco/esco-web-services
// Endpoints: /search, /resource/skill, /resource/occupation, /taxonomy/concept
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const text = searchParams.get('text') || 'data analysis';
  const type = searchParams.get('type') || 'skill'; // skill | occupation | isced-f | isco-group
  const language = searchParams.get('language') || 'en';
  const limit = parseInt(searchParams.get('limit') || '10');
  const offset = parseInt(searchParams.get('offset') || '0');

  const url = `https://ec.europa.eu/esco/api/search?language=${language}&type=${type}&text=${encodeURIComponent(text)}&offset=${offset}&limit=${limit}`;

  try {
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 3600 }
    });

    if (!res.ok) return NextResponse.json({ error: `ESCO API error: ${res.status}` }, { status: res.status });

    const raw = await res.json();

    const items = (raw._embedded?.results || []).map((item: any) => ({
      title: item.title,
      type: item.className,
      uri: item.uri,
      preferredLabel_en: item.preferredLabel?.en || item.title,
      skillType: item.hasSkillType?.[0]?.split('/').pop() || null,
      reuseLevel: item.hasReuseLevel?.[0]?.split('/').pop() || null,
      broaderConcept: item.broaderHierarchyConcept?.[0]?.split('/').pop() || null
    }));

    return NextResponse.json({
      source: 'ESCO Skills Taxonomy (EU)',
      apiDocs: 'https://esco.ec.europa.eu/en/use-esco/esco-web-services',
      query: text,
      type,
      language,
      total: raw.total,
      offset,
      limit,
      data: items
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
