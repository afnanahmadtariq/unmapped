'use client';

import React, { useState } from 'react';
import './signals.css';

export default function SignalsPage() {
  const [occupation, setOccupation] = useState('');
  const [country, setCountry] = useState('');
  const [loading, setLoading] = useState(false);
  const [processedData, setProcessedData] = useState<any>(null);
  const [manualInputs, setManualInputs] = useState<Record<string, string>>({});

  const handleManualInput = (key: string, value: string) => {
    setManualInputs(prev => ({ ...prev, [key]: value }));
  };

  const processSignals = async () => {
    if (!occupation || !country) return alert('Please enter an occupation and country code (ISO3).');
    setLoading(true);
    
    try {
      // Fetch all relevant datasets
      const fetchJson = async (url: string) => {
        try { const r = await fetch(url); return r.ok ? await r.json() : null; } catch { return null; }
      };

      const [frey, iloFow, iloIlostat, itu, unesco, unPop, wittgenstein] = await Promise.all([
        fetchJson(`http://localhost:4000/datasets/frey-osborne`),
        fetchJson(`http://localhost:4000/datasets/ilo-fow?country=${country}`),
        fetchJson(`http://localhost:4000/datasets/ilo-ilostat?country=${country}`),
        fetchJson(`http://localhost:4000/datasets/itu-digital?country=${country}`),
        fetchJson(`http://localhost:4000/datasets/unesco-uis?country=${country}`),
        fetchJson(`http://localhost:4000/datasets/un-population`),
        fetchJson(`http://localhost:4000/datasets/wittgenstein`),
      ]);

      const data: any = {};

      // C. Automation Risk Signals
      if (frey?.records) {
        const match = frey.records.find((r: any) => r.occupation.toLowerCase().includes(occupation.toLowerCase()));
        if (match) data.automationProb = { value: `${(match.probability * 100).toFixed(1)}%`, source: 'Frey & Osborne (API)' };
      }

      // E. Regional Opportunity Signals
      if (unPop?.records) {
        // UN Pop country mapping is complex (uses numeric IDs), so we just show World/Region if country not matched
        const migration = unPop.records.find((r: any) => r.indicatorId === 78 && r.locationName === 'World');
        if (migration) data.migrationIndicator = { value: `${migration.value} (World Avg)`, source: 'UN Population (API)' };
      }
      if (itu?.records) {
        const internet = itu.records.find((r: any) => r.indicatorId === 'IT.NET.USER.ZS');
        if (internet) data.infrastructure = { value: `${internet.value}% Internet Penetration`, source: 'ITU Digital Dev (API)' };
      }

      // F. Education & Workforce
      if (unesco?.records) {
        const literacy = unesco.records.find((r: any) => r.indicatorId === 'SE.ADT.LITR.ZS');
        if (literacy) data.literacy = { value: `${literacy.value}%`, source: 'UNESCO UIS (API)' };
      }
      if (wittgenstein?.records) {
        const wcde = wittgenstein.records.find((r: any) => r.iso3 === country && r.year === 2030);
        if (wcde) data.workforceProj = { value: `Projected population shift available`, source: 'Wittgenstein Centre (API)' };
      }
      if (iloIlostat?.records) {
        // Find youth unemployment if available, else general
        const unemp = iloIlostat.records.find((r: any) => r.indicatorId === 'UNE_DEAP_SEX_AGE_RT');
        if (unemp) data.youthUnemp = { value: `${unemp.obs_value}% (General)`, source: 'ILO ILOSTAT (API)' };
      }

      // G. Inequality & Access
      if (iloFow?.records) {
        const informal = iloFow.records.find((r: any) => r.indicatorId === 'IFL_XEES_SEX_RT');
        if (informal) data.informality = { value: `${informal.obs_value}%`, source: 'ILO FoW (API)' };
      }
      if (iloIlostat?.records) {
        // Gender gap calculation
        const male = iloIlostat.records.find((r: any) => r.indicatorId === 'EMP_TEMP_SEX_AGE_NB' && String(r.sex).includes('M'));
        const female = iloIlostat.records.find((r: any) => r.indicatorId === 'EMP_TEMP_SEX_AGE_NB' && String(r.sex).includes('F'));
        if (male && female) data.genderGap = { value: `Male: ${male.obs_value}, Female: ${female.obs_value}`, source: 'ILO ILOSTAT (API)' };
      }

      setProcessedData(data);
    } catch (err) {
      console.error(err);
      alert('Failed to process signals from Harvester API.');
    } finally {
      setLoading(false);
    }
  };

  const SignalField = ({ label, apiData, manualKey, placeholder }: any) => {
    const isInsufficient = !apiData;
    return (
      <div className="sig-field">
        <div className="sig-field-header">
          <span className="sig-field-label">{label}</span>
          <span className={`sig-badge ${isInsufficient ? 'manual' : 'api'}`}>
            {isInsufficient ? 'Insufficient Data' : 'API Data'}
          </span>
        </div>
        <div className="sig-value-box">
          {isInsufficient ? (
            <input 
              type="text" 
              className="sig-value-input" 
              placeholder={placeholder || "Manual Input Required..."}
              value={manualInputs[manualKey] || ''}
              onChange={(e) => handleManualInput(manualKey, e.target.value)}
            />
          ) : (
            <span style={{ color: '#22c55e' }}>{apiData.value}</span>
          )}
        </div>
        <span className="sig-source-note">Source: {isInsufficient ? 'No programmatic source available' : apiData.source}</span>
      </div>
    );
  };

  return (
    <div className="sig-container">
      <div className="sig-header">
        <h1>Signal Processor</h1>
        <p>Calculates exact signals based on global harvesting. Insufficient data fields are strictly labeled and require manual qualitative input.</p>
      </div>

      <div className="sig-controls">
        <div className="sig-input-group">
          <label>Target Occupation</label>
          <input type="text" placeholder="e.g., Mobile Repair" value={occupation} onChange={e => setOccupation(e.target.value)} />
        </div>
        <div className="sig-input-group">
          <label>Country Code (ISO3)</label>
          <input type="text" placeholder="e.g., PAK" value={country} onChange={e => setCountry(e.target.value)} maxLength={3} />
        </div>
        <button className="sig-btn" onClick={processSignals} disabled={loading}>
          {loading ? 'Processing...' : 'Calculate Signals'}
        </button>
      </div>

      <div className="sig-grid">
          
          <div className="sig-card">
            <div className="sig-card-header">
              <span className="sig-card-icon">💰</span>
              <div className="sig-card-title">
                <h2>A. Income & Wage Signals</h2>
                <p>Direct earning potential indicators</p>
              </div>
            </div>
            <SignalField label="Wage floor (minimum typical)" manualKey="wageFloor" apiData={null} placeholder="e.g. PKR 25,000/month" />
            <SignalField label="Median wage (typical income)" manualKey="medianWage" apiData={null} placeholder="e.g. PKR 45,000/month" />
            <SignalField label="Wage growth rate (YoY)" manualKey="wageGrowth" apiData={null} placeholder="e.g. +8% yearly" />
            <SignalField label="Income volatility" manualKey="incomeVol" apiData={null} placeholder="e.g. Highly unstable" />
            <SignalField label="Informal vs formal wage gap" manualKey="wageGap" apiData={null} placeholder="e.g. 30% lower in informal" />
          </div>

          <div className="sig-card">
            <div className="sig-card-header">
              <span className="sig-card-icon">📈</span>
              <div className="sig-card-title">
                <h2>B. Demand & Growth Signals</h2>
                <p>Is this field growing or dying?</p>
              </div>
            </div>
            <SignalField label="Sector employment growth rate" manualKey="secGrowth" apiData={null} placeholder="e.g. grew 12% in 2024" />
            <SignalField label="Job creation rate" manualKey="jobCreation" apiData={null} placeholder="e.g. +5,000 jobs/yr" />
            <SignalField label="Demand-supply gap" manualKey="dsGap" apiData={null} placeholder="e.g. Demand > Supply" />
            <SignalField label="Vacancy rate" manualKey="vacancy" apiData={null} placeholder="e.g. 4.5%" />
            <SignalField label="Informal sector expansion rate" manualKey="informalExp" apiData={null} placeholder="e.g. Rapid expansion" />
          </div>

          <div className="sig-card">
            <div className="sig-card-header">
              <span className="sig-card-icon">🤖</span>
              <div className="sig-card-title">
                <h2>C. Automation Risk Signals</h2>
                <p>Vulnerability to AI</p>
              </div>
            </div>
            <SignalField label="Task automation probability" apiData={processedData?.automationProb} manualKey="autoProb" placeholder="Calculated by Frey-Osborne" />
            <SignalField label="Routine vs non-routine ratio" manualKey="routineRatio" apiData={null} placeholder="e.g. High routine" />
            <SignalField label="AI exposure index" manualKey="aiExposure" apiData={null} placeholder="e.g. Medium exposure" />
            <SignalField label="Skill durability score" manualKey="skillDurability" apiData={null} placeholder="e.g. 5 years" />
          </div>

          <div className="sig-card">
            <div className="sig-card-header">
              <span className="sig-card-icon">🧠</span>
              <div className="sig-card-title">
                <h2>D. Skills Demand Signals</h2>
                <p>What skills are valuable right now?</p>
              </div>
            </div>
            <SignalField label="Top demanded skills (regional)" manualKey="topSkills" apiData={null} placeholder="e.g. Basic electronics" />
            <SignalField label="Emerging skills (growth rate)" manualKey="emergingSkills" apiData={null} placeholder="e.g. Digital payments" />
            <SignalField label="Skill scarcity index" manualKey="skillScarcity" apiData={null} placeholder="e.g. High scarcity" />
            <SignalField label="Cross-skill transferability" manualKey="skillTransfer" apiData={null} placeholder="e.g. High to IT repair" />
          </div>

          <div className="sig-card">
            <div className="sig-card-header">
              <span className="sig-card-icon">🌍</span>
              <div className="sig-card-title">
                <h2>E. Regional Opportunity Signals</h2>
                <p>Where should I go or focus?</p>
              </div>
            </div>
            <SignalField label="Urban vs rural opportunity gap" manualKey="urbanRural" apiData={null} placeholder="e.g. Highly urbanized" />
            <SignalField label="Regional employment density" manualKey="empDensity" apiData={null} placeholder="e.g. High in tech hubs" />
            <SignalField label="Migration opportunity indicators" apiData={processedData?.migrationIndicator} manualKey="migInd" placeholder="e.g. High outward migration" />
            <SignalField label="Infrastructure readiness" apiData={processedData?.infrastructure} manualKey="infra" placeholder="e.g. High 4G penetration" />
          </div>

          <div className="sig-card">
            <div className="sig-card-header">
              <span className="sig-card-icon">📊</span>
              <div className="sig-card-title">
                <h2>F. Education & Workforce Signals</h2>
                <p>Human capital readiness</p>
              </div>
            </div>
            <SignalField label="Education level distribution" manualKey="eduDist" apiData={null} placeholder="e.g. 60% secondary" />
            <SignalField label="Future workforce projections" apiData={processedData?.workforceProj} manualKey="workProj" placeholder="e.g. +2M by 2030" />
            <SignalField label="Literacy/digital literacy rates" apiData={processedData?.literacy} manualKey="literacy" placeholder="e.g. 65%" />
            <SignalField label="Youth unemployment rate" apiData={processedData?.youthUnemp} manualKey="youthUnemp" placeholder="e.g. 15%" />
          </div>

          <div className="sig-card">
            <div className="sig-card-header">
              <span className="sig-card-icon">⚖️</span>
              <div className="sig-card-title">
                <h2>G. Inequality & Access Signals</h2>
                <p>Important for policymakers</p>
              </div>
            </div>
            <SignalField label="Gender employment gap" apiData={processedData?.genderGap} manualKey="genderGap" placeholder="e.g. 30% gap" />
            <SignalField label="Youth vs adult wage gap" manualKey="youthWageGap" apiData={null} placeholder="e.g. Youth earn 20% less" />
            <SignalField label="Informality rate" apiData={processedData?.informality} manualKey="informality" placeholder="e.g. 70% informal" />
            <SignalField label="Access to training programs" manualKey="trainingAccess" apiData={null} placeholder="e.g. Low access" />
          </div>

          <div className="sig-card">
            <div className="sig-card-header">
              <span className="sig-card-icon">🧪</span>
              <div className="sig-card-title">
                <h2>H. Risk & Stability Signals</h2>
                <p>Economic shock sensitivity</p>
              </div>
            </div>
            <SignalField label="Sector volatility index" manualKey="volatility" apiData={null} placeholder="e.g. High volatility" />
            <SignalField label="Economic shock sensitivity" manualKey="shockSense" apiData={null} placeholder="e.g. Highly sensitive" />
            <SignalField label="Seasonality (agriculture, etc.)" manualKey="seasonality" apiData={null} placeholder="e.g. Non-seasonal" />
            <SignalField label="Job survival rate" manualKey="jobSurvival" apiData={null} placeholder="e.g. 80% after 1 year" />
          </div>

      </div>
    </div>
  );
}
