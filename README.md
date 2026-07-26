# Prism

A browser-native cloud IDE and full-stack web development platform. Write, preview, and run Node.js applications entirely in the browser, with no local setup or terminal installation required.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Node.js](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen?logo=node.js&logoColor=white)

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Configuration](#configuration)
- [Usage](#usage)
- [API Reference](#api-reference)
- [Project Structure](#project-structure)
- [Design Notes](#design-notes)
- [Known Limitations](#known-limitations)
- [Contributing](#contributing)

---

## Overview

Prism is an AI-powered, browser-native cloud IDE for building full-stack web applications without leaving the browser. It combines a fully-featured multi-tab code editor, an in-browser Node.js runtime powered by the WebContainers API, and an autonomous AI coding agent into a single, cohesive development environment.

A few core ideas underpin the platform:

- **Zero local setup.** All development happens in the browser, from writing code to running a live dev server.
- **AI-first editing.** Inline completions, quick-edit refactoring, and a multi-tool coding agent are built into the editing experience from the ground up.
- **Real-time persistence.** Project files are stored in Convex and synced live, including hot-reloading directly into the running WebContainer, with no container restarts required.

---

## Features

### Code Editor

- Multi-tab editor powered by CodeMirror 6, with syntax support for JavaScript, TypeScript, HTML, CSS, JSON, Markdown, and Python
- Tab pinning, preview tabs (single-click to browse, double-click to pin), and breadcrumb navigation
- Integrated minimap, indentation markers, and One Dark theme
- Hierarchical file explorer with full CRUD operations, including binary file support

### AI Assistance

- **Cursor suggestions:** Real-time, context-aware inline completions powered by Gemini 2.5 Flash Lite, triggered at the cursor position via `/api/suggestion`
- **Quick Edit (`Cmd/Ctrl + K`):** Select a code block, describe the change in plain English, and the AI rewrites it in place. If a URL is included in the prompt, Prism automatically scrapes the referenced documentation via Firecrawl before generating the edit
- **AI Coding Agent:** An autonomous, multi-tool agent backed by Inngest Agent Kit and Gemini 3.1 Flash Lite. The agent can list and read project files, create and update files across the codebase, delete and rename files, and scrape external documentation on demand

### In-Browser Runtime

- Full Node.js development environment running in the browser via the WebContainers API and WebAssembly
- Integrated Xterm.js terminal with live build output and server logs
- Hot-reloading file sync: changes persisted to Convex are written directly into the WebContainer filesystem without restarting the dev server
- Configurable install and dev commands per project (e.g., `npm install`, `pnpm run dev`, `vite`)

### GitHub Integration

- Import any public or private GitHub repository by URL; Prism handles recursive tree fetching, text/binary file separation, and Convex storage upload automatically
- Export any project to a new GitHub repository (public or private) under the authenticated account
- All import and export operations run as resilient background jobs managed by Inngest, with full cancellation support

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router), React 19 |
| Styling | Tailwind CSS v4, Radix UI, Shadcn UI, Lucide Icons |
| State Management | Zustand v5 |
| Code Editor | CodeMirror 6 |
| Terminal | Xterm.js |
| Backend & Database | Convex |
| Authentication | Clerk |
| Background Jobs | Inngest |
| AI Models | Google Gemini (`gemini-2.5-flash-lite`, `gemini-3.1-flash-lite`, `gemini-3.5-flash`) via Vercel AI SDK |
| Agent Framework | Inngest Agent Kit |
| Web Scraping | Firecrawl |
| Runtime Sandbox | WebContainers API |
| Error Tracking | Sentry |

---

## Getting Started

### Prerequisites

- Node.js v20.0.0 or higher
- npm v10+ or pnpm
- [Convex](https://www.convex.dev/) account and project
- [Clerk](https://clerk.com/) account and application
- [Google AI](https://ai.google.dev/) API key (Gemini)
- [Firecrawl](https://www.firecrawl.dev/) API key
- [Inngest](https://www.inngest.com/) account, or the Inngest CLI for local development

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/aditya-gupta-me/Prism.git
   cd Prism
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Initialize and link your Convex backend. This generates the required TypeScript types under `convex/_generated` and starts the Convex development server:

   ```bash
   npx convex dev
   ```

4. *(Optional)* Start the Inngest local dev server in a separate terminal to handle background jobs during local development:

   ```bash
   npx inngest-cli@latest dev
   ```

5. Start the Next.js development server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

### Configuration

Create a `.env.local` file in the project root with the following environment variables:

```env
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_JWT_ISSUER_DOMAIN=https://<your-clerk-domain>.clerk.accounts.dev

# Convex
CONVEX_DEPLOYMENT=dev:<your-convex-deployment>
NEXT_PUBLIC_CONVEX_URL=https://<your-convex-deployment>.convex.cloud

# Internal Security Key (shared between Inngest workers and Convex internal functions)
PRISM_CONVEX_INTERNAL_KEY=your_generated_internal_key

# Google Generative AI
GOOGLE_GENERATIVE_AI_API_KEY=your_google_ai_api_key

# Firecrawl
FIRECRAWL_API_KEY=fc-...

# Sentry (optional)
SENTRY_AUTH_TOKEN=sntrys_...
```

---

## Usage

### Creating and Managing Projects

From the home dashboard (`/`), click **New Project** to start from scratch or **Import Repository** to pull in an existing GitHub repository by URL. Each project supports configurable build and runtime settings, including a custom `installCommand` and `devCommand`, accessible from the preview settings panel.

### Editor

Click any file in the sidebar to open it. Single-clicking opens a file in preview mode (italicised tab title); double-clicking or making an edit pins it permanently. The breadcrumb bar at the top of the editor provides quick navigation to ancestor directories.

### Quick Edit

1. Select a code block in the editor.
2. Press `Cmd + K` (macOS) or `Ctrl + K` (Windows/Linux).
3. Enter a plain-English instruction, for example: *"Refactor this function to use async/await"* or *"Add TypeScript types using the docs at https://react.dev"*.
4. Prism rewrites the selected code in place, scraping any linked documentation automatically before generating the edit.

### AI Coding Agent

Open the AI Assistant sidebar on the right side of the workspace. Ask questions or issue multi-file tasks (for example, *"Create a counter component and import it into App.tsx"*). The agent executes the necessary file operations in real time and reports its actions as it works.

### Live Preview and Terminal

Toggle the Preview panel to boot the in-browser WebContainer runtime. Dependencies are installed and the dev server starts automatically based on the project's configured commands. Build output and server logs appear in the embedded terminal. Code changes are persisted to Convex and hot-reloaded into the running environment without restarting the container process.

### GitHub Import and Export

- **Import:** Paste a public or private GitHub repository URL into the import dialog on the home page.
- **Export:** Click **Export** in the project navbar, set the repository name, description, and visibility, then confirm. The export runs as a background job and can be cancelled at any point.

---

## API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/messages` | `POST` | Accepts a user chat prompt, cancels any in-progress response, and dispatches the AI agent via an Inngest `message/sent` event |
| `/api/messages/cancel` | `POST` | Cancels an ongoing AI message generation task |
| `/api/quick-edit` | `POST` | Accepts selected code, full file context, and a plain-English instruction; returns modified code from Gemini 2.5 Flash Lite, with optional Firecrawl documentation scraping |
| `/api/suggestion` | `POST` | Accepts line and cursor context; returns an inline code completion from Gemini 2.5 Flash Lite |
| `/api/github/import` | `POST` | Accepts a GitHub repository URL, retrieves OAuth credentials from Clerk, and triggers an Inngest `github/import.repo` event |
| `/api/github/export` | `POST` | Initiates a project export to a new GitHub repository via an Inngest `github/export.repo` event |
| `/api/github/export/cancel` | `POST` | Cancels an active GitHub export job |
| `/api/inngest` | `GET / POST` | Inngest webhook endpoint serving all registered background functions |

---

## Project Structure

```
prism/
├── app/                          # Next.js App Router pages and API route handlers
│   ├── api/
│   │   ├── github/
│   │   │   ├── export/           # Export project to GitHub
│   │   │   │   ├── cancel/
│   │   │   │   └── reset/
│   │   │   └── import/           # Import GitHub repository by URL
│   │   ├── inngest/              # Inngest webhook handler
│   │   ├── messages/             # Chat message processing and AI agent dispatch
│   │   │   └── cancel/
│   │   ├── quick-edit/           # Inline AI code editing
│   │   └── suggestion/           # AI cursor completion
│   ├── projects/
│   │   └── [projectId]/          # Per-project IDE workspace
│   ├── sign-in/
│   ├── sign-up/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                  # Projects dashboard
│
├── components/                   # Shared UI and provider components
│   ├── ai-elements/              # AI response message renderers
│   ├── ui/                       # Radix/Shadcn UI primitives
│   ├── convex-client-provider.tsx
│   ├── providers.tsx
│   └── theme-provider.tsx
│
├── convex/                       # Convex backend schema and functions
│   ├── auth.config.ts
│   ├── authContext.ts
│   ├── constants.ts
│   ├── conversations.ts
│   ├── files.ts
│   ├── projects.ts
│   ├── schema.ts
│   └── system.ts                 # Internal API, protected by PRISM_CONVEX_INTERNAL_KEY
│
├── features/                     # Feature-driven modules
│   ├── auth/
│   ├── conversations/            # AI chat sidebar, history, and Inngest agent
│   │   ├── components/
│   │   ├── hooks/
│   │   └── inngest/
│   │       ├── tools/            # Agent tools: read, write, create, delete, rename, scrape
│   │       ├── constants.ts      # Agent system prompts
│   │       └── process-message.ts
│   ├── editor/                   # CodeMirror editor, tab state, and extensions
│   │   ├── components/
│   │   ├── extensions/
│   │   └── store/                # Zustand tab management
│   ├── preview/                  # WebContainer runtime and Xterm terminal
│   │   ├── components/
│   │   ├── hooks/
│   │   └── utils/
│   └── projects/                 # Dashboard, file explorer, GitHub dialogs
│       ├── components/
│       ├── hooks/
│       └── inngest/              # GitHub import and export background jobs
│
├── hooks/                        # Global UI hooks
├── inngest/
│   ├── client.ts
│   └── functions.ts              # Registered Inngest function definitions
├── lib/
│   ├── convex-client.ts
│   ├── firecrawl.ts
│   └── utils.ts
├── middleware.ts                  # Clerk authentication middleware
└── next.config.ts                 # COOP/COEP headers for WebContainers, Sentry config
```

---

## Design Notes

**Internal API authentication.** Long-running Inngest background tasks interact with Convex through internal functions defined in `convex/system.ts`. Every endpoint in that file validates `PRISM_CONVEX_INTERNAL_KEY` before executing, ensuring these internal routes are inaccessible to unauthorized callers.

**Hierarchical file system.** Files and folders are stored in a single flat Convex table using `parentId` references. The folder hierarchy is reconstructed in memory at render time and again when mounting the WebContainer filesystem through `buildFileTree`.

**WebContainers browser requirements.** The WebContainers API depends on `SharedArrayBuffer`, which browsers restrict to cross-origin isolated contexts. `next.config.ts` sets `Cross-Origin-Embedder-Policy: credentialless` and `Cross-Origin-Opener-Policy: same-origin` on every response to satisfy this requirement.

**AI agent tool loop.** The coding agent uses `@inngest/agent-kit` with a custom router that continues invoking tools (`list_files`, `read_files`, `create_files`, `update_file`, `delete_files`, `rename_file`, `scrape_urls`) until the model produces a clean, text-only response with no further tool calls pending.

**Hot-reloading without container restarts.** The `useWebContainer` hook subscribes to real-time Convex query updates. When file content changes, it writes the updated content directly into the WebContainer filesystem via `container.fs.writeFile`, allowing Vite or Next.js HMR to pick up the change without restarting the dev server process.

---

## Known Limitations

- **Browser compatibility.** WebContainers require a modern browser with `SharedArrayBuffer` support and correct enforcement of COOP/COEP headers.
- **Runtime persistence.** The WebContainer environment runs in browser memory and is lost on page reload. All project files remain persisted in Convex and are re-mounted when the container boots again.
- **Documentation scraping context limit.** Markdown content retrieved via Firecrawl is capped at 8,000 characters to avoid exceeding LLM context window limits.

---

## Contributing

Contributions, bug reports, and feature requests are welcome. To contribute:

1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Commit your changes: `git commit -m 'Add your feature'`
4. Push to your branch: `git push origin feature/your-feature-name`
5. Open a pull request against `main`.

For significant changes, please open an issue at [github.com/aditya-gupta-me/Prism/issues](https://github.com/aditya-gupta-me/Prism/issues) first to discuss the approach before submitting a PR.