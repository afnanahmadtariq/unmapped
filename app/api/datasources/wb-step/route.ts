import { NextResponse } from 'next/server';

// World Bank STEP Skills Measurement — AUTH REQUIRED (Microdata)
// Main portal: https://microdata.worldbank.org/index.php/catalog/step
// Registration: https://microdata.worldbank.org/index.php/auth/register
// World Bank Microdata Library requires free account for data download
export async function GET() {
  return NextResponse.json({
    source: 'World Bank STEP Skills Measurement',
    authRequired: true,
    status: 'Account Required for Microdata Access',
    description: 'STEP (Skills Toward Employment and Productivity) measures the skills of the adult population in developing countries, covering cognitive, socioemotional, and job-relevant skills.',
    coverage: 'Urban workers in 12+ low/middle-income countries',
    howToGetAccess: [
      {
        step: 1,
        action: 'Create a free World Bank Microdata Library account',
        url: 'https://microdata.worldbank.org/index.php/auth/register',
        instruction: 'Register for a free account — no payment required'
      },
      {
        step: 2,
        action: 'Browse the STEP catalog',
        url: 'https://microdata.worldbank.org/index.php/catalog/step',
        instruction: 'Search for STEP datasets by country'
      },
      {
        step: 3,
        action: 'Submit a data request',
        url: 'https://microdata.worldbank.org/index.php/catalog/step',
        instruction: 'For licensed data, complete the online application form explaining your research purpose'
      },
      {
        step: 4,
        action: 'Add API token to env',
        instruction: 'Once approved, add WB_MICRODATA_API_KEY=your_key to .env.local'
      }
    ],
    aggregateProxyIndicators: {
      note: 'Aggregate STEP metrics are available via World Bank WDI without auth',
      indicators: [
        { id: 'SL.TLF.CACT.ZS', name: 'Labor force participation rate, total (%)' },
        { id: 'SL.UEM.TOTL.ZS', name: 'Unemployment, total (% of labor force)' },
        { id: 'SE.TER.ENRR', name: 'School enrollment, tertiary (%)' }
      ]
    },
    apiUrl: 'https://microdata.worldbank.org/index.php/api/catalog/',
    requiredEnvVar: 'WB_MICRODATA_API_KEY'
  }, { status: 401 });
}
