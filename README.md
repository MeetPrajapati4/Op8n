# Op8n

> Describe any automation in plain English → get importable n8n JSON

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Tailwind](https://img.shields.io/badge/Tailwind-4-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-22c55e?style=flat-square)](LICENSE)

---

> [!NOTE]
> **Disclaimer**: Op8n is an independent tool and is not affiliated with or endorsed by n8n GmbH. The name "n8n" is used purely descriptively to indicate compatibility with workflow JSON schemas.

---

## What Op8n does

- **Plain-English → n8n JSON** — Describe any automation; Op8n streams structurally sound, validated n8n workflow JSON with correct node types, connection schemas, and visual coordinates.
- **Built-in Validator & Auto-Repair** — Deep structural Zod validation for triggers, connections, and node schemas, with automatic retry feedback loops and coordinate repair.
- **BYOK Multi-Provider AI** — Run with OpenAI, Anthropic Claude, Google Gemini, OpenRouter, or local Ollama. API keys remain safe in your browser (`localStorage`) and are never persisted or logged.
- **History & Saved Workflows** — IndexedDB persistence with search, favorites, custom renaming, and full JSON backup import/export.
- **One-Click Imports** — Live node visualizer, complexity metrics, copy/download utilities, and guided 3-step n8n import instructions.

---

## Getting Started

### Prerequisites

- Node.js 18+ or 20+
- (Optional) AI provider API key (Gemini, Anthropic, OpenAI, OpenRouter) or a local Ollama instance.

### Install & Run

```bash
# Install dependencies
npm install

# Start local dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Configuration

You can either enter your API key directly in the Op8n **Settings** dialog in the browser (saved to `localStorage` under BYOK), or configure server-side defaults:

```bash
# Copy template
cp .env.example .env.local

# Optional server-side Gemini key
GEMINI_API_KEY=your_gemini_key_here
```

### Import into n8n

1. Copy the generated workflow JSON or click **Download .json** in Op8n.
2. In your n8n workspace canvas:
   - Hit `Cmd + V` (or `Ctrl + V`), or click **Workflow menu → Import from JSON**.
3. Fill in your service credentials on the marked nodes and hit **Activate**.

---

## Attribution & License

- Licensed under the [MIT License](LICENSE).
- Core initial prototype and groundwork by Puneeth Raj.
