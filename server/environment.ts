import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';

// Deployment environment values take precedence; .env is an optional local convenience.
export function loadEnvironment() {
  if (existsSync('.env')) loadEnvFile('.env');
}
