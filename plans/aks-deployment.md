# MCP Server AKS Deployment Plan

## Overview

This document outlines the deployment strategy for the Crypto Documentation MCP Server to Azure Kubernetes Service (AKS) with proper load balancing and minimal exposed permissions.

### Server Summary

| Property | Value |
|----------|-------|
| Application | Express.js HTTP server |
| Port | 3000 (configurable via `MCP_PORT`) |
| Endpoints | `/health` (GET), `/mcp` (POST), `/mcp/events` (SSE) |
| Runtime | Node.js 18+ |
| External Dependencies | Qdrant (vector DB), SQLite (FTS), LLM APIs |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Azure Cloud                               │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    AKS Cluster                             │  │
│  │                                                            │  │
│  │  ┌──────────────┐    ┌──────────────────────────────────┐ │  │
│  │  │   Azure      │    │      mcp-server namespace        │ │  │
│  │  │   Load       │───▶│  ┌────────────────────────────┐  │ │  │
│  │  │   Balancer   │    │  │   MCP Server Deployment    │  │ │  │
│  │  └──────────────┘    │  │   (2+ replicas)            │  │ │  │
│  │                      │  │   - Non-root container     │  │ │  │
│  │                      │  │   - Read-only rootfs       │  │ │  │
│  │                      │  │   - Resource limits        │  │ │  │
│  │                      │  └─────────────┬──────────────┘  │ │  │
│  │                      │                │                  │ │  │
│  │                      │                ▼                  │ │  │
│  │                      │  ┌────────────────────────────┐  │ │  │
│  │                      │  │   Qdrant StatefulSet       │  │ │  │
│  │                      │  │   - Persistent storage     │  │ │  │
│  │                      │  │   - Internal service only  │  │ │  │
│  │                      │  └────────────────────────────┘  │ │  │
│  │                      │                                   │ │  │
│  │                      │  ┌────────────────────────────┐  │ │  │
│  │                      │  │   Azure Key Vault CSI      │  │ │  │
│  │                      │  │   - API keys mounted       │  │ │  │
│  │                      │  └────────────────────────────┘  │ │  │
│  │                      └──────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  External APIs: OpenAI, Anthropic, Tavily (egress only)         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Components

### 1. Dockerfile

Create `/Dockerfile` for the MCP server:

```dockerfile
# =============================================================================
# Stage 1: Build
# =============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files for dependency installation
COPY package*.json ./
COPY packages/shared/package*.json packages/shared/
COPY packages/server/package*.json packages/server/

# Install dependencies
RUN npm ci

# Copy source code
COPY packages/shared/ packages/shared/
COPY packages/server/ packages/server/
COPY config/ config/
COPY tsconfig*.json ./

# Build TypeScript
RUN npm run build --workspace=packages/shared --workspace=packages/server

# Prune dev dependencies
RUN npm prune --production

# =============================================================================
# Stage 2: Runtime
# =============================================================================
FROM node:20-alpine AS runtime

WORKDIR /app

# Security: Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

# Install runtime dependencies only
RUN apk add --no-cache tini

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder --chown=nodejs:nodejs /app/packages/shared/package.json ./packages/shared/
COPY --from=builder --chown=nodejs:nodejs /app/packages/server/dist ./packages/server/dist
COPY --from=builder --chown=nodejs:nodejs /app/packages/server/package.json ./packages/server/
COPY --from=builder --chown=nodejs:nodejs /app/config ./config
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./

# Create data directory for SQLite
RUN mkdir -p /app/data && chown nodejs:nodejs /app/data

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Use tini for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "packages/server/dist/index.js"]
```

### 2. Kubernetes Manifests

#### Directory Structure

```
k8s/
├── base/
│   ├── kustomization.yaml
│   ├── namespace.yaml
│   ├── serviceaccount.yaml
│   ├── configmap.yaml
│   ├── secret.yaml
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── pvc.yaml
│   ├── networkpolicy.yaml
│   └── pdb.yaml
├── qdrant/
│   ├── kustomization.yaml
│   ├── statefulset.yaml
│   ├── service.yaml
│   └── pvc.yaml
└── overlays/
    ├── dev/
    │   ├── kustomization.yaml
    │   └── patches/
    └── prod/
        ├── kustomization.yaml
        └── patches/
```

---

## Kubernetes Manifests (Detailed)

### Namespace

```yaml
# k8s/base/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: mcp-server
  labels:
    app.kubernetes.io/name: mcp-server
    app.kubernetes.io/component: namespace
    # Enable Pod Security Standards
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
```

### ServiceAccount (Minimal Permissions)

```yaml
# k8s/base/serviceaccount.yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: mcp-server
  namespace: mcp-server
  labels:
    app.kubernetes.io/name: mcp-server
automountServiceAccountToken: false  # No K8s API access needed
```

### ConfigMap (Non-Sensitive Config)

```yaml
# k8s/base/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: mcp-server-config
  namespace: mcp-server
data:
  MCP_PORT: "3000"
  MCP_HOST: "0.0.0.0"

  # Database
  QDRANT_URL: "http://qdrant.mcp-server.svc.cluster.local:6333"
  QDRANT_COLLECTION: "crypto_docs"
  SQLITE_PATH: "/app/data/crypto_docs.db"

  # LLM Configuration
  LLM_SYNTHESIS_MODEL: "gpt-4.1"
  LLM_EVALUATION_MODEL: "gpt-4.1-mini"
  LLM_REFINEMENT_MODEL: "gpt-4.1"
  LLM_ANALYZER_MODEL: "gpt-4.1-mini"
  LLM_MAX_TOKENS: "4000"
  LLM_TEMPERATURE: "0.3"

  # Agentic Evaluation
  AGENTIC_EVALUATION_ENABLED: "true"
  AGENTIC_MAX_ITERATIONS: "3"
  AGENTIC_AUTO_RETURN_THRESHOLD: "85"

  # Response
  MCP_RESPONSE_METADATA: "true"
```

### Secret (API Keys)

```yaml
# k8s/base/secret.yaml
# NOTE: In production, use Azure Key Vault CSI driver or sealed-secrets
# This is a template - do NOT commit actual secrets
apiVersion: v1
kind: Secret
metadata:
  name: mcp-server-secrets
  namespace: mcp-server
type: Opaque
stringData:
  OPENAI_API_KEY: "${OPENAI_API_KEY}"
  ANTHROPIC_API_KEY: "${ANTHROPIC_API_KEY}"
  TAVILY_API_KEY: "${TAVILY_API_KEY}"
  # Add other API keys as needed
```

### Deployment

```yaml
# k8s/base/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mcp-server
  namespace: mcp-server
  labels:
    app.kubernetes.io/name: mcp-server
    app.kubernetes.io/component: server
spec:
  replicas: 2
  selector:
    matchLabels:
      app.kubernetes.io/name: mcp-server
  template:
    metadata:
      labels:
        app.kubernetes.io/name: mcp-server
    spec:
      serviceAccountName: mcp-server

      # Security Context (Pod-level)
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
        runAsGroup: 1001
        fsGroup: 1001
        seccompProfile:
          type: RuntimeDefault

      containers:
        - name: mcp-server
          image: ${ACR_NAME}.azurecr.io/mcp-server:${TAG}
          imagePullPolicy: Always

          ports:
            - name: http
              containerPort: 3000
              protocol: TCP

          # Security Context (Container-level)
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities:
              drop:
                - ALL

          # Environment from ConfigMap
          envFrom:
            - configMapRef:
                name: mcp-server-config
            - secretRef:
                name: mcp-server-secrets

          # Resource Limits
          resources:
            requests:
              cpu: "250m"
              memory: "512Mi"
            limits:
              cpu: "1000m"
              memory: "2Gi"

          # Health Probes
          readinessProbe:
            httpGet:
              path: /health
              port: http
            initialDelaySeconds: 10
            periodSeconds: 10
            timeoutSeconds: 5
            failureThreshold: 3

          livenessProbe:
            httpGet:
              path: /health
              port: http
            initialDelaySeconds: 30
            periodSeconds: 30
            timeoutSeconds: 5
            failureThreshold: 3

          # Volume Mounts
          volumeMounts:
            - name: data
              mountPath: /app/data
            - name: tmp
              mountPath: /tmp

      volumes:
        - name: data
          persistentVolumeClaim:
            claimName: mcp-server-data
        - name: tmp
          emptyDir: {}

      # Anti-affinity for HA
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
            - weight: 100
              podAffinityTerm:
                labelSelector:
                  matchLabels:
                    app.kubernetes.io/name: mcp-server
                topologyKey: kubernetes.io/hostname
```

### Service (Load Balancer)

```yaml
# k8s/base/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: mcp-server
  namespace: mcp-server
  labels:
    app.kubernetes.io/name: mcp-server
  annotations:
    # Azure Load Balancer Configuration
    service.beta.kubernetes.io/azure-load-balancer-internal: "false"
    # For internal-only: set to "true"

    # Optional: Specify static IP
    # service.beta.kubernetes.io/azure-load-balancer-ipv4: "x.x.x.x"

    # Optional: Health probe configuration
    service.beta.kubernetes.io/azure-load-balancer-health-probe-request-path: "/health"
spec:
  type: LoadBalancer
  selector:
    app.kubernetes.io/name: mcp-server
  ports:
    - name: http
      port: 80
      targetPort: 3000
      protocol: TCP
  sessionAffinity: None
```

### PersistentVolumeClaim

```yaml
# k8s/base/pvc.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: mcp-server-data
  namespace: mcp-server
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: managed-csi  # Azure Disk CSI
  resources:
    requests:
      storage: 10Gi
```

### NetworkPolicy (Minimal Permissions)

```yaml
# k8s/base/networkpolicy.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: mcp-server-network-policy
  namespace: mcp-server
spec:
  podSelector:
    matchLabels:
      app.kubernetes.io/name: mcp-server
  policyTypes:
    - Ingress
    - Egress

  ingress:
    # Allow traffic from Azure Load Balancer
    - from: []  # Any source (LB health checks + client traffic)
      ports:
        - protocol: TCP
          port: 3000

  egress:
    # Allow DNS resolution
    - to:
        - namespaceSelector: {}
          podSelector:
            matchLabels:
              k8s-app: kube-dns
      ports:
        - protocol: UDP
          port: 53

    # Allow Qdrant (internal)
    - to:
        - podSelector:
            matchLabels:
              app.kubernetes.io/name: qdrant
      ports:
        - protocol: TCP
          port: 6333

    # Allow external HTTPS (LLM APIs, Tavily)
    - to:
        - ipBlock:
            cidr: 0.0.0.0/0
            except:
              - 10.0.0.0/8
              - 172.16.0.0/12
              - 192.168.0.0/16
      ports:
        - protocol: TCP
          port: 443
```

### PodDisruptionBudget

```yaml
# k8s/base/pdb.yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: mcp-server-pdb
  namespace: mcp-server
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: mcp-server
```

### Kustomization

```yaml
# k8s/base/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: mcp-server

resources:
  - namespace.yaml
  - serviceaccount.yaml
  - configmap.yaml
  - secret.yaml
  - pvc.yaml
  - deployment.yaml
  - service.yaml
  - networkpolicy.yaml
  - pdb.yaml

commonLabels:
  app.kubernetes.io/part-of: crypto-docs-mcp
  app.kubernetes.io/managed-by: kustomize
```

---

## Qdrant Deployment

### StatefulSet

```yaml
# k8s/qdrant/statefulset.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: qdrant
  namespace: mcp-server
spec:
  serviceName: qdrant
  replicas: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: qdrant
  template:
    metadata:
      labels:
        app.kubernetes.io/name: qdrant
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        fsGroup: 1000

      containers:
        - name: qdrant
          image: qdrant/qdrant:v1.12.0

          ports:
            - name: http
              containerPort: 6333
            - name: grpc
              containerPort: 6334

          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities:
              drop:
                - ALL

          resources:
            requests:
              cpu: "250m"
              memory: "1Gi"
            limits:
              cpu: "1000m"
              memory: "4Gi"

          volumeMounts:
            - name: qdrant-storage
              mountPath: /qdrant/storage
            - name: tmp
              mountPath: /tmp

          readinessProbe:
            httpGet:
              path: /readyz
              port: 6333
            initialDelaySeconds: 5
            periodSeconds: 10

          livenessProbe:
            httpGet:
              path: /livez
              port: 6333
            initialDelaySeconds: 30
            periodSeconds: 30

      volumes:
        - name: tmp
          emptyDir: {}

  volumeClaimTemplates:
    - metadata:
        name: qdrant-storage
      spec:
        accessModes: ["ReadWriteOnce"]
        storageClassName: managed-csi
        resources:
          requests:
            storage: 50Gi
```

### Qdrant Service (Internal Only)

```yaml
# k8s/qdrant/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: qdrant
  namespace: mcp-server
spec:
  type: ClusterIP  # Internal only
  selector:
    app.kubernetes.io/name: qdrant
  ports:
    - name: http
      port: 6333
      targetPort: 6333
    - name: grpc
      port: 6334
      targetPort: 6334
```

### Qdrant NetworkPolicy

```yaml
# k8s/qdrant/networkpolicy.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: qdrant-network-policy
  namespace: mcp-server
spec:
  podSelector:
    matchLabels:
      app.kubernetes.io/name: qdrant
  policyTypes:
    - Ingress
    - Egress

  ingress:
    # Only allow from MCP server
    - from:
        - podSelector:
            matchLabels:
              app.kubernetes.io/name: mcp-server
      ports:
        - protocol: TCP
          port: 6333
        - protocol: TCP
          port: 6334

  egress:
    # DNS only
    - to:
        - namespaceSelector: {}
          podSelector:
            matchLabels:
              k8s-app: kube-dns
      ports:
        - protocol: UDP
          port: 53
```

---

## Security Summary

### Principle of Least Privilege

| Layer | Security Measure | Implementation |
|-------|------------------|----------------|
| **Namespace** | Pod Security Standards | `pod-security.kubernetes.io/enforce: restricted` |
| **ServiceAccount** | No API access | `automountServiceAccountToken: false` |
| **Pod** | Non-root execution | `runAsNonRoot: true`, `runAsUser: 1001` |
| **Container** | Read-only filesystem | `readOnlyRootFilesystem: true` |
| **Container** | No privilege escalation | `allowPrivilegeEscalation: false` |
| **Container** | Drop all capabilities | `capabilities.drop: ["ALL"]` |
| **Network** | Ingress restricted | Only port 3000 from LB |
| **Network** | Egress restricted | Only DNS, Qdrant, external HTTPS |
| **Qdrant** | Internal only | ClusterIP service, NetworkPolicy |
| **Secrets** | External management | Azure Key Vault CSI driver |

### Network Flow

```
Internet
    │
    ▼
┌─────────────────┐
│ Azure Load      │  Port 80 → 3000
│ Balancer        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ MCP Server      │  NetworkPolicy allows:
│ Pods            │  - Ingress: port 3000
└────────┬────────┘  - Egress: DNS, Qdrant:6333, HTTPS:443
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌───────┐  ┌─────────┐
│Qdrant │  │ LLM APIs│
│(6333) │  │ (HTTPS) │
└───────┘  └─────────┘
```

---

## Deployment Steps

### Prerequisites

1. **Azure CLI** authenticated
2. **kubectl** configured for AKS cluster
3. **Azure Container Registry** (ACR) created
4. **Azure Key Vault** with secrets (recommended)

### Step 1: Build and Push Docker Image

```bash
# Login to ACR
az acr login --name ${ACR_NAME}

# Build and push
docker build -t ${ACR_NAME}.azurecr.io/mcp-server:v1.0.0 .
docker push ${ACR_NAME}.azurecr.io/mcp-server:v1.0.0
```

### Step 2: Configure Secrets

**Option A: Azure Key Vault CSI Driver (Recommended)**

```bash
# Install CSI driver
az aks enable-addons --addons azure-keyvault-secrets-provider \
  --name ${AKS_CLUSTER} --resource-group ${RESOURCE_GROUP}

# Create SecretProviderClass (see Azure docs)
```

**Option B: Kubernetes Secrets**

```bash
# Create secrets from .env file
kubectl create secret generic mcp-server-secrets \
  --namespace=mcp-server \
  --from-literal=OPENAI_API_KEY=${OPENAI_API_KEY} \
  --from-literal=ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY} \
  --from-literal=TAVILY_API_KEY=${TAVILY_API_KEY}
```

### Step 3: Deploy with Kustomize

```bash
# Deploy Qdrant first
kubectl apply -k k8s/qdrant/

# Wait for Qdrant to be ready
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=qdrant \
  -n mcp-server --timeout=300s

# Deploy MCP server
kubectl apply -k k8s/base/

# Verify deployment
kubectl get pods -n mcp-server
kubectl get svc -n mcp-server
```

### Step 4: Verify

```bash
# Get Load Balancer IP
LB_IP=$(kubectl get svc mcp-server -n mcp-server -o jsonpath='{.status.loadBalancer.ingress[0].ip}')

# Health check
curl http://${LB_IP}/health

# Test MCP endpoint
curl -X POST http://${LB_IP}/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```

---

## Optional Enhancements

### TLS with Azure Application Gateway

For HTTPS termination, use Azure Application Gateway Ingress Controller:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: mcp-server-ingress
  namespace: mcp-server
  annotations:
    kubernetes.io/ingress.class: azure/application-gateway
    appgw.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  tls:
    - hosts:
        - mcp.example.com
      secretName: mcp-tls-secret
  rules:
    - host: mcp.example.com
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

### Horizontal Pod Autoscaler

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: mcp-server-hpa
  namespace: mcp-server
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: mcp-server
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

---

## Monitoring

### Recommended Azure Monitor Metrics

- Pod CPU/Memory utilization
- Request latency (p50, p95, p99)
- Error rate (5xx responses)
- Qdrant connection health
- LLM API latency

### Log Analytics Query Examples

```kusto
// Request latency by endpoint
ContainerLog
| where LogEntry contains "POST /mcp"
| parse LogEntry with * "duration=" duration:real "ms" *
| summarize p50=percentile(duration, 50), p95=percentile(duration, 95) by bin(TimeGenerated, 5m)
```

---

## Cost Considerations

| Component | SKU Recommendation | Estimated Cost |
|-----------|-------------------|----------------|
| AKS Node Pool | Standard_D4s_v3 (2 nodes) | ~$280/month |
| Azure Disk (MCP) | Premium SSD 10Gi | ~$2/month |
| Azure Disk (Qdrant) | Premium SSD 50Gi | ~$8/month |
| Load Balancer | Standard | ~$18/month |
| **Total Infrastructure** | | **~$310/month** |

*Note: LLM API costs (OpenAI, Anthropic) are usage-based and separate.*

---

## Checklist

- [ ] Create Azure Container Registry
- [ ] Build and push Docker image
- [ ] Create Azure Key Vault with API keys
- [ ] Enable Key Vault CSI driver on AKS
- [ ] Deploy Qdrant StatefulSet
- [ ] Initialize Qdrant with document embeddings
- [ ] Deploy MCP server
- [ ] Verify health endpoint
- [ ] Configure monitoring/alerting
- [ ] Set up TLS (optional)
- [ ] Configure HPA (optional)
