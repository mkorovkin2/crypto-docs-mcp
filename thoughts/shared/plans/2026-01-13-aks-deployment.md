# Azure Kubernetes Service Deployment Implementation Plan

## Overview

Deploy the crypto-docs-mcp server as a full Kubernetes service on Azure Kubernetes Service (AKS), publicly accessible at `mcp.crypdocs.xyz`. The deployment will support dual-database configuration (SQLite for local development, PostgreSQL for Kubernetes) and use NGINX Ingress with cert-manager for TLS termination.

## Current State Analysis

**Existing Architecture:**
- Express-based HTTP server at `packages/server/src/transport.ts`
- Configuration loaded from `.env` file via `packages/shared/src/load-env.ts`
- Qdrant vector database (external, configured via `QDRANT_URL`)
- SQLite full-text search database (file-based, `packages/shared/src/db/fts.ts`)
- Health check endpoint at `/health`, MCP endpoint at `/mcp`

**Key Constraints Discovered:**
- SQLite is file-based and incompatible with multi-replica K8s deployments
- No Dockerfile or Kubernetes manifests exist
- Server currently binds to `localhost` by default (needs `0.0.0.0` for K8s)
- `better-sqlite3` requires native compilation (affects Docker build)

## Desired End State

After this plan is complete:

1. **Local Development**: `npm run dev:server` works with SQLite and local Qdrant (unchanged)
2. **Kubernetes Deployment**:
   - Server runs as a Deployment with 2+ replicas
   - Uses external PostgreSQL for FTS and external Qdrant for vectors
   - Publicly accessible at `https://mcp.crypdocs.xyz`
   - TLS certificate auto-renewed via Let's Encrypt
3. **Configuration**:
   - `NODE_ENV=development` → SQLite, localhost defaults
   - `NODE_ENV=production` → PostgreSQL, external database URLs from env vars

**Verification:**
- `curl https://mcp.crypdocs.xyz/health` returns 200 OK
- MCP tools work correctly via `https://mcp.crypdocs.xyz/mcp`
- Local development continues to work unchanged

## What We're NOT Doing

- **NOT** creating a Helm chart (raw Kubernetes manifests are sufficient for this scope)
- **NOT** setting up CI/CD pipelines (manual deployment scripts only)
- **NOT** deploying Qdrant or PostgreSQL to Kubernetes (these are external managed services)
- **NOT** implementing database migrations (PostgreSQL schema created on first connection)
- **NOT** adding horizontal pod autoscaling (fixed replica count)
- **NOT** setting up monitoring/alerting (can be added later)

## Implementation Approach

Use `NODE_ENV` environment variable for configuration switching:
- `development` (default): SQLite at `./data/crypto_docs.db`, Qdrant at `localhost:6333`
- `production`: PostgreSQL from `DATABASE_URL`, Qdrant from `QDRANT_URL`

Create a factory pattern for the FTS database to select SQLite or PostgreSQL based on environment.

---

## Phase 1: PostgreSQL Full-Text Search Database Implementation

### Overview
Create a PostgreSQL-backed implementation of the full-text search database that provides the same interface as the existing SQLite implementation. This enables the server to work with either database backend based on configuration.

### Changes Required:

#### 1. Create PostgreSQL FTS Implementation
**File**: `packages/shared/src/db/fts-postgres.ts` (new file)

Create a new class `PostgresFullTextDB` that implements all the same methods as `FullTextDB`:

```typescript
import pg from 'pg';
import type { DocumentChunk } from '../types.js';

export interface PostgresFullTextDBOptions {
  connectionString: string;
}

export class PostgresFullTextDB {
  private pool: pg.Pool;

  constructor(options: PostgresFullTextDBOptions) {
    this.pool = new pg.Pool({
      connectionString: options.connectionString,
      ssl: { rejectUnauthorized: false } // Azure PostgreSQL requires SSL
    });
  }

  async initialize(): Promise<void> {
    // Create tables with PostgreSQL full-text search using tsvector
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS chunks (
        id TEXT PRIMARY KEY,
        url TEXT NOT NULL,
        title TEXT NOT NULL,
        section TEXT NOT NULL,
        content TEXT NOT NULL,
        content_type TEXT NOT NULL,
        project TEXT NOT NULL,
        metadata JSONB NOT NULL,
        orphaned BOOLEAN DEFAULT FALSE,
        document_id TEXT,
        chunk_index INTEGER,
        total_chunks INTEGER,
        search_vector TSVECTOR,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Create GIN index for full-text search
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_chunks_search ON chunks USING GIN(search_vector)
    `);

    // Create indexes for filtering
    await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_chunks_project ON chunks(project)`);
    await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_chunks_url ON chunks(url)`);
    await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON chunks(document_id)`);

    // Create page_hashes table
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS page_hashes (
        url TEXT PRIMARY KEY,
        project TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        chunk_count INTEGER NOT NULL,
        last_indexed TIMESTAMPTZ NOT NULL
      )
    `);

    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_page_hashes_project ON page_hashes(project)
    `);
  }

  async upsert(chunks: DocumentChunk[]): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      for (const chunk of chunks) {
        await client.query(`
          INSERT INTO chunks (id, url, title, section, content, content_type, project, metadata, orphaned, document_id, chunk_index, total_chunks, search_vector)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, to_tsvector('english', $3 || ' ' || $4 || ' ' || $5))
          ON CONFLICT (id) DO UPDATE SET
            url = EXCLUDED.url,
            title = EXCLUDED.title,
            section = EXCLUDED.section,
            content = EXCLUDED.content,
            content_type = EXCLUDED.content_type,
            project = EXCLUDED.project,
            metadata = EXCLUDED.metadata,
            orphaned = EXCLUDED.orphaned,
            document_id = EXCLUDED.document_id,
            chunk_index = EXCLUDED.chunk_index,
            total_chunks = EXCLUDED.total_chunks,
            search_vector = to_tsvector('english', EXCLUDED.title || ' ' || EXCLUDED.section || ' ' || EXCLUDED.content)
        `, [
          chunk.id,
          chunk.url,
          chunk.title,
          chunk.section,
          chunk.content,
          chunk.contentType,
          chunk.project,
          JSON.stringify(chunk.metadata),
          chunk.metadata.orphaned || false,
          chunk.documentId ?? null,
          chunk.chunkIndex ?? null,
          chunk.totalChunks ?? null
        ]);
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async search(
    query: string,
    options: { limit?: number; contentType?: string; project?: string } = {}
  ): Promise<Array<{ chunk: DocumentChunk; score: number }>> {
    const { limit = 10, contentType, project } = options;

    // Convert query to tsquery format
    const tsQuery = query
      .split(/\s+/)
      .filter(word => word.length > 0)
      .map(word => word.replace(/[^\w]/g, ''))
      .filter(word => word.length > 0)
      .join(' | ');

    if (!tsQuery) return [];

    let sql = `
      SELECT *, ts_rank(search_vector, to_tsquery('english', $1)) as score
      FROM chunks
      WHERE search_vector @@ to_tsquery('english', $1)
    `;

    const params: any[] = [tsQuery];
    let paramIndex = 2;

    if (contentType) {
      sql += ` AND content_type = $${paramIndex}`;
      params.push(contentType);
      paramIndex++;
    }

    if (project) {
      sql += ` AND project = $${paramIndex}`;
      params.push(project);
      paramIndex++;
    }

    sql += ` ORDER BY score DESC LIMIT $${paramIndex}`;
    params.push(limit);

    try {
      const result = await this.pool.query(sql, params);

      return result.rows.map(row => ({
        chunk: {
          id: row.id,
          url: row.url,
          title: row.title,
          section: row.section,
          content: row.content,
          contentType: row.content_type,
          project: row.project,
          documentId: row.document_id ?? undefined,
          chunkIndex: row.chunk_index ?? undefined,
          totalChunks: row.total_chunks ?? undefined,
          metadata: {
            ...row.metadata,
            orphaned: row.orphaned
          }
        },
        score: parseFloat(row.score)
      }));
    } catch (error) {
      console.error('PostgreSQL FTS search error:', error);
      return [];
    }
  }

  // ... remaining methods (deleteByUrl, deleteByProject, getUrlsForProject,
  // markOrphaned, getPageHash, setPageHash, getIndexedUrlsForProject,
  // deletePageHash, getAdjacentChunks, close) follow same pattern

  async close(): Promise<void> {
    await this.pool.end();
  }
}
```

#### 2. Create Database Factory
**File**: `packages/shared/src/db/fts-factory.ts` (new file)

```typescript
import { FullTextDB, type FullTextDBOptions } from './fts.js';
import { PostgresFullTextDB, type PostgresFullTextDBOptions } from './fts-postgres.js';

export type FTSDatabase = FullTextDB | PostgresFullTextDB;

export interface FTSFactoryOptions {
  type: 'sqlite' | 'postgres';
  sqlitePath?: string;
  postgresConnectionString?: string;
}

export function createFTSDatabase(options: FTSFactoryOptions): FTSDatabase {
  if (options.type === 'postgres') {
    if (!options.postgresConnectionString) {
      throw new Error('PostgreSQL connection string required for postgres type');
    }
    return new PostgresFullTextDB({
      connectionString: options.postgresConnectionString
    });
  }

  if (!options.sqlitePath) {
    throw new Error('SQLite path required for sqlite type');
  }
  return new FullTextDB({
    path: options.sqlitePath
  });
}
```

#### 3. Add pg Dependency
**File**: `packages/shared/package.json`
**Changes**: Add `pg` and `@types/pg` dependencies

```json
{
  "dependencies": {
    "pg": "^8.11.0"
  },
  "devDependencies": {
    "@types/pg": "^8.10.0"
  }
}
```

#### 4. Export from Shared Package
**File**: `packages/shared/src/index.ts`
**Changes**: Export the new classes and factory

```typescript
export { PostgresFullTextDB, type PostgresFullTextDBOptions } from './db/fts-postgres.js';
export { createFTSDatabase, type FTSDatabase, type FTSFactoryOptions } from './db/fts-factory.js';
```

### Success Criteria:

#### Automated Verification:
- [ ] Build succeeds: `npm run build`
- [ ] TypeScript compilation has no errors
- [ ] New files exist at expected paths

#### Manual Verification:
- [ ] With a local PostgreSQL instance, `createFTSDatabase({ type: 'postgres', postgresConnectionString: '...' })` successfully connects and creates tables
- [ ] Basic CRUD operations work (upsert, search, delete)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the PostgreSQL FTS implementation works correctly before proceeding to the next phase.

---

## Phase 2: Configuration Updates

### Overview
Update the server configuration to support environment-based database selection and add PostgreSQL configuration options.

### Changes Required:

#### 1. Update Server Configuration
**File**: `packages/server/src/config.ts`
**Changes**: Add database type detection and PostgreSQL config

```typescript
// Add after existing imports
const isProduction = process.env.NODE_ENV === 'production';

// Add to config object
export const config = {
  // ... existing config ...

  // Database configuration
  database: {
    type: (process.env.DATABASE_TYPE || (isProduction ? 'postgres' : 'sqlite')) as 'sqlite' | 'postgres',
    postgres: {
      connectionString: process.env.DATABASE_URL || ''
    },
    sqlite: {
      path: process.env.SQLITE_PATH || './data/crypto_docs.db'
    }
  },

  // Update host default for production
  host: process.env.MCP_HOST || (isProduction ? '0.0.0.0' : 'localhost'),

  // ... rest of config ...
};

// Add validation for production PostgreSQL
export function validateConfig(): void {
  // ... existing validation ...

  if (config.database.type === 'postgres' && !config.database.postgres.connectionString) {
    throw new Error(
      'PostgreSQL connection string required when DATABASE_TYPE=postgres.\n' +
      'Set DATABASE_URL environment variable.'
    );
  }
}
```

#### 2. Update Server Entry Point
**File**: `packages/server/src/index.ts`
**Changes**: Use factory to create appropriate database

```typescript
// Update imports
import { VectorDB, HybridSearch, Reranker, LLMClient, WebSearchClient, listProjects, createFTSDatabase } from '@mina-docs/shared';

// Replace ftsDb initialization (around line 48)
const ftsDb = createFTSDatabase({
  type: config.database.type,
  sqlitePath: config.database.sqlite.path,
  postgresConnectionString: config.database.postgres.connectionString
});
```

#### 3. Update Environment Example
**File**: `.env.example`
**Changes**: Add PostgreSQL configuration section

```bash
# =============================================================================
# DATABASE CONFIGURATION
# =============================================================================

# Database type: sqlite (default for development) or postgres (for production/k8s)
# DATABASE_TYPE=sqlite

# PostgreSQL connection string (required when DATABASE_TYPE=postgres)
# DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require

# Qdrant Vector Database
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION=crypto_docs

# SQLite Full-Text Search Database (used when DATABASE_TYPE=sqlite)
SQLITE_PATH=./data/crypto_docs.db
```

### Success Criteria:

#### Automated Verification:
- [ ] Build succeeds: `npm run build`
- [ ] Server starts with `NODE_ENV=development`: `npm run server`
- [ ] Health check returns OK: `curl http://localhost:3000/health`

#### Manual Verification:
- [ ] Server uses SQLite when `NODE_ENV=development` (default)
- [ ] Server uses PostgreSQL when `DATABASE_TYPE=postgres` is set
- [ ] Startup logs show correct database type

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that configuration switching works correctly before proceeding to the next phase.

---

## Phase 3: Dockerization

### Overview
Create Docker configuration for building and running the server as a container.

### Changes Required:

#### 1. Create Dockerfile
**File**: `Dockerfile` (new file in root)

```dockerfile
# syntax=docker/dockerfile:1

# =============================================================================
# Stage 1: Base image with shared setup
# =============================================================================
FROM node:20-slim AS base
WORKDIR /app

# Install OpenSSL for Prisma/native modules (if needed in future)
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# =============================================================================
# Stage 2: Install dependencies
# =============================================================================
FROM base AS deps

# Copy package files for all workspaces
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/
COPY packages/scraper/package.json ./packages/scraper/

# Install all dependencies (including devDependencies for build)
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# =============================================================================
# Stage 3: Build TypeScript
# =============================================================================
FROM deps AS build

# Copy source code
COPY tsconfig.base.json ./
COPY packages/shared/ ./packages/shared/
COPY packages/server/ ./packages/server/
COPY packages/scraper/ ./packages/scraper/
COPY config/ ./config/

# Build all packages
RUN npm run build

# =============================================================================
# Stage 4: Production dependencies only
# =============================================================================
FROM base AS prod-deps

COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/

# Install production dependencies only
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --workspace=packages/shared --workspace=packages/server

# =============================================================================
# Stage 5: Production image
# =============================================================================
FROM base AS production

# Create non-root user
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs nodejs

# Copy built artifacts
COPY --from=build --chown=nodejs:nodejs /app/packages/shared/dist ./packages/shared/dist
COPY --from=build --chown=nodejs:nodejs /app/packages/server/dist ./packages/server/dist
COPY --from=build --chown=nodejs:nodejs /app/config ./config

# Copy production dependencies
COPY --from=prod-deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=prod-deps --chown=nodejs:nodejs /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=prod-deps --chown=nodejs:nodejs /app/packages/server/node_modules ./packages/server/node_modules

# Copy package.json files (needed for module resolution)
COPY --chown=nodejs:nodejs package.json ./
COPY --chown=nodejs:nodejs packages/shared/package.json ./packages/shared/
COPY --chown=nodejs:nodejs packages/server/package.json ./packages/server/

# Set environment
ENV NODE_ENV=production
ENV MCP_PORT=3000
ENV MCP_HOST=0.0.0.0

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD node -e "const http = require('http'); http.get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"

# Start server
CMD ["node", "packages/server/dist/index.js"]
```

#### 2. Create .dockerignore
**File**: `.dockerignore` (new file in root)

```
# Version control
.git
.gitignore

# Docker files (prevent recursive copying)
Dockerfile*
docker-compose*.yml
.dockerignore

# Dependencies (will be installed fresh)
node_modules
packages/*/node_modules

# Build artifacts (will be built fresh)
packages/*/dist

# Environment files (secrets should come from K8s)
.env
.env.*
!.env.example

# IDE and editor files
.vscode
.idea
*.swp
*.swo
*~

# OS files
.DS_Store
Thumbs.db

# Test and coverage
coverage/
.nyc_output/

# Documentation and thoughts
*.md
!README.md
thoughts/
docs/

# Scripts not needed in container
scripts/

# Development tools
Polymarket-Copy-Trading-Bot/
examples/
evaluator/

# Puppeteer (not needed for server)
packages/scraper/

# TypeScript source (only dist needed)
packages/*/src/
tsconfig*.json

# Logs
*.log
npm-debug.log*
```

#### 3. Update docker-compose.yml for Development
**File**: `docker-compose.yml`
**Changes**: Add PostgreSQL option for local testing

```yaml
version: '3.8'

services:
  qdrant:
    image: qdrant/qdrant:latest
    ports:
      - "6333:6333"
      - "6334:6334"
    volumes:
      - qdrant_storage:/qdrant/storage
    environment:
      - QDRANT__SERVICE__GRPC_PORT=6334

  # Optional: PostgreSQL for local testing of production config
  postgres:
    image: postgres:15-alpine
    profiles:
      - postgres  # Only starts with: docker-compose --profile postgres up
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: mcp
      POSTGRES_PASSWORD: mcp_password
      POSTGRES_DB: crypto_docs
    volumes:
      - postgres_storage:/var/lib/postgresql/data

  # MCP Server (for local container testing)
  mcp-server:
    build:
      context: .
      dockerfile: Dockerfile
    profiles:
      - server  # Only starts with: docker-compose --profile server up
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_TYPE=postgres
      - DATABASE_URL=postgresql://mcp:mcp_password@postgres:5432/crypto_docs
      - QDRANT_URL=http://qdrant:6333
      - QDRANT_COLLECTION=crypto_docs
      # Add your API keys here or use env_file
    depends_on:
      - qdrant
      - postgres

volumes:
  qdrant_storage:
  postgres_storage:
```

### Success Criteria:

#### Automated Verification:
- [ ] Docker build succeeds: `docker build -t crypto-docs-mcp:test .`
- [ ] Container starts without errors: `docker run --rm crypto-docs-mcp:test`
- [ ] Image size is reasonable (< 500MB)

#### Manual Verification:
- [ ] Container health check passes after startup
- [ ] Full stack works with docker-compose: `docker-compose --profile postgres --profile server up`
- [ ] MCP endpoint responds: `curl http://localhost:3000/health`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that the Docker build and local container deployment work correctly before proceeding to the next phase.

---

## Phase 4: Kubernetes Manifests

### Overview
Create Kubernetes manifest files for deploying the server to AKS.

### Changes Required:

#### 1. Create Kubernetes Directory Structure
**Directory**: `k8s/` (new directory in root)

```
k8s/
├── namespace.yaml
├── configmap.yaml
├── secrets.yaml.template
├── deployment.yaml
├── service.yaml
└── kustomization.yaml
```

#### 2. Create Namespace
**File**: `k8s/namespace.yaml`

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: crypto-docs-mcp
  labels:
    app.kubernetes.io/name: crypto-docs-mcp
    app.kubernetes.io/part-of: crypto-docs
```

#### 3. Create ConfigMap
**File**: `k8s/configmap.yaml`

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: mcp-server-config
  namespace: crypto-docs-mcp
  labels:
    app.kubernetes.io/name: mcp-server
    app.kubernetes.io/component: config
data:
  NODE_ENV: "production"
  MCP_PORT: "3000"
  MCP_HOST: "0.0.0.0"
  DATABASE_TYPE: "postgres"
  QDRANT_COLLECTION: "crypto_docs"
  LOG_LEVEL: "info"

  # LLM Configuration (non-sensitive)
  LLM_SYNTHESIS_MAX_TOKENS: "4000"
  LLM_EVALUATION_MAX_TOKENS: "2000"
  LLM_REFINEMENT_MAX_TOKENS: "4000"
  LLM_TEMPERATURE: "0.3"

  # Agentic Evaluation
  AGENTIC_EVALUATION_ENABLED: "true"
  AGENTIC_MAX_ITERATIONS: "3"
  AGENTIC_AUTO_RETURN_THRESHOLD: "85"
```

#### 4. Create Secrets Template
**File**: `k8s/secrets.yaml.template`

```yaml
# IMPORTANT: This is a template. Copy to secrets.yaml and fill in real values.
# DO NOT commit secrets.yaml to version control.
apiVersion: v1
kind: Secret
metadata:
  name: mcp-server-secrets
  namespace: crypto-docs-mcp
  labels:
    app.kubernetes.io/name: mcp-server
    app.kubernetes.io/component: secrets
type: Opaque
stringData:
  # Database connections (REQUIRED)
  DATABASE_URL: "postgresql://USER:PASSWORD@HOST:5432/DBNAME?sslmode=require"
  QDRANT_URL: "https://YOUR_QDRANT_HOST:6333"

  # LLM API Keys (at least one required)
  OPENAI_API_KEY: "sk-..."
  # ANTHROPIC_API_KEY: "sk-ant-..."
  # XAI_API_KEY: "xai-..."

  # Optional: Web search
  # TAVILY_API_KEY: "tvly-..."
```

#### 5. Create Deployment
**File**: `k8s/deployment.yaml`

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mcp-server
  namespace: crypto-docs-mcp
  labels:
    app.kubernetes.io/name: mcp-server
    app.kubernetes.io/component: server
spec:
  replicas: 2
  selector:
    matchLabels:
      app.kubernetes.io/name: mcp-server
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  template:
    metadata:
      labels:
        app.kubernetes.io/name: mcp-server
        app.kubernetes.io/component: server
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
        runAsGroup: 1001
        fsGroup: 1001

      terminationGracePeriodSeconds: 30

      # Spread across nodes for high availability
      topologySpreadConstraints:
        - maxSkew: 1
          topologyKey: kubernetes.io/hostname
          whenUnsatisfiable: ScheduleAnyway
          labelSelector:
            matchLabels:
              app.kubernetes.io/name: mcp-server

      containers:
        - name: mcp-server
          image: YOUR_ACR.azurecr.io/crypto-docs-mcp:latest
          imagePullPolicy: Always

          ports:
            - name: http
              containerPort: 3000
              protocol: TCP

          # Load config from ConfigMap and Secrets
          envFrom:
            - configMapRef:
                name: mcp-server-config
            - secretRef:
                name: mcp-server-secrets

          # Resource limits
          resources:
            requests:
              cpu: 100m
              memory: 256Mi
            limits:
              cpu: 1000m
              memory: 1Gi

          # Liveness probe - restart if not responding
          livenessProbe:
            httpGet:
              path: /health
              port: http
            initialDelaySeconds: 30
            periodSeconds: 10
            timeoutSeconds: 5
            failureThreshold: 3

          # Readiness probe - remove from service if not ready
          readinessProbe:
            httpGet:
              path: /health
              port: http
            initialDelaySeconds: 10
            periodSeconds: 5
            timeoutSeconds: 3
            failureThreshold: 3

          # Startup probe - allow time for initialization
          startupProbe:
            httpGet:
              path: /health
              port: http
            initialDelaySeconds: 5
            periodSeconds: 5
            timeoutSeconds: 5
            failureThreshold: 30

          # Graceful shutdown
          lifecycle:
            preStop:
              exec:
                command: ["/bin/sh", "-c", "sleep 5"]

      # ACR authentication (if not using managed identity)
      # imagePullSecrets:
      #   - name: acr-secret
```

#### 6. Create Service
**File**: `k8s/service.yaml`

```yaml
apiVersion: v1
kind: Service
metadata:
  name: mcp-server
  namespace: crypto-docs-mcp
  labels:
    app.kubernetes.io/name: mcp-server
    app.kubernetes.io/component: server
spec:
  type: ClusterIP
  selector:
    app.kubernetes.io/name: mcp-server
  ports:
    - name: http
      protocol: TCP
      port: 80
      targetPort: http
```

#### 7. Create Kustomization
**File**: `k8s/kustomization.yaml`

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: crypto-docs-mcp

resources:
  - namespace.yaml
  - configmap.yaml
  - deployment.yaml
  - service.yaml
  # Note: secrets.yaml must be created from template and applied separately

commonLabels:
  app.kubernetes.io/part-of: crypto-docs
  app.kubernetes.io/managed-by: kustomize
```

### Success Criteria:

#### Automated Verification:
- [ ] Kubernetes manifests are valid: `kubectl apply --dry-run=client -k k8s/`
- [ ] All YAML files pass linting

#### Manual Verification:
- [ ] With a test AKS cluster and secrets configured, `kubectl apply -k k8s/` creates all resources
- [ ] Pods start successfully: `kubectl get pods -n crypto-docs-mcp`
- [ ] Service is accessible within cluster

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that Kubernetes resources can be created (in a test namespace) before proceeding to the next phase.

---

## Phase 5: Ingress and TLS Configuration

### Overview
Configure NGINX Ingress with cert-manager for TLS termination on `mcp.crypdocs.xyz`.

### Changes Required:

#### 1. Create Ingress Directory
**Directory**: `k8s/ingress/` (new subdirectory)

```
k8s/ingress/
├── cluster-issuer.yaml
├── ingress.yaml
└── README.md
```

#### 2. Create ClusterIssuer for Let's Encrypt
**File**: `k8s/ingress/cluster-issuer.yaml`

```yaml
# ClusterIssuer for Let's Encrypt production certificates
# Prerequisites:
# 1. Install cert-manager: helm install cert-manager jetstack/cert-manager --namespace cert-manager --create-namespace --set installCRDs=true
# 2. Install NGINX Ingress: helm install ingress-nginx ingress-nginx/ingress-nginx --namespace ingress-nginx --create-namespace
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-production
spec:
  acme:
    # Production Let's Encrypt server
    server: https://acme-v02.api.letsencrypt.org/directory
    # Email for certificate notifications
    email: admin@crypdocs.xyz  # UPDATE THIS
    privateKeySecretRef:
      name: letsencrypt-production
    solvers:
      - http01:
          ingress:
            ingressClassName: nginx
            podTemplate:
              spec:
                nodeSelector:
                  "kubernetes.io/os": linux

---
# ClusterIssuer for Let's Encrypt staging (for testing)
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-staging
spec:
  acme:
    server: https://acme-staging-v02.api.letsencrypt.org/directory
    email: admin@crypdocs.xyz  # UPDATE THIS
    privateKeySecretRef:
      name: letsencrypt-staging
    solvers:
      - http01:
          ingress:
            ingressClassName: nginx
            podTemplate:
              spec:
                nodeSelector:
                  "kubernetes.io/os": linux
```

#### 3. Create Ingress Resource
**File**: `k8s/ingress/ingress.yaml`

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: mcp-server-ingress
  namespace: crypto-docs-mcp
  labels:
    app.kubernetes.io/name: mcp-server
    app.kubernetes.io/component: ingress
  annotations:
    # Use cert-manager for TLS
    cert-manager.io/cluster-issuer: "letsencrypt-production"

    # NGINX specific annotations
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"

    # CORS for browser-based MCP clients
    nginx.ingress.kubernetes.io/enable-cors: "true"
    nginx.ingress.kubernetes.io/cors-allow-origin: "*"
    nginx.ingress.kubernetes.io/cors-allow-methods: "GET, POST, OPTIONS"
    nginx.ingress.kubernetes.io/cors-allow-headers: "Content-Type"

    # Timeouts for long-running MCP requests
    nginx.ingress.kubernetes.io/proxy-connect-timeout: "60"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "300"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "300"

    # Body size for large requests
    nginx.ingress.kubernetes.io/proxy-body-size: "10m"
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - mcp.crypdocs.xyz
      secretName: mcp-server-tls
  rules:
    - host: mcp.crypdocs.xyz
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: mcp-server
                port:
                  number: 80
```

#### 4. Create Ingress README
**File**: `k8s/ingress/README.md`

```markdown
# Ingress Setup for mcp.crypdocs.xyz

## Prerequisites

### 1. Install NGINX Ingress Controller

```bash
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update

helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace \
  --set controller.service.annotations."service\.beta\.kubernetes\.io/azure-load-balancer-health-probe-request-path"=/healthz \
  --set controller.replicaCount=2
```

### 2. Install cert-manager

```bash
helm repo add jetstack https://charts.jetstack.io
helm repo update

helm install cert-manager jetstack/cert-manager \
  --namespace cert-manager \
  --create-namespace \
  --set installCRDs=true
```

### 3. Get Ingress External IP

```bash
kubectl get svc -n ingress-nginx ingress-nginx-controller -o jsonpath='{.status.loadBalancer.ingress[0].ip}'
```

### 4. Configure DNS

Create an A record in your DNS provider:
- Name: `mcp`
- Type: `A`
- Value: `<EXTERNAL_IP>` (from step 3)
- TTL: 300

For Azure DNS:
```bash
az network dns record-set a add-record \
  --resource-group YOUR_RG \
  --zone-name crypdocs.xyz \
  --record-set-name mcp \
  --ipv4-address <EXTERNAL_IP>
```

## Deployment

### 1. Apply ClusterIssuers (once per cluster)

```bash
kubectl apply -f cluster-issuer.yaml
```

### 2. Apply Ingress (after DNS is configured)

```bash
kubectl apply -f ingress.yaml
```

### 3. Verify Certificate

```bash
# Check certificate status
kubectl get certificate -n crypto-docs-mcp

# Should show READY=True after a few minutes
kubectl describe certificate mcp-server-tls -n crypto-docs-mcp
```

## Troubleshooting

### Certificate not issuing

```bash
# Check cert-manager logs
kubectl logs -n cert-manager deployment/cert-manager

# Check certificate request
kubectl get certificaterequest -n crypto-docs-mcp

# Check challenges
kubectl get challenges -n crypto-docs-mcp
```

### 502 Bad Gateway

```bash
# Check if pods are running
kubectl get pods -n crypto-docs-mcp

# Check service endpoints
kubectl get endpoints mcp-server -n crypto-docs-mcp
```
```

### Success Criteria:

#### Automated Verification:
- [ ] Ingress manifests are valid: `kubectl apply --dry-run=client -f k8s/ingress/`
- [ ] ClusterIssuer syntax is correct

#### Manual Verification:
- [ ] After full deployment, `https://mcp.crypdocs.xyz/health` returns 200 OK
- [ ] TLS certificate is valid and issued by Let's Encrypt
- [ ] HTTP requests are redirected to HTTPS
- [ ] MCP endpoint works: `curl -X POST https://mcp.crypdocs.xyz/mcp -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that the ingress and TLS are working correctly before proceeding to the next phase.

---

## Phase 6: Deployment Scripts and Documentation

### Overview
Create scripts and documentation for building, pushing, and deploying the application.

### Changes Required:

#### 1. Create Deploy Script
**File**: `scripts/deploy-k8s.sh` (new file)

```bash
#!/bin/bash
set -euo pipefail

# =============================================================================
# Kubernetes Deployment Script for crypto-docs-mcp
# =============================================================================

# Configuration
ACR_NAME="${ACR_NAME:-}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
NAMESPACE="crypto-docs-mcp"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# =============================================================================
# Validation
# =============================================================================

if [ -z "$ACR_NAME" ]; then
    log_error "ACR_NAME environment variable is required"
    echo "Usage: ACR_NAME=myacr ./scripts/deploy-k8s.sh"
    exit 1
fi

if ! command -v kubectl &> /dev/null; then
    log_error "kubectl is not installed"
    exit 1
fi

if ! command -v az &> /dev/null; then
    log_error "Azure CLI is not installed"
    exit 1
fi

# =============================================================================
# Build and Push Docker Image
# =============================================================================

log_info "Building Docker image..."
docker build -t ${ACR_NAME}.azurecr.io/crypto-docs-mcp:${IMAGE_TAG} .

log_info "Logging into ACR..."
az acr login --name ${ACR_NAME}

log_info "Pushing image to ACR..."
docker push ${ACR_NAME}.azurecr.io/crypto-docs-mcp:${IMAGE_TAG}

# =============================================================================
# Update Deployment Image
# =============================================================================

log_info "Updating deployment image reference..."
# Create a temporary file with the correct image
sed "s|YOUR_ACR.azurecr.io/crypto-docs-mcp:latest|${ACR_NAME}.azurecr.io/crypto-docs-mcp:${IMAGE_TAG}|g" \
    k8s/deployment.yaml > /tmp/deployment-updated.yaml

# =============================================================================
# Apply Kubernetes Resources
# =============================================================================

log_info "Applying Kubernetes resources..."

# Apply base resources
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f /tmp/deployment-updated.yaml
kubectl apply -f k8s/service.yaml

# Check if secrets exist, remind user if not
if ! kubectl get secret mcp-server-secrets -n ${NAMESPACE} &> /dev/null; then
    log_warn "Secrets not found. Please create from template:"
    echo "  1. Copy k8s/secrets.yaml.template to k8s/secrets.yaml"
    echo "  2. Fill in the actual values"
    echo "  3. Run: kubectl apply -f k8s/secrets.yaml"
fi

# =============================================================================
# Wait for Deployment
# =============================================================================

log_info "Waiting for deployment to be ready..."
kubectl rollout status deployment/mcp-server -n ${NAMESPACE} --timeout=300s

# =============================================================================
# Verify
# =============================================================================

log_info "Deployment complete! Checking status..."
kubectl get pods -n ${NAMESPACE}
kubectl get svc -n ${NAMESPACE}

log_info "To apply ingress (after DNS is configured):"
echo "  kubectl apply -f k8s/ingress/"

# Cleanup
rm -f /tmp/deployment-updated.yaml
```

#### 2. Create Local Development Script
**File**: `scripts/dev-postgres.sh` (new file)

```bash
#!/bin/bash
set -euo pipefail

# =============================================================================
# Local Development with PostgreSQL
# =============================================================================
# This script starts Qdrant and PostgreSQL for local development testing
# of the production database configuration.

echo "Starting Qdrant and PostgreSQL..."
docker-compose --profile postgres up -d

echo ""
echo "Waiting for services to be ready..."
sleep 5

echo ""
echo "Services are ready. Set these environment variables:"
echo ""
echo "export DATABASE_TYPE=postgres"
echo "export DATABASE_URL=postgresql://mcp:mcp_password@localhost:5432/crypto_docs"
echo "export QDRANT_URL=http://localhost:6333"
echo ""
echo "Then run: npm run dev:server"
echo ""
echo "To stop services: docker-compose --profile postgres down"
```

#### 3. Update Package.json Scripts
**File**: `package.json`
**Changes**: Add deployment scripts

```json
{
  "scripts": {
    // ... existing scripts ...
    "docker:build": "docker build -t crypto-docs-mcp:local .",
    "docker:run": "docker run --rm -p 3000:3000 --env-file .env crypto-docs-mcp:local",
    "deploy:k8s": "./scripts/deploy-k8s.sh",
    "dev:postgres": "./scripts/dev-postgres.sh"
  }
}
```

#### 4. Update .gitignore
**File**: `.gitignore`
**Changes**: Add Kubernetes secrets

```
# Kubernetes secrets (never commit)
k8s/secrets.yaml
```

#### 5. Create Deployment Documentation
**File**: `k8s/README.md` (new file)

```markdown
# Kubernetes Deployment Guide

This guide covers deploying crypto-docs-mcp to Azure Kubernetes Service (AKS).

## Prerequisites

1. **Azure CLI** installed and logged in
2. **kubectl** configured for your AKS cluster
3. **Docker** for building images
4. **Azure Container Registry (ACR)** created

### AKS Cluster Setup (if needed)

```bash
# Create resource group
az group create --name crypto-docs-rg --location eastus

# Create ACR
az acr create --name cryptodocsacr --resource-group crypto-docs-rg --sku Basic

# Create AKS cluster with ACR integration
az aks create \
  --resource-group crypto-docs-rg \
  --name crypto-docs-aks \
  --node-count 2 \
  --attach-acr cryptodocsacr \
  --generate-ssh-keys

# Get credentials
az aks get-credentials --resource-group crypto-docs-rg --name crypto-docs-aks
```

## Deployment Steps

### 1. Configure Secrets

```bash
# Copy template
cp k8s/secrets.yaml.template k8s/secrets.yaml

# Edit with your values
# - DATABASE_URL: Your PostgreSQL connection string
# - QDRANT_URL: Your Qdrant instance URL
# - OPENAI_API_KEY or other LLM API keys
```

### 2. Apply Secrets

```bash
kubectl apply -f k8s/secrets.yaml
```

### 3. Deploy Application

```bash
# Set your ACR name
export ACR_NAME=cryptodocsacr

# Build, push, and deploy
./scripts/deploy-k8s.sh
```

### 4. Configure Ingress (optional, for public access)

See [k8s/ingress/README.md](ingress/README.md) for instructions.

## Verifying Deployment

```bash
# Check pods
kubectl get pods -n crypto-docs-mcp

# Check logs
kubectl logs -n crypto-docs-mcp deployment/mcp-server

# Port-forward for local testing
kubectl port-forward -n crypto-docs-mcp svc/mcp-server 3000:80

# Test health endpoint
curl http://localhost:3000/health
```

## Updating

To update to a new version:

```bash
export ACR_NAME=cryptodocsacr
export IMAGE_TAG=v1.1.0  # or new version
./scripts/deploy-k8s.sh
```

## Troubleshooting

### Pods not starting

```bash
# Describe pod for events
kubectl describe pod -n crypto-docs-mcp <pod-name>

# Check logs
kubectl logs -n crypto-docs-mcp <pod-name>
```

### Database connection errors

1. Verify DATABASE_URL in secrets is correct
2. Ensure PostgreSQL allows connections from AKS cluster IP
3. Check SSL mode in connection string

### Qdrant connection errors

1. Verify QDRANT_URL in secrets is correct
2. Ensure Qdrant allows connections from AKS cluster IP
```

### Success Criteria:

#### Automated Verification:
- [ ] Scripts have execute permission: `chmod +x scripts/deploy-k8s.sh scripts/dev-postgres.sh`
- [ ] Scripts pass shellcheck: `shellcheck scripts/*.sh`

#### Manual Verification:
- [ ] Full deployment works end-to-end with a test AKS cluster
- [ ] `https://mcp.crypdocs.xyz/health` returns 200 OK
- [ ] MCP tools work correctly
- [ ] Local development still works with SQLite (unchanged)

**Implementation Note**: This is the final phase. After completing all verification, the deployment should be fully functional.

---

## Testing Strategy

### Unit Tests:
- Test PostgreSQL FTS implementation with test database
- Test database factory returns correct implementation based on config

### Integration Tests:
- Docker build produces working image
- Container starts and health check passes
- Kubernetes manifests create valid resources

### Manual Testing Steps:
1. Build and run Docker container locally
2. Test with docker-compose PostgreSQL setup
3. Deploy to test AKS cluster
4. Verify health endpoint and MCP tools
5. Test TLS certificate issuance
6. Verify public access via custom domain

## Performance Considerations

- **Replica Count**: Starting with 2 replicas for high availability
- **Resource Limits**: Conservative limits (1 CPU, 1GB RAM) to start, adjust based on monitoring
- **Connection Pooling**: PostgreSQL connection pool is managed by `pg.Pool`
- **Startup Time**: Startup probe allows up to 150 seconds for initialization

## Migration Notes

No data migration is needed since:
- Qdrant data remains in external Qdrant instance
- PostgreSQL is a fresh deployment (no existing data to migrate)
- SQLite remains for local development (unchanged)

## References

- Current server configuration: `packages/server/src/config.ts`
- Current FTS implementation: `packages/shared/src/db/fts.ts`
- Express transport: `packages/server/src/transport.ts`
- AKS documentation: https://learn.microsoft.com/en-us/azure/aks/
- cert-manager: https://cert-manager.io/docs/
- NGINX Ingress: https://kubernetes.github.io/ingress-nginx/
