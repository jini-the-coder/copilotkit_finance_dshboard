// ── Meridian — Retail Bank metrics ────────────────────────────
export interface BankMetrics {
  // Business Volume
  totalDeposits:       number;   // $B
  totalLoans:          number;   // $B
  netInterestMargin:   number;   // %
  branches:            number;   // count
  atms:                number;   // count

  // Customer
  activeCustomers:     number;   // K (in thousands)
  newCustomersMonth:   number;   // K added this month
  digitalAdoption:     number;   // % using mobile/web monthly
  customerSatisfaction:number;   // CSAT score 0-100
  premiumCustomers:    number;   // K (high-value tier)

  // Lending
  loanApprovalRate:    number;   // %
  nonPerformingLoans:  number;   // % (loans 90+ days overdue)
  avgLoanSize:         number;   // $K
  mortgageBook:        number;   // $B

  // Profitability
  monthlyRevenue:      number;   // $M
  monthlyCost:         number;   // $M
  netProfit:           number;   // $M
  costToIncome:        number;   // %

  // Loan portfolio composition ($B)
  mortgageLoans:       number;
  autoLoans:           number;
  personalLoans:       number;
  businessLoans:       number;
  creditCardLoans:     number;
}

// Backwards compat alias
export type SalesMetrics = BankMetrics;

// ── Chat ──────────────────────────────────────────────────────
export interface Message {
  role:       "user" | "assistant";
  content:    string;
  isLoading?: boolean;
}

// ── Chart datasets ────────────────────────────────────────────
export interface ChartDataSets {
  depositsLoansTrend: { month: string; deposits: number; loans: number }[];
  loanPortfolio:      { name: string; value: number; color: string }[];
  customerFunnel:     { stage: string; count: number; pct: number }[];
  branchPerformance:  { region: string; deposits: number; loans: number; customers: number; rank: number }[];
  revenueCostTrend:   { month: string; revenue: number; cost: number; profit: number }[];
  channelMix:         { channel: string; transactions: number; pct: number }[];
  healthGauges:       { label: string; value: number; max: number; tone: "good" | "warn" | "bad"; benchmark: number }[];
}