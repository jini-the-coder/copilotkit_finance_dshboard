# Meridian Bank — AI-Powered Executive Dashboard

A conversational retail-banking dashboard. Ask questions in plain English, and the AI advisor not only answers — it **operates the dashboard for you**, updating live charts and KPIs in real time.

> Try asking: _"What if we open 25 new branches?"_ — watch every affected metric animate.

![Stack](https://img.shields.io/badge/stack-React%20%7C%20TypeScript%20%7C%20FastAPI%20%7C%20Gemini-blue)
![Powered by](https://img.shields.io/badge/powered%20by-CopilotKit-7C3AED)

---

## ✨ What makes it different

Most analytics dashboards have a chatbot bolted on. This one inverts that: **the AI sits inside the dashboard and actually drives it**.

- Ask *"How can we grow deposits 10%?"* → the AI explains the levers AND lifts the deposits number, cascades the impact across loans, profit, and cost-to-income, and animates every affected chart
- Every metric has a hover **(?)** icon that explains it in plain English — built for pitches to non-technical audiences
- Resizable chat panel with smooth collapse — the dashboard reclaims the full viewport when chat is closed
- One codebase, three personas (banking, trading, retail) — swap a system prompt and a metrics file

---

## 🏗️ Architecture

```
┌────────────────────┐     ┌─────────────────────┐     ┌─────────────────┐
│  React Dashboard   │ ←→  │  CopilotKit Actions │ ←→  │  FastAPI Backend │
│  (Recharts + SCSS) │     │  + Custom Stream    │     │  + Gemini AI    │
└────────────────────┘     └─────────────────────┘     └─────────────────┘
        ↑                          ↑                          ↑
        │                          │                          │
   Lives state              Bridge layer:                 Model fallback
   in useState              [ACTION:...] tag              chain for
   hooks                    streaming                     reliability
```

**The clever bit:** the AI emits `[ACTION:update_metric:{"metric":"totalDeposits","value":53}]` tags mid-stream. The frontend strips these from display text and applies them to dashboard state the moment they arrive — so charts start animating *while the AI is still typing its explanation*.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript + Vite |
| Charts | Recharts |
| Styles | SCSS modules (BEM convention) |
| AI integration | [CopilotKit](https://copilotkit.ai) (`useCopilotAction`, `useCopilotReadable`) |
| Markdown rendering | `react-markdown` |
| Backend | FastAPI (Python) |
| LLM | Google Gemini (2.5 Flash primary, fallback chain) |
| Streaming | Server-Sent Events (SSE) |

---

## 📁 Project Structure

```
meridian-bank-dashboard/
├── frontend/
│   ├── src/
│   │   ├── App.tsx                    # Root layout — dashboard + resizable chat
│   │   ├── App.scss
│   │   ├── types.ts                   # BankMetrics interface
│   │   ├── constants/
│   │   │   ├── metrics.ts             # DEFAULT_METRICS + QUICK_PROMPTS
│   │   │   └── theme.ts               # Color palette
│   │   ├── utils/
│   │   │   ├── chartData.ts           # Derive chart datasets from metrics
│   │   │   └── systemPrompt.ts        # The advisor persona prompt
│   │   ├── hooks/
│   │   │   ├── useSalesMetrics.ts     # State + CopilotKit action bindings
│   │   │   └── useChat.ts             # SSE streaming hook
│   │   ├── dashboard/
│   │   │   ├── Dashboard.tsx          # All charts, KPIs, gauges
│   │   │   ├── Topbar.tsx
│   │   │   └── dashboard.scss
│   │   ├── chatbot/
│   │   │   ├── Chatbot.tsx            # Chat UI
│   │   │   └── chatbot.scss
│   │   └── markdown/
│   │       └── MarkdownMessage.tsx
│   └── package.json
│
└── backend/
    ├── app.py                          # FastAPI + Gemini + fallback chain
    ├── requirements.txt
    └── .env.example
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Python 3.10+
- A [Google AI Studio API key](https://aistudio.google.com/app/apikey) (free tier works)

### 1. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Add your API key
cp .env.example .env
# Then edit .env and paste your GEMINI_API_KEY

python app.py
```

Backend now running at `http://localhost:5000`.

### 2. Frontend

```bash
cd frontend
npm install
npm start
```

Frontend at `http://localhost:3000`.

Open it in a browser. The chat panel on the right will greet you with quick prompts. Click one or type your own scenario.

---

## 💬 Sample Prompts to Try

| Prompt | What you'll see |
|---|---|
| `"How can we grow deposits 10%?"` | Deposits tile flashes, line chart redraws, AI explains the levers |
| `"What if we open 25 new branches?"` | Branches counter updates, customer growth ripples through, costs adjust |
| `"Lift digital adoption to 85%"` | Channel-mix bars shift, cost-to-income gauge improves |
| `"Reduce non-performing loans by half"` | NPL gauge swings green, net profit ticks up |
| `"Simulate a strong quarter"` | Multiple metrics cascade together |
| `"Reset dashboard"` | Everything snaps back to defaults |

---

## 🧠 How CopilotKit fits in

The whole "AI can act on the UI" magic comes from [CopilotKit](https://copilotkit.ai). Three primitives do the heavy lifting:

**1. `useCopilotReadable`** — exposes dashboard state to the AI

```ts
useCopilotReadable({
  description: "retail bank metrics",
  value: { metrics }
});
```

The AI always knows the current state of the dashboard.

**2. `useCopilotAction`** — gives the AI typed functions it can call

```ts
useCopilotAction({
  name: "update_metric",
  description: "Update a single bank metric",
  parameters: [
    { name: "metric", type: "string", required: true },
    { name: "value",  type: "number", required: true },
  ],
  handler: async ({ metric, value }) => {
    setMetrics(prev => ({ ...prev, [metric]: value }));
    return { success: true };
  },
});
```

**3. The `[ACTION:...]` tag protocol** — for streaming responsiveness

CopilotKit's built-in actions are perfect for non-streaming use. For mid-stream chart updates (so charts start moving while text is still being typed), the backend emits `[ACTION:...]` tags inline, and `useChat.ts` parses them on the fly.

---

## 🎨 Design Choices

### Plain language everywhere

Every metric on the dashboard has a hover **(?)** icon explaining what it means. Banking shorthand like NIM, NPL, CIR, LDR are decoded inline.

The AI advisor follows the same rule: it defines every banking term on first use, e.g. *"Your Net Interest Margin (the profit margin we make on lending) is at 3.2%..."*.

### Smart tooltip positioning

Tooltips automatically flip:
- **Vertically** (above ↔ below) when near the sticky topbar
- **Horizontally** (left ↔ right anchor) when near a viewport edge

No clipping, no half-visible explanations.

### Reliability over raw quality

The backend uses a **3-model Gemini fallback chain**:

```
gemini-2.5-flash  →  gemini-2.5-flash-lite  →  gemini-2.0-flash-001
```

Plus:
- Retries with exponential backoff on 429/5xx/timeouts
- 45s request timeout (frontend doesn't stall on slow responses)
- Friendly user-facing error messages when everything fails

Result: near-zero downtime even when individual Gemini endpoints hiccup.

---

## 🔧 Configuration

### Backend env vars (`.env`)

```bash
GEMINI_API_KEY=your_key_here
```

### Customize the metrics

Define new metrics in `frontend/src/types.ts`, default values in `frontend/src/constants/metrics.ts`, and the advisor persona in `frontend/src/utils/systemPrompt.ts`. The same scaffolding works for any domain — I've already used it for a trading desk and a DTC retail tracker.

---

## 🐛 Known Limitations

- This is a **demo / prototype** — the metrics are mocked, not connected to a real banking system
- The fallback chain assumes Google's Gemini API is available; behind a corporate firewall you may need to set up a proxy
- Tooltip placement uses inline JS measurement on hover; for very dense layouts, consider a popover library like Floating UI

---

## 📜 License

MIT — use it, fork it, ship it.

---

## 🙏 Acknowledgments

- **[CopilotKit](https://copilotkit.ai)** — for the framework that made AI-driven UIs feel obvious
- **[Recharts](https://recharts.org)** — for charts that just work
- **[Google Gemini](https://ai.google.dev)** — for the LLM brain

---

Built with ☕ — if you found this useful, a ⭐ on the repo means a lot.