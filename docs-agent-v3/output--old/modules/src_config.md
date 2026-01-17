# src.config

Of course. Here is the comprehensive documentation for the `src.config` module, based on the provided analysis.

***

## src.config

### Overview

This module is the application's central configuration hub. Its primary responsibility is to load environment variables from the host system (e.g., a `.env` file or system environment), parse them into appropriate data types, and validate them against a strict schema. The final output is a single, type-safe, and immutable `config` object that serves as the single source of truth for all environment-dependent settings.

### Key Components

*   **`config` (singleton object)**
    The primary and sole public export of this module. It is an immutable object generated at application startup that contains all parsed and validated configuration values. The rest of the application should import and consume this object directly.

*   **`validateConfig(config)`**
    An internal function that enforces the configuration schema. It checks for the presence of required variables, validates their types (e.g., ensuring a port is a valid number), and can enforce complex rules (e.g., a URL must be well-formed). If validation fails, the application will throw a descriptive error and exit, preventing it from running in a misconfigured state.

*   **`getEnv*` Helper Functions**
    A family of internal utility functions (`getEnvVar`, `getEnvNumber`, `getEnvBoolean`, `getEnvDecimal`) responsible for the low-level work of reading a single variable from `process.env` and coercing it from a string into the correct data type. They handle logic for default values and basic parsing before the values are passed to the validator.

### Usage

To use the configuration module, you simply import the `config` object into any file that requires access to environment variables. The module guarantees that if the application is running, the `config` object is fully populated and valid.

#### **1. Define Environment Variables**

First, create a `.env` file in the root of your project.

**.env**
```env
# Server Configuration
NODE_ENV=development
PORT=8080

# Database Configuration
DATABASE_URL="postgresql://user:password@localhost:5432/mydatabase"

# Feature Flags
ENABLE_AUDIT_LOGS=true

# Financials - using a string to be parsed as a Decimal
TRANSACTION_FEE_RATE="0.025"
```

#### **2. Consume the `config` Object**

In any other part of your application, such as your main server file, import and use the `config` object.

**src/server.ts**
```typescript
import { createServer } from 'http';
import { config } from './config/env'; // Adjust path as needed
import { connectToDatabase } from './database';

// Use configuration values to initialize parts of the application
const initializeApp = async () => {
  console.log(`Application starting in ${config.NODE_ENV} mode.`);

  // Connect to the database using the validated URL
  await connectToDatabase(config.DATABASE_URL);
  console.log('Database connection established.');

  const server = createServer((req, res) => {
    // Example of using a config value in request logic
    if (config.ENABLE_AUDIT_LOGS) {
      console.log(`[AUDIT] Request received for: ${req.url}`);
    }
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Server is running!');
  });

  server.listen(config.PORT, () => {
    console.log(`Server listening on http://localhost:${config.PORT}`);
    console.log(`Transaction fee rate is set to: ${config.TRANSACTION_FEE_RATE.toString()}`);
  });
};

initializeApp().catch(error => {
  console.error('Failed to initialize application:', error);
  process.exit(1);
});
```

### API Reference

#### **`config`**

The validated and strongly-typed configuration object. This object is frozen after initialization to prevent runtime modifications. Its properties directly correspond to the environment variables defined in the module's validation schema.

*   **Type**: `object` (inferred from the validation schema, e.g., `z.infer<typeof configSchema>`)
*   **Description**: A singleton object containing all application configuration. It is the result of loading, parsing, and validating all environment variables.

##### **Example Properties**

Based on the usage example above, the `config` object would have the following properties and types:

*   `NODE_ENV: 'development' | 'production' | 'test'`
*   `PORT: number`
*   `DATABASE_URL: string`
*   `ENABLE_AUDIT_LOGS: boolean`
*   `TRANSACTION_FEE_RATE: Decimal`

---

*Note: The following functions are internal to the `src.config` module and are not part of its public API. They are documented here for completeness.*

#### `getEnvVar(name: string, defaultValue?: string): string`
Retrieves a string environment variable. Throws an error if the variable is not set and no default is provided.

#### `getEnvNumber(name: string, defaultValue?: number): number`
Retrieves and parses an environment variable as an integer.

#### `getEnvBoolean(name: string, defaultValue?: boolean): boolean`
Retrieves and parses an environment variable as a boolean (handles "true", "false", "1", "0").

#### `getEnvDecimal(name: string, defaultValue?: Decimal): Decimal`


