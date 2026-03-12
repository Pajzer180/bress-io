import 'server-only';

import type {
  SearchConsoleConnectionRecord,
  SearchConsolePropertySummary,
} from '@/types/searchConsole';

export const GOOGLE_OAUTH_AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const GOOGLE_SEARCH_CONSOLE_SITES_URL = 'https://www.googleapis.com/webmasters/v3/sites';
export const SEARCH_CONSOLE_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
export const SEARCH_CONSOLE_STATE_MAX_AGE_MS = 10 * 60 * 1000;
export const DEFAULT_SEARCH_CONSOLE_RETURN_TO = '/dashboard/analityka';
export const SEARCH_CONSOLE_OAUTH_STATES_COLLECTION = 'search_console_oauth_states';

export interface SearchConsoleConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface SearchConsoleOAuthStateRecord {
  uid: string;
  projectId: string;
  returnTo: string;
  createdAt: string;
  expiresAt: string;
}

export interface SearchConsoleStoredOAuthState extends SearchConsoleOAuthStateRecord {
  token: string;
}

export interface GoogleTokenResponse {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
}

export interface GoogleSitesListResponse {
  siteEntry?: Array<{
    siteUrl?: string;
    permissionLevel?: string;
  }>;
}

export interface StartSearchConsoleConnectionArgs {
  uid: string;
  projectId: string;
  returnTo?: string;
}

export interface SearchConsoleCallbackArgs {
  code: string | null;
  error: string | null;
  state: string;
}

export interface SearchConsoleCallbackResult {
  returnTo: string;
  status: 'connected' | 'error';
  reason?: string;
}

export interface JsonRequestOptions {
  url: string;
  method: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: BodyInit;
  errorCode: string;
  errorMessage: string;
}

export interface PersistConnectedSearchConsoleConnectionArgs {
  projectId: string;
  userId: string;
  refreshTokenEncrypted: string;
  scope: string;
  tokenType: string | null;
  availableProperties: SearchConsolePropertySummary[];
  selectedPropertyUrl: string | null;
}

export interface SearchConsoleSitesResult {
  items: SearchConsolePropertySummary[];
  selectedPropertyUrl: string | null;
  lastSyncedAt: number | null;
}

export interface SearchConsoleProjectRecord {
  id: string;
  uid: string;
  domain: string;
  searchConsole?: {
    selectedPropertyUrl: string | null;
  } | null;
}

export interface SearchConsoleConnectionSnapshot {
  project: SearchConsoleProjectRecord;
  connection: SearchConsoleConnectionRecord;
}