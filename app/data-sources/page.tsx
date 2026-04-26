"use client";
import React, { useState } from 'react';
import { Briefcase, GraduationCap, Cpu, Layers, ExternalLink, CheckCircle2, AlertCircle, X, Database, Lock, Settings } from 'lucide-react';
import './data-sources.css';

interface Param { key: string; label: string; type: 'text' | 'select'; options?: { value: string; label: string }[]; default: string; description?: string; }
interface AccessStep { step?: number; action?: string; url?: string; instruction: string; }
interface Source {
  id: string; name: string; description: string; status: 'public' | 'auth'; category: string;
  apiRoute: string; params?: Param[]; docsUrl?: string;
  authInfo?: { status: string; steps: AccessStep[]; requiredEnvVar?: string; alternativeUrl?: string; alternativeNote?: string; };
}

const WB_INDICATORS = [
  { value: 'SL.UEM.TOTL.ZS', label: 'Unemployment rate (%)' },
  { value: 'SP.POP.TOTL', label: 'Total Population' },
  { value: 'SL.TLF.CACT.ZS', label: 'Labor Force Participation (%)' },
  { value: 'SL.GDP.PCAP.EM.KD', label: 'GDP per person employed' },
  { value: 'SL.EMP.VULN.ZS', label: 'Vulnerable employment (%)' },
];

const SOURCES: Source[] = [
  {
    id: 'ilo-ilostat', name: 'ILO ILOSTAT', description: 'International Labour Organization employment & labor data', status: 'public', category: 'Labor Market',
    apiRoute: 'http://localhost:4000/datasets/ilo-ilostat', docsUrl: 'https://rplumber.ilo.org/__docs__/',
    params: [
      { key: 'indicator', label: 'Indicator', type: 'select', default: 'EMP_TEMP_SEX_AGE_NB', options: [
        { value: 'EMP_TEMP_SEX_AGE_NB', label: 'Employment by sex & age' },
        { value: 'UNE_DEAP_SEX_AGE_RT', label: 'Unemployment rate' },
        { value: 'SDG_0852_SEX_RT', label: 'Labour income share' },
        { value: 'HOW_TEMP_SEX_NB', label: 'Mean weekly hours worked' },
      ]},
      { key: 'country', label: 'Country Code (ISO2)', type: 'text', default: 'PAK', description: 'e.g. PAK, IND, USA, GBR' },
      { key: 'limit', label: 'Max Records', type: 'select', default: '10', options: [
        { value: '5', label: '5' }, { value: '10', label: '10' }, { value: '25', label: '25' },
      ]},
    ]
  },
  {
    id: 'wb-wdi', name: 'World Bank WDI', description: 'World Development Indicators — comprehensive global data', status: 'public', category: 'Labor Market',
    apiRoute: 'http://localhost:4000/datasets/wb-wdi', docsUrl: 'https://datahelpdesk.worldbank.org/knowledgebase/articles/898581',
    params: [
      { key: 'indicator', label: 'Indicator', type: 'select', default: 'SL.UEM.TOTL.ZS', options: WB_INDICATORS },
      { key: 'country', label: 'Country', type: 'select', default: 'all', options: [
        { value: 'all', label: 'All countries' }, { value: 'PAK', label: 'Pakistan' }, { value: 'IND', label: 'India' }, { value: 'USA', label: 'USA' }, { value: 'GBR', label: 'UK' }, { value: 'CHN', label: 'China' },
      ]},
      { key: 'mrv', label: 'Most Recent Values', type: 'select', default: '1', options: [{ value: '1', label: '1 year' }, { value: '3', label: '3 years' }, { value: '5', label: '5 years' }] },
    ]
  },
  {
    id: 'wb-hci', name: 'World Bank HCI', description: 'Human Capital Index — health, education & survival rates', status: 'public', category: 'Labor Market',
    apiRoute: 'http://localhost:4000/datasets/wb-hci', docsUrl: 'https://datatopics.worldbank.org/human-capital/',
    params: [
      { key: 'indicator', label: 'HCI Indicator', type: 'select', default: 'HD.HCI.OVRL', options: [
        { value: 'HD.HCI.OVRL', label: 'Overall HCI Score (0-1)' },
        { value: 'HD.HCI.EYRS', label: 'Expected Years of School' },
        { value: 'HD.HCI.LAYS', label: 'Learning-Adjusted Years of School' },
        { value: 'HD.HCI.MORT', label: 'Child Survival Rate' },
      ]},
      { key: 'country', label: 'Country', type: 'select', default: 'all', options: [
        { value: 'all', label: 'All countries' }, { value: 'PAK', label: 'Pakistan' }, { value: 'IND', label: 'India' }, { value: 'USA', label: 'USA' },
      ]},
    ]
  },
  {
    id: 'ilo-isco', name: 'ILO ISCO-08', description: 'International Standard Classification of Occupations 2008', status: 'public', category: 'Labor Market',
    apiRoute: 'http://localhost:4000/datasets/ilo-isco', docsUrl: 'https://ilostat.ilo.org/resources/concepts-and-definitions/classification-occupation/',
    params: [
      { key: 'lang', label: 'Language', type: 'select', default: 'en', options: [{ value: 'en', label: 'English' }, { value: 'fr', label: 'French' }, { value: 'es', label: 'Spanish' }] },
      { key: 'level', label: 'Classification Level', type: 'select', default: '1', options: [
        { value: '1', label: 'Level 1 — Major Groups' }, { value: '2', label: 'Level 2 — Sub-major Groups' },
        { value: '3', label: 'Level 3 — Minor Groups' }, { value: '4', label: 'Level 4 — Unit Groups' },
      ]},
    ]
  },
  {
    id: 'wittgenstein', name: 'Wittgenstein Centre', description: 'Global education & demographic projections', status: 'public', category: 'Education',
    apiRoute: 'http://localhost:4000/datasets/wittgenstein', docsUrl: 'https://dataexplorer.wittgensteincentre.org/wcde/',
    params: [] // No params needed, just returns access info
  },
  {
    id: 'un-population', name: 'UN Population', description: 'World Population Prospects projections', status: 'public', category: 'Education',
    apiRoute: 'http://localhost:4000/datasets/un-population', docsUrl: 'https://population.un.org/dataportal/about/dataapi',
    params: [
      { key: 'indicator', label: 'Indicator ID', type: 'text', default: '49', description: '49 = Total Population, 65 = Life Expectancy' },
      { key: 'location', label: 'Location ID', type: 'text', default: '4', description: '4 = World, 356 = India, 586 = Pakistan' },
      { key: 'startYear', label: 'Start Year', type: 'text', default: '2020', description: 'e.g. 2020' },
      { key: 'endYear', label: 'End Year', type: 'text', default: '2030', description: 'e.g. 2030' },
    ]
  },
  {
    id: 'unesco-uis', name: 'UNESCO UIS', description: 'Education statistics mirrored via World Bank', status: 'public', category: 'Education',
    apiRoute: 'http://localhost:4000/datasets/unesco-uis', docsUrl: 'https://apiportal.uis.unesco.org/',
    params: [
      { key: 'indicator', label: 'Indicator', type: 'select', default: 'SE.ADT.LITR.ZS', options: [
        { value: 'SE.ADT.LITR.ZS', label: 'Adult Literacy Rate (%)' },
        { value: 'SE.PRM.ENRR', label: 'Primary School Enrollment (%)' },
        { value: 'SE.SEC.ENRR', label: 'Secondary School Enrollment (%)' },
        { value: 'SE.TER.ENRR', label: 'Tertiary Enrollment (%)' },
        { value: 'SE.XPD.TOTL.GD.ZS', label: 'Govt. Education Spending (% GDP)' },
      ]},
      { key: 'country', label: 'Country', type: 'select', default: 'all', options: [
        { value: 'all', label: 'All countries' }, { value: 'PAK', label: 'Pakistan' }, { value: 'IND', label: 'India' }, { value: 'USA', label: 'USA' },
      ]},
    ]
  },
  {
    id: 'frey-osborne', name: 'Frey & Osborne', description: 'Automation probability scores for 702 occupations (2013)', status: 'public', category: 'Automation',
    apiRoute: 'http://localhost:4000/datasets/frey-osborne', docsUrl: 'https://www.oxfordmartin.ox.ac.uk/downloads/academic/The_Future_of_Employment.pdf',
    params: [
      { key: 'minRisk', label: 'Min Risk Score', type: 'select', default: '0', options: [{ value: '0', label: '0 (any)' }, { value: '0.5', label: '0.5 (medium+)' }, { value: '0.7', label: '0.7 (high)' }, { value: '0.9', label: '0.9 (very high)' }] },
      { key: 'maxRisk', label: 'Max Risk Score', type: 'select', default: '1', options: [{ value: '0.3', label: '0.3 (low risk only)' }, { value: '0.5', label: '0.5 (up to medium)' }, { value: '1', label: '1 (all)' }] },
      { key: 'sortBy', label: 'Sort By Risk', type: 'select', default: 'desc', options: [{ value: 'desc', label: 'Highest risk first' }, { value: 'asc', label: 'Lowest risk first' }] },
      { key: 'limit', label: 'Max Results', type: 'select', default: '20', options: [{ value: '10', label: '10' }, { value: '20', label: '20' }, { value: '25', label: 'All (25 sample)' }] },
    ]
  },
  {
    id: 'wb-step', name: 'World Bank STEP', description: 'Skills Toward Employment & Productivity microdata', status: 'auth', category: 'Automation',
    apiRoute: 'http://localhost:4000/datasets/wb-step', docsUrl: 'https://microdata.worldbank.org/index.php/catalog/step',
    authInfo: {
      status: 'Free Account Required for Microdata', requiredEnvVar: 'WB_MICRODATA_API_KEY',
      steps: [
        { step: 1, action: 'Register at World Bank Microdata Library', url: 'https://microdata.worldbank.org/index.php/auth/register', instruction: 'Create a free account — no payment needed' },
        { step: 2, action: 'Browse STEP catalog', url: 'https://microdata.worldbank.org/index.php/catalog/step', instruction: 'Find datasets by country and submit a data access request' },
        { step: 3, instruction: 'Add WB_MICRODATA_API_KEY=your_key to .env.local after approval' },
      ],
      alternativeUrl: 'https://microdata.worldbank.org/index.php/catalog/step',
      alternativeNote: 'Many STEP datasets are freely downloadable after free registration'
    }
  },
  {
    id: 'ilo-fow', name: 'ILO Future of Work', description: 'Labour income, hours, earnings — future of work indicators', status: 'public', category: 'Automation',
    apiRoute: 'http://localhost:4000/datasets/ilo-fow', docsUrl: 'https://rplumber.ilo.org/__docs__/',
    params: [
      { key: 'indicator', label: 'Indicator', type: 'select', default: 'SDG_0852_SEX_RT', options: [
        { value: 'SDG_0852_SEX_RT', label: 'Labour income share (%)' },
        { value: 'EMP_TEMP_SEX_AGE_NB', label: 'Employment by sex & age' },
        { value: 'HOW_TEMP_SEX_NB', label: 'Mean weekly hours worked' },
        { value: 'UNE_DEAP_SEX_AGE_RT', label: 'Unemployment rate' },
      ]},
      { key: 'country', label: 'Country Code (ISO2, optional)', type: 'text', default: '', description: 'Leave blank for all. e.g. PAK, IND, USA' },
      { key: 'limit', label: 'Max Records', type: 'select', default: '20', options: [{ value: '10', label: '10' }, { value: '20', label: '20' }, { value: '50', label: '50' }] },
    ]
  },
  {
    id: 'itu-digital', name: 'ITU Digital Dev', description: 'Internet, mobile & broadband penetration data', status: 'public', category: 'Automation',
    apiRoute: 'http://localhost:4000/datasets/itu-digital', docsUrl: 'https://www.itu.int/en/ITU-D/Statistics/Pages/stat/default.aspx',
    params: [
      { key: 'indicator', label: 'Indicator', type: 'select', default: 'IT.NET.USER.ZS', options: [
        { value: 'IT.NET.USER.ZS', label: 'Internet users (% of population)' },
        { value: 'IT.CEL.SETS.P2', label: 'Mobile subscriptions per 100 people' },
        { value: 'IT.NET.BBND.P2', label: 'Fixed broadband per 100 people' },
        { value: 'IT.MLT.MAIN.P2', label: 'Fixed telephone subscriptions per 100' },
      ]},
      { key: 'country', label: 'Country', type: 'select', default: 'all', options: [
        { value: 'all', label: 'All countries' }, { value: 'PAK', label: 'Pakistan' }, { value: 'IND', label: 'India' }, { value: 'USA', label: 'USA' }, { value: 'CHN', label: 'China' },
      ]},
      { key: 'mrv', label: 'Most Recent Years', type: 'select', default: '1', options: [{ value: '1', label: '1 year' }, { value: '3', label: '3 years' }, { value: '5', label: '5 years' }] },
    ]
  },
  {
    id: 'esco', name: 'ESCO Skills', description: 'EU Skills & Occupations Taxonomy — 13,000+ skills', status: 'public', category: 'Skills',
    apiRoute: 'http://localhost:4000/datasets/esco', docsUrl: 'https://esco.ec.europa.eu/en/use-esco/esco-web-services',
    params: [
      { key: 'text', label: 'Search Term', type: 'text', default: 'data analysis', description: 'Search for skills, e.g. "machine learning", "accounting"' },
      { key: 'type', label: 'Result Type', type: 'select', default: 'skill', options: [
        { value: 'skill', label: 'Skills & Competences' }, { value: 'occupation', label: 'Occupations' }, { value: 'isced-f', label: 'Education Fields' },
      ]},
      { key: 'language', label: 'Language', type: 'select', default: 'en', options: [{ value: 'en', label: 'English' }, { value: 'fr', label: 'French' }, { value: 'de', label: 'German' }, { value: 'ar', label: 'Arabic' }] },
      { key: 'limit', label: 'Results', type: 'select', default: '10', options: [{ value: '5', label: '5' }, { value: '10', label: '10' }, { value: '20', label: '20' }] },
    ]
  },
  {
    id: 'onet', name: 'O*NET (US DOL)', description: 'Occupational Information Network — skills, tasks, wages for 1000+ jobs', status: 'auth', category: 'Skills',
    apiRoute: 'http://localhost:4000/datasets/onet', docsUrl: 'https://services.onetcenter.org/developer/',
    authInfo: {
      status: 'Free API Key Required (Non-commercial)', requiredEnvVar: 'ONET_API_KEY',
      steps: [
        { step: 1, action: 'Register at O*NET Web Services', url: 'https://services.onetcenter.org/developer/', instruction: 'Free for non-commercial use — click "Register"' },
        { step: 2, instruction: 'You will receive credentials via email within 1-2 business days' },
        { step: 3, instruction: 'Add ONET_API_KEY=username:password (plain, will be base64 encoded) to .env.local' },
      ],
      alternativeUrl: 'https://www.onetonline.org/',
      alternativeNote: 'Browse O*NET occupations freely at onetonline.org — no account needed'
    }
  },
];

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  'Labor Market': <Briefcase size={22} color="#6366f1" />,
  'Education': <GraduationCap size={22} color="#a855f7" />,
  'Automation': <Cpu size={22} color="#ec4899" />,
  'Skills': <Layers size={22} color="#10b981" />,
};

export default function DataSourcesPage() {
  const [selected, setSelected] = useState<Source | null>(null);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'config' | 'result'>('config');

  const openSource = (src: Source) => {
    setSelected(src);
    setData(null); setError(null); setView('config');
    const defaults: Record<string, string> = {};
    src.params?.forEach(p => { defaults[p.key] = p.default; });
    setParamValues(defaults);
  };

  const fetchData = async () => {
    if (!selected) return;
    setLoading(true); setError(null); setData(null);
    try {
      const qs = new URLSearchParams(paramValues).toString();
      const url = `${selected.apiRoute}${qs ? '?' + qs : ''}`;
      const res = await fetch(url);
      const json = await res.json();
      setData(json); setView('result');
    } catch (e: any) {
      setError(e.message);
    } finally { setLoading(false); }
  };

  const categories = ['Labor Market', 'Education', 'Automation', 'Skills'];

  return (
    <div className="ds-container">
      <div className="ds-header">
        <div className="ds-header-badge">Global Intelligence Hub</div>
        <h1>Data Sources</h1>
        <p>Labor market, education & automation datasets from international organizations</p>
        <div className="ds-stats">
          <span><strong>{SOURCES.filter(s => s.status === 'public').length}</strong> Public APIs</span>
          <span className="dot">·</span>
          <span><strong>{SOURCES.filter(s => s.status === 'auth').length}</strong> Auth Required</span>
          <span className="dot">·</span>
          <span><strong>{SOURCES.length}</strong> Total Sources</span>
        </div>
      </div>

      {categories.map(cat => (
        <div key={cat} className="ds-section">
          <h2 className="ds-section-title">{CATEGORY_ICONS[cat]} {cat}</h2>
          <div className="ds-grid">
            {SOURCES.filter(s => s.category === cat).map(src => (
              <div key={src.id} className={`ds-card ${src.status}`}>
                <div className="ds-card-top">
                  <div className="ds-card-icon">{src.status === 'public' ? <Database size={18} /> : <Lock size={18} />}</div>
                  <span className={`ds-badge ${src.status}`}>{src.status === 'public' ? '● Public' : '● Auth Required'}</span>
                </div>
                <h3>{src.name}</h3>
                <p>{src.description}</p>
                <div className="ds-card-actions">
                  <button className={`ds-btn ${src.status}`} onClick={() => openSource(src)}>
                    {src.status === 'public' ? <><Settings size={14} /> Configure & Fetch</> : <><Lock size={14} /> View Access Info</>}
                  </button>
                  {src.docsUrl && (
                    <a href={src.docsUrl} target="_blank" rel="noreferrer" className="ds-btn-ghost">
                      <ExternalLink size={14} /> Docs
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {selected && (
        <div className="ds-overlay" onClick={() => setSelected(null)}>
          <div className="ds-modal" onClick={e => e.stopPropagation()}>
            <button className="ds-close" onClick={() => setSelected(null)}><X size={20} /></button>
            <div className="ds-modal-header">
              <div className={`ds-modal-icon ${selected.status}`}>{selected.status === 'public' ? <Database size={24} /> : <Lock size={24} />}</div>
              <div>
                <h2>{selected.name}</h2>
                <p>{selected.description}</p>
              </div>
            </div>

            {/* AUTH SOURCES */}
            {selected.status === 'auth' && selected.authInfo && (
              <div className="ds-auth-panel">
                <div className="ds-auth-status"><AlertCircle size={16} /> {selected.authInfo.status}</div>
                {selected.authInfo.requiredEnvVar && (
                  <div className="ds-env-var">Env variable needed: <code>{selected.authInfo.requiredEnvVar}</code></div>
                )}
                <div className="ds-steps">
                  {selected.authInfo.steps.map((s, i) => (
                    <div key={i} className="ds-step">
                      {s.step && <div className="ds-step-num">{s.step}</div>}
                      <div>
                        {s.action && <strong>{s.action}</strong>}
                        {s.url && <a href={s.url} target="_blank" rel="noreferrer" className="ds-link"> → {s.url}</a>}
                        <p>{s.instruction}</p>
                      </div>
                    </div>
                  ))}
                </div>
                {selected.authInfo.alternativeUrl && (
                  <div className="ds-alternative">
                    <CheckCircle2 size={14} />
                    <span><strong>Free alternative:</strong> {selected.authInfo.alternativeNote} — <a href={selected.authInfo.alternativeUrl} target="_blank" rel="noreferrer" className="ds-link">{selected.authInfo.alternativeUrl}</a></span>
                  </div>
                )}
                <button className="ds-btn public" style={{ marginTop: '1.5rem' }} onClick={fetchData} disabled={loading}>
                  {loading ? 'Checking...' : 'Check API Status'}
                </button>
              </div>
            )}

            {/* PUBLIC SOURCES — PARAMS */}
            {selected.status === 'public' && view === 'config' && (
              <div className="ds-params">
                <h3><Settings size={16} /> Configure Request</h3>
                {selected.params?.map(p => (
                  <div key={p.key} className="ds-param-row">
                    <label htmlFor={`param-${p.key}`}>{p.label}</label>
                    {p.type === 'select' ? (
                      <select id={`param-${p.key}`} value={paramValues[p.key] || p.default} onChange={e => setParamValues(v => ({ ...v, [p.key]: e.target.value }))}>
                        {p.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    ) : (
                      <input id={`param-${p.key}`} type="text" value={paramValues[p.key] ?? p.default} onChange={e => setParamValues(v => ({ ...v, [p.key]: e.target.value }))} placeholder={p.description} />
                    )}
                    {p.description && <span className="ds-param-hint">{p.description}</span>}
                  </div>
                ))}
                <button className="ds-btn public" onClick={fetchData} disabled={loading}>
                  {loading ? <span className="ds-spinner" /> : null} {loading ? 'Fetching...' : 'Fetch Data'}
                </button>
              </div>
            )}

            {/* RESULTS */}
            {view === 'result' && (
              <div className="ds-result">
                <div className="ds-result-header">
                  {error ? <span className="ds-error-badge"><AlertCircle size={14} /> Error</span> : <span className="ds-success-badge"><CheckCircle2 size={14} /> Live Data</span>}
                  {selected.status === 'public' && <button className="ds-btn-ghost" onClick={() => setView('config')}><Settings size={14} /> Reconfigure</button>}
                </div>
                {error && <div className="ds-error-box">{error}</div>}
                {data && <pre className="ds-terminal">{JSON.stringify(data, null, 2)}</pre>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
