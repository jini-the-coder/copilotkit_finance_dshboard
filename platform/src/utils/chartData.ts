import { BankMetrics, ChartDataSets } from "../types";
import { MONTHS } from "../constants/metrics";
import { COLORS } from "../constants/theme";

// ── Formatters ────────────────────────────────────────────────
export const fmtB = (v: number): string =>
  v >= 1000 ? `$${(v / 1000).toFixed(2)}T` : `$${v.toFixed(1)}B`;

export const fmtM = (v: number): string => `$${v}M`;

export const fmtK = (v: number): string =>
  v >= 1000 ? `${(v / 1000).toFixed(2)}M` : `${v}K`;

export const fmtPct = (v: number): string => `${v.toFixed(1)}%`;

export const fmtNumber = (v: number): string =>
  v.toLocaleString();

// ── Builder ───────────────────────────────────────────────────
export function buildCharts(m: BankMetrics): ChartDataSets {

  // ── Deposits vs Loans 12-month trend ──────────────────────
  // Both grow slightly through the year; deposits typically lead loans
  const depositsLoansTrend = MONTHS.map((month, i) => {
    const factor = 0.88 + i * 0.012;
    return {
      month,
      deposits: +(m.totalDeposits * factor).toFixed(1),
      loans:    +(m.totalLoans * (factor - 0.02)).toFixed(1),
    };
  });

  // ── Loan portfolio donut ──────────────────────────────────
  const loanPortfolio = [
    { name: "Mortgages",    value: m.mortgageLoans,   color: COLORS.loan[0] },
    { name: "Business",     value: m.businessLoans,   color: COLORS.loan[1] },
    { name: "Auto",         value: m.autoLoans,       color: COLORS.loan[2] },
    { name: "Personal",     value: m.personalLoans,   color: COLORS.loan[3] },
    { name: "Credit Card",  value: m.creditCardLoans, color: COLORS.loan[4] },
  ];

  // ── Customer funnel ──────────────────────────────────────
  // Total → Active → Digital users → Premium
  const total      = m.activeCustomers + 200;   // approximate registered base
  const active     = m.activeCustomers;
  const digital    = Math.round(m.activeCustomers * (m.digitalAdoption / 100));
  const premium    = m.premiumCustomers;

  const customerFunnel = [
    { stage: "Total Customers",   count: total,    pct: 100 },
    { stage: "Active (last 30d)", count: active,   pct: +(active / total * 100).toFixed(1) },
    { stage: "Digital Users",     count: digital,  pct: +(digital / total * 100).toFixed(1) },
    { stage: "Premium Tier",      count: premium,  pct: +(premium / total * 100).toFixed(1) },
  ];

  // ── Branch performance by region ──────────────────────────
  const regions = [
    { region: "North",   share: 0.32 },
    { region: "South",   share: 0.24 },
    { region: "East",    score: 0.20, share: 0.20 },
    { region: "West",    share: 0.16 },
    { region: "Central", share: 0.08 },
  ];
  const branchPerformance = regions
    .map((r, i) => ({
      region:    r.region,
      deposits:  +(m.totalDeposits * r.share).toFixed(1),
      loans:     +(m.totalLoans * r.share * (0.85 + i * 0.06)).toFixed(1),
      customers: Math.round(m.activeCustomers * r.share),
      rank:      0,  // filled in below
    }))
    .sort((a, b) => b.deposits - a.deposits)
    .map((r, i) => ({ ...r, rank: i + 1 }));

  // ── Revenue / Cost / Profit 12-month trend ────────────────
  const revenueCostTrend = MONTHS.map((month, i) => {
    const seasonal = 1 + 0.08 * Math.sin((i / 12) * Math.PI * 2);
    const revenue = +(m.monthlyRevenue * seasonal * (0.92 + i * 0.013)).toFixed(0);
    const cost    = +(m.monthlyCost    * seasonal * (0.95 + i * 0.008)).toFixed(0);
    return { month, revenue, cost, profit: revenue - cost };
  });

  // ── Channel mix ───────────────────────────────────────────
  // Where customers transact — illustrative split
  const channelMix = [
    { channel: "Mobile App", transactions: 58, pct: 58 },
    { channel: "Web Banking", transactions: 18, pct: 18 },
    { channel: "ATM",         transactions: 14, pct: 14 },
    { channel: "Branch",      transactions:  8, pct:  8 },
    { channel: "Phone",       transactions:  2, pct:  2 },
  ];

  // ── Health gauges ─────────────────────────────────────────
  // Lower is better for NPL & cost-to-income; higher is better for CAR
  const healthGauges = [
    {
      label:     "Non-Performing Loans",
      value:     m.nonPerformingLoans,
      max:       5,
      benchmark: 3,
      tone:      (m.nonPerformingLoans < 2.5 ? "good" : m.nonPerformingLoans < 4 ? "warn" : "bad") as "good" | "warn" | "bad",
    },
    {
      label:     "Cost-to-Income Ratio",
      value:     m.costToIncome,
      max:       80,
      benchmark: 60,
      tone:      (m.costToIncome < 55 ? "good" : m.costToIncome < 65 ? "warn" : "bad") as "good" | "warn" | "bad",
    },
    {
      label:     "Customer Satisfaction",
      value:     m.customerSatisfaction,
      max:       100,
      benchmark: 75,
      tone:      (m.customerSatisfaction > 80 ? "good" : m.customerSatisfaction > 70 ? "warn" : "bad") as "good" | "warn" | "bad",
    },
  ];

  return {
    depositsLoansTrend,
    loanPortfolio,
    customerFunnel,
    branchPerformance,
    revenueCostTrend,
    channelMix,
    healthGauges,
  };
}