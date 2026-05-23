import { useState, useEffect, useRef, useCallback } from "react";
import { useCopilotAction, useCopilotReadable } from "@copilotkit/react-core";
import { BankMetrics } from "../types";
import { DEFAULT_METRICS } from "../constants/metrics";

export function useSalesMetrics() {
  const [metrics, setMetrics]         = useState<BankMetrics>(DEFAULT_METRICS);
  const [changedKeys, setChangedKeys] = useState<Set<string>>(new Set());
  const prevRef                       = useRef<BankMetrics>(metrics);

  // ── Track changed keys for flash animation ──────────────────────────────
  useEffect(() => {
    const changed = new Set<string>();
    (Object.keys(metrics) as (keyof BankMetrics)[]).forEach(k => {
      if (metrics[k] !== prevRef.current[k]) changed.add(k);
    });
    if (changed.size) {
      setChangedKeys(changed);
      setTimeout(() => setChangedKeys(new Set()), 3000);
    }
    prevRef.current = metrics;
  }, [metrics]);

  // ── CopilotKit bindings ─────────────────────────────────────────────────
  useCopilotReadable({ description: "retail bank metrics", value: { metrics } });

  useCopilotAction({
    name: "update_metric",
    description: "Update a single bank metric",
    parameters: [
      { name: "metric", type: "string", required: true },
      { name: "value",  type: "number", required: true },
    ],
    handler: async ({ metric, value }) => {
      if (!(metric in DEFAULT_METRICS)) return { success: false };
      setMetrics(prev => ({ ...prev, [metric]: value }));
      return { success: true };
    },
  });

  useCopilotAction({
    name: "simulate_scenario",
    description: "Update multiple metrics at once",
    parameters: [{ name: "updates", type: "string", required: true }],
    handler: async ({ updates }) => {
      try {
        const parsed = JSON.parse(updates);
        setMetrics(prev => {
          const next = { ...prev };
          for (const [k, v] of Object.entries(parsed)) {
            if (k in next) (next as any)[k] = Number(v);
          }
          return next;
        });
        return { success: true };
      } catch { return { success: false }; }
    },
  });

  useCopilotAction({
    name: "reset_dashboard",
    description: "Reset to defaults",
    parameters: [],
    handler: async () => { setMetrics(DEFAULT_METRICS); return { success: true }; },
  });

  // ── Internal action applier ────────────────────────────────────────────
  const applyAction = useCallback((name: string, args: any) => {
    console.log(`▶️  Applying action: ${name}`, args);

    if (name === "update_metric") {
      const { metric, value } = args;
      if (metric && metric in DEFAULT_METRICS) {
        setMetrics(prev => ({ ...prev, [metric]: Number(value) }));
      } else {
        console.warn(`⚠️  Unknown metric key: "${metric}"`);
      }

    } else if (name === "simulate_scenario") {
      try {
        const upd = typeof args.updates === "string"
          ? JSON.parse(args.updates)
          : args.updates;
        if (typeof upd !== "object" || upd === null) throw new Error("Not an object");
        setMetrics(prev => {
          const next = { ...prev };
          for (const [k, v] of Object.entries(upd)) {
            if (k in next) (next as any)[k] = Number(v);
            else console.warn(`⚠️  simulate_scenario: unknown key "${k}"`);
          }
          return next;
        });
      } catch (e) {
        console.warn("⚠️  simulate_scenario parse failed:", e);
      }

    } else if (name === "reset_dashboard") {
      setMetrics(DEFAULT_METRICS);

    } else {
      console.warn(`⚠️  Unknown action name: "${name}"`);
    }
  }, []);

  // ── Keyword fallback ───────────────────────────────────────────────────
  const tryKeywordFallback = useCallback((text: string) => {
    console.log("🔎 Trying keyword fallback...");

    const keywordMap: Record<string, string> = {
      // Volume
      totaldeposits:        "totalDeposits",
      deposits:             "totalDeposits",
      totalloans:           "totalLoans",
      loans:                "totalLoans",
      netinterestmargin:    "netInterestMargin",
      nim:                  "netInterestMargin",
      branches:             "branches",
      atms:                 "atms",
      // Customer
      activecustomers:      "activeCustomers",
      customers:            "activeCustomers",
      newcustomers:         "newCustomersMonth",
      newcustomersmonth:    "newCustomersMonth",
      digitaladoption:      "digitalAdoption",
      digital:              "digitalAdoption",
      customersatisfaction: "customerSatisfaction",
      csat:                 "customerSatisfaction",
      satisfaction:         "customerSatisfaction",
      premium:              "premiumCustomers",
      premiumcustomers:     "premiumCustomers",
      // Lending
      loanapprovalrate:     "loanApprovalRate",
      approvalrate:         "loanApprovalRate",
      nonperformingloans:   "nonPerformingLoans",
      npl:                  "nonPerformingLoans",
      avgloansize:          "avgLoanSize",
      mortgagebook:         "mortgageBook",
      // Profit
      monthlyrevenue:       "monthlyRevenue",
      revenue:              "monthlyRevenue",
      monthlycost:          "monthlyCost",
      cost:                 "monthlyCost",
      netprofit:            "netProfit",
      profit:               "netProfit",
      costtoincome:         "costToIncome",
      cir:                  "costToIncome",
      // Portfolio
      mortgageloans:        "mortgageLoans",
      mortgages:            "mortgageLoans",
      autoloans:            "autoLoans",
      personalloans:        "personalLoans",
      businessloans:        "businessLoans",
      creditcardloans:      "creditCardLoans",
      creditcard:           "creditCardLoans",
    };

    const numRe = /"?(\w+)"?\s*(?::|to|=)\s*(-?[$]?[\d,]+\.?\d*)/gi;
    const updates: Record<string, number> = {};
    let nm: RegExpExecArray | null;

    while ((nm = numRe.exec(text)) !== null) {
      const key    = nm[1].toLowerCase();
      const val    = parseFloat(nm[2].replace(/[$,]/g, ""));
      const mapped = keywordMap[key];
      if (mapped && !isNaN(val)) updates[mapped] = val;
    }

    if (Object.keys(updates).length > 0) {
      console.log("📊 Keyword fallback updates:", updates);
      setMetrics(prev => {
        const next = { ...prev };
        for (const [k, v] of Object.entries(updates)) {
          if (k in next) (next as any)[k] = v;
        }
        return next;
      });
    } else {
      console.log("📭 Keyword fallback: no matching metrics found");
    }
  }, []);

  // ── Public ─────────────────────────────────────────────────────────────
  const lastAppliedRef = useRef<string>("");

  const applyEmbeddedActions = useCallback((text: string, isFinal: boolean) => {
    console.log(`🔍 applyEmbeddedActions (isFinal=${isFinal})`);

    const re = /\[ACTION:(\w+):([\s\S]*?)\]/g;
    let m: RegExpExecArray | null;
    let found = false;

    while ((m = re.exec(text)) !== null) {
      const signature = m[0];

      try {
        const [, name, rawArgs] = m;
        const args = JSON.parse(rawArgs.trim());

        if (lastAppliedRef.current === signature) {
          console.log("⏭️  Skipping duplicate action:", name);
          continue;
        }

        applyAction(name, args);
        lastAppliedRef.current = signature;
        found = true;

      } catch (e) {
        console.warn("⚠️  Failed to parse action:", m[0], e);
      }
    }

    if (!found && isFinal) {
      console.log("⚠️  No [ACTION] tags — trying keyword fallback");
      tryKeywordFallback(text);
    }
  }, [applyAction, tryKeywordFallback]);

  return {
    metrics,
    changedKeys,
    applyEmbeddedActions,
    resetMetrics: () => setMetrics(DEFAULT_METRICS),
  };
}