import { NextResponse } from 'next/server';

// O*NET (US Department of Labor) — API KEY REQUIRED
// API docs: https://services.onetcenter.org/developer/
// Registration (free for non-commercial): https://services.onetcenter.org/developer/
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const apiKey = process.env.ONET_API_KEY;

  if (!apiKey) {
    return NextResponse.json({
      source: 'O*NET (US Department of Labor)',
      authRequired: true,
      status: 'API Key Not Configured',
      description: 'O*NET provides detailed occupational information including skills, abilities, work activities, and wages for 1,000+ occupations in the US.',
      howToGetApiKey: [
        {
          step: 1,
          action: 'Register for a free O*NET Web Services account',
          url: 'https://services.onetcenter.org/developer/',
          instruction: 'Click "Register" and complete the form. Free for non-commercial use.'
        },
        {
          step: 2,
          action: 'Receive credentials',
          instruction: 'You will receive a username and password via email within 1-2 business days'
        },
        {
          step: 3,
          action: 'Add credentials to environment variables',
          instruction: 'Add ONET_API_KEY=username:password (base64 encoded) to your .env.local file'
        }
      ],
      registrationUrl: 'https://services.onetcenter.org/developer/',
      apiBaseUrl: 'https://services.onetcenter.org/ws/',
      requiredEnvVar: 'ONET_API_KEY',
      sampleEndpoints: [
        { path: '/ws/mnm/careers', description: 'Browse careers list' },
        { path: '/ws/online/occupations/15-1132.00', description: 'Get details for Software Developers' },
        { path: '/ws/online/occupations/15-1132.00/summary/skills', description: 'Get skills for an occupation' }
      ]
    }, { status: 401 });
  }

  try {
    const keyword = searchParams.get('keyword') || 'software';
    const url = `https://services.onetcenter.org/ws/mnm/search?keyword=${encodeURIComponent(keyword)}`;

    const res = await fetch(url, {
      headers: {
        'Authorization': `Basic ${Buffer.from(apiKey).toString('base64')}`,
        'Accept': 'application/json'
      },
      next: { revalidate: 3600 }
    });

    if (!res.ok) return NextResponse.json({ error: `O*NET API error: ${res.status}` }, { status: res.status });
    const data = await res.json();
    return NextResponse.json({ source: 'O*NET (US DOL)', keyword, data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
