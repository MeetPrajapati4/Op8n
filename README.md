<div align="center">

<img src="public/logo.png" alt="Op8n Logo" width="140" style="margin-bottom: 16px;" />

# Op8n

### **Describe any automation in plain English → get importable n8n JSON in 3–5 seconds.**

[![Next.js](https://img.shields.io/badge/Next.js-16.4.3-black?style=flat-square&logo=next.js&logoColor=white)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.x-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![Turbopack](https://img.shields.io/badge/Turbopack-Ready-blueviolet?style=flat-square)](https://nextjs.org/docs/app/api-reference/turbopack)
[![Speed](https://img.shields.io/badge/Generation-3--5s-FF6D5A?style=flat-square)](#-ultra-fast-generation)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)

<br/>

[Features](#-key-features) • [Quickstart](#-quickstart) • [How to Import](#-how-to-import-into-n8n) • [Architecture](#-architecture) • [Security](#-security--privacy) • [License](#-attribution--license)

</div>

---

> [!NOTE]
> **Legal Disclaimer**: Op8n is an independent open-source tool and is **not affiliated with, endorsed by, or sponsored by n8n GmbH**. The name "n8n" is used purely descriptively to indicate workflow format compatibility.

---

## ⚡ What is Op8n?

**Op8n** is an AI-powered automation studio that transforms natural language prompts into clean, structurally valid, and importable **n8n workflow JSON**. 

Instead of manually dragging nodes, wiring connections, and writing boilerplate JavaScript expressions from scratch, simply type what you want to automate. Op8n builds the full graph, checks connections, sanitizes secrets, and produces importable JSON in under 5 seconds.

<div align="center">
  <img src="public/screenshots/workflow-canvas.png" alt="Generated workflow running directly on the n8n canvas" width="90%" style="border-radius: 8px; border: 1px solid #2e2e35;" />
  <p><em>Resulting workflow imported and executed directly in the n8n canvas.</em></p>
</div>

---

## 🌟 Key Features

### ⚡ Ultra-Fast Generation (3–5s)
- Powered by **Google Gemini 2.5 Flash** with zero-latency thinking budget optimization (`thinkingBudget: 0`) and direct JSON schema streaming.
- Complete 4–8 node workflow graphs generated and validated in **3.2 to 4.7 seconds**.
- Built-in **Self-Healing AI Engine**: Automatically falls back to resilient candidate models if a provider experiences temporary rate limits or deprecations.

### 🌐 Multi-Provider & BYOK (Bring Your Own Key)
- Connect any leading AI provider in **Settings**:
  - **Google Gemini** (`gemini-2.5-flash`, `gemini-2.5-pro`)
  - **OpenAI** (`gpt-4o-mini`, `gpt-4o`, `o3-mini`)
  - **Anthropic Claude** (`claude-3-5-haiku`, `claude-3-5-sonnet`, `claude-3-7-sonnet`)
  - **OpenRouter**, **Groq**, **DeepSeek**, **Mistral**, **Perplexity**, **Together AI**, and local **Ollama**.
- **Write-Once & Client-Encrypted**: Keys are validated with the provider, encrypted locally in your browser, and sent securely per-request without being logged or stored on any external server.

### 🛡️ Deep Zod Validation & Auto-Repair
- **Trigger Integrity**: Guarantees exactly one trigger node (Webhook, Schedule, Manual, or event triggers) or automatically prepends a Manual Trigger.
- **Node Whitelist & Connection Verification**: Verifies all connection sources and destinations against `n8n-nodes-base` specifications.
- **Secrets Sanitization**: Automatically scrubs API keys, bearer tokens, and secrets into safe placeholders (e.g. `[YOUR_API_KEY]`).
- **Canvas Auto-Layout**: Automatically computes left-to-right coordinates (`x, y`) with zero overlapping nodes.

### 🔄 Conversational Refine Mode with Visual Diff
- Request modifications naturally without starting over:
  - *"Add a Slack alert right after the email is sent"*
  - *"Filter out orders where total < $50"*
- Inspect changes with an intuitive **visual diff bar** (`+Added`, `-Removed`, `~Modified`) and choose to **Apply** or **Discard**.

### 🚀 1-Click Direct Deploy to n8n
- Connect your self-hosted or n8n Cloud workspace with your n8n Base URL and API Key.
- Deploy generated workflows directly to n8n via its REST API (`POST /api/v1/workflows`) with built-in **SSRF Protection** that prevents attacks on loopback and cloud metadata addresses.

### 🔍 Audit & Explain Mode
- Switch between **Studio** and **Audit & Explain** modes in the top navigation.
- Paste any existing n8n workflow JSON to receive:
  - Human-readable step-by-step logic breakdown
  - Credential scope and privilege security audits
  - Error resilience and retry recommendations

### ⚙️ Workflow Canvas Preferences
- **Error Handling Policy**: Automatically injects `continueOnFail: true` or `maxTries: 3` so automated tasks don't stop unexpectedly.
- **Node Spacing**: Choose between Compact (180px), Standard (260px), or Spacious (340px) canvas layouts.
- **Mock Sample Output (`pinData`)**: Auto-injects test payloads for immediate one-click testing in n8n.
- **Auto Sticky Notes**: Adds Markdown documentation cards directly to your workflow canvas.

### 💾 Local History & Offline Storage
- Built-in **IndexedDB** client-side storage: search, tag, rename, and preview your previous workflow generations.
- Full backup **JSON Export & Import** capabilities for archiving.

### 📋 Interactive Node Inspector
- Click any node on the interactive canvas preview to view parameters, connections, required credentials, and node documentation in a focused popover.

---

## 🚀 Quickstart

### Prerequisites
- [Node.js](https://nodejs.org) (v18.18+ or v20+)
- npm or pnpm
- A Google Gemini API key (or any supported provider key)

### Installation

```bash
# 1. Clone repository
git clone https://github.com/MeetPrajapati4/Op8n.git
cd Op8n

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env.local
```

Add your Gemini API key in `.env.local`:
```env
AI_API_KEY=your_gemini_api_key_here
```

### Run Locally

```bash
# Start development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) in your browser.

### Build for Production

```bash
# Build with Next.js Turbopack
npm run build

# Start production server
npm start
```

---

## 📋 How to Import into n8n

You have 3 easy ways to import workflows into n8n:

### Method 1: Direct Canvas Paste (Recommended)
1. Click **Copy JSON** in Op8n.
2. Open your n8n workflow editor.
3. Click anywhere on the canvas and press <kbd>Ctrl+V</kbd> (or <kbd>Cmd+V</kbd> on macOS).

### Method 2: 1-Click Direct Deploy
1. Click **Send to n8n** in the Op8n toolbar.
2. Enter your n8n instance URL (e.g., `https://your-n8n.cloud` or `http://localhost:5678`) and API Key.
3. Click **Deploy Workflow** — Op8n creates the workflow and gives you a direct link to open it!

### Method 3: Download & Import
1. Click **Download .json** in the Op8n toolbar.
2. In n8n, click **Workflow Menu (top right) → Import from File...**.
3. Select your downloaded `.json` file.

---

## 🏗️ Architecture

```
op8n/
├── app/
│   ├── api/
│   │   ├── generate/route.ts      # Fast SSE workflow generation with auto-repair
│   │   ├── refine/route.ts        # Conversational refinement endpoint
│   │   ├── audit/route.ts         # Security audit & logic explanation endpoint
│   │   ├── validate-key/route.ts  # Multi-provider client key validation
│   │   ├── status/route.ts        # Server status & cloud engine telemetry
│   │   ├── health/route.ts        # Service uptime healthcheck
│   │   └── n8n/deploy/route.ts    # SSRF-protected 1-click n8n REST deployer
│   ├── globals.css                # Tailwind CSS v4 styling & 60fps animations
│   ├── layout.tsx                 # Root layout with Lenis smooth scrolling & fonts
│   └── page.tsx                   # Main studio app shell (zero-scroll h-dvh)
├── components/
│   ├── Header.tsx                 # Top navigation with Studio / Audit mode switcher
│   ├── Footer.tsx                 # Clean, minimal bottom status bar
│   ├── WorkflowForm.tsx           # Prompt textarea, presets & generation trigger
│   ├── NodePreview.tsx            # Interactive canvas flow & Node Inspector popover
│   ├── JsonViewer.tsx             # Syntax-highlighted JSON viewer with quick copy
│   ├── OutputToolbar.tsx          # Actions toolbar (Deploy, Download, Copy, Import guide)
│   ├── RefineBar.tsx              # Conversational diff bar with Add/Remove pills
│   ├── DeployDialog.tsx           # Modal for 1-click n8n REST API deployment
│   ├── ExplainView.tsx            # Security audit & step explanation UI
│   ├── SettingsDialog.tsx         # Multi-provider keys, active model & canvas preferences
│   ├── HistorySheet.tsx           # IndexedDB workflow history drawer
│   ├── ValidationBadge.tsx        # Schema validation status popover
│   └── SmoothScroll.tsx           # Lenis smooth-scrolling wrapper
└── lib/
    ├── validator.ts               # Zod schemas, auto-layout, trigger check & sanitization
    ├── prompt.ts                  # n8n node specification prompts & formatting rules
    ├── settings.ts                # User preferences & localStorage persistence
    ├── n8n-types.ts               # Complete TypeScript interfaces for n8n workflows
    ├── db.ts                      # IndexedDB persistent storage utilities (idb)
    ├── registry/
    │   ├── providers.ts           # Multi-provider catalog (Gemini, OpenAI, Claude, Groq...)
    │   └── model-filter.ts        # Model suitability filter & friendly naming
    ├── client/
    │   └── user-keys.ts           # Client-side encrypted write-once key management
    └── server/
        ├── auto-error-handler.ts  # Self-healing AI stream with automatic candidate failover
        ├── provider-client.ts     # Unified multi-provider chat & stream client
        ├── ai-config.ts           # Server-side environment key detection
        └── rate-limiter.ts        # In-memory sliding window rate limiter
```

---

## 🔒 Security & Privacy

- **Safe API Keys**: User-configured n8n API keys and instance URLs are stored exclusively in your local browser (`localStorage`) and are never tracked or saved to a remote database.
- **SSRF Protection**: The deployment proxy actively resolves hostnames and rejects private, loopback (127.0.0.1, localhost), and cloud metadata (169.254.169.254) addresses by default.
- **Automated Credential Masking**: Hardcoded secrets detected in AI outputs are replaced with explicit placeholder tokens (`[YOUR_TOKEN]`).

---

## 📄 Attribution & License

- Licensed under the **[MIT License](LICENSE)**.
- Created and developed by **[Meet Prajapati](https://github.com/MeetPrajapati4)**.
- Op8n is an independent project and is **not affiliated with, maintained by, or endorsed by n8n GmbH**.
