export type SearchConsoleConnectionStatus = 'connected' | 'failed' | 'disconnected';
export type SearchConsolePropertyPermissionLevel =
  | 'siteOwner'
  | 'siteFullUser'
  | 'siteRestrictedUser'
  | 'siteUnverifiedUser';

export interface SearchConsolePropertySummary {
  siteUrl: string;
  permissionLevel: SearchConsolePropertyPermissionLevel | string;
}

export interface ProjectSearchConsoleState {
  connectionId: string;
  status: SearchConsoleConnectionStatus;
  selectedPropertyUrl: string | null;
  availableProperties: SearchConsolePropertySummary[];
  connectedAt: number | null;
  updatedAt: number;
  lastSyncedAt: number | null;
  lastError: string | null;
}

export interface SearchConsoleConnectionRecord {
  id: string;
  projectId: string;
  userId: string;
  refreshTokenEncrypted: string;
  scope: string;
  tokenType: string | null;
  status: SearchConsoleConnectionStatus;
  selectedPropertyUrl: string | null;
  availableProperties: SearchConsolePropertySummary[];
  connectedAt: string;
  updatedAt: string;
  lastError: string | null;
}

export interface SearchConsoleConnectRequestBody {
  projectId: string;
  returnTo?: string;
}

export interface SearchConsoleConnectResponse {
  ok: true;
  authorizationUrl: string;
}

export interface SearchConsoleSitesQuery {
  projectId: string;
}

export interface SearchConsoleSitesResponse {
  ok: true;
  items: SearchConsolePropertySummary[];
  selectedPropertyUrl: string | null;
  lastSyncedAt: number | null;
}

export interface SearchConsoleSelectPropertyRequestBody {
  projectId: string;
  propertyUrl: string;
}

export interface SearchConsoleSelectPropertyResponse {
  ok: true;
  selectedPropertyUrl: string;
}