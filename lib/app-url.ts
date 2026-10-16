import 'server-only';
import { headers } from 'next/headers';

/** URL base do sistema (ex.: https://sgc....vercel.app), tirada da própria requisição. */
export function getAppBaseUrl(): string {
  const requestHeaders = headers();
  const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host') ?? 'localhost:3000';
  const protocol = requestHeaders.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${protocol}://${host}`;
}
