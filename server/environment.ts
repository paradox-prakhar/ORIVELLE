import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';

// Deployment environment values take precedence; .env.local and .env are optional local conveniences.
export function loadEnvironment() {
  if (existsSync('.env.local')) loadEnvFile('.env.local');
  if (existsSync('.env')) loadEnvFile('.env');
}
