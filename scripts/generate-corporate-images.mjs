import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const outputDir = path.resolve('public/images');
const distDir = path.resolve('dist/images');
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });

// Shared design tokens
const COLORS = {
  navyDark: '#07172B',
  navyCard: '#0D2340',
  navyBorder: '#1E3A5F',
  gold: '#C99A3D',
  goldLight: '#E2BD67',
  goldMuted: '#96742E',
  slateDark: '#1E293B',
  slateMuted: '#64748B',
  slateLight: '#94A3B8',
  white: '#FFFFFF',
  emerald: '#10B981',
  emeraldLight: '#34D399',
  sky: '#0284C7',
  skyLight: '#38BDF8',
};

// 1. Tax Advisory & Planning
function generateTaxAdvisorySvg() {
  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#051324"/>
        <stop offset="50%" stop-color="#081E38"/>
        <stop offset="100%" stop-color="#0A2748"/>
      </linearGradient>
      <linearGradient id="cardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#0F2B4E"/>
        <stop offset="100%" stop-color="#0A1E37"/>
      </linearGradient>
      <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#C99A3D"/>
        <stop offset="100%" stop-color="#E2BD67"/>
      </linearGradient>
      <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
        <feDropShadow dx="0" dy="8" stdDeviation="16" flood-color="#000000" flood-opacity="0.6"/>
      </filter>
    </defs>

    <!-- Background Canvas -->
    <rect width="1200" height="800" fill="url(#bg)"/>

    <!-- Subtle Technical Grid -->
    <g opacity="0.08" stroke="#E2BD67" stroke-width="1">
      <path d="M 0,100 L 1200,100 M 0,200 L 1200,200 M 0,300 L 1200,300 M 0,400 L 1200,400 M 0,500 L 1200,500 M 0,600 L 1200,600 M 0,700 L 1200,700"/>
      <path d="M 150,0 L 150,800 M 300,0 L 300,800 M 450,0 L 450,800 M 600,0 L 600,800 M 750,0 L 750,800 M 900,0 L 900,800 M 1050,0 L 1050,800"/>
    </g>

    <!-- Top Corporate Header Banner -->
    <rect x="40" y="36" width="1120" height="60" rx="10" fill="#0D2340" stroke="#1E3A5F" stroke-width="1.5"/>
    <rect x="52" y="48" width="36" height="36" rx="8" fill="#C99A3D"/>
    <text x="70" y="72" font-family="Liberation Sans, sans-serif" font-size="16" font-weight="900" fill="#07172B" text-anchor="middle">A/R</text>
    <text x="102" y="65" font-family="Liberation Sans, sans-serif" font-size="14" font-weight="bold" fill="#FFFFFF" letter-spacing="1">A/R TAX SERVICES, LLC</text>
    <text x="102" y="82" font-family="Liberation Sans, sans-serif" font-size="11" fill="#E2BD67">PRIVATE CLIENT STRATEGY &amp; TAX PLANNING ADVISORY</text>

    <!-- Right Header Badges -->
    <rect x="910" y="48" width="235" height="36" rx="6" fill="#07172B" stroke="#C99A3D" stroke-width="1"/>
    <circle cx="930" cy="66" r="5" fill="#10B981"/>
    <text x="946" y="71" font-family="Liberation Sans, sans-serif" font-size="11" font-weight="bold" fill="#E2BD67">MULTI-YEAR PLANNING ACTIVE</text>

    <!-- Left Main Card: Entity Architecture & Scenario Modeling -->
    <g filter="url(#shadow)">
      <rect x="40" y="116" width="670" height="644" rx="16" fill="url(#cardGrad)" stroke="#1E3A5F" stroke-width="2"/>
      
      <!-- Card Header -->
      <rect x="40" y="116" width="670" height="54" rx="16" fill="#0A1E37"/>
      <text x="68" y="150" font-family="Liberation Sans, sans-serif" font-size="15" font-weight="bold" fill="#E2BD67">ENTITY STRUCTURE &amp; TAX PROJECTION ARCHITECTURE</text>
      <text x="600" y="150" font-family="Liberation Sans, sans-serif" font-size="11" fill="#94A3B8">SEC. 199A / PASS-THROUGH</text>
      <line x1="40" y1="170" x2="710" y2="170" stroke="#1E3A5F" stroke-width="1.5"/>

      <!-- Entity Flow Diagram -->
      <!-- Holding / Family Trust Box -->
      <rect x="235" y="195" width="280" height="70" rx="8" fill="#07172B" stroke="#C99A3D" stroke-width="1.5"/>
      <text x="375" y="224" font-family="Liberation Sans, sans-serif" font-size="12" font-weight="bold" fill="#FFFFFF" text-anchor="middle">FAMILY ASSET HOLDING TRUST</text>
      <text x="375" y="244" font-family="Liberation Sans, sans-serif" font-size="10" fill="#94A3B8" text-anchor="middle">100% Beneficial Interest • Estate Exemption Shield</text>

      <!-- Connecting Lines -->
      <line x1="375" y1="265" x2="375" y2="300" stroke="#C99A3D" stroke-width="2" stroke-dasharray="4,4"/>
      <line x1="205" y1="300" x2="545" y2="300" stroke="#C99A3D" stroke-width="2"/>
      <line x1="205" y1="300" x2="205" y2="325" stroke="#C99A3D" stroke-width="2"/>
      <line x1="545" y1="300" x2="545" y2="325" stroke="#C99A3D" stroke-width="2"/>

      <!-- Operating S-Corporation Box -->
      <rect x="75" y="325" width="260" height="95" rx="8" fill="#0B2342" stroke="#38BDF8" stroke-width="1.5"/>
      <text x="205" y="352" font-family="Liberation Sans, sans-serif" font-size="12" font-weight="bold" fill="#38BDF8" text-anchor="middle">OPERATING ENTITY (S-CORP)</text>
      <text x="205" y="372" font-family="Liberation Sans, sans-serif" font-size="10" fill="#FFFFFF" text-anchor="middle">Form 1120-S • Active Revenue</text>
      <text x="205" y="392" font-family="Liberation Sans, sans-serif" font-size="10" fill="#E2BD67" text-anchor="middle">W-2 Reasonable Salary: $150,000</text>
      <text x="205" y="408" font-family="Liberation Sans, sans-serif" font-size="9" fill="#94A3B8" text-anchor="middle">K-1 Distribution: $260,000 (No FICA)</text>

      <!-- Real Estate Holding LLC Box -->
      <rect x="415" y="325" width="260" height="95" rx="8" fill="#0B2342" stroke="#10B981" stroke-width="1.5"/>
      <text x="545" y="352" font-family="Liberation Sans, sans-serif" font-size="12" font-weight="bold" fill="#10B981" text-anchor="middle">REAL ESTATE HOLDING (LLC)</text>
      <text x="545" y="372" font-family="Liberation Sans, sans-serif" font-size="10" fill="#FFFFFF" text-anchor="middle">Form 1065 • Multi-Member Partnership</text>
      <text x="545" y="392" font-family="Liberation Sans, sans-serif" font-size="10" fill="#E2BD67" text-anchor="middle">Cost Segregation &amp; Bonus Deprec.</text>
      <text x="545" y="408" font-family="Liberation Sans, sans-serif" font-size="9" fill="#94A3B8" text-anchor="middle">Net Sheltered Cashflow: $185,000</text>

      <!-- Modeling Scenarios Table -->
      <rect x="75" y="445" width="600" height="280" rx="10" fill="#07172B" stroke="#1E3A5F" stroke-width="1.5"/>
      <text x="100" y="475" font-family="Liberation Sans, sans-serif" font-size="13" font-weight="bold" fill="#FFFFFF">THREE-YEAR TAX PROJECTION &amp; ENTITY OPTIMIZATION</text>
      
      <!-- Table Headers -->
      <rect x="95" y="492" width="560" height="30" rx="4" fill="#0E2849"/>
      <text x="110" y="512" font-family="Liberation Sans, sans-serif" font-size="10" font-weight="bold" fill="#94A3B8">TAX STRATEGY METRIC</text>
      <text x="310" y="512" font-family="Liberation Sans, sans-serif" font-size="10" font-weight="bold" fill="#94A3B8">DEFAULT FILING</text>
      <text x="440" y="512" font-family="Liberation Sans, sans-serif" font-size="10" font-weight="bold" fill="#94A3B8">A/R ADVISORY</text>
      <text x="560" y="512" font-family="Liberation Sans, sans-serif" font-size="10" font-weight="bold" fill="#E2BD67">TAX REDUCTION</text>

      <!-- Row 1 -->
      <text x="110" y="546" font-family="Liberation Sans, sans-serif" font-size="11" fill="#FFFFFF">Self-Employment / FICA Tax</text>
      <text x="310" y="546" font-family="Liberation Sans, sans-serif" font-size="11" fill="#EF4444">$46,240</text>
      <text x="440" y="546" font-family="Liberation Sans, sans-serif" font-size="11" fill="#10B981">$21,450</text>
      <text x="560" y="546" font-family="Liberation Sans, sans-serif" font-size="11" font-weight="bold" fill="#10B981">-$24,790</text>
      <line x1="95" y1="560" x2="655" y2="560" stroke="#1E3A5F" stroke-width="1"/>

      <!-- Row 2 -->
      <text x="110" y="586" font-family="Liberation Sans, sans-serif" font-size="11" fill="#FFFFFF">Section 199A QBI Deduction</text>
      <text x="310" y="586" font-family="Liberation Sans, sans-serif" font-size="11" fill="#94A3B8">$0 (Phased Out)</text>
      <text x="440" y="586" font-family="Liberation Sans, sans-serif" font-size="11" fill="#10B981">$64,000 Shield</text>
      <text x="560" y="586" font-family="Liberation Sans, sans-serif" font-size="11" font-weight="bold" fill="#10B981">-$23,680</text>
      <line x1="95" y1="600" x2="655" y2="600" stroke="#1E3A5F" stroke-width="1"/>

      <!-- Row 3 -->
      <text x="110" y="626" font-family="Liberation Sans, sans-serif" font-size="11" fill="#FFFFFF">Defined Benefit Pension Plan</text>
      <text x="310" y="626" font-family="Liberation Sans, sans-serif" font-size="11" fill="#94A3B8">$0 (Standard IRA)</text>
      <text x="440" y="626" font-family="Liberation Sans, sans-serif" font-size="11" fill="#10B981">$145,000 Contrib.</text>
      <text x="560" y="626" font-family="Liberation Sans, sans-serif" font-size="11" font-weight="bold" fill="#10B981">-$53,650</text>
      <line x1="95" y1="640" x2="655" y2="640" stroke="#1E3A5F" stroke-width="1"/>

      <!-- Total Row -->
      <rect x="95" y="655" width="560" height="52" rx="6" fill="#0A223E" stroke="#C99A3D" stroke-width="1"/>
      <text x="110" y="686" font-family="Liberation Sans, sans-serif" font-size="12" font-weight="bold" fill="#FFFFFF">CUMULATIVE ESTIMATED TAX SAVINGS</text>
      <text x="540" y="687" font-family="Liberation Sans, sans-serif" font-size="16" font-weight="bold" fill="#E2BD67">$102,120 / YR</text>
    </g>

    <!-- Right Column: Proactive Decision Matrix & Advisory Core -->
    <g filter="url(#shadow)">
      <!-- Proactive Decision Principle Card -->
      <rect x="735" y="116" width="425" height="340" rx="16" fill="url(#cardGrad)" stroke="#1E3A5F" stroke-width="2"/>
      <rect x="735" y="116" width="425" height="54" rx="16" fill="#0A1E37"/>
      <text x="760" y="150" font-family="Liberation Sans, sans-serif" font-size="14" font-weight="bold" fill="#E2BD67">PROACTIVE ADVISORY PRINCIPLE</text>
      
      <rect x="760" y="190" width="375" height="74" rx="8" fill="#07172B" stroke="#C99A3D" stroke-width="1"/>
      <text x="775" y="218" font-family="Liberation Serif, serif" font-size="15" font-style="italic" fill="#E2BD67">“Strategic decisions before filing —</text>
      <text x="775" y="244" font-family="Liberation Serif, serif" font-size="15" font-style="italic" fill="#FFFFFF">not simply preparing forms.”</text>

      <g transform="translate(760, 285)">
        <circle cx="16" cy="16" r="14" fill="#07172B" stroke="#10B981" stroke-width="2"/>
        <text x="16" y="21" font-family="Liberation Sans, sans-serif" font-size="12" font-weight="bold" fill="#10B981" text-anchor="middle">✓</text>
        <text x="42" y="15" font-family="Liberation Sans, sans-serif" font-size="12" font-weight="bold" fill="#FFFFFF">Quarterly Safe-Harbor Projections</text>
        <text x="42" y="30" font-family="Liberation Sans, sans-serif" font-size="10" fill="#94A3B8">Prevent underpayment penalties &amp; lock cashflow</text>
      </g>

      <g transform="translate(760, 345)">
        <circle cx="16" cy="16" r="14" fill="#07172B" stroke="#10B981" stroke-width="2"/>
        <text x="16" y="21" font-family="Liberation Sans, sans-serif" font-size="12" font-weight="bold" fill="#10B981" text-anchor="middle">✓</text>
        <text x="42" y="15" font-family="Liberation Sans, sans-serif" font-size="12" font-weight="bold" fill="#FFFFFF">Entity Conversion Modeling</text>
        <text x="42" y="30" font-family="Liberation Sans, sans-serif" font-size="10" fill="#94A3B8">Multi-entity asset segregation &amp; liability shields</text>
      </g>

      <g transform="translate(760, 405)">
        <circle cx="16" cy="16" r="14" fill="#07172B" stroke="#10B981" stroke-width="2"/>
        <text x="16" y="21" font-family="Liberation Sans, sans-serif" font-size="12" font-weight="bold" fill="#10B981" text-anchor="middle">✓</text>
        <text x="42" y="15" font-family="Liberation Sans, sans-serif" font-size="12" font-weight="bold" fill="#FFFFFF">Prior-Year Diagnostic Audit</text>
        <text x="42" y="30" font-family="Liberation Sans, sans-serif" font-size="10" fill="#94A3B8">Recover uncaptured deductions on Forms 1040X</text>
      </g>

      <!-- Bottom Executive Engagement Stamp -->
      <rect x="735" y="480" width="425" height="280" rx="16" fill="url(#cardGrad)" stroke="#1E3A5F" stroke-width="2"/>
      <rect x="735" y="480" width="425" height="54" rx="16" fill="#0A1E37"/>
      <text x="760" y="514" font-family="Liberation Sans, sans-serif" font-size="14" font-weight="bold" fill="#E2BD67">PRACTICE CAPABILITIES &amp; ADVISORY PROTOCOL</text>

      <rect x="760" y="555" width="375" height="48" rx="8" fill="#07172B" stroke="#1E3A5F" stroke-width="1"/>
      <text x="776" y="584" font-family="Liberation Sans, sans-serif" font-size="11" font-weight="bold" fill="#38BDF8">Q1–Q4 PROJECTIONS</text>
      <text x="960" y="584" font-family="Liberation Sans, sans-serif" font-size="11" fill="#94A3B8">Quarterly Estimated Filings</text>

      <rect x="760" y="615" width="375" height="48" rx="8" fill="#07172B" stroke="#1E3A5F" stroke-width="1"/>
      <text x="776" y="644" font-family="Liberation Sans, sans-serif" font-size="11" font-weight="bold" fill="#10B981">IRS FORM 2553 ELECTIONS</text>
      <text x="960" y="644" font-family="Liberation Sans, sans-serif" font-size="11" fill="#94A3B8">Timely S-Corp Status Opt-in</text>

      <rect x="760" y="675" width="375" height="60" rx="8" fill="#0A223E" stroke="#C99A3D" stroke-width="1.5"/>
      <text x="776" y="700" font-family="Liberation Sans, sans-serif" font-size="11" font-weight="bold" fill="#E2BD67">COLUMBIA, SC PRACTICE HEADQUARTERS</text>
      <text x="776" y="720" font-family="Liberation Sans, sans-serif" font-size="10" fill="#94A3B8">Authorized IRS e-file Provider • Private Client Group</text>
    </g>
  </svg>
  `;
}

// 2. Business & Corporate Services
function generateCorporateServicesSvg() {
  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#051324"/>
        <stop offset="50%" stop-color="#081E38"/>
        <stop offset="100%" stop-color="#0A2748"/>
      </linearGradient>
      <linearGradient id="cardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#0F2B4E"/>
        <stop offset="100%" stop-color="#0A1E37"/>
      </linearGradient>
      <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
        <feDropShadow dx="0" dy="8" stdDeviation="16" flood-color="#000000" flood-opacity="0.6"/>
      </filter>
    </defs>

    <rect width="1200" height="800" fill="url(#bg)"/>

    <g opacity="0.08" stroke="#38BDF8" stroke-width="1">
      <path d="M 0,100 L 1200,100 M 0,200 L 1200,200 M 0,300 L 1200,300 M 0,400 L 1200,400 M 0,500 L 1200,500 M 0,600 L 1200,600 M 0,700 L 1200,700"/>
      <path d="M 150,0 L 150,800 M 300,0 L 300,800 M 450,0 L 450,800 M 600,0 L 600,800 M 750,0 L 750,800 M 900,0 L 900,800 M 1050,0 L 1050,800"/>
    </g>

    <!-- Header -->
    <rect x="40" y="36" width="1120" height="60" rx="10" fill="#0D2340" stroke="#1E3A5F" stroke-width="1.5"/>
    <rect x="52" y="48" width="36" height="36" rx="8" fill="#38BDF8"/>
    <text x="70" y="72" font-family="Liberation Sans, sans-serif" font-size="16" font-weight="900" fill="#07172B" text-anchor="middle">CORP</text>
    <text x="102" y="65" font-family="Liberation Sans, sans-serif" font-size="14" font-weight="bold" fill="#FFFFFF" letter-spacing="1">A/R TAX SERVICES, LLC</text>
    <text x="102" y="82" font-family="Liberation Sans, sans-serif" font-size="11" fill="#38BDF8">CORPORATE TAX COMPLIANCE &amp; MULTISTATE BUSINESS ADVISORY</text>

    <rect x="880" y="48" width="265" height="36" rx="6" fill="#07172B" stroke="#38BDF8" stroke-width="1"/>
    <circle cx="900" cy="66" r="5" fill="#10B981"/>
    <text x="916" y="71" font-family="Liberation Sans, sans-serif" font-size="11" font-weight="bold" fill="#FFFFFF">ENTERPRISE COMPLIANCE VERIFIED</text>

    <!-- Left Main Panel: Corporate Entity Tax Stack -->
    <g filter="url(#shadow)">
      <rect x="40" y="116" width="670" height="644" rx="16" fill="url(#cardGrad)" stroke="#1E3A5F" stroke-width="2"/>
      <rect x="40" y="116" width="670" height="54" rx="16" fill="#0A1E37"/>
      <text x="68" y="150" font-family="Liberation Sans, sans-serif" font-size="15" font-weight="bold" fill="#38BDF8">CORPORATE ENTITY FILING ARCHITECTURE</text>
      <text x="560" y="150" font-family="Liberation Sans, sans-serif" font-size="11" fill="#E2BD67">50-STATE NEXUS</text>

      <!-- 3 Filings Hierarchy Cards -->
      <!-- Card 1: 1120-S -->
      <rect x="70" y="190" width="610" height="100" rx="10" fill="#07172B" stroke="#1E3A5F" stroke-width="1.5"/>
      <rect x="85" y="205" width="80" height="70" rx="8" fill="#0B2342" stroke="#38BDF8" stroke-width="1"/>
      <text x="125" y="238" font-family="Liberation Sans, sans-serif" font-size="13" font-weight="bold" fill="#38BDF8" text-anchor="middle">FORM</text>
      <text x="125" y="258" font-family="Liberation Sans, sans-serif" font-size="14" font-weight="900" fill="#FFFFFF" text-anchor="middle">1120-S</text>
      
      <text x="185" y="225" font-family="Liberation Sans, sans-serif" font-size="14" font-weight="bold" fill="#FFFFFF">S-Corporation Federal &amp; State Filings</text>
      <text x="185" y="246" font-family="Liberation Sans, sans-serif" font-size="11" fill="#94A3B8">Shareholder basis tracking, Form 7203 loss limitations, and K-1 distributions</text>
      <text x="185" y="266" font-family="Liberation Sans, sans-serif" font-size="11" font-weight="bold" fill="#E2BD67">Officer Reasonable Compensation Analysis Included</text>

      <!-- Card 2: 1065 -->
      <rect x="70" y="305" width="610" height="100" rx="10" fill="#07172B" stroke="#1E3A5F" stroke-width="1.5"/>
      <rect x="85" y="320" width="80" height="70" rx="8" fill="#0B2342" stroke="#10B981" stroke-width="1"/>
      <text x="125" y="353" font-family="Liberation Sans, sans-serif" font-size="13" font-weight="bold" fill="#10B981" text-anchor="middle">FORM</text>
      <text x="125" y="373" font-family="Liberation Sans, sans-serif" font-size="14" font-weight="900" fill="#FFFFFF" text-anchor="middle">1065</text>
      
      <text x="185" y="340" font-family="Liberation Sans, sans-serif" font-size="14" font-weight="bold" fill="#FFFFFF">Partnership &amp; Multi-Member LLC</text>
      <text x="185" y="361" font-family="Liberation Sans, sans-serif" font-size="11" fill="#94A3B8">Section 704(b) capital accounts, special allocations, and partner debt apportionment</text>
      <text x="185" y="381" font-family="Liberation Sans, sans-serif" font-size="11" font-weight="bold" fill="#10B981">Multi-Tier Partner Schedule K-1 Automation</text>

      <!-- Card 3: 1120 -->
      <rect x="70" y="420" width="610" height="100" rx="10" fill="#07172B" stroke="#1E3A5F" stroke-width="1.5"/>
      <rect x="85" y="435" width="80" height="70" rx="8" fill="#0B2342" stroke="#C99A3D" stroke-width="1"/>
      <text x="125" y="468" font-family="Liberation Sans, sans-serif" font-size="13" font-weight="bold" fill="#C99A3D" text-anchor="middle">FORM</text>
      <text x="125" y="488" font-family="Liberation Sans, sans-serif" font-size="14" font-weight="900" fill="#FFFFFF" text-anchor="middle">1120</text>
      
      <text x="185" y="455" font-family="Liberation Sans, sans-serif" font-size="14" font-weight="bold" fill="#FFFFFF">C-Corporation Enterprise Tax Compliance</text>
      <text x="185" y="476" font-family="Liberation Sans, sans-serif" font-size="11" fill="#94A3B8">Schedule M-1 / M-3 book-to-tax reconciliations, retained earnings, and dividend withholding</text>
      <text x="185" y="496" font-family="Liberation Sans, sans-serif" font-size="11" font-weight="bold" fill="#38BDF8">Section 243 Dividends Received Deduction Coordination</text>

      <!-- Executive Compensation Review Matrix -->
      <rect x="70" y="535" width="610" height="190" rx="10" fill="#07172B" stroke="#1E3A5F" stroke-width="1.5"/>
      <text x="95" y="565" font-family="Liberation Sans, sans-serif" font-size="13" font-weight="bold" fill="#FFFFFF">EXECUTIVE REASONABLE COMPENSATION STUDY</text>
      <rect x="95" y="582" width="560" height="32" rx="4" fill="#0E2849"/>
      <text x="110" y="602" font-family="Liberation Sans, sans-serif" font-size="10" font-weight="bold" fill="#94A3B8">ROLE &amp; INDUSTRY BENCHMARK</text>
      <text x="330" y="602" font-family="Liberation Sans, sans-serif" font-size="10" font-weight="bold" fill="#94A3B8">W-2 SALARY</text>
      <text x="440" y="602" font-family="Liberation Sans, sans-serif" font-size="10" font-weight="bold" fill="#94A3B8">K-1 PROFIT</text>
      <text x="550" y="602" font-family="Liberation Sans, sans-serif" font-size="10" font-weight="bold" fill="#10B981">IRS AUDIT SAFE</text>

      <text x="110" y="635" font-family="Liberation Sans, sans-serif" font-size="11" fill="#FFFFFF">Managing Principal (Engineering Services)</text>
      <text x="330" y="635" font-family="Liberation Sans, sans-serif" font-size="11" fill="#38BDF8">$165,000</text>
      <text x="440" y="635" font-family="Liberation Sans, sans-serif" font-size="11" fill="#E2BD67">$240,000</text>
      <text x="550" y="635" font-family="Liberation Sans, sans-serif" font-size="11" font-weight="bold" fill="#10B981">COMPLIANT</text>
      <line x1="95" y1="650" x2="655" y2="650" stroke="#1E3A5F" stroke-width="1"/>

      <text x="110" y="675" font-family="Liberation Sans, sans-serif" font-size="11" fill="#FFFFFF">Corporate Director (Medical Practice LLC)</text>
      <text x="330" y="675" font-family="Liberation Sans, sans-serif" font-size="11" fill="#38BDF8">$210,000</text>
      <text x="440" y="675" font-family="Liberation Sans, sans-serif" font-size="11" fill="#E2BD67">$385,000</text>
      <text x="550" y="675" font-family="Liberation Sans, sans-serif" font-size="11" font-weight="bold" fill="#10B981">COMPLIANT</text>

      <rect x="95" y="695" width="560" height="20" rx="3" fill="#0A223E"/>
      <text x="110" y="709" font-family="Liberation Sans, sans-serif" font-size="9" fill="#E2BD67">RCReports™ &amp; Bureau of Labor Statistics Geographic Wage Data Grounded</text>
    </g>

    <!-- Right Column: Multistate Nexus Map & Compliance -->
    <g filter="url(#shadow)">
      <rect x="735" y="116" width="425" height="340" rx="16" fill="url(#cardGrad)" stroke="#1E3A5F" stroke-width="2"/>
      <rect x="735" y="116" width="425" height="54" rx="16" fill="#0A1E37"/>
      <text x="760" y="150" font-family="Liberation Sans, sans-serif" font-size="14" font-weight="bold" fill="#38BDF8">MULTISTATE APPORTIONMENT &amp; NEXUS</text>

      <!-- Visual State Apportionment Bars -->
      <g transform="translate(760, 185)">
        <text x="0" y="15" font-family="Liberation Sans, sans-serif" font-size="12" font-weight="bold" fill="#FFFFFF">South Carolina (Home State HQ)</text>
        <text x="320" y="15" font-family="Liberation Sans, sans-serif" font-size="12" font-weight="bold" fill="#E2BD67">52%</text>
        <rect x="0" y="24" width="375" height="12" rx="6" fill="#07172B" stroke="#1E3A5F" stroke-width="1"/>
        <rect x="0" y="24" width="195" height="12" rx="6" fill="#38BDF8"/>
      </g>

      <g transform="translate(760, 245)">
        <text x="0" y="15" font-family="Liberation Sans, sans-serif" font-size="12" font-weight="bold" fill="#FFFFFF">North Carolina (Economic Nexus)</text>
        <text x="320" y="15" font-family="Liberation Sans, sans-serif" font-size="12" font-weight="bold" fill="#E2BD67">24%</text>
        <rect x="0" y="24" width="375" height="12" rx="6" fill="#07172B" stroke="#1E3A5F" stroke-width="1"/>
        <rect x="0" y="24" width="90" height="12" rx="6" fill="#10B981"/>
      </g>

      <g transform="translate(760, 305)">
        <text x="0" y="15" font-family="Liberation Sans, sans-serif" font-size="12" font-weight="bold" fill="#FFFFFF">Georgia (Payroll &amp; Remote Staff)</text>
        <text x="320" y="15" font-family="Liberation Sans, sans-serif" font-size="12" font-weight="bold" fill="#E2BD67">14%</text>
        <rect x="0" y="24" width="375" height="12" rx="6" fill="#07172B" stroke="#1E3A5F" stroke-width="1"/>
        <rect x="0" y="24" width="52" height="12" rx="6" fill="#C99A3D"/>
      </g>

      <g transform="translate(760, 365)">
        <text x="0" y="15" font-family="Liberation Sans, sans-serif" font-size="12" font-weight="bold" fill="#FFFFFF">Florida / Out-of-State Sales</text>
        <text x="320" y="15" font-family="Liberation Sans, sans-serif" font-size="12" font-weight="bold" fill="#E2BD67">10%</text>
        <rect x="0" y="24" width="375" height="12" rx="6" fill="#07172B" stroke="#1E3A5F" stroke-width="1"/>
        <rect x="0" y="24" width="38" height="12" rx="6" fill="#94A3B8"/>
      </g>

      <text x="760" y="430" font-family="Liberation Sans, sans-serif" font-size="11" fill="#94A3B8">P.L. 86-272 Safe Harbor • Sales Factor Apportionment Compliant</text>

      <!-- Bottom Card -->
      <rect x="735" y="480" width="425" height="280" rx="16" fill="url(#cardGrad)" stroke="#1E3A5F" stroke-width="2"/>
      <rect x="735" y="480" width="425" height="54" rx="16" fill="#0A1E37"/>
      <text x="760" y="514" font-family="Liberation Sans, sans-serif" font-size="14" font-weight="bold" fill="#38BDF8">CORPORATE STATUTORY OVERSIGHT</text>

      <g transform="translate(760, 555)">
        <rect x="0" y="0" width="375" height="50" rx="8" fill="#07172B" stroke="#1E3A5F" stroke-width="1"/>
        <text x="16" y="28" font-family="Liberation Sans, sans-serif" font-size="12" font-weight="bold" fill="#FFFFFF">Annual Secretary of State Filings</text>
        <text x="16" y="42" font-family="Liberation Sans, sans-serif" font-size="10" fill="#10B981">Good Standing Status Maintained Across All Entities</text>
      </g>

      <g transform="translate(760, 615)">
        <rect x="0" y="0" width="375" height="50" rx="8" fill="#07172B" stroke="#1E3A5F" stroke-width="1"/>
        <text x="16" y="28" font-family="Liberation Sans, sans-serif" font-size="12" font-weight="bold" fill="#FFFFFF">State Franchise &amp; Corporate License</text>
        <text x="16" y="42" font-family="Liberation Sans, sans-serif" font-size="10" fill="#38BDF8">SC Dept. of Revenue CL-1 &amp; Form SC1120-S</text>
      </g>

      <rect x="760" y="675" width="375" height="60" rx="8" fill="#0A223E" stroke="#38BDF8" stroke-width="1.5"/>
      <text x="776" y="700" font-family="Liberation Sans, sans-serif" font-size="11" font-weight="bold" fill="#FFFFFF">A/R CORPORATE ADVISORY DIVISION</text>
      <text x="776" y="720" font-family="Liberation Sans, sans-serif" font-size="10" fill="#38BDF8">Dedicated Entity Compliance Desk • Audit-Ready Workpapers</text>
    </g>
  </svg>
  `;
}

// 3. Wealth, Estate & Asset Protection (replaces generic model house)
function generateEstatePlanningSvg() {
  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#051324"/>
        <stop offset="50%" stop-color="#081E38"/>
        <stop offset="100%" stop-color="#0A2748"/>
      </linearGradient>
      <linearGradient id="cardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#0F2B4E"/>
        <stop offset="100%" stop-color="#0A1E37"/>
      </linearGradient>
      <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
        <feDropShadow dx="0" dy="8" stdDeviation="16" flood-color="#000000" flood-opacity="0.6"/>
      </filter>
    </defs>

    <rect width="1200" height="800" fill="url(#bg)"/>

    <g opacity="0.08" stroke="#E2BD67" stroke-width="1">
      <path d="M 0,100 L 1200,100 M 0,200 L 1200,200 M 0,300 L 1200,300 M 0,400 L 1200,400 M 0,500 L 1200,500 M 0,600 L 1200,600 M 0,700 L 1200,700"/>
      <path d="M 150,0 L 150,800 M 300,0 L 300,800 M 450,0 L 450,800 M 600,0 L 600,800 M 750,0 L 750,800 M 900,0 L 900,800 M 1050,0 L 1050,800"/>
    </g>

    <!-- Header -->
    <rect x="40" y="36" width="1120" height="60" rx="10" fill="#0D2340" stroke="#1E3A5F" stroke-width="1.5"/>
    <rect x="52" y="48" width="36" height="36" rx="8" fill="#C99A3D"/>
    <text x="70" y="72" font-family="Liberation Sans, sans-serif" font-size="16" font-weight="900" fill="#07172B" text-anchor="middle">TRUST</text>
    <text x="102" y="65" font-family="Liberation Sans, sans-serif" font-size="14" font-weight="bold" fill="#FFFFFF" letter-spacing="1">A/R TAX SERVICES, LLC</text>
    <text x="102" y="82" font-family="Liberation Sans, sans-serif" font-size="11" fill="#E2BD67">WEALTH, ESTATE &amp; ASSET PROTECTION ARCHITECTURE</text>

    <!-- Core Directive Pill: PROTECT -> STRUCTURE -> TRANSFER -> PRESERVE -->
    <rect x="680" y="48" width="465" height="36" rx="18" fill="#07172B" stroke="#C99A3D" stroke-width="1.5"/>
    <text x="912" y="71" font-family="Liberation Sans, sans-serif" font-size="12" font-weight="bold" fill="#E2BD67" text-anchor="middle" letter-spacing="1.5">PROTECT  ➔  STRUCTURE  ➔  TRANSFER  ➔  PRESERVE</text>

    <!-- Left Main Card: Multi-Generational Wealth Flow -->
    <g filter="url(#shadow)">
      <rect x="40" y="116" width="670" height="644" rx="16" fill="url(#cardGrad)" stroke="#1E3A5F" stroke-width="2"/>
      <rect x="40" y="116" width="670" height="54" rx="16" fill="#0A1E37"/>
      <text x="68" y="150" font-family="Liberation Sans, sans-serif" font-size="15" font-weight="bold" fill="#E2BD67">FAMILY WEALTH &amp; ASSET PRESERVATION HIERARCHY</text>
      <text x="560" y="150" font-family="Liberation Sans, sans-serif" font-size="11" fill="#10B981">FORM 706 / 709</text>

      <!-- Tier 1: Family Grantor / Principals -->
      <rect x="235" y="190" width="280" height="64" rx="8" fill="#07172B" stroke="#C99A3D" stroke-width="2"/>
      <text x="375" y="218" font-family="Liberation Sans, sans-serif" font-size="13" font-weight="bold" fill="#FFFFFF" text-anchor="middle">FAMILY PRINCIPALS / GRANTOR</text>
      <text x="375" y="238" font-family="Liberation Sans, sans-serif" font-size="10" fill="#E2BD67" text-anchor="middle">Lifetime Exemption Allocation: $13.61M / $27.22M</text>

      <!-- Connector Arrows -->
      <line x1="375" y1="254" x2="375" y2="285" stroke="#C99A3D" stroke-width="2"/>
      <polygon points="375,290 370,282 380,282" fill="#C99A3D"/>

      <!-- Tier 2: Fiduciary Trusts -->
      <g transform="translate(75, 295)">
        <!-- Trust A: Revocable Living Trust -->
        <rect x="0" y="0" width="260" height="85" rx="8" fill="#0B2342" stroke="#38BDF8" stroke-width="1.5"/>
        <text x="130" y="26" font-family="Liberation Sans, sans-serif" font-size="12" font-weight="bold" fill="#38BDF8" text-anchor="middle">REVOCABLE LIVING TRUST</text>
        <text x="130" y="46" font-family="Liberation Sans, sans-serif" font-size="10" fill="#FFFFFF" text-anchor="middle">Probate Bypass • Incapacity Shield</text>
        <text x="130" y="66" font-family="Liberation Sans, sans-serif" font-size="9" fill="#94A3B8" text-anchor="middle">Grantor Trust Status (Form 1040 Reporting)</text>

        <!-- Trust B: Irrevocable Dynastic Trust -->
        <rect x="290" y="0" width="260" height="85" rx="8" fill="#0B2342" stroke="#10B981" stroke-width="1.5"/>
        <text x="420" y="26" font-family="Liberation Sans, sans-serif" font-size="12" font-weight="bold" fill="#10B981" text-anchor="middle">IRREVOCABLE DYNASTY TRUST</text>
        <text x="420" y="46" font-family="Liberation Sans, sans-serif" font-size="10" fill="#FFFFFF" text-anchor="middle">Creditor Protection • GST Exemption</text>
        <text x="420" y="66" font-family="Liberation Sans, sans-serif" font-size="9" fill="#E2BD67" text-anchor="middle">Form 1041 Fiduciary Income Tax Return</text>
      </g>

      <!-- Asset Pillars Inside Trust (4 Columns) -->
      <text x="75" y="415" font-family="Liberation Sans, sans-serif" font-size="12" font-weight="bold" fill="#FFFFFF">PROTECTED UNDERLYING ASSET CLASSES</text>

      <g transform="translate(75, 430)">
        <!-- Pillar 1: Real Estate -->
        <rect x="0" y="0" width="138" height="110" rx="8" fill="#07172B" stroke="#1E3A5F" stroke-width="1.5"/>
        <rect x="12" y="12" width="28" height="28" rx="6" fill="#0B2342" stroke="#C99A3D" stroke-width="1"/>
        <text x="26" y="31" font-family="Liberation Sans, sans-serif" font-size="12" fill="#E2BD67" text-anchor="middle">🏠</text>
        <text x="48" y="30" font-family="Liberation Sans, sans-serif" font-size="11" font-weight="bold" fill="#FFFFFF">Real Estate</text>
        <text x="12" y="62" font-family="Liberation Sans, sans-serif" font-size="10" fill="#94A3B8">Commercial &amp; Land</text>
        <text x="12" y="80" font-family="Liberation Sans, sans-serif" font-size="9" fill="#10B981">Step-Up in Basis</text>
        <text x="12" y="96" font-family="Liberation Sans, sans-serif" font-size="9" fill="#E2BD67">35% Allocation</text>

        <!-- Pillar 2: Operating Business -->
        <rect x="154" y="0" width="138" height="110" rx="8" fill="#07172B" stroke="#1E3A5F" stroke-width="1.5"/>
        <rect x="166" y="12" width="28" height="28" rx="6" fill="#0B2342" stroke="#38BDF8" stroke-width="1"/>
        <text x="180" y="31" font-family="Liberation Sans, sans-serif" font-size="12" fill="#38BDF8" text-anchor="middle">🏢</text>
        <text x="202" y="30" font-family="Liberation Sans, sans-serif" font-size="11" font-weight="bold" fill="#FFFFFF">Business</text>
        <text x="166" y="62" font-family="Liberation Sans, sans-serif" font-size="10" fill="#94A3B8">S-Corp / LLC Shares</text>
        <text x="166" y="80" font-family="Liberation Sans, sans-serif" font-size="9" fill="#38BDF8">Buy-Sell Valuation</text>
        <text x="166" y="96" font-family="Liberation Sans, sans-serif" font-size="9" fill="#E2BD67">40% Allocation</text>

        <!-- Pillar 3: Liquid Securities -->
        <rect x="308" y="0" width="138" height="110" rx="8" fill="#07172B" stroke="#1E3A5F" stroke-width="1.5"/>
        <rect x="320" y="12" width="28" height="28" rx="6" fill="#0B2342" stroke="#10B981" stroke-width="1"/>
        <text x="334" y="31" font-family="Liberation Sans, sans-serif" font-size="12" fill="#10B981" text-anchor="middle">📈</text>
        <text x="356" y="30" font-family="Liberation Sans, sans-serif" font-size="11" font-weight="bold" fill="#FFFFFF">Investments</text>
        <text x="320" y="62" font-family="Liberation Sans, sans-serif" font-size="10" fill="#94A3B8">Market Portfolios</text>
        <text x="320" y="80" font-family="Liberation Sans, sans-serif" font-size="9" fill="#10B981">Custodial Fiduciary</text>
        <text x="320" y="96" font-family="Liberation Sans, sans-serif" font-size="9" fill="#E2BD67">20% Allocation</text>

        <!-- Pillar 4: Life & Insurance Trust -->
        <rect x="462" y="0" width="138" height="110" rx="8" fill="#07172B" stroke="#1E3A5F" stroke-width="1.5"/>
        <rect x="474" y="12" width="28" height="28" rx="6" fill="#0B2342" stroke="#C99A3D" stroke-width="1"/>
        <text x="488" y="31" font-family="Liberation Sans, sans-serif" font-size="12" fill="#E2BD67" text-anchor="middle">🛡️</text>
        <text x="510" y="30" font-family="Liberation Sans, sans-serif" font-size="11" font-weight="bold" fill="#FFFFFF">ILIT Life</text>
        <text x="474" y="62" font-family="Liberation Sans, sans-serif" font-size="10" fill="#94A3B8">Estate Liquidity</text>
        <text x="474" y="80" font-family="Liberation Sans, sans-serif" font-size="9" fill="#E2BD67">Tax-Free Payout</text>
        <text x="474" y="96" font-family="Liberation Sans, sans-serif" font-size="9" fill="#E2BD67">5% Allocation</text>
      </g>

      <!-- Tier 3: Beneficiary Succession Box -->
      <rect x="75" y="565" width="600" height="150" rx="10" fill="#07172B" stroke="#C99A3D" stroke-width="1.5"/>
      <text x="100" y="595" font-family="Liberation Sans, sans-serif" font-size="13" font-weight="bold" fill="#FFFFFF">MULTI-GENERATIONAL BENEFICIARY SUCCESSION</text>
      <text x="530" y="595" font-family="Liberation Sans, sans-serif" font-size="11" fill="#10B981">GENERATION-SKIPPING</text>

      <rect x="95" y="612" width="560" height="85" rx="6" fill="#0B2342" stroke="#1E3A5F" stroke-width="1"/>
      <text x="115" y="638" font-family="Liberation Sans, sans-serif" font-size="12" font-weight="bold" fill="#E2BD67">Next-Generation Beneficiaries &amp; Charitable Endowment</text>
      <text x="115" y="658" font-family="Liberation Sans, sans-serif" font-size="11" fill="#FFFFFF">• 0% Estate Friction via Full Statutory Lifetime Unified Credit Shield</text>
      <text x="115" y="678" font-family="Liberation Sans, sans-serif" font-size="11" fill="#94A3B8">• Synchronized Collaboration with Licensed Estate Legal Counsel</text>
    </g>

    <!-- Right Column: Estate Fiduciary Metrics & Checklists -->
    <g filter="url(#shadow)">
      <rect x="735" y="116" width="425" height="340" rx="16" fill="url(#cardGrad)" stroke="#1E3A5F" stroke-width="2"/>
      <rect x="735" y="116" width="425" height="54" rx="16" fill="#0A1E37"/>
      <text x="760" y="150" font-family="Liberation Sans, sans-serif" font-size="14" font-weight="bold" fill="#E2BD67">ESTATE TAX MINIMIZATION BENCHMARK</text>

      <g transform="translate(760, 190)">
        <rect x="0" y="0" width="375" height="65" rx="8" fill="#07172B" stroke="#10B981" stroke-width="1"/>
        <text x="16" y="26" font-family="Liberation Sans, sans-serif" font-size="11" font-weight="bold" fill="#10B981">FEDERAL ESTATE EXEMPTION PROTECTION</text>
        <text x="16" y="48" font-family="Liberation Sans, sans-serif" font-size="16" font-weight="bold" fill="#FFFFFF">$27,220,000</text>
        <text x="215" y="48" font-family="Liberation Sans, sans-serif" font-size="10" fill="#94A3B8">Married Spousal Portability (DSUE)</text>
      </g>

      <g transform="translate(760, 270)">
        <rect x="0" y="0" width="375" height="65" rx="8" fill="#07172B" stroke="#C99A3D" stroke-width="1"/>
        <text x="16" y="26" font-family="Liberation Sans, sans-serif" font-size="11" font-weight="bold" fill="#E2BD67">ANNUAL GIFT EXCLUSION RECOGNITION</text>
        <text x="16" y="48" font-family="Liberation Sans, sans-serif" font-size="16" font-weight="bold" fill="#FFFFFF">$18,000 / $36,000</text>
        <text x="215" y="48" font-family="Liberation Sans, sans-serif" font-size="10" fill="#94A3B8">Per Donee Annual Tax-Free Gift</text>
      </g>

      <text x="760" y="375" font-family="Liberation Sans, sans-serif" font-size="11" fill="#FFFFFF">Form 706 Estate Tax Return Audit Defense</text>
      <text x="760" y="395" font-family="Liberation Sans, sans-serif" font-size="11" fill="#FFFFFF">Form 709 United States Gift Tax Reporting</text>
      <text x="760" y="415" font-family="Liberation Sans, sans-serif" font-size="11" fill="#FFFFFF">Valuation Discount Studies on Family Entities</text>

      <!-- Bottom Advisory Block -->
      <rect x="735" y="480" width="425" height="280" rx="16" fill="url(#cardGrad)" stroke="#1E3A5F" stroke-width="2"/>
      <rect x="735" y="480" width="425" height="54" rx="16" fill="#0A1E37"/>
      <text x="760" y="514" font-family="Liberation Sans, sans-serif" font-size="14" font-weight="bold" fill="#E2BD67">FIDUCIARY ADVISORY PROTOCOL</text>

      <g transform="translate(760, 555)">
        <rect x="0" y="0" width="375" height="50" rx="8" fill="#07172B" stroke="#1E3A5F" stroke-width="1"/>
        <text x="16" y="28" font-family="Liberation Sans, sans-serif" font-size="12" font-weight="bold" fill="#FFFFFF">Direct Collaboration with Counsel</text>
        <text x="16" y="42" font-family="Liberation Sans, sans-serif" font-size="10" fill="#10B981">Coordination with client trust attorneys &amp; fiduciaries</text>
      </g>

      <g transform="translate(760, 615)">
        <rect x="0" y="0" width="375" height="50" rx="8" fill="#07172B" stroke="#1E3A5F" stroke-width="1"/>
        <text x="16" y="28" font-family="Liberation Sans, sans-serif" font-size="12" font-weight="bold" fill="#FFFFFF">Annual Trust Tax Compliance</text>
        <text x="16" y="42" font-family="Liberation Sans, sans-serif" font-size="10" fill="#38BDF8">Timely Form 1041 filings &amp; Schedule K-1 allocations</text>
      </g>

      <rect x="760" y="675" width="375" height="60" rx="8" fill="#0A223E" stroke="#C99A3D" stroke-width="1.5"/>
      <text x="776" y="700" font-family="Liberation Sans, sans-serif" font-size="11" font-weight="bold" fill="#E2BD67">A/R TAX SERVICES, LLC PRIVATE WEALTH DESK</text>
      <text x="776" y="720" font-family="Liberation Sans, sans-serif" font-size="10" fill="#94A3B8">Columbia, SC • Preserving Wealth. Building Legacies.</text>
    </g>
  </svg>
  `;
}

// 4. Meticulous Tax Preparation (replaces unrelated black-background portrait)
function generateTaxPreparationSvg() {
  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#051324"/>
        <stop offset="50%" stop-color="#081E38"/>
        <stop offset="100%" stop-color="#0A2748"/>
      </linearGradient>
      <linearGradient id="cardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#0F2B4E"/>
        <stop offset="100%" stop-color="#0A1E37"/>
      </linearGradient>
      <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
        <feDropShadow dx="0" dy="8" stdDeviation="16" flood-color="#000000" flood-opacity="0.6"/>
      </filter>
    </defs>

    <rect width="1200" height="800" fill="url(#bg)"/>

    <g opacity="0.08" stroke="#10B981" stroke-width="1">
      <path d="M 0,100 L 1200,100 M 0,200 L 1200,200 M 0,300 L 1200,300 M 0,400 L 1200,400 M 0,500 L 1200,500 M 0,600 L 1200,600 M 0,700 L 1200,700"/>
      <path d="M 150,0 L 150,800 M 300,0 L 300,800 M 450,0 L 450,800 M 600,0 L 600,800 M 750,0 L 750,800 M 900,0 L 900,800 M 1050,0 L 1050,800"/>
    </g>

    <!-- Header -->
    <rect x="40" y="36" width="1120" height="60" rx="10" fill="#0D2340" stroke="#1E3A5F" stroke-width="1.5"/>
    <rect x="52" y="48" width="36" height="36" rx="8" fill="#10B981"/>
    <text x="70" y="72" font-family="Liberation Sans, sans-serif" font-size="16" font-weight="900" fill="#07172B" text-anchor="middle">1040</text>
    <text x="102" y="65" font-family="Liberation Sans, sans-serif" font-size="14" font-weight="bold" fill="#FFFFFF" letter-spacing="1">A/R TAX SERVICES, LLC</text>
    <text x="102" y="82" font-family="Liberation Sans, sans-serif" font-size="11" fill="#10B981">EXHAUSTIVE MULTI-TIER TAX RETURN PREPARATION &amp; QUALITY CONTROL</text>

    <!-- Right Header Badge -->
    <rect x="880" y="48" width="265" height="36" rx="6" fill="#07172B" stroke="#10B981" stroke-width="1"/>
    <circle cx="900" cy="66" r="5" fill="#10B981"/>
    <text x="916" y="71" font-family="Liberation Sans, sans-serif" font-size="11" font-weight="bold" fill="#10B981">100% AUDIT-SUBSTANTIATED</text>

    <!-- Left Main Card: Multi-Screen Tax Verification Workstation -->
    <g filter="url(#shadow)">
      <rect x="40" y="116" width="670" height="644" rx="16" fill="url(#cardGrad)" stroke="#1E3A5F" stroke-width="2"/>
      <rect x="40" y="116" width="670" height="54" rx="16" fill="#0A1E37"/>
      <text x="68" y="150" font-family="Liberation Sans, sans-serif" font-size="15" font-weight="bold" fill="#10B981">DOCUMENT VERIFICATION &amp; RECONCILIATION SUITE</text>
      <text x="560" y="150" font-family="Liberation Sans, sans-serif" font-size="11" fill="#E2BD67">IRS e-file CERTIFIED</text>

      <!-- Seven-Step Workflow Banner -->
      <!-- DOCUMENTS -> CLASSIFICATION -> RECONCILIATION -> PREPARER REVIEW -> QC -> CLIENT APPROVAL -> FILING -->
      <rect x="70" y="185" width="610" height="42" rx="6" fill="#07172B" stroke="#1E3A5F" stroke-width="1"/>
      <text x="375" y="211" font-family="Liberation Sans, sans-serif" font-size="10" font-weight="bold" fill="#E2BD67" text-anchor="middle" letter-spacing="0.5">
        DOCS ➔ CLASSIFY ➔ RECONCILE ➔ PREPARER REVIEW ➔ QC ➔ CLIENT APPROVAL ➔ IRS E-FILE
      </text>

      <!-- Categorized Document Intake Grids (W-2, 1099, K-1, Sch C, Sch E) -->
      <g transform="translate(70, 245)">
        <!-- Box 1: Form W-2 / 1099 -->
        <rect x="0" y="0" width="190" height="95" rx="8" fill="#07172B" stroke="#1E3A5F" stroke-width="1.5"/>
        <text x="16" y="26" font-family="Liberation Sans, sans-serif" font-size="12" font-weight="bold" fill="#FFFFFF">W-2 &amp; 1099-NEC / MISC</text>
        <text x="16" y="46" font-family="Liberation Sans, sans-serif" font-size="10" fill="#94A3B8">Wage &amp; Compensation Audit</text>
        <text x="16" y="66" font-family="Liberation Sans, sans-serif" font-size="10" fill="#38BDF8">IRS Transcript Matching: OK</text>
        <text x="16" y="82" font-family="Liberation Sans, sans-serif" font-size="9" fill="#10B981">Box 1 / Box 2 Withholding Verified</text>

        <!-- Box 2: Schedule K-1 Pass-Through -->
        <rect x="210" y="0" width="190" height="95" rx="8" fill="#07172B" stroke="#1E3A5F" stroke-width="1.5"/>
        <text x="226" y="26" font-family="Liberation Sans, sans-serif" font-size="12" font-weight="bold" fill="#FFFFFF">SCHEDULE K-1 PASS-THRU</text>
        <text x="226" y="46" font-family="Liberation Sans, sans-serif" font-size="10" fill="#94A3B8">Forms 1065 / 1120-S Inflows</text>
        <text x="226" y="66" font-family="Liberation Sans, sans-serif" font-size="10" fill="#E2BD67">Form 7203 Basis Calculation</text>
        <text x="226" y="82" font-family="Liberation Sans, sans-serif" font-size="9" fill="#10B981">At-Risk Loss Limits Substantiated</text>

        <!-- Box 3: Schedule C / Business -->
        <rect x="420" y="0" width="190" height="95" rx="8" fill="#07172B" stroke="#1E3A5F" stroke-width="1.5"/>
        <text x="436" y="26" font-family="Liberation Sans, sans-serif" font-size="12" font-weight="bold" fill="#FFFFFF">SCHEDULE C &amp; E</text>
        <text x="436" y="46" font-family="Liberation Sans, sans-serif" font-size="10" fill="#94A3B8">Sole Prop &amp; Real Estate Rental</text>
        <text x="436" y="66" font-family="Liberation Sans, sans-serif" font-size="10" fill="#10B981">Section 179 Depreciation</text>
        <text x="436" y="82" font-family="Liberation Sans, sans-serif" font-size="9" fill="#38BDF8">Passive Activity Loss Rules Applied</text>
      </g>

      <!-- Detailed Form 1040 Line-Item Reconciliation Table -->
      <rect x="70" y="360" width="610" height="260" rx="10" fill="#07172B" stroke="#1E3A5F" stroke-width="1.5"/>
      <text x="95" y="390" font-family="Liberation Sans, sans-serif" font-size="13" font-weight="bold" fill="#FFFFFF">FORM 1040 CORE RECONCILIATION SUMMARY</text>
      
      <rect x="95" y="405" width="560" height="28" rx="4" fill="#0E2849"/>
      <text x="110" y="423" font-family="Liberation Sans, sans-serif" font-size="10" font-weight="bold" fill="#94A3B8">TAX RETURN LINE ITEM</text>
      <text x="330" y="423" font-family="Liberation Sans, sans-serif" font-size="10" font-weight="bold" fill="#94A3B8">SOURCE DOCUMENT</text>
      <text x="460" y="423" font-family="Liberation Sans, sans-serif" font-size="10" font-weight="bold" fill="#94A3B8">REPORTED</text>
      <text x="560" y="423" font-family="Liberation Sans, sans-serif" font-size="10" font-weight="bold" fill="#10B981">STATUS</text>

      <!-- Row 1 -->
      <text x="110" y="455" font-family="Liberation Sans, sans-serif" font-size="11" fill="#FFFFFF">Line 1z: Total W-2 Wages</text>
      <text x="330" y="455" font-family="Liberation Sans, sans-serif" font-size="11" fill="#94A3B8">W-2 (Employer Box 1)</text>
      <text x="460" y="455" font-family="Liberation Sans, sans-serif" font-size="11" fill="#FFFFFF">$245,600</text>
      <text x="560" y="455" font-family="Liberation Sans, sans-serif" font-size="11" font-weight="bold" fill="#10B981">MATCHED</text>
      <line x1="95" y1="468" x2="655" y2="468" stroke="#1E3A5F" stroke-width="1"/>

      <!-- Row 2 -->
      <text x="110" y="490" font-family="Liberation Sans, sans-serif" font-size="11" fill="#FFFFFF">Line 2b: Taxable Interest</text>
      <text x="330" y="490" font-family="Liberation Sans, sans-serif" font-size="11" fill="#94A3B8">1099-INT / Brokerage</text>
      <text x="460" y="490" font-family="Liberation Sans, sans-serif" font-size="11" fill="#FFFFFF">$8,420</text>
      <text x="560" y="490" font-family="Liberation Sans, sans-serif" font-size="11" font-weight="bold" fill="#10B981">MATCHED</text>
      <line x1="95" y1="503" x2="655" y2="503" stroke="#1E3A5F" stroke-width="1"/>

      <!-- Row 3 -->
      <text x="110" y="525" font-family="Liberation Sans, sans-serif" font-size="11" fill="#FFFFFF">Line 7: Capital Gain/Loss</text>
      <text x="330" y="525" font-family="Liberation Sans, sans-serif" font-size="11" fill="#94A3B8">1099-B / Schedule D</text>
      <text x="460" y="525" font-family="Liberation Sans, sans-serif" font-size="11" fill="#FFFFFF">$41,850</text>
      <text x="560" y="525" font-family="Liberation Sans, sans-serif" font-size="11" font-weight="bold" fill="#10B981">SUBSTANTIATED</text>
      <line x1="95" y1="538" x2="655" y2="538" stroke="#1E3A5F" stroke-width="1"/>

      <!-- Row 4 -->
      <text x="110" y="560" font-family="Liberation Sans, sans-serif" font-size="11" fill="#FFFFFF">Line 13: QBI Deduction (Sec 199A)</text>
      <text x="330" y="560" font-family="Liberation Sans, sans-serif" font-size="11" fill="#94A3B8">Form 8995-A Schedule</text>
      <text x="460" y="560" font-family="Liberation Sans, sans-serif" font-size="11" fill="#10B981">-$38,400</text>
      <text x="560" y="560" font-family="Liberation Sans, sans-serif" font-size="11" font-weight="bold" fill="#10B981">VERIFIED</text>
      <line x1="95" y1="573" x2="655" y2="573" stroke="#1E3A5F" stroke-width="1"/>

      <!-- Summary -->
      <text x="110" y="598" font-family="Liberation Sans, sans-serif" font-size="12" font-weight="bold" fill="#FFFFFF">TOTAL TAX ADJUSTMENTS APPLIED</text>
      <text x="540" y="598" font-family="Liberation Sans, sans-serif" font-size="14" font-weight="bold" fill="#E2BD67">100% AUDIT READY</text>

      <!-- Signature & Preparer Review Block -->
      <rect x="70" y="635" width="610" height="95" rx="8" fill="#07172B" stroke="#10B981" stroke-width="1.5"/>
      <text x="95" y="662" font-family="Liberation Sans, sans-serif" font-size="12" font-weight="bold" fill="#10B981">AUTHORIZED PAID PREPARER SIGN-OFF &amp; IRS PTIN</text>
      <text x="95" y="682" font-family="Liberation Sans, sans-serif" font-size="11" fill="#FFFFFF">Desmond Hinds, Founder • A/R Tax Services, LLC</text>
      <text x="95" y="702" font-family="Liberation Sans, sans-serif" font-size="10" fill="#94A3B8">E-File Authorization Form 8879 Generated • Encrypted Client Portal Delivery</text>
    </g>

    <!-- Right Column: Compliance Verification & Multi-Tier Review -->
    <g filter="url(#shadow)">
      <rect x="735" y="116" width="425" height="340" rx="16" fill="url(#cardGrad)" stroke="#1E3A5F" stroke-width="2"/>
      <rect x="735" y="116" width="425" height="54" rx="16" fill="#0A1E37"/>
      <text x="760" y="150" font-family="Liberation Sans, sans-serif" font-size="14" font-weight="bold" fill="#10B981">THREE-TIER QUALITY CONTROL CHECK</text>

      <g transform="translate(760, 190)">
        <circle cx="16" cy="16" r="14" fill="#07172B" stroke="#10B981" stroke-width="2"/>
        <text x="16" y="21" font-family="Liberation Sans, sans-serif" font-size="12" font-weight="bold" fill="#10B981" text-anchor="middle">✓</text>
        <text x="42" y="15" font-family="Liberation Sans, sans-serif" font-size="12" font-weight="bold" fill="#FFFFFF">Tier 1: Preparer Calculation &amp; Workpapers</text>
        <text x="42" y="30" font-family="Liberation Sans, sans-serif" font-size="10" fill="#94A3B8">Mathematical proof and source document tie-out</text>
      </g>

      <g transform="translate(760, 250)">
        <circle cx="16" cy="16" r="14" fill="#07172B" stroke="#10B981" stroke-width="2"/>
        <text x="16" y="21" font-family="Liberation Sans, sans-serif" font-size="12" font-weight="bold" fill="#10B981" text-anchor="middle">✓</text>
        <text x="42" y="15" font-family="Liberation Sans, sans-serif" font-size="12" font-weight="bold" fill="#FFFFFF">Tier 2: Senior Manager Diagnostic Review</text>
        <text x="42" y="30" font-family="Liberation Sans, sans-serif" font-size="10" fill="#94A3B8">Deduction eligibility &amp; passive loss limitation test</text>
      </g>

      <g transform="translate(760, 310)">
        <circle cx="16" cy="16" r="14" fill="#07172B" stroke="#10B981" stroke-width="2"/>
        <text x="16" y="21" font-family="Liberation Sans, sans-serif" font-size="12" font-weight="bold" fill="#10B981" text-anchor="middle">✓</text>
        <text x="42" y="15" font-family="Liberation Sans, sans-serif" font-size="12" font-weight="bold" fill="#FFFFFF">Tier 3: Executive Partner Final Audit</text>
        <text x="42" y="30" font-family="Liberation Sans, sans-serif" font-size="10" fill="#94A3B8">Substantive verification before client signing</text>
      </g>

      <g transform="translate(760, 370)">
        <circle cx="16" cy="16" r="14" fill="#07172B" stroke="#10B981" stroke-width="2"/>
        <text x="16" y="21" font-family="Liberation Sans, sans-serif" font-size="12" font-weight="bold" fill="#10B981" text-anchor="middle">✓</text>
        <text x="42" y="15" font-family="Liberation Sans, sans-serif" font-size="12" font-weight="bold" fill="#FFFFFF">IRS Direct E-File Confirmation Receipt</text>
        <text x="42" y="30" font-family="Liberation Sans, sans-serif" font-size="10" fill="#94A3B8">Official Submission Electronic Tracking ID</text>
      </g>

      <!-- Bottom Card -->
      <rect x="735" y="480" width="425" height="280" rx="16" fill="url(#cardGrad)" stroke="#1E3A5F" stroke-width="2"/>
      <rect x="735" y="480" width="425" height="54" rx="16" fill="#0A1E37"/>
      <text x="760" y="514" font-family="Liberation Sans, sans-serif" font-size="14" font-weight="bold" fill="#10B981">METICULOUS RETURN FILING STANDARD</text>

      <g transform="translate(760, 555)">
        <rect x="0" y="0" width="375" height="50" rx="8" fill="#07172B" stroke="#1E3A5F" stroke-width="1"/>
        <text x="16" y="28" font-family="Liberation Sans, sans-serif" font-size="12" font-weight="bold" fill="#FFFFFF">IRS Security Six Standards Enforced</text>
        <text x="16" y="42" font-family="Liberation Sans, sans-serif" font-size="10" fill="#10B981">Client data protected with 256-bit encryption</text>
      </g>

      <g transform="translate(760, 615)">
        <rect x="0" y="0" width="375" height="50" rx="8" fill="#07172B" stroke="#1E3A5F" stroke-width="1"/>
        <text x="16" y="28" font-family="Liberation Sans, sans-serif" font-size="12" font-weight="bold" fill="#FFFFFF">Comprehensive Document Retention</text>
        <text x="16" y="42" font-family="Liberation Sans, sans-serif" font-size="10" fill="#38BDF8">7-Year Secure Cloud Vault Access Included</text>
      </g>

      <rect x="760" y="675" width="375" height="60" rx="8" fill="#0A223E" stroke="#10B981" stroke-width="1.5"/>
      <text x="776" y="700" font-family="Liberation Sans, sans-serif" font-size="11" font-weight="bold" fill="#FFFFFF">A/R TAX PREPARATION EXCELLENCE</text>
      <text x="776" y="720" font-family="Liberation Sans, sans-serif" font-size="10" fill="#10B981">Every Line Item Substantiated • Zero Unsubstantiated Estimates</text>
    </g>
  </svg>
  `;
}

// 5. Accurate Financial Reporting & Seamless Accounting Integration
function generateFinancialReportingSvg() {
  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#051324"/>
        <stop offset="50%" stop-color="#081E38"/>
        <stop offset="100%" stop-color="#0A2748"/>
      </linearGradient>
      <linearGradient id="cardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#0F2B4E"/>
        <stop offset="100%" stop-color="#0A1E37"/>
      </linearGradient>
      <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
        <feDropShadow dx="0" dy="8" stdDeviation="16" flood-color="#000000" flood-opacity="0.6"/>
      </filter>
    </defs>

    <rect width="1200" height="800" fill="url(#bg)"/>

    <g opacity="0.08" stroke="#38BDF8" stroke-width="1">
      <path d="M 0,100 L 1200,100 M 0,200 L 1200,200 M 0,300 L 1200,300 M 0,400 L 1200,400 M 0,500 L 1200,500 M 0,600 L 1200,600 M 0,700 L 1200,700"/>
      <path d="M 150,0 L 150,800 M 300,0 L 300,800 M 450,0 L 450,800 M 600,0 L 600,800 M 750,0 L 750,800 M 900,0 L 900,800 M 1050,0 L 1050,800"/>
    </g>

    <!-- Header -->
    <rect x="40" y="36" width="1120" height="60" rx="10" fill="#0D2340" stroke="#1E3A5F" stroke-width="1.5"/>
    <rect x="52" y="48" width="36" height="36" rx="8" fill="#C99A3D"/>
    <text x="70" y="72" font-family="Liberation Sans, sans-serif" font-size="16" font-weight="900" fill="#07172B" text-anchor="middle">GL</text>
    <text x="102" y="65" font-family="Liberation Sans, sans-serif" font-size="14" font-weight="bold" fill="#FFFFFF" letter-spacing="1">A/R TAX SERVICES, LLC</text>
    <text x="102" y="82" font-family="Liberation Sans, sans-serif" font-size="11" fill="#E2BD67">ACCURATE FINANCIAL REPORTING &amp; SEAMLESS ACCOUNTING INTEGRATION</text>

    <!-- Directive Pill: DATA -> RECONCILIATION -> REPORTING -> INSIGHT -->
    <rect x="710" y="48" width="435" height="36" rx="18" fill="#07172B" stroke="#38BDF8" stroke-width="1.5"/>
    <text x="927" y="71" font-family="Liberation Sans, sans-serif" font-size="12" font-weight="bold" fill="#38BDF8" text-anchor="middle" letter-spacing="1.5">
      DATA  ➔  RECONCILIATION  ➔  REPORTING  ➔  INSIGHT
    </text>

    <!-- Left Main Card: General Ledger & Live Reconciliation Suite -->
    <g filter="url(#shadow)">
      <rect x="40" y="116" width="670" height="644" rx="16" fill="url(#cardGrad)" stroke="#1E3A5F" stroke-width="2"/>
      <rect x="40" y="116" width="670" height="54" rx="16" fill="#0A1E37"/>
      <text x="68" y="150" font-family="Liberation Sans, sans-serif" font-size="15" font-weight="bold" fill="#38BDF8">FINANCIAL DASHBOARD &amp; GENERAL LEDGER RECONCILIATION</text>
      <text x="560" y="150" font-family="Liberation Sans, sans-serif" font-size="11" fill="#10B981">REAL-TIME SYNC</text>

      <!-- 3 Integration Cards: QuickBooks, Xero, Bank Feeds -->
      <g transform="translate(70, 190)">
        <rect x="0" y="0" width="190" height="85" rx="8" fill="#07172B" stroke="#10B981" stroke-width="1.5"/>
        <text x="16" y="28" font-family="Liberation Sans, sans-serif" font-size="12" font-weight="bold" fill="#10B981">QuickBooks Online</text>
        <text x="16" y="48" font-family="Liberation Sans, sans-serif" font-size="10" fill="#FFFFFF">Direct API Two-Way Sync</text>
        <text x="16" y="68" font-family="Liberation Sans, sans-serif" font-size="9" fill="#94A3B8">Chart of Accounts Mapped</text>

        <rect x="210" y="0" width="190" height="85" rx="8" fill="#07172B" stroke="#38BDF8" stroke-width="1.5"/>
        <text x="226" y="28" font-family="Liberation Sans, sans-serif" font-size="12" font-weight="bold" fill="#38BDF8">Xero Accounting</text>
        <text x="226" y="48" font-family="Liberation Sans, sans-serif" font-size="10" fill="#FFFFFF">Bank Feed Reconciliation</text>
        <text x="226" y="68" font-family="Liberation Sans, sans-serif" font-size="9" fill="#94A3B8">Trial Balance Synchronized</text>

        <rect x="420" y="0" width="190" height="85" rx="8" fill="#07172B" stroke="#E2BD67" stroke-width="1.5"/>
        <text x="436" y="28" font-family="Liberation Sans, sans-serif" font-size="12" font-weight="bold" fill="#E2BD67">Secure Bank Feeds</text>
        <text x="436" y="48" font-family="Liberation Sans, sans-serif" font-size="10" fill="#FFFFFF">OFX, CSV &amp; PDF Intake</text>
        <text x="436" y="68" font-family="Liberation Sans, sans-serif" font-size="9" fill="#94A3B8">Automated Clearing Match</text>
      </g>

      <!-- Financial Ledger Activity Table -->
      <rect x="70" y="295" width="610" height="305" rx="10" fill="#07172B" stroke="#1E3A5F" stroke-width="1.5"/>
      <text x="95" y="325" font-family="Liberation Sans, sans-serif" font-size="13" font-weight="bold" fill="#FFFFFF">MONTH-END RECONCILIATION &amp; TRIAL BALANCE LEDGER</text>
      
      <rect x="95" y="342" width="560" height="28" rx="4" fill="#0E2849"/>
      <text x="110" y="360" font-family="Liberation Sans, sans-serif" font-size="10" font-weight="bold" fill="#94A3B8">GL ACCOUNT</text>
      <text x="310" y="360" font-family="Liberation Sans, sans-serif" font-size="10" font-weight="bold" fill="#94A3B8">CATEGORY</text>
      <text x="440" y="360" font-family="Liberation Sans, sans-serif" font-size="10" font-weight="bold" fill="#94A3B8">BALANCE</text>
      <text x="560" y="360" font-family="Liberation Sans, sans-serif" font-size="10" font-weight="bold" fill="#10B981">STATUS</text>

      <!-- Row 1 -->
      <text x="110" y="390" font-family="Liberation Sans, sans-serif" font-size="11" fill="#FFFFFF">1010 - Operating Checking</text>
      <text x="310" y="390" font-family="Liberation Sans, sans-serif" font-size="11" fill="#94A3B8">Current Assets</text>
      <text x="440" y="390" font-family="Liberation Sans, sans-serif" font-size="11" fill="#FFFFFF">$318,450.22</text>
      <text x="560" y="390" font-family="Liberation Sans, sans-serif" font-size="11" font-weight="bold" fill="#10B981">RECONCILED</text>
      <line x1="95" y1="402" x2="655" y2="402" stroke="#1E3A5F" stroke-width="1"/>

      <!-- Row 2 -->
      <text x="110" y="425" font-family="Liberation Sans, sans-serif" font-size="11" fill="#FFFFFF">1200 - Accounts Receivable</text>
      <text x="310" y="425" font-family="Liberation Sans, sans-serif" font-size="11" fill="#94A3B8">Trade Receivables</text>
      <text x="440" y="425" font-family="Liberation Sans, sans-serif" font-size="11" fill="#FFFFFF">$86,300.00</text>
      <text x="560" y="425" font-family="Liberation Sans, sans-serif" font-size="11" font-weight="bold" fill="#10B981">CONFIRMED</text>
      <line x1="95" y1="437" x2="655" y2="437" stroke="#1E3A5F" stroke-width="1"/>

      <!-- Row 3 -->
      <text x="110" y="460" font-family="Liberation Sans, sans-serif" font-size="11" fill="#FFFFFF">2010 - Accounts Payable</text>
      <text x="310" y="460" font-family="Liberation Sans, sans-serif" font-size="11" fill="#94A3B8">Short-Term Liabilities</text>
      <text x="440" y="460" font-family="Liberation Sans, sans-serif" font-size="11" fill="#FFFFFF">($42,180.50)</text>
      <text x="560" y="460" font-family="Liberation Sans, sans-serif" font-size="11" font-weight="bold" fill="#10B981">MATCHED</text>
      <line x1="95" y1="472" x2="655" y2="472" stroke="#1E3A5F" stroke-width="1"/>

      <!-- Row 4 -->
      <text x="110" y="495" font-family="Liberation Sans, sans-serif" font-size="11" fill="#FFFFFF">4000 - Gross Client Billings</text>
      <text x="310" y="495" font-family="Liberation Sans, sans-serif" font-size="11" fill="#94A3B8">Revenue / Top-Line</text>
      <text x="440" y="495" font-family="Liberation Sans, sans-serif" font-size="11" fill="#38BDF8">$1,480,250.00</text>
      <text x="560" y="495" font-family="Liberation Sans, sans-serif" font-size="11" font-weight="bold" fill="#10B981">SUBSTANTIATED</text>
      <line x1="95" y1="507" x2="655" y2="507" stroke="#1E3A5F" stroke-width="1"/>

      <!-- Row 5 -->
      <text x="110" y="530" font-family="Liberation Sans, sans-serif" font-size="11" fill="#FFFFFF">5010 - Direct Cost of Sales</text>
      <text x="310" y="530" font-family="Liberation Sans, sans-serif" font-size="11" fill="#94A3B8">Direct Operating Cost</text>
      <text x="440" y="530" font-family="Liberation Sans, sans-serif" font-size="11" fill="#FFFFFF">($520,100.00)</text>
      <text x="560" y="530" font-family="Liberation Sans, sans-serif" font-size="11" font-weight="bold" fill="#10B981">TIED TO 1099</text>
      <line x1="95" y1="542" x2="655" y2="542" stroke="#1E3A5F" stroke-width="1"/>

      <!-- Total Row -->
      <rect x="95" y="555" width="560" height="35" rx="6" fill="#0A223E" stroke="#10B981" stroke-width="1"/>
      <text x="110" y="577" font-family="Liberation Sans, sans-serif" font-size="11" font-weight="bold" fill="#FFFFFF">NET OPERATING INCOME (EBITDA)</text>
      <text x="510" y="577" font-family="Liberation Sans, sans-serif" font-size="13" font-weight="bold" fill="#10B981">$960,150.00 (64.8%)</text>

      <!-- Executive Financial Statement Ready Block -->
      <rect x="70" y="620" width="610" height="110" rx="8" fill="#07172B" stroke="#C99A3D" stroke-width="1.5"/>
      <text x="95" y="648" font-family="Liberation Sans, sans-serif" font-size="12" font-weight="bold" fill="#E2BD67">GAAP-COMPLIANT FINANCIAL STATEMENTS GENERATED</text>
      <text x="95" y="670" font-family="Liberation Sans, sans-serif" font-size="11" fill="#FFFFFF">• Balance Sheet (Statement of Financial Position)</text>
      <text x="95" y="690" font-family="Liberation Sans, sans-serif" font-size="11" fill="#FFFFFF">• Income Statement (Profit &amp; Loss Statement with Prior-Year Comparison)</text>
      <text x="95" y="710" font-family="Liberation Sans, sans-serif" font-size="11" fill="#94A3B8">• Statement of Cash Flows • Tax Return Bridge Schedule (M-1)</text>
    </g>

    <!-- Right Column: Strategic Insights & Executive Pen Detail -->
    <g filter="url(#shadow)">
      <rect x="735" y="116" width="425" height="340" rx="16" fill="url(#cardGrad)" stroke="#1E3A5F" stroke-width="2"/>
      <rect x="735" y="116" width="425" height="54" rx="16" fill="#0A1E37"/>
      <text x="760" y="150" font-family="Liberation Sans, sans-serif" font-size="14" font-weight="bold" fill="#E2BD67">TURNING NUMBERS INTO OPPORTUNITIES</text>

      <rect x="760" y="185" width="375" height="70" rx="8" fill="#07172B" stroke="#C99A3D" stroke-width="1"/>
      <text x="776" y="212" font-family="Liberation Serif, serif" font-size="14" font-style="italic" fill="#E2BD67">“Preserving Wealth. Building Legacies.”</text>
      <text x="776" y="235" font-family="Liberation Sans, sans-serif" font-size="11" fill="#FFFFFF">Executive Strategy • Precision Process • Verified Results</text>

      <g transform="translate(760, 275)">
        <rect x="0" y="0" width="375" height="42" rx="6" fill="#07172B" stroke="#1E3A5F" stroke-width="1"/>
        <circle cx="20" cy="21" r="5" fill="#10B981"/>
        <text x="36" y="26" font-family="Liberation Sans, sans-serif" font-size="11" font-weight="bold" fill="#FFFFFF">Accurate &amp; Bank-Reconciled Ledgers</text>
      </g>

      <g transform="translate(760, 325)">
        <rect x="0" y="0" width="375" height="42" rx="6" fill="#07172B" stroke="#1E3A5F" stroke-width="1"/>
        <circle cx="20" cy="21" r="5" fill="#10B981"/>
        <text x="36" y="26" font-family="Liberation Sans, sans-serif" font-size="11" font-weight="bold" fill="#FFFFFF">Statutory &amp; Regulatory Tax Compliance</text>
      </g>

      <g transform="translate(760, 375)">
        <rect x="0" y="0" width="375" height="42" rx="6" fill="#07172B" stroke="#1E3A5F" stroke-width="1"/>
        <circle cx="20" cy="21" r="5" fill="#10B981"/>
        <text x="36" y="26" font-family="Liberation Sans, sans-serif" font-size="11" font-weight="bold" fill="#FFFFFF">Seamless Multi-Channel Integration</text>
      </g>

      <g transform="translate(760, 425)">
        <rect x="0" y="0" width="375" height="42" rx="6" fill="#07172B" stroke="#1E3A5F" stroke-width="1"/>
        <circle cx="20" cy="21" r="5" fill="#10B981"/>
        <text x="36" y="26" font-family="Liberation Sans, sans-serif" font-size="11" font-weight="bold" fill="#FFFFFF">Insightful Executive Forecasting &amp; KPIs</text>
      </g>

      <!-- Bottom Card -->
      <rect x="735" y="480" width="425" height="280" rx="16" fill="url(#cardGrad)" stroke="#1E3A5F" stroke-width="2"/>
      <rect x="735" y="480" width="425" height="54" rx="16" fill="#0A1E37"/>
      <text x="760" y="514" font-family="Liberation Sans, sans-serif" font-size="14" font-weight="bold" fill="#38BDF8">SECURE CLIENT DATA PIPELINE</text>

      <g transform="translate(760, 555)">
        <rect x="0" y="0" width="375" height="50" rx="8" fill="#07172B" stroke="#1E3A5F" stroke-width="1"/>
        <text x="16" y="28" font-family="Liberation Sans, sans-serif" font-size="12" font-weight="bold" fill="#FFFFFF">Read-Only Authorized Bank Connections</text>
        <text x="16" y="42" font-family="Liberation Sans, sans-serif" font-size="10" fill="#10B981">Plaid™ &amp; Yodlee™ Banking Security Standards</text>
      </g>

      <g transform="translate(760, 615)">
        <rect x="0" y="0" width="375" height="50" rx="8" fill="#07172B" stroke="#1E3A5F" stroke-width="1"/>
        <text x="16" y="28" font-family="Liberation Sans, sans-serif" font-size="12" font-weight="bold" fill="#FFFFFF">TLS Transport Layer &amp; AES-256 Storage</text>
        <text x="16" y="42" font-family="Liberation Sans, sans-serif" font-size="10" fill="#38BDF8">Zero unauthorized credential persistence</text>
      </g>

      <rect x="760" y="675" width="375" height="60" rx="8" fill="#0A223E" stroke="#38BDF8" stroke-width="1.5"/>
      <text x="776" y="700" font-family="Liberation Sans, sans-serif" font-size="11" font-weight="bold" fill="#FFFFFF">A/R TAX SERVICES, LLC</text>
      <text x="776" y="720" font-family="Liberation Sans, sans-serif" font-size="10" fill="#E2BD67">Financial Reporting &amp; Reconciliation Suite</text>
    </g>
  </svg>
  `;
}

// 6. Private Consultation Experience
function generatePrivateConsultationSvg() {
  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#051324"/>
        <stop offset="50%" stop-color="#081E38"/>
        <stop offset="100%" stop-color="#0A2748"/>
      </linearGradient>
      <linearGradient id="cardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#0F2B4E"/>
        <stop offset="100%" stop-color="#0A1E37"/>
      </linearGradient>
      <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
        <feDropShadow dx="0" dy="8" stdDeviation="16" flood-color="#000000" flood-opacity="0.6"/>
      </filter>
    </defs>

    <rect width="1200" height="800" fill="url(#bg)"/>

    <g opacity="0.08" stroke="#E2BD67" stroke-width="1">
      <path d="M 0,100 L 1200,100 M 0,200 L 1200,200 M 0,300 L 1200,300 M 0,400 L 1200,400 M 0,500 L 1200,500 M 0,600 L 1200,600 M 0,700 L 1200,700"/>
      <path d="M 150,0 L 150,800 M 300,0 L 300,800 M 450,0 L 450,800 M 600,0 L 600,800 M 750,0 L 750,800 M 900,0 L 900,800 M 1050,0 L 1050,800"/>
    </g>

    <!-- Header -->
    <rect x="40" y="36" width="1120" height="60" rx="10" fill="#0D2340" stroke="#1E3A5F" stroke-width="1.5"/>
    <rect x="52" y="48" width="36" height="36" rx="8" fill="#C99A3D"/>
    <text x="70" y="72" font-family="Liberation Sans, sans-serif" font-size="16" font-weight="900" fill="#07172B" text-anchor="middle">EXP</text>
    <text x="102" y="65" font-family="Liberation Sans, sans-serif" font-size="14" font-weight="bold" fill="#FFFFFF" letter-spacing="1">A/R TAX SERVICES, LLC</text>
    <text x="102" y="82" font-family="Liberation Sans, sans-serif" font-size="11" fill="#E2BD67">FOUR-PHASE PRIVATE CLIENT ADVISORY ENGAGEMENT PROTOCOL</text>

    <!-- Main Container -->
    <g filter="url(#shadow)">
      <rect x="40" y="116" width="1120" height="644" rx="16" fill="url(#cardGrad)" stroke="#1E3A5F" stroke-width="2"/>
      <rect x="40" y="116" width="1120" height="54" rx="16" fill="#0A1E37"/>
      <text x="68" y="150" font-family="Liberation Sans, sans-serif" font-size="15" font-weight="bold" fill="#E2BD67">INTENTIONAL ENGAGEMENT ROADMAP • FROM DIAGNOSTIC TO MULTI-YEAR STEWARDSHIP</text>
      <text x="1000" y="150" font-family="Liberation Sans, sans-serif" font-size="11" fill="#10B981">CONFIDENTIAL SUITE</text>

      <!-- 4 Strategic Pillars Horizontal Grid -->
      <g transform="translate(68, 195)">
        <!-- Phase 1 -->
        <rect x="0" y="0" width="250" height="420" rx="12" fill="#07172B" stroke="#1E3A5F" stroke-width="1.5"/>
        <rect x="20" y="20" width="44" height="44" rx="8" fill="#0A223E" stroke="#C99A3D" stroke-width="1"/>
        <text x="42" y="48" font-family="Liberation Sans, sans-serif" font-size="16" font-weight="bold" fill="#E2BD67" text-anchor="middle">01</text>
        <text x="20" y="90" font-family="Liberation Sans, sans-serif" font-size="14" font-weight="bold" fill="#FFFFFF">Discovery &amp;</text>
        <text x="20" y="110" font-family="Liberation Sans, sans-serif" font-size="14" font-weight="bold" fill="#E2BD67">Diagnostic</text>
        <line x1="20" y1="125" x2="230" y2="125" stroke="#1E3A5F" stroke-width="1"/>
        <text x="20" y="150" font-family="Liberation Sans, sans-serif" font-size="11" fill="#94A3B8">• Prior 3-Year Return Analysis</text>
        <text x="20" y="180" font-family="Liberation Sans, sans-serif" font-size="11" fill="#94A3B8">• Entity Structure Diagnostic</text>
        <text x="20" y="210" font-family="Liberation Sans, sans-serif" font-size="11" fill="#94A3B8">• Balance Sheet Reconciliation</text>
        <text x="20" y="240" font-family="Liberation Sans, sans-serif" font-size="11" fill="#94A3B8">• Statutory Risk Assessment</text>
        <rect x="20" y="345" width="210" height="45" rx="6" fill="#0B2342" stroke="#1E3A5F" stroke-width="1"/>
        <text x="125" y="372" font-family="Liberation Sans, sans-serif" font-size="10" font-weight="bold" fill="#38BDF8" text-anchor="middle">CONFIDENTIAL AUDIT</text>

        <!-- Phase 2 -->
        <rect x="270" y="0" width="250" height="420" rx="12" fill="#07172B" stroke="#1E3A5F" stroke-width="1.5"/>
        <rect x="290" y="20" width="44" height="44" rx="8" fill="#0A223E" stroke="#38BDF8" stroke-width="1"/>
        <text x="312" y="48" font-family="Liberation Sans, sans-serif" font-size="16" font-weight="bold" fill="#38BDF8" text-anchor="middle">02</text>
        <text x="290" y="90" font-family="Liberation Sans, sans-serif" font-size="14" font-weight="bold" fill="#FFFFFF">Strategic</text>
        <text x="290" y="110" font-family="Liberation Sans, sans-serif" font-size="14" font-weight="bold" fill="#38BDF8">Architecture</text>
        <line x1="290" y1="125" x2="500" y2="125" stroke="#1E3A5F" stroke-width="1"/>
        <text x="290" y="150" font-family="Liberation Sans, sans-serif" font-size="11" fill="#94A3B8">• Custom Tax Reduction Plan</text>
        <text x="290" y="180" font-family="Liberation Sans, sans-serif" font-size="11" fill="#94A3B8">• S-Corp Salary Optimization</text>
        <text x="290" y="210" font-family="Liberation Sans, sans-serif" font-size="11" fill="#94A3B8">• Retirement / Defined Benefit</text>
        <text x="290" y="240" font-family="Liberation Sans, sans-serif" font-size="11" fill="#94A3B8">• Multistate Nexus Planning</text>
        <rect x="290" y="345" width="210" height="45" rx="6" fill="#0B2342" stroke="#1E3A5F" stroke-width="1"/>
        <text x="395" y="372" font-family="Liberation Sans, sans-serif" font-size="10" font-weight="bold" fill="#E2BD67" text-anchor="middle">BLUEPRINT PRESENTED</text>

        <!-- Phase 3 -->
        <rect x="540" y="0" width="250" height="420" rx="12" fill="#07172B" stroke="#1E3A5F" stroke-width="1.5"/>
        <rect x="560" y="20" width="44" height="44" rx="8" fill="#0A223E" stroke="#10B981" stroke-width="1"/>
        <text x="582" y="48" font-family="Liberation Sans, sans-serif" font-size="16" font-weight="bold" fill="#10B981" text-anchor="middle">03</text>
        <text x="560" y="90" font-family="Liberation Sans, sans-serif" font-size="14" font-weight="bold" fill="#FFFFFF">Meticulous</text>
        <text x="560" y="110" font-family="Liberation Sans, sans-serif" font-size="14" font-weight="bold" fill="#10B981">Execution</text>
        <line x1="560" y1="125" x2="770" y2="125" stroke="#1E3A5F" stroke-width="1"/>
        <text x="560" y="150" font-family="Liberation Sans, sans-serif" font-size="11" fill="#94A3B8">• Multi-Tier QC Verification</text>
        <text x="560" y="180" font-family="Liberation Sans, sans-serif" font-size="11" fill="#94A3B8">• Form 1040, 1120-S &amp; 1065</text>
        <text x="560" y="210" font-family="Liberation Sans, sans-serif" font-size="11" fill="#94A3B8">• Line-Item Substantiation</text>
        <text x="560" y="240" font-family="Liberation Sans, sans-serif" font-size="11" fill="#94A3B8">• Authorized Electronic Filing</text>
        <rect x="560" y="345" width="210" height="45" rx="6" fill="#0B2342" stroke="#1E3A5F" stroke-width="1"/>
        <text x="665" y="372" font-family="Liberation Sans, sans-serif" font-size="10" font-weight="bold" fill="#10B981" text-anchor="middle">ZERO-DEFECT FILING</text>

        <!-- Phase 4 -->
        <rect x="810" y="0" width="250" height="420" rx="12" fill="#07172B" stroke="#C99A3D" stroke-width="1.5"/>
        <rect x="830" y="20" width="44" height="44" rx="8" fill="#0A223E" stroke="#C99A3D" stroke-width="1"/>
        <text x="852" y="48" font-family="Liberation Sans, sans-serif" font-size="16" font-weight="bold" fill="#E2BD67" text-anchor="middle">04</text>
        <text x="830" y="90" font-family="Liberation Sans, sans-serif" font-size="14" font-weight="bold" fill="#FFFFFF">Ongoing</text>
        <text x="830" y="110" font-family="Liberation Sans, sans-serif" font-size="14" font-weight="bold" fill="#E2BD67">Stewardship</text>
        <line x1="830" y1="125" x2="1040" y2="125" stroke="#1E3A5F" stroke-width="1"/>
        <text x="830" y="150" font-family="Liberation Sans, sans-serif" font-size="11" fill="#94A3B8">• Year-Round Tax Projections</text>
        <text x="830" y="180" font-family="Liberation Sans, sans-serif" font-size="11" fill="#94A3B8">• Safe Harbor Protection</text>
        <text x="830" y="210" font-family="Liberation Sans, sans-serif" font-size="11" fill="#94A3B8">• Transaction Advisory</text>
        <text x="830" y="240" font-family="Liberation Sans, sans-serif" font-size="11" fill="#94A3B8">• Fiduciary &amp; Trust Updates</text>
        <rect x="830" y="345" width="210" height="45" rx="6" fill="#0A223E" stroke="#C99A3D" stroke-width="1"/>
        <text x="935" y="372" font-family="Liberation Sans, sans-serif" font-size="10" font-weight="bold" fill="#E2BD67" text-anchor="middle">ANNUAL ADVISORY</text>
      </g>

      <!-- Bottom Banner -->
      <rect x="68" y="640" width="984" height="60" rx="8" fill="#07172B" stroke="#1E3A5F" stroke-width="1"/>
      <text x="90" y="675" font-family="Liberation Sans, sans-serif" font-size="12" font-weight="bold" fill="#FFFFFF">CLIENT COMMENCEMENT GUARANTEE:</text>
      <text x="350" y="675" font-family="Liberation Sans, sans-serif" font-size="12" fill="#E2BD67">Direct Executive Partner Access • 24-Hour Confidential Portal Response • Audit Defense Included</text>
    </g>
  </svg>
  `;
}

// 7. Executive Consultation Suite (CTA Background)
function generateExecutiveSuiteSvg() {
  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
    <defs>
      <radialGradient id="roomLight" cx="50%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#14365D"/>
        <stop offset="60%" stop-color="#07172B"/>
        <stop offset="100%" stop-color="#030A14"/>
      </radialGradient>
      <linearGradient id="goldAcc" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#C99A3D" stop-opacity="0.8"/>
        <stop offset="50%" stop-color="#E2BD67" stop-opacity="1"/>
        <stop offset="100%" stop-color="#C99A3D" stop-opacity="0.8"/>
      </linearGradient>
    </defs>

    <!-- Atmospheric Boardroom Background -->
    <rect width="1200" height="800" fill="url(#roomLight)"/>

    <!-- Architectural Millwork Panels -->
    <g stroke="#1E3A5F" stroke-width="1.5" opacity="0.4">
      <rect x="80" y="60" width="220" height="480" rx="4" fill="none"/>
      <rect x="95" y="75" width="190" height="450" rx="2" fill="none"/>
      
      <rect x="340" y="60" width="520" height="480" rx="4" fill="none"/>
      <rect x="355" y="75" width="490" height="450" rx="2" fill="none"/>
      
      <rect x="900" y="60" width="220" height="480" rx="4" fill="none"/>
      <rect x="915" y="75" width="190" height="450" rx="2" fill="none"/>
    </g>

    <!-- Center Boardroom Crest / Emblem -->
    <g transform="translate(600, 240)">
      <circle cx="0" cy="0" r="90" fill="#07172B" stroke="url(#goldAcc)" stroke-width="2.5"/>
      <circle cx="0" cy="0" r="75" fill="#0A1E37" stroke="#1E3A5F" stroke-width="1.5"/>
      <text x="0" y="-10" font-family="Liberation Sans, sans-serif" font-size="28" font-weight="900" fill="#E2BD67" text-anchor="middle">A/R</text>
      <text x="0" y="16" font-family="Liberation Sans, sans-serif" font-size="10" font-weight="bold" fill="#FFFFFF" text-anchor="middle" letter-spacing="2">TAX SERVICES</text>
      <text x="0" y="32" font-family="Liberation Sans, sans-serif" font-size="9" fill="#94A3B8" text-anchor="middle" letter-spacing="1">COLUMBIA, SC</text>
    </g>

    <!-- Executive Conference Desk Surface in Foreground -->
    <path d="M 0,560 L 1200,560 L 1200,800 L 0,800 Z" fill="#071424"/>
    <line x1="0" y1="560" x2="1200" y2="560" stroke="url(#goldAcc)" stroke-width="3"/>
    <line x1="0" y1="564" x2="1200" y2="564" stroke="#1E3A5F" stroke-width="1"/>

    <!-- Desk Surface Elements -->
    <g transform="translate(200, 600)">
      <!-- Leather Brief / Folder -->
      <rect x="0" y="0" width="220" height="150" rx="6" fill="#0B2038" stroke="#C99A3D" stroke-width="1.5"/>
      <text x="20" y="35" font-family="Liberation Sans, sans-serif" font-size="12" font-weight="bold" fill="#E2BD67">CONFIDENTIAL BRIEF</text>
      <text x="20" y="55" font-family="Liberation Sans, sans-serif" font-size="10" fill="#FFFFFF">Client Advisory Dossier</text>
      <text x="20" y="75" font-family="Liberation Sans, sans-serif" font-size="9" fill="#94A3B8">Privileged Tax Workpapers</text>
    </g>

    <g transform="translate(780, 600)">
      <!-- Tablet / Reporting Screen -->
      <rect x="0" y="0" width="220" height="150" rx="8" fill="#0A1E37" stroke="#38BDF8" stroke-width="1.5"/>
      <text x="20" y="35" font-family="Liberation Sans, sans-serif" font-size="12" font-weight="bold" fill="#38BDF8">PORTAL ENCRYPTED</text>
      <text x="20" y="55" font-family="Liberation Sans, sans-serif" font-size="10" fill="#FFFFFF">Direct Fiduciary Link</text>
      <text x="20" y="75" font-family="Liberation Sans, sans-serif" font-size="9" fill="#10B981">IRS Authorized e-file Active</text>
    </g>

    <!-- Subtle Ambient Gold Glow at Base -->
    <circle cx="600" cy="800" r="300" fill="#C99A3D" opacity="0.08"/>
  </svg>
  `;
}

async function buildAllImages() {
  const images = [
    {
      name: 'tax-advisory-planning',
      svg: generateTaxAdvisorySvg(),
    },
    {
      name: 'corporate-business-advisory',
      svg: generateCorporateServicesSvg(),
    },
    {
      name: 'estate-legacy-planning',
      svg: generateEstatePlanningSvg(),
    },
    {
      name: 'meticulous-tax-preparation',
      svg: generateTaxPreparationSvg(),
    },
    {
      name: 'bookkeeping-financial-reporting',
      svg: generateFinancialReportingSvg(),
    },
    {
      name: 'private-consultation-experience',
      svg: generatePrivateConsultationSvg(),
    },
    {
      name: 'executive-consultation-suite',
      svg: generateExecutiveSuiteSvg(),
    },
  ];

  for (const img of images) {
    console.log(`Rendering ${img.name}...`);
    const svgBuffer = Buffer.from(img.svg);

    // Render WebP
    const webpBuffer = await sharp(svgBuffer, { density: 150 })
      .resize(1200, 800)
      .webp({ quality: 92 })
      .toBuffer();

    // Render JPG
    const jpgBuffer = await sharp(svgBuffer, { density: 150 })
      .resize(1200, 800)
      .jpeg({ quality: 92 })
      .toBuffer();

    // Write to public/images and dist/images
    fs.writeFileSync(path.join(outputDir, `${img.name}.webp`), webpBuffer);
    fs.writeFileSync(path.join(outputDir, `${img.name}.jpg`), jpgBuffer);
    fs.writeFileSync(path.join(distDir, `${img.name}.webp`), webpBuffer);
    fs.writeFileSync(path.join(distDir, `${img.name}.jpg`), jpgBuffer);
    console.log(`Saved ${img.name}.webp (${webpBuffer.length} bytes) and ${img.name}.jpg (${jpgBuffer.length} bytes)`);
  }

  console.log('All corporate images generated successfully!');
}

buildAllImages().catch(err => {
  console.error('Build error:', err);
  process.exit(1);
});
