import React, { useRef, useState, useCallback } from "react";
import {
  LineChart, Line,
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { BankMetrics } from "../types";
import { buildCharts, fmtB, fmtM, fmtK, fmtPct, fmtNumber } from "../utils/chartData";
import { COLORS } from "../constants/theme";
import { TopBar } from "./Topbar";
import "./dashboard.scss";

// ── Recharts tooltip ──────────────────────────────────────────
function MeridianTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="m-tooltip">
      {label !== undefined && <div className="m-tooltip__label">{label}</div>}
      {payload.map((p: any, i: number) => (
        <div key={i} className="m-tooltip__row">
          <span className="m-tooltip__dot" style={{ background: p.color }} />
          <span className="m-tooltip__name">{p.name}</span>
          <span className="m-tooltip__val">
            {typeof p.value === "number" ? p.value.toLocaleString() : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Info icon with hover tooltip ──────────────────────────────
// Smart placement: measures available space on hover and flips the
// tooltip both vertically (above/below) and horizontally (left/right)
// so it never gets clipped by the topbar or the viewport edges.
function InfoIcon({ text }: { text: string }) {
  const iconRef = useRef<HTMLSpanElement>(null);
  const [vPlace, setVPlace] = useState<"above" | "below">("above");
  const [hPlace, setHPlace] = useState<"left" | "right">("right");

  // Recompute on each open — handles scroll/resize too without listeners
  const recomputePlacement = useCallback(() => {
    const el = iconRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;

    // Vertical: flip below if too close to a sticky topbar
    const REQUIRED_ABOVE   = 200;   // approx tooltip height + arrow + margin
    const TOPBAR_CLEARANCE =  80;   // leave room beneath the topbar
    setVPlace(
      rect.top - TOPBAR_CLEARANCE < REQUIRED_ABOVE ? "below" : "above",
    );

    // Horizontal: tooltip is 260px wide. If anchoring right would push
    // the left edge past the viewport, anchor left instead.
    const TIP_WIDTH = 260;
    // Right-anchored: tooltip's right edge sits at (rect.right + 4),
    // so its left edge sits at (rect.right + 4 - TIP_WIDTH).
    const leftIfAnchoredRight = rect.right + 4 - TIP_WIDTH;
    setHPlace(leftIfAnchoredRight < 8 ? "left" : "right");
  }, []);

  return (
    <span
      ref={iconRef}
      className={`info-icon info-icon--${vPlace} info-icon--${hPlace}`}
      tabIndex={0}
      aria-label="More information"
      onMouseEnter={recomputePlacement}
      onFocus={recomputePlacement}
    >
      ?
      <span className="info-icon__tip" role="tooltip">{text}</span>
    </span>
  );
}

// ── Chart header (now accepts an explainer) ───────────────────
function ChartHeader({ title, sub, explain }: { title: string; sub?: string; explain?: string }) {
  return (
    <div className="chart-header">
      <div className="chart-header__top">
        <div className="chart-header__title">{title}</div>
        {explain && <InfoIcon text={explain} />}
      </div>
      {sub && <div className="chart-header__sub">{sub}</div>}
    </div>
  );
}

// ── KPI tile (with optional explainer) ────────────────────────
interface KpiTileProps {
  label:       string;
  value:       string;
  hint?:       string;
  explain?:    string;
  metricKey:   string;
  changedKeys: Set<string>;
  tone?:       "default" | "good" | "warn";
}

function KpiTile({ label, value, hint, explain, metricKey, changedKeys, tone = "default" }: KpiTileProps) {
  const changed = changedKeys.has(metricKey);
  return (
    <div className={`kpi-tile kpi-tile--${tone}${changed ? " kpi-tile--changed" : ""}`}>
      <div className="kpi-tile__label-row">
        <div className="kpi-tile__label">{label}</div>
        {explain && <InfoIcon text={explain} />}
      </div>
      <div className="kpi-tile__value">{value}</div>
      {hint && <div className="kpi-tile__hint">{hint}</div>}
    </div>
  );
}

// ── Gauge (semi-circle SVG) ────────────────────────────────────
interface GaugeProps {
  label:     string;
  value:     number;
  max:       number;
  benchmark: number;
  tone:      "good" | "warn" | "bad";
  unit?:     string;
  explain:   string;
}

function Gauge({ label, value, max, benchmark, tone, unit = "%", explain }: GaugeProps) {
  const radius = 60;
  const cx = 80, cy = 70;
  const pct = Math.min(1, Math.max(0, value / max));
  const startAngle = -Math.PI;
  const endAngle   = 0;
  const valueAngle = startAngle + pct * (endAngle - startAngle);
  const benchAngle = startAngle + (benchmark / max) * (endAngle - startAngle);

  const arcPath = (a1: number, a2: number) => {
    const x1 = cx + radius * Math.cos(a1);
    const y1 = cy + radius * Math.sin(a1);
    const x2 = cx + radius * Math.cos(a2);
    const y2 = cy + radius * Math.sin(a2);
    const largeArc = Math.abs(a2 - a1) > Math.PI ? 1 : 0;
    const sweep = a2 > a1 ? 1 : 0;
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} ${sweep} ${x2} ${y2}`;
  };

  const benchX = cx + radius * Math.cos(benchAngle);
  const benchY = cy + radius * Math.sin(benchAngle);

  const toneColor = tone === "good" ? COLORS.good : tone === "warn" ? COLORS.warn : COLORS.bad;

  return (
    <div className="gauge">
      <div className="gauge__head">
        <span className="gauge__label">{label}</span>
        <InfoIcon text={explain} />
      </div>
      <svg viewBox="0 0 160 90" className="gauge__svg">
        <path d={arcPath(startAngle, endAngle)} stroke={COLORS.border} strokeWidth="10" fill="none" strokeLinecap="round" />
        <path d={arcPath(startAngle, valueAngle)} stroke={toneColor} strokeWidth="10" fill="none" strokeLinecap="round" />
        <line
          x1={benchX - 2 * Math.cos(benchAngle + Math.PI / 2)}
          y1={benchY - 2 * Math.sin(benchAngle + Math.PI / 2)}
          x2={benchX + 8 * Math.cos(benchAngle + Math.PI / 2)}
          y2={benchY + 8 * Math.sin(benchAngle + Math.PI / 2)}
          stroke={COLORS.ink}
          strokeWidth="1.5"
        />
      </svg>
      <div className="gauge__value" style={{ color: toneColor }}>{value}{unit}</div>
      <div className="gauge__benchmark">Benchmark: {benchmark}{unit}</div>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────
interface DashboardProps {
  metrics:     BankMetrics;
  changedKeys: Set<string>;
  onReset:     () => void;
}

export function Dashboard({ metrics, changedKeys, onReset }: DashboardProps) {
  const charts = buildCharts(metrics);
  const ltdRatio = (metrics.totalLoans / metrics.totalDeposits) * 100;

  return (
    <div className="dashboard">
      <TopBar onReset={onReset} />

      <div className="dashboard__content">

        {/* ── Welcome row ── */}
        <div className="welcome">
          <div className="welcome__line">
            <h1 className="welcome__title">Performance at a glance</h1>
            <div className="welcome__period">Period: Trailing 12 months</div>
          </div>
          <p className="welcome__sub">
            A clear view of how the bank is performing — deposits we hold, loans we've made,
            customers we serve, and money we're making. Hover any <span className="welcome__qmark">?</span> for an explanation.
          </p>
        </div>

        {/* ── KPI Strip ── */}
        <div className="kpi-grid">
          <KpiTile
            label="Total Deposits" value={fmtB(metrics.totalDeposits)}
            hint="Money customers hold with us"
            explain="Deposits are the money customers have placed with the bank in savings, checking, and term accounts. This is the bank's main source of funding for lending."
            metricKey="totalDeposits" changedKeys={changedKeys} tone="good"
          />
          <KpiTile
            label="Total Loans" value={fmtB(metrics.totalLoans)}
            hint="Money we've lent out"
            explain="The total value of all outstanding loans — mortgages, business loans, auto, personal, and credit cards. This is how the bank earns interest income."
            metricKey="totalLoans" changedKeys={changedKeys}
          />
          <KpiTile
            label="Loan-to-Deposit" value={`${ltdRatio.toFixed(1)}%`}
            hint="Healthy range: 70-90%"
            explain="The Loan-to-Deposit ratio (LDR) shows what share of deposits we've lent out. Below 70% suggests we're not lending enough; above 90% means we may be stretching our funding."
            metricKey="totalLoans" changedKeys={changedKeys} tone={ltdRatio >= 70 && ltdRatio <= 90 ? "good" : "warn"}
          />
          <KpiTile
            label="Net Interest Margin" value={fmtPct(metrics.netInterestMargin)}
            hint="Profit margin on lending"
            explain="Net Interest Margin (NIM) is the difference between the interest we earn on loans and the interest we pay on deposits, expressed as a % of lending assets. Higher NIM means more profitable lending."
            metricKey="netInterestMargin" changedKeys={changedKeys}
          />
          <KpiTile
            label="Active Customers" value={`${(metrics.activeCustomers / 1000).toFixed(2)}M`}
            hint="Used the bank in last 30 days"
            explain="Customers who have logged in, made a transaction, or otherwise engaged with the bank in the last 30 days. A better health indicator than total customers."
            metricKey="activeCustomers" changedKeys={changedKeys}
          />
          <KpiTile
            label="Monthly Net Profit" value={fmtM(metrics.netProfit)}
            hint="Revenue minus costs"
            explain="What the bank earns after paying all operating costs — staff, branches, technology, regulatory expenses. This is the bottom-line profit each month."
            metricKey="netProfit" changedKeys={changedKeys} tone="good"
          />

          <KpiTile
            label="Branches" value={fmtNumber(metrics.branches)}
            hint={`+ ${metrics.atms.toLocaleString()} ATMs`}
            explain="Number of physical branches plus ATMs. Branches are expensive to run but matter for high-value customers and complex products like mortgages."
            metricKey="branches" changedKeys={changedKeys}
          />
          <KpiTile
            label="Digital Adoption" value={fmtPct(metrics.digitalAdoption)}
            hint="Customers using mobile/web"
            explain="Share of active customers who use the mobile app or web banking each month. Higher adoption lowers cost-to-serve and improves customer retention."
            metricKey="digitalAdoption" changedKeys={changedKeys} tone="good"
          />
          <KpiTile
            label="Customer Satisfaction" value={`${metrics.customerSatisfaction}/100`}
            hint="CSAT survey score"
            explain="Customer Satisfaction (CSAT) is an average score from customer surveys, where 100 is perfect satisfaction. Banks typically aim for 75 or higher."
            metricKey="customerSatisfaction" changedKeys={changedKeys}
          />
          <KpiTile
            label="Loan Approval Rate" value={fmtPct(metrics.loanApprovalRate)}
            hint="Of applications received"
            explain="Share of loan applications we approve. Too high may suggest we're taking on risky borrowers; too low means we're losing growth opportunities."
            metricKey="loanApprovalRate" changedKeys={changedKeys}
          />
          <KpiTile
            label="Non-Performing Loans" value={fmtPct(metrics.nonPerformingLoans)}
            hint="Loans 90+ days overdue"
            explain="Non-Performing Loans (NPL) are loans where the customer is 90+ days behind on payments. A lower NPL ratio means a healthier loan book. Industry average is roughly 3%."
            metricKey="nonPerformingLoans" changedKeys={changedKeys} tone={metrics.nonPerformingLoans < 2.5 ? "good" : "warn"}
          />
          <KpiTile
            label="Cost-to-Income" value={fmtPct(metrics.costToIncome)}
            hint="Lower is better"
            explain="Cost-to-Income ratio (CIR) shows operating costs as a share of revenue. Well-run retail banks aim below 60%. Reducing CIR is the main lever for improving profitability."
            metricKey="costToIncome" changedKeys={changedKeys} tone={metrics.costToIncome < 60 ? "good" : "warn"}
          />
        </div>

        {/* ── Row 1: Deposits vs Loans + Loan Portfolio ──────── */}
        <div className="chart-row chart-row--2col">

          <div className="chart-card">
            <ChartHeader
              title="Deposits vs Loans"
              sub="Trailing 12 months · $ Billions"
              explain="Tracks how much money customers deposit with us versus how much we lend out each month. We want both lines rising — deposits give us the funding to lend, and loans earn us interest. If loans grow faster than deposits for too long, we have to find other (more expensive) funding."
            />
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={charts.depositsLoansTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
                <XAxis dataKey="month" tick={{ fill: COLORS.dim, fontSize: 11 }} />
                <YAxis tick={{ fill: COLORS.dim, fontSize: 11 }} tickFormatter={v => `$${v}B`} />
                <Tooltip content={<MeridianTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12, color: COLORS.inkSoft }} />
                <Line type="monotone" dataKey="deposits" stroke={COLORS.primary} strokeWidth={2.5} dot={{ r: 3, fill: COLORS.primary }} name="Deposits" />
                <Line type="monotone" dataKey="loans"    stroke={COLORS.accent}  strokeWidth={2.5} dot={{ r: 3, fill: COLORS.accent }}  name="Loans" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-card">
            <ChartHeader
              title="Loan Portfolio Mix"
              sub="Where our lending dollars are placed"
              explain="The breakdown of our loan book by product type. Mortgages are typically the largest category for a retail bank because they're large, long-duration loans. A balanced mix across product types helps spread risk if any one segment turns bad."
            />
            <div className="donut-wrap">
              <ResponsiveContainer width={180} height={180}>
                <PieChart>
                  <Pie data={charts.loanPortfolio} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={2}>
                    {charts.loanPortfolio.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip content={<MeridianTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="donut-legend">
                {charts.loanPortfolio.map(d => {
                  const pct = (d.value / metrics.totalLoans) * 100;
                  return (
                    <div key={d.name} className="donut-legend__row">
                      <span className="donut-legend__dot" style={{ background: d.color }} />
                      <span className="donut-legend__name">{d.name}</span>
                      <span className="donut-legend__val">${d.value}B</span>
                      <span className="donut-legend__pct">{pct.toFixed(0)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ── Row 2: Customer Engagement + Channel Mix ──────── */}
        <div className="chart-row chart-row--2col">

          <div className="chart-card">
            <ChartHeader
              title="Customer Engagement"
              sub="From all customers down to our most valuable"
              explain="The customer journey from anyone who has an account, down to those who are actively engaged, using digital channels, and finally in the high-value Premium tier. The closer the bars are to each other, the better — it means more customers are deeply engaged."
            />
            <div className="funnel">
              {charts.customerFunnel.map((f, i) => {
                const max = charts.customerFunnel[0].count;
                const w = (f.count / max) * 100;
                return (
                  <div key={f.stage} className="funnel__row">
                    <div className="funnel__label">{f.stage}</div>
                    <div className="funnel__bar-wrap">
                      <div
                        className="funnel__bar"
                        style={{
                          width: `${w}%`,
                          background: COLORS.loan[i],
                        }}
                      >
                        <span className="funnel__bar-value">
                          {(f.count / 1000).toFixed(2)}M
                        </span>
                      </div>
                      <span className="funnel__pct">{f.pct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="chart-card">
            <ChartHeader
              title="How Customers Bank With Us"
              sub="Share of monthly transactions by channel"
              explain="The share of all customer transactions happening through each channel. Digital channels (mobile + web) cost a fraction of branch transactions, so a high digital share directly improves our cost-to-income ratio."
            />
            <div className="channel-list">
              {charts.channelMix.map((c, i) => (
                <div key={c.channel} className="channel-row">
                  <div className="channel-row__head">
                    <span className="channel-row__name">{c.channel}</span>
                    <span className="channel-row__val">{c.pct}%</span>
                  </div>
                  <div className="channel-row__track">
                    <div
                      className="channel-row__fill"
                      style={{
                        width: `${c.pct}%`,
                        background: COLORS.loan[i % COLORS.loan.length],
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Row 3: Revenue vs Cost (full width) ─────────────── */}
        <div className="chart-card">
          <ChartHeader
            title="Revenue, Costs & Net Profit"
            sub="Trailing 12 months · $ Millions"
            explain="Monthly revenue (blue bars), the cost of running the bank (gray bars), and the net profit — what's left after costs (green line). Profit grows when we either earn more (raise NIM, grow loans) or spend less (cut costs, shift to digital)."
          />
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={charts.revenueCostTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
              <XAxis dataKey="month" tick={{ fill: COLORS.dim, fontSize: 11 }} />
              <YAxis tick={{ fill: COLORS.dim, fontSize: 11 }} tickFormatter={v => `$${v}M`} />
              <Tooltip content={<MeridianTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12, color: COLORS.inkSoft }} />
              <Bar dataKey="revenue" fill={COLORS.primary} radius={[4, 4, 0, 0]} name="Revenue" />
              <Bar dataKey="cost"    fill={COLORS.dim}     radius={[4, 4, 0, 0]} name="Costs" />
              <Line type="monotone" dataKey="profit" stroke={COLORS.good} strokeWidth={2.5} dot={{ r: 3, fill: COLORS.good }} name="Net Profit" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* ── Row 4: Branch Performance (full width) ──────────── */}
        <div className="chart-card">
          <ChartHeader
            title="Performance by Region"
            sub="How each region's branches contribute"
            explain="Each region ranked by total deposits. Regions with strong deposit growth but lower lending may be opportunities to expand credit products. Regions where deposits are flat may need a customer-acquisition push."
          />
          <div className="branches">
            <div className="branches__head">
              <span>Region</span>
              <span className="ta-r">Deposits</span>
              <span className="ta-r">Loans</span>
              <span className="ta-r">Customers</span>
              <span>Share of Deposits</span>
            </div>
            {charts.branchPerformance.map(b => {
              const share = (b.deposits / metrics.totalDeposits) * 100;
              return (
                <div key={b.region} className="branches__row">
                  <span className="branches__region">
                    <span className="branches__rank">#{b.rank}</span>
                    {b.region}
                  </span>
                  <span className="ta-r">{fmtB(b.deposits)}</span>
                  <span className="ta-r">{fmtB(b.loans)}</span>
                  <span className="ta-r">{(b.customers / 1000).toFixed(2)}M</span>
                  <span className="branches__bar-wrap">
                    <span className="branches__bar-track">
                      <span className="branches__bar-fill" style={{ width: `${share * 2}%` }} />
                    </span>
                    <span className="branches__bar-val">{share.toFixed(0)}%</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Row 5: Three Health Gauges ───────────────────── */}
        <div className="chart-card">
          <ChartHeader
            title="Bank Health Indicators"
            sub="How safe and efficient we are vs industry benchmarks"
            explain="Three critical health metrics, each with an industry benchmark tick mark. Green means we're in healthy territory, amber means watch carefully, red means action is needed."
          />
          <div className="gauges">
            <Gauge
              label="Non-Performing Loans"
              value={metrics.nonPerformingLoans}
              max={5}
              benchmark={3}
              tone={charts.healthGauges[0].tone}
              explain="The % of loans where customers are 90+ days behind on payments. Lower is healthier. Industry benchmark is around 3%."
            />
            <Gauge
              label="Cost-to-Income"
              value={metrics.costToIncome}
              max={80}
              benchmark={60}
              tone={charts.healthGauges[1].tone}
              explain="Costs as a share of revenue. Well-run retail banks aim below 60%. Lower means more efficient operations."
            />
            <Gauge
              label="Customer Satisfaction"
              value={metrics.customerSatisfaction}
              max={100}
              benchmark={75}
              unit=""
              tone={charts.healthGauges[2].tone}
              explain="Average CSAT score across customer surveys. Higher is better; 75 or more is considered strong for a retail bank."
            />
          </div>
        </div>

      </div>
    </div>
  );
}