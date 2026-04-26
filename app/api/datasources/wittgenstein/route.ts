import { NextResponse } from 'next/server';

// Wittgenstein Centre — AUTH REQUIRED
// Data access: https://dataexplorer.wittgensteincentre.org/wcde/
// API/Download portal: https://www.wittgensteincentre.org/en/data.htm
// No public REST API — data available via Shiny app or bulk download
export async function GET() {
  return NextResponse.json({
    source: 'Wittgenstein Centre for Demography',
    authRequired: true,
    status: 'Data Not Publicly Available via REST API',
    description: 'The Wittgenstein Centre provides global education and population projections by age, sex, and level of educational attainment.',
    howToAccess: [
      {
        method: 'Interactive Data Explorer',
        url: 'https://dataexplorer.wittgensteincentre.org/wcde/',
        description: 'Web-based Shiny app to explore and download projections'
      },
      {
        method: 'Bulk Download',
        url: 'https://www.wittgensteincentre.org/en/data.htm',
        description: 'Download full projection datasets in CSV format (free, no account needed for bulk)'
      },
      {
        method: 'R Package (wpp2022)',
        url: 'https://cran.r-project.org/web/packages/wpp2022/index.html',
        description: 'Access UN World Population Prospects data via R'
      }
    ],
    apiKeyUrl: null,
    note: 'Bulk CSV downloads are FREE and do not require API key. REST API not available.'
  });
}
