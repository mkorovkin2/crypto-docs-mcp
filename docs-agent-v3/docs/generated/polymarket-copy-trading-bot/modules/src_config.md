# src.config

Of course. Here is the comprehensive documentation for the `src.config` module.

---

## src.config

### Overview

The `src.config` module is the application's central authority for configuration management. It loads settings from environment variables, parses them into strongly-typed values (numbers, booleans, etc.), and validates their presence and correctness at startup. This ensures that the application has a reliable and type-safe configuration object, preventing runtime errors from missing or invalid environment variables.

### Key Components

*   **`config`** (constant): The primary export of the module. This is a frozen, validated object containing all application configuration settings. It serves as the single source of truth for the rest of the application.
*   **`getEnvVar(name: string, fallback?: string): string`**: An internal helper function to retrieve a string environment variable. It throws an error if the variable is not set and no fallback is provided.
*   **`getEnvNumber(name: string, fallback?: number): number`**: An internal helper to retrieve and parse an environment variable as an integer.
*   **`getEnvDecimal(name: string, fallback?: number): number`**: An internal helper to retrieve and parse an environment variable as a floating-point number.
*   **`getEnvBoolean(name: string, fallback?: boolean): boolean`**: An internal helper that parses an environment variable into a boolean. It typically interprets `"true"` as `true` and everything else as `false`.
*   **`validateConfig(config: object): void`**: A crucial internal function that runs at application startup. It takes the raw, parsed configuration object and validates it against a predefined schema, ensuring all required fields are present and correctly typed.

### Usage

The module is designed for simple consumption. Any part of the application that needs access to configuration settings can import the `config` object directly. The validation logic runs automatically when the module is first imported, guaranteeing that the application will fail fast if the environment is misconfigured.

**Example: Initializing a web server**
```typescript
// src/server.ts
import { config } from './config/env';
import { createApp } from './app';

const app = createApp();
const PORT = config.PORT;

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Current environment: ${config.NODE_ENV}`);
});
```

**Example: Setting up a database connection**
```typescript
// src/database/connection.ts
import { Pool } from 'pg';
import { config } from '../config/env';

// The config object provides the validated, type-safe connection string.
const pool = new Pool({
  connectionString: config.DATABASE_URL,
});

export default pool;
```

### API Reference

The public API consists of a single exported constant.

#### `config`
A read-only object containing all parsed and validated application configuration variables.

**Type:** `Readonly<AppConfig>` (where `AppConfig` is an internal interface defining the configuration shape)

**Properties:**
The properties available on the `config` object are derived from the environment variables defined for the application. Common properties include:

| Property             | Type                                       | Description                                                              | Example Env Var         |
| -------------------- | ------------------------------------------ | ------------------------------------------------------------------------ | ----------------------- |
| `NODE_ENV`           | `'development' \| 'production' \| 'test'`  | The runtime environment of the application.                              | `NODE_ENV=development`  |
| `PORT`               | `number`                                   | The port number on which the server should listen.                       | `PORT=8080`             |
| `DATABASE_URL`       | `string`                                   | The full connection string for the primary database.                     | `DATABASE_URL=...`      |
| `LOG_LEVEL`          | `string`                                   | The configured level for application logging (e.g., 'info', 'debug').    | `LOG_LEVEL=info`        |
| `ENABLE_FEATURE_X`   | `boolean`                                  | A feature flag, parsed as a boolean.                                     | `ENABLE_FEATURE_X=true` |

### Dependencies

*   **Node.js `process.env`**: The module directly reads from the global `process.env` object to source its configuration values.
*   **(Implied) `dotenv`**: While not explicitly listed, a module like this typically uses the `dotenv` library to load environment variables from a `.env` file during local development. This allows developers to manage configuration without setting system-level environment variables.

