# Landing Page Implementation Plan

## Overview

Create a concise, single-page React landing page that explains what the Crypto Documentation MCP Server does, demonstrates its value through an interactive flow visualization, and provides a quick start path for developers.

## Current State Analysis

- **No existing frontend**: The project has no web UI (only a CLI RAG inspector)
- **Monorepo structure**: Uses npm workspaces with packages in `packages/`
- **Documentation exists**: Comprehensive README.md with all technical details
- **Target audience**: Developers using AI coding agents (Claude Code, Cursor)

## Desired End State

A local React/Vite SPA in `packages/landing/` that:
- Explains the product in under 30 seconds of reading
- Shows an interactive flow visualization of how the system works
- Provides clear "get started" steps
- Is visually clean and developer-friendly

### Verification:
- Page loads at `http://localhost:5173` after running `npm run dev` from `packages/landing/`
- All sections render correctly
- Interactive flow visualization responds to hover/click
- No console errors

## What We're NOT Doing

- No deployment setup (local only per user request)
- No backend integration (purely informational page)
- No user accounts or dynamic data
- No complex animations or heavy graphics
- No extensive documentation (link to README instead)

## Implementation Approach

Build a lightweight React SPA with:
- Vite for fast development
- Tailwind CSS for styling (minimal, utility-first)
- Framer Motion for smooth interactions on the flow diagram
- No additional component libraries (keep dependencies minimal)

---

## Phase 1: Project Setup

### Overview
Initialize the React/Vite project as a new package in the monorepo.

### Changes Required:

#### 1. Create landing package
**Directory**: `packages/landing/`

```bash
# From project root
cd packages
npm create vite@latest landing -- --template react-ts
cd landing
npm install
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
npm install framer-motion
```

#### 2. Configure Tailwind
**File**: `packages/landing/tailwind.config.js`

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#6366f1',    // Indigo
        secondary: '#22d3ee',  // Cyan
        dark: '#0f172a',       // Slate 900
      }
    },
  },
  plugins: [],
}
```

#### 3. Update root package.json
**File**: `package.json` (root)

Add to workspaces array:
```json
{
  "workspaces": [
    "packages/shared",
    "packages/scraper",
    "packages/server",
    "packages/evaluator",
    "packages/landing"
  ]
}
```

Add script:
```json
{
  "scripts": {
    "landing": "npm run dev --workspace=packages/landing"
  }
}
```

### Success Criteria:

#### Automated Verification:
- [ ] `npm run landing` starts dev server without errors
- [ ] Page loads at `http://localhost:5173`

#### Manual Verification:
- [ ] Vite welcome page displays correctly
- [ ] Tailwind classes apply styling

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation.

---

## Phase 2: Page Structure & Hero Section

### Overview
Create the basic page structure and hero section with headline/value prop.

### Changes Required:

#### 1. Main App Component
**File**: `packages/landing/src/App.tsx`

```tsx
import { Hero } from './components/Hero'
import { Problem } from './components/Problem'
import { FlowDiagram } from './components/FlowDiagram'
import { Benefits } from './components/Benefits'
import { QuickStart } from './components/QuickStart'
import { Projects } from './components/Projects'

function App() {
  return (
    <div className="min-h-screen bg-dark text-white">
      <Hero />
      <Problem />
      <FlowDiagram />
      <Benefits />
      <QuickStart />
      <Projects />
    </div>
  )
}

export default App
```

#### 2. Hero Component
**File**: `packages/landing/src/components/Hero.tsx`

```tsx
export function Hero() {
  return (
    <section className="py-20 px-6 text-center">
      <h1 className="text-5xl font-bold mb-4">
        Blockchain Docs for <span className="text-primary">AI Agents</span>
      </h1>
      <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-8">
        Give your AI coding assistant accurate, up-to-date crypto documentation.
        No more hallucinated APIs or outdated examples.
      </p>
      <a
        href="#quickstart"
        className="inline-block bg-primary hover:bg-primary/80 px-6 py-3 rounded-lg font-medium transition"
      >
        Get Started
      </a>
    </section>
  )
}
```

#### 3. Global Styles
**File**: `packages/landing/src/index.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html {
  scroll-behavior: smooth;
}

body {
  font-family: 'Inter', system-ui, sans-serif;
}
```

### Success Criteria:

#### Automated Verification:
- [ ] No TypeScript errors: `npm run build` in landing package

#### Manual Verification:
- [ ] Hero section displays with headline, subheadline, CTA button
- [ ] Dark theme with proper contrast
- [ ] CTA button smoothly scrolls to quickstart section

**Implementation Note**: Pause for manual verification before proceeding.

---

## Phase 3: Problem/Solution Section

### Overview
Brief section explaining the problem AI agents face and how this solves it.

### Changes Required:

#### 1. Problem Component
**File**: `packages/landing/src/components/Problem.tsx`

```tsx
export function Problem() {
  return (
    <section className="py-16 px-6 bg-slate-900/50">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-8">The Problem</h2>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Without */}
          <div className="bg-red-950/30 border border-red-900/50 rounded-lg p-6">
            <h3 className="text-red-400 font-semibold mb-3">Without Documentation Access</h3>
            <ul className="space-y-2 text-gray-400 text-sm">
              <li>❌ Hallucinated function names & APIs</li>
              <li>❌ Outdated syntax from training data</li>
              <li>❌ Missing imports and setup code</li>
              <li>❌ Generic answers that don't work</li>
            </ul>
          </div>

          {/* With */}
          <div className="bg-green-950/30 border border-green-900/50 rounded-lg p-6">
            <h3 className="text-green-400 font-semibold mb-3">With Crypto Docs MCP</h3>
            <ul className="space-y-2 text-gray-400 text-sm">
              <li>✓ Accurate APIs from official docs</li>
              <li>✓ Working code with all imports</li>
              <li>✓ Source citations for verification</li>
              <li>✓ Self-correcting when uncertain</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
```

### Success Criteria:

#### Automated Verification:
- [ ] No build errors

#### Manual Verification:
- [ ] Two-column comparison displays correctly
- [ ] Visual contrast between problem/solution is clear

---

## Phase 4: Interactive Flow Visualization

### Overview
Create an interactive diagram showing how queries flow through the system.

### Changes Required:

#### 1. Flow Diagram Component
**File**: `packages/landing/src/components/FlowDiagram.tsx`

```tsx
import { useState } from 'react'
import { motion } from 'framer-motion'

const steps = [
  {
    id: 'agent',
    label: 'AI Agent',
    description: 'Claude Code or Cursor asks a question about blockchain development',
    icon: '🤖',
  },
  {
    id: 'mcp',
    label: 'MCP Server',
    description: 'Receives the query via Model Context Protocol (JSON-RPC)',
    icon: '🔌',
  },
  {
    id: 'search',
    label: 'Hybrid Search',
    description: 'Searches vector DB (semantic) + SQLite (full-text) with reranking',
    icon: '🔍',
  },
  {
    id: 'rag',
    label: 'Corrective RAG',
    description: 'If confidence is low, automatically retries with alternative queries',
    icon: '🔄',
  },
  {
    id: 'llm',
    label: 'GPT-4o Synthesis',
    description: 'Generates comprehensive answer with code examples and citations',
    icon: '✨',
  },
  {
    id: 'response',
    label: 'Smart Answer',
    description: 'Returns working code, imports, setup instructions, and source links',
    icon: '📦',
  },
]

export function FlowDiagram() {
  const [activeStep, setActiveStep] = useState<string | null>(null)

  return (
    <section className="py-16 px-6">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-4">How It Works</h2>
        <p className="text-gray-400 text-center mb-12">
          Click any step to learn more
        </p>

        {/* Flow diagram */}
        <div className="flex flex-wrap justify-center items-center gap-4">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              {/* Step node */}
              <motion.button
                className={`
                  relative px-4 py-3 rounded-lg border-2 transition-all cursor-pointer
                  ${activeStep === step.id
                    ? 'bg-primary/20 border-primary'
                    : 'bg-slate-800 border-slate-700 hover:border-slate-500'}
                `}
                onClick={() => setActiveStep(activeStep === step.id ? null : step.id)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <span className="text-2xl mr-2">{step.icon}</span>
                <span className="font-medium text-sm">{step.label}</span>
              </motion.button>

              {/* Arrow */}
              {index < steps.length - 1 && (
                <motion.span
                  className="text-slate-600 mx-2 text-xl"
                  animate={{ x: [0, 5, 0] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                >
                  →
                </motion.span>
              )}
            </div>
          ))}
        </div>

        {/* Detail panel */}
        <motion.div
          initial={false}
          animate={{
            height: activeStep ? 'auto' : 0,
            opacity: activeStep ? 1 : 0
          }}
          className="overflow-hidden mt-8"
        >
          {activeStep && (
            <div className="bg-slate-800 rounded-lg p-6 text-center">
              <p className="text-gray-300">
                {steps.find(s => s.id === activeStep)?.description}
              </p>
            </div>
          )}
        </motion.div>
      </div>
    </section>
  )
}
```

### Success Criteria:

#### Automated Verification:
- [ ] No build errors
- [ ] Framer motion animations compile correctly

#### Manual Verification:
- [ ] All 6 steps display in a row (wraps on mobile)
- [ ] Clicking a step highlights it and shows description
- [ ] Clicking again hides the description
- [ ] Arrows animate smoothly
- [ ] Hover/tap animations work

**Implementation Note**: This is the key interactive element. Pause for thorough manual testing.

---

## Phase 5: Benefits & Quick Start Sections

### Overview
Add benefits grid and quick start code snippet.

### Changes Required:

#### 1. Benefits Component
**File**: `packages/landing/src/components/Benefits.tsx`

```tsx
const benefits = [
  {
    title: 'LLM-Synthesized Answers',
    description: 'GPT-4o generates comprehensive responses, not just raw doc chunks',
    icon: '🧠',
  },
  {
    title: 'Working Code Examples',
    description: 'Complete code with imports, setup, and usage instructions',
    icon: '💻',
  },
  {
    title: 'Source Citations',
    description: 'Every answer links back to official documentation',
    icon: '📚',
  },
  {
    title: 'Self-Correcting',
    description: 'Corrective RAG automatically retries when confidence is low',
    icon: '🔄',
  },
]

export function Benefits() {
  return (
    <section className="py-16 px-6 bg-slate-900/50">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-12">Key Benefits</h2>

        <div className="grid md:grid-cols-2 gap-6">
          {benefits.map((benefit) => (
            <div
              key={benefit.title}
              className="bg-slate-800 rounded-lg p-6 border border-slate-700"
            >
              <span className="text-3xl mb-3 block">{benefit.icon}</span>
              <h3 className="font-semibold mb-2">{benefit.title}</h3>
              <p className="text-gray-400 text-sm">{benefit.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

#### 2. Quick Start Component
**File**: `packages/landing/src/components/QuickStart.tsx`

```tsx
export function QuickStart() {
  const code = `# 1. Start Qdrant
docker-compose up -d

# 2. Index documentation
npm run scraper -- -p mina --use-registry

# 3. Start the server
npm run server

# 4. Test it
curl -X POST http://localhost:3000/mcp \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"crypto_ask_docs","arguments":{"question":"How do I create a zkApp?","project":"mina"}},"id":1}'`

  return (
    <section id="quickstart" className="py-16 px-6">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-4">Quick Start</h2>
        <p className="text-gray-400 text-center mb-8">
          Up and running in 4 commands
        </p>

        <div className="bg-slate-900 rounded-lg border border-slate-700 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-800 border-b border-slate-700">
            <span className="w-3 h-3 rounded-full bg-red-500"></span>
            <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
            <span className="w-3 h-3 rounded-full bg-green-500"></span>
            <span className="text-xs text-gray-500 ml-2">terminal</span>
          </div>
          <pre className="p-4 overflow-x-auto text-sm">
            <code className="text-gray-300">{code}</code>
          </pre>
        </div>

        <p className="text-center mt-6 text-gray-500 text-sm">
          See the <a href="https://github.com/your-repo/crypto-docs-mcp" className="text-primary hover:underline">README</a> for full setup instructions
        </p>
      </div>
    </section>
  )
}
```

### Success Criteria:

#### Automated Verification:
- [ ] No build errors

#### Manual Verification:
- [ ] Benefits grid displays 2x2 on desktop, stacks on mobile
- [ ] Quick start terminal looks realistic with colored dots
- [ ] Code is readable and scrolls horizontally if needed
- [ ] "Get Started" button from hero scrolls to this section

---

## Phase 6: Supported Projects Section

### Overview
Display the 6 supported blockchain projects.

### Changes Required:

#### 1. Projects Component
**File**: `packages/landing/src/components/Projects.tsx`

```tsx
const projects = [
  { id: 'mina', name: 'Mina Protocol', color: '#FF6B4A' },
  { id: 'solana', name: 'Solana', color: '#14F195' },
  { id: 'cosmos', name: 'Cosmos SDK', color: '#6F7390' },
  { id: 'secret', name: 'Secret Network', color: '#1B1B1B' },
  { id: 'beam', name: 'Beam', color: '#25C8D9' },
  { id: 'pirate', name: 'Pirate Chain', color: '#FFD700' },
]

export function Projects() {
  return (
    <section className="py-16 px-6 bg-slate-900/50">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-3xl font-bold mb-4">Supported Projects</h2>
        <p className="text-gray-400 mb-12">
          6 blockchain ecosystems, more coming soon
        </p>

        <div className="flex flex-wrap justify-center gap-4">
          {projects.map((project) => (
            <div
              key={project.id}
              className="px-6 py-3 rounded-full border border-slate-700 bg-slate-800 hover:border-slate-500 transition"
              style={{ borderLeftColor: project.color, borderLeftWidth: '4px' }}
            >
              <span className="font-medium">{project.name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

### Success Criteria:

#### Automated Verification:
- [ ] Full build succeeds: `npm run build` in landing package

#### Manual Verification:
- [ ] All 6 projects display as pills with colored left border
- [ ] Hover effect works
- [ ] Layout wraps nicely on mobile

---

## Phase 7: Final Polish

### Overview
Add footer, ensure mobile responsiveness, and verify complete page.

### Changes Required:

#### 1. Add Footer to App.tsx
**File**: `packages/landing/src/App.tsx`

Add footer section:
```tsx
<footer className="py-8 px-6 text-center text-gray-500 text-sm border-t border-slate-800">
  <p>
    Built with the{' '}
    <a href="https://modelcontextprotocol.io" className="text-primary hover:underline">
      Model Context Protocol
    </a>
  </p>
  <p className="mt-2">MIT License</p>
</footer>
```

#### 2. Add viewport meta
**File**: `packages/landing/index.html`

Ensure viewport meta tag is present:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0">
```

### Success Criteria:

#### Automated Verification:
- [ ] Production build succeeds: `npm run build`
- [ ] No console errors in browser

#### Manual Verification:
- [ ] Page looks good on mobile (test at 375px width)
- [ ] Page looks good on desktop (1440px+)
- [ ] All sections scroll smoothly
- [ ] Interactive flow diagram works on touch devices
- [ ] Total page content is readable in under 30 seconds

---

## Testing Strategy

### Manual Testing Steps:
1. Start dev server: `npm run landing`
2. Test on desktop (Chrome, Firefox)
3. Test on mobile viewport (Chrome DevTools)
4. Click through all interactive elements
5. Verify all links work
6. Check for console errors

### Accessibility Check:
- [ ] Color contrast meets WCAG AA
- [ ] Interactive elements are keyboard accessible
- [ ] Text is readable at default zoom

---

## File Structure Summary

```
packages/landing/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css
│   └── components/
│       ├── Hero.tsx
│       ├── Problem.tsx
│       ├── FlowDiagram.tsx
│       ├── Benefits.tsx
│       ├── QuickStart.tsx
│       └── Projects.tsx
└── public/
```

---

## References

- Main README: `/Users/mkorovkin/Desktop/crypto-docs-mcp/README.md`
- MCP Protocol: https://modelcontextprotocol.io
- Vite: https://vitejs.dev
- Tailwind CSS: https://tailwindcss.com
- Framer Motion: https://www.framer.com/motion/
