import { BankMetrics } from "../types";

export const MONTHS = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun"];

export const DEFAULT_METRICS: BankMetrics = {
  // Business Volume
  totalDeposits:        48.2,   // $B
  totalLoans:           34.6,   // $B
  netInterestMargin:     3.2,   // %
  branches:            412,
  atms:               1842,

  // Customer
  activeCustomers:    2870,     // K = 2.87M
  newCustomersMonth:    42,     // K added this month
  digitalAdoption:      71.4,   // %
  customerSatisfaction: 84,     // /100
  premiumCustomers:    180,     // K

  // Lending
  loanApprovalRate:     78.5,
  nonPerformingLoans:    2.1,
  avgLoanSize:          85,     // $K
  mortgageBook:         18.4,   // $B

  // Profitability ($M monthly)
  monthlyRevenue:      385,
  monthlyCost:         218,
  netProfit:           167,
  costToIncome:         56.6,

  // Loan portfolio composition ($B, sums to ~totalLoans)
  mortgageLoans:        18.4,
  autoLoans:             4.8,
  personalLoans:         3.6,
  businessLoans:         5.2,
  creditCardLoans:       2.6,
};

export const QUICK_PROMPTS = [
  "How can we grow deposits 10%?",
  "What if we open 25 new branches?",
  "Lift digital adoption to 85%",
  "Reduce non-performing loans by half",
  "Simulate a strong quarter",
  "Reset dashboard",
];