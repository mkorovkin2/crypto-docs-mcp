---
description: Optimize a page for SEO - analyzes purpose, identifies keywords, and adds JSON-LD schema markup
argument-hint: "<path/to/page.html>"
allowed-tools: Read, Glob, Grep, Task
model: opus
---

# SEO Page Optimizer

You MUST optimize the specified page for search engines by delegating to the `seo-optimizer` agent.

## Required Argument

The user must provide a file path to the page that needs optimization. If no path is provided, ask for one:

```
Please specify the path to the page you want to optimize for SEO.
Example: /optimize_seo src/pages/about.html
```

## Your Process

### Step 1: Validate the File Exists

First, confirm the target file exists:

```bash
ls -la [provided-path]
```

If the file doesn't exist, help the user find the correct file:
- Use Glob to search for similar filenames
- Suggest common page locations (src/pages/, public/, app/, etc.)

### Step 2: Read the Target Page

Read the complete file content to understand what you're working with:

- File type (HTML, JSX, TSX, Vue, Svelte, etc.)
- Current structure and content
- Existing SEO elements

### Step 3: Gather Context (Optional)

If the page is part of a larger site, try to find additional context:

```bash
# Look for existing schema or SEO patterns in the project
grep -r "application/ld+json" --include="*.html" --include="*.tsx" --include="*.jsx" . 2>/dev/null | head -5

# Check for site configuration
ls -la next.config.* nuxt.config.* vite.config.* 2>/dev/null
```

This helps the seo-optimizer agent match existing patterns.

### Step 4: Delegate to seo-optimizer Agent

Spawn a Task with `subagent_type="seo-optimizer"` and provide ALL necessary context:

```
Optimize this page for SEO:

## Target File
**Path**: [full/path/to/file]
**File Type**: [html/jsx/tsx/vue/etc.]

## Current Page Content
[PASTE THE COMPLETE FILE CONTENT HERE]

## Site Context (if found)
- Framework: [Next.js/Nuxt/plain HTML/etc.]
- Existing SEO patterns: [any patterns found in other files]
- Site name: [if identifiable]

## Special Instructions
[Any user-specified requirements or constraints]
```

**CRITICAL**: The seo-optimizer agent does NOT have access to this conversation. Include:
1. The COMPLETE file content (copy/paste the entire file)
2. The file type/framework being used
3. Any existing SEO patterns from the project
4. The full file path for edits

### Step 5: Present Results

After the seo-optimizer agent completes, present a summary to the user:

```
## SEO Optimization Complete

### Page Optimized
[file path]

### Keywords Targeted
- **Primary**: [keyword]
- **Secondary**: [list]

### Changes Made
- Title tag: [new title]
- Meta description: [new description]
- JSON-LD schema: [schema type] added
- [Other changes]

### JSON-LD Schema Added
```json
[paste the schema]
```

### Validate Your Schema
Test at: https://validator.schema.org/

### Next Steps
1. [Recommendations from the agent]
2. [Additional suggestions]
```

## Handling Different File Types

### HTML Files
Standard approach - add meta tags to `<head>`, JSON-LD before `</head>`.

### React/JSX/TSX
- Meta tags may need to use a Head component (Next.js) or react-helmet
- JSON-LD can be added via a script tag or dedicated component

Example for Next.js:
```jsx
import Head from 'next/head';

export default function Page() {
  return (
    <>
      <Head>
        <title>Optimized Title</title>
        <meta name="description" content="..." />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      </Head>
      {/* page content */}
    </>
  );
}
```

### Vue/Nuxt
- Use `useHead()` composable or `<Head>` component
- Nuxt has built-in SEO module support

### Svelte/SvelteKit
- Use `<svelte:head>` for meta tags

Inform the seo-optimizer agent of the framework so it makes appropriate changes.

## Example Usage

User runs: `/optimize_seo src/pages/pricing.html`

You:
1. Read `src/pages/pricing.html`
2. Identify it as a pricing/product page
3. Check for existing SEO patterns in the project
4. Spawn seo-optimizer with full context
5. Report back the changes made

## What NOT to Do

- Don't skip reading the file first
- Don't guess at file contents
- Don't make changes yourself - always delegate to seo-optimizer
- Don't forget to include the full file content when delegating
- Don't skip validation instructions

## Error Handling

If the file can't be found:
```
I couldn't find the file at [path].

Did you mean one of these?
- [similar file 1]
- [similar file 2]

Please provide the correct path to the page you want to optimize.
```

If the file type isn't a web page:
```
The file [path] doesn't appear to be a web page (found: [type]).

SEO optimization works best on:
- HTML files (.html, .htm)
- React components (.jsx, .tsx)
- Vue components (.vue)
- Svelte components (.svelte)

Please specify a web page file to optimize.
```
