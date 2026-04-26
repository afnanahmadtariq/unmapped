import { NextResponse } from 'next/server';

// UN Population Division — AUTH REQUIRED for API, bulk data free
// API docs: https://population.un.org/dataportal/about/dataapi
// Registration: https://population.un.org/dataportal/
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const apiKey = process.env.UN_POPULATION_API_KEY;

  if (!apiKey) {
    return NextResponse.json({
      source: 'UN Population Division',
      authRequired: true,
      status: 'API Key Not Configured',
      description: 'The UN Population Division provides World Population Prospects projections.',
      howToGetApiKey: [
        {
          step: 1,
          action: 'Register at the UN Data Portal',
          url: 'https://population.un.org/dataportal/',
          instruction: 'Create a free account at the UN Population Data Portal'
        },
        {
          step: 2,
          action: 'Request API Access',
          url: 'https://population.un.org/dataportal/about/dataapi',
          instruction: 'Read the API documentation and request a token'
        },
        {
          step: 3,
          action: 'Add to environment variables',
          instruction: 'Add UN_POPULATION_API_KEY=your_key_here to your .env.local file'
        }
      ],
      alternativeFreeAccess: {
        url: 'https://population.un.org/wpp/',
        description: 'Download Excel/CSV files of World Population Prospects 2024 — completely free'
      },
      sampleEndpoint: 'https://population.un.org/dataportalapi/api/v1/indicators/',
      requiredEnvVar: 'UN_POPULATION_API_KEY'
    }, { status: 401 });
  }

  try {
    const indicatorId = searchParams.get('indicator') || '49'; // 49 = Total Population
    const location = searchParams.get('location') || '4'; // 4 = World
    const startYear = searchParams.get('startYear') || '2020';
    const endYear = searchParams.get('endYear') || '2030';

    const url = `https://population.un.org/dataportalapi/api/v1/data/indicators/${indicatorId}/locations/${location}/start/${startYear}/end/${endYear}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
      next: { revalidate: 86400 }
    });

    if (!res.ok) return NextResponse.json({ error: `UN Population API error: ${res.status}` }, { status: res.status });
    const data = await res.json();
    return NextResponse.json({ source: 'UN Population Division', data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
