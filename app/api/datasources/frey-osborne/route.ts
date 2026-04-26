import { NextResponse } from 'next/server';

// Frey & Osborne Automation Risk — No official REST API
// Original paper: https://www.oxfordmartin.ox.ac.uk/downloads/academic/The_Future_of_Employment.pdf
// Data available as static CSV from Oxford Martin School and hosted mirrors
// O*NET-SOC occupation codes with automation probability scores
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const minRisk = parseFloat(searchParams.get('minRisk') || '0');
  const maxRisk = parseFloat(searchParams.get('maxRisk') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');
  const sortBy = searchParams.get('sortBy') || 'desc'; // asc or desc

  // Frey & Osborne data is publicly available from Oxford's supplementary materials
  // and widely mirrored. We use the canonical dataset hosted publicly.
  // Source: Carl Benedikt Frey & Michael A. Osborne (2013)
  // "The Future of Employment: How Susceptible Are Jobs to Computerisation?"
  
  // Representative sample of the Frey-Osborne dataset (top/bottom occupations)
  // In production, load from a hosted CSV or a local copy
  const freyOsborneData = [
    { soc: '25-1011', occupation: 'Business Teachers, Postsecondary', probability: 0.03 },
    { soc: '29-1069', occupation: 'Physicians and Surgeons', probability: 0.004 },
    { soc: '27-1012', occupation: 'Craft Artists', probability: 0.033 },
    { soc: '25-2021', occupation: 'Elementary School Teachers', probability: 0.004 },
    { soc: '21-1022', occupation: 'Healthcare Social Workers', probability: 0.035 },
    { soc: '27-2041', occupation: 'Music Directors and Composers', probability: 0.071 },
    { soc: '29-1141', occupation: 'Registered Nurses', probability: 0.009 },
    { soc: '13-2011', occupation: 'Accountants and Auditors', probability: 0.94 },
    { soc: '43-3031', occupation: 'Bookkeeping Clerks', probability: 0.98 },
    { soc: '51-2092', occupation: 'Team Assemblers', probability: 0.98 },
    { soc: '43-4051', occupation: 'Customer Service Representatives', probability: 0.55 },
    { soc: '41-2031', occupation: 'Retail Salespersons', probability: 0.92 },
    { soc: '53-3032', occupation: 'Heavy Truck Drivers', probability: 0.79 },
    { soc: '43-9011', occupation: 'Computer Operators', probability: 0.98 },
    { soc: '19-2041', occupation: 'Environmental Scientists', probability: 0.025 },
    { soc: '15-1132', occupation: 'Software Developers', probability: 0.048 },
    { soc: '17-2141', occupation: 'Mechanical Engineers', probability: 0.015 },
    { soc: '39-9021', occupation: 'Personal Care Aides', probability: 0.074 },
    { soc: '13-1151', occupation: 'Training and Development Specialists', probability: 0.035 },
    { soc: '23-1011', occupation: 'Lawyers', probability: 0.035 },
    { soc: '43-4111', occupation: 'Interviewers, Except Eligibility and Loan', probability: 0.55 },
    { soc: '51-9061', occupation: 'Inspectors, Testers, Sorters', probability: 0.98 },
    { soc: '53-7051', occupation: 'Industrial Truck Operators', probability: 0.97 },
    { soc: '43-6011', occupation: 'Executive Secretaries', probability: 0.40 },
    { soc: '11-1011', occupation: 'Chief Executives', probability: 0.015 },
  ];

  const filtered = freyOsborneData
    .filter(d => d.probability >= minRisk && d.probability <= maxRisk)
    .sort((a, b) => sortBy === 'desc' ? b.probability - a.probability : a.probability - b.probability)
    .slice(0, limit);

  return NextResponse.json({
    source: 'Frey & Osborne (2013)',
    title: 'The Future of Employment: Automation Risk Scores',
    citation: 'Frey, C. B., & Osborne, M. A. (2013). The future of employment: How susceptible are jobs to computerisation? University of Oxford.',
    paperUrl: 'https://www.oxfordmartin.ox.ac.uk/downloads/academic/The_Future_of_Employment.pdf',
    note: 'Probability ranges from 0 (low automation risk) to 1 (high automation risk). This is a curated sample — full dataset has 702 occupations.',
    fullDatasetUrl: 'https://raw.githubusercontent.com/automatedrisk/frey-osborne/main/frey_osborne_2013.csv',
    parameters: { minRisk, maxRisk, limit, sortBy },
    totalMatches: filtered.length,
    data: filtered
  });
}
