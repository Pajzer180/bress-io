import 'server-only';

import type { ProjectWordPressState } from '@/lib/snippetActions';
import { RouteError } from '@/lib/server/firebaseAuth';
import { decryptSecret, encryptSecret } from '@/lib/server/secretCrypto';
import {
  normalizeWordPressSiteUrl,
  wordpressRequest,
  WordPressApiError,
} from '@/lib/wordpress/client';
import {
  createWordPressJob,
  getWordPressConnection,
  getWordPressJob,
  saveWordPressConnection,
  updateProjectWordPressSummary,
  updateWordPressJob,
} from '@/lib/wordpress/repository';
import type {
  WordPressApplyResponse,
  WordPressChangedField,
  WordPressConnectResponse,
  WordPressConnectionRecord,
  WordPressFetchResponse,
  WordPressItemSummary,
  WordPressJobRecord,
  WordPressPreviewResponse,
  WordPressTargetType,
  WordPressTargetTypePlural,
} from '@/types/wordpress';

interface WordPressUserResponse {
  id?: number;
  name?: string;
  slug?: string;
}

interface WordPressTextField {
  raw?: string;
  rendered?: string;
}

interface WordPressResourceResponse {
  id: number;
  slug?: string;
  status?: string;
  link?: string;
  title?: WordPressTextField;
  content?: WordPressTextField;
}

interface ConnectWordPressArgs {
  uid: string;
  projectId?: string | null;
  siteUrl: string;
  wpUsername: string;
  applicationPassword: string;
}

interface PreviewWordPressArgs {
  uid: string;
  targetType: WordPressTargetType;
  targetId: number;
  suggestedTitle?: string;
  suggestedContent?: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function pluralizeTargetType(targetType: WordPressTargetType): WordPressTargetTypePlural {
  return targetType === 'page' ? 'pages' : 'posts';
}

function singularizeTargetType(targetType: WordPressTargetTypePlural): WordPressTargetType {
  return targetType === 'pages' ? 'page' : 'post';
}

function normalizeUsername(input: string): string {
  const value = input.trim();
  if (!value) {
    throw new RouteError(400, 'Podaj WP Username.');
  }
  return value;
}

function normalizeApplicationPassword(input: string): string {
  const value = input.replace(/\s+/g, '').trim();
  if (!value) {
    throw new RouteError(400, 'Podaj Application Password.');
  }
  return value;
}

function extractFieldValue(field?: WordPressTextField): string {
  if (typeof field?.raw === 'string') return field.raw;
  if (typeof field?.rendered === 'string') return field.rendered;
  return '';
}

function normalizeWordPressItem(
  resource: WordPressResourceResponse,
  targetType: WordPressTargetType,
): WordPressItemSummary {
  return {
    id: resource.id,
    title: extractFieldValue(resource.title) || '(bez tytulu)',
    slug: resource.slug ?? '',
    status: resource.status ?? 'unknown',
    link: resource.link ?? '',
    targetType,
  };
}

function buildProjectWordPressState(
  connectionId: string,
  siteUrl: string,
  wpUsername: string,
  status: ProjectWordPressState['status'],
  lastError: string | null,
  lastVerifiedUser?: string | null,
): ProjectWordPressState {
  return {
    connectionId,
    siteUrl,
    wpUsername,
    status,
    lastCheckedAt: Date.now(),
    lastError,
    lastVerifiedUser: lastVerifiedUser ?? null,
  };
}

function isJobBoundToCurrentConnection(
  job: WordPressJobRecord,
  connection: WordPressConnectionRecord,
): boolean {
  if (!job.connectionSiteUrl) return true;

  try {
    return normalizeWordPressSiteUrl(job.connectionSiteUrl) === normalizeWordPressSiteUrl(connection.siteUrl);
  } catch {
    return false;
  }
}

async function failJob(jobId: string, message: string): Promise<void> {
  await updateWordPressJob(jobId, {
    status: 'failed',
    error: message,
  });
}

function buildRouteError(error: unknown, fallbackMessage: string): RouteError {
  if (error instanceof RouteError) {
    return error;
  }

  if (error instanceof WordPressApiError) {
    const status = error.status === 401 || error.status === 403 ? 401 : 502;
    return new RouteError(status, error.message || fallbackMessage, error.details);
  }

  return new RouteError(500, fallbackMessage);
}

async function syncProjectSummary(
  projectId: string | null | undefined,
  summary: ProjectWordPressState | null,
): Promise<void> {
  if (!projectId) return;
  await updateProjectWordPressSummary(projectId, summary);
}

async function getConnectedWordPressAuth(uid: string): Promise<{
  connection: WordPressConnectionRecord;
  applicationPassword: string;
}> {
  const connection = await getWordPressConnection(uid);
  if (!connection) {
    throw new RouteError(404, 'Brak zapisanego polaczenia WordPress.');
  }

  if (connection.status !== 'connected' || !connection.appPasswordEncrypted) {
    throw new RouteError(409, 'Najpierw polacz i zweryfikuj WordPress.');
  }

  try {
    const applicationPassword = decryptSecret(connection.appPasswordEncrypted);
    return { connection, applicationPassword };
  } catch {
    throw new RouteError(500, 'Nie mozna odczytac zapisanych danych WordPress.');
  }
}

async function markRuntimeConnectionFailure(
  connection: WordPressConnectionRecord,
  message: string,
): Promise<void> {
  const timestamp = nowIso();
  await saveWordPressConnection({
    userId: connection.userId,
    projectId: connection.projectId ?? null,
    siteUrl: connection.siteUrl,
    wpUsername: connection.wpUsername,
    appPasswordEncrypted: connection.appPasswordEncrypted,
    status: 'failed',
    lastTestAt: timestamp,
    lastVerifiedUser: connection.lastVerifiedUser ?? null,
    lastError: message,
    createdAt: connection.createdAt,
    updatedAt: timestamp,
  });

  await syncProjectSummary(
    connection.projectId,
    buildProjectWordPressState(
      connection.id,
      connection.siteUrl,
      connection.wpUsername,
      'failed',
      message,
      connection.lastVerifiedUser ?? null,
    ),
  );
}

export async function connectWordPressConnection(
  args: ConnectWordPressArgs,
): Promise<WordPressConnectResponse> {
  const timestamp = nowIso();
  const existing = await getWordPressConnection(args.uid);
  const siteUrl = normalizeWordPressSiteUrl(args.siteUrl);
  const wpUsername = normalizeUsername(args.wpUsername);
  const applicationPassword = normalizeApplicationPassword(args.applicationPassword);

  try {
    const verifiedUserResponse = await wordpressRequest<WordPressUserResponse>({
      siteUrl,
      username: wpUsername,
      applicationPassword,
      path: '/wp-json/wp/v2/users/me',
      method: 'GET',
    });

    const verifiedUser = verifiedUserResponse.name?.trim()
      || verifiedUserResponse.slug?.trim()
      || wpUsername;

    const connection = await saveWordPressConnection({
      userId: args.uid,
      projectId: args.projectId ?? existing?.projectId ?? null,
      siteUrl,
      wpUsername,
      appPasswordEncrypted: encryptSecret(applicationPassword),
      status: 'connected',
      lastTestAt: timestamp,
      lastVerifiedUser: verifiedUser,
      lastError: null,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    });

    await syncProjectSummary(
      connection.projectId,
      buildProjectWordPressState(
        connection.id,
        connection.siteUrl,
        connection.wpUsername,
        'connected',
        null,
        verifiedUser,
      ),
    );

    return {
      ok: true,
      status: 'connected',
      siteUrl: connection.siteUrl,
      verifiedUser,
      connectionId: connection.id,
    };
  } catch (error) {
    const routeError = buildRouteError(error, 'Nie udalo sie zweryfikowac polaczenia WordPress.');

    await saveWordPressConnection({
      userId: args.uid,
      projectId: args.projectId ?? existing?.projectId ?? null,
      siteUrl,
      wpUsername,
      appPasswordEncrypted: '',
      status: 'failed',
      lastTestAt: timestamp,
      lastVerifiedUser: existing?.lastVerifiedUser ?? null,
      lastError: routeError.message,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    });

    await syncProjectSummary(
      args.projectId ?? existing?.projectId ?? null,
      buildProjectWordPressState(
        args.uid,
        siteUrl,
        wpUsername,
        'failed',
        routeError.message,
        existing?.lastVerifiedUser ?? null,
      ),
    );

    throw routeError;
  }
}

export async function disconnectWordPressConnection(
  uid: string,
  projectId?: string | null,
): Promise<void> {
  const timestamp = nowIso();
  const connection = await getWordPressConnection(uid);

  if (connection) {
    await saveWordPressConnection({
      userId: uid,
      projectId: projectId ?? connection.projectId ?? null,
      siteUrl: connection.siteUrl,
      wpUsername: connection.wpUsername,
      appPasswordEncrypted: '',
      status: 'disconnected',
      lastTestAt: timestamp,
      lastVerifiedUser: connection.lastVerifiedUser ?? null,
      lastError: null,
      createdAt: connection.createdAt,
      updatedAt: timestamp,
    });
  }

  await syncProjectSummary(
    projectId ?? connection?.projectId ?? null,
    connection
      ? buildProjectWordPressState(
          uid,
          connection.siteUrl,
          connection.wpUsername,
          'disconnected',
          null,
          connection.lastVerifiedUser ?? null,
        )
      : null,
  );
}

export async function fetchWordPressItems(
  uid: string,
  targetType: WordPressTargetTypePlural,
  search?: string,
): Promise<WordPressFetchResponse> {
  const { connection, applicationPassword } = await getConnectedWordPressAuth(uid);
  const normalizedSearch = search?.trim().slice(0, 100) || undefined;
  const singularType = singularizeTargetType(targetType);

  try {
    const resources = await wordpressRequest<WordPressResourceResponse[]>({
      siteUrl: connection.siteUrl,
      username: connection.wpUsername,
      applicationPassword,
      path: `/wp-json/wp/v2/${targetType}`,
      method: 'GET',
      searchParams: {
        per_page: 50,
        search: normalizedSearch,
        _fields: 'id,title,slug,status,link',
      },
    });

    return {
      ok: true,
      targetType,
      items: resources.map((resource) => normalizeWordPressItem(resource, singularType)),
    };
  } catch (error) {
    const routeError = buildRouteError(error, 'Nie udalo sie pobrac listy z WordPress.');
    if (routeError.status === 401) {
      await markRuntimeConnectionFailure(connection, routeError.message);
    }
    throw routeError;
  }
}

export async function createWordPressPreviewJob(
  args: PreviewWordPressArgs,
): Promise<WordPressPreviewResponse> {
  if (!Number.isInteger(args.targetId) || args.targetId <= 0) {
    throw new RouteError(400, 'Nieprawidlowy targetId.');
  }

  const { connection, applicationPassword } = await getConnectedWordPressAuth(args.uid);

  try {
    const resource = await wordpressRequest<WordPressResourceResponse>({
      siteUrl: connection.siteUrl,
      username: connection.wpUsername,
      applicationPassword,
      path: `/wp-json/wp/v2/${pluralizeTargetType(args.targetType)}/${args.targetId}`,
      method: 'GET',
      searchParams: {
        context: 'edit',
      },
    });

    const currentTitle = extractFieldValue(resource.title);
    const currentContent = extractFieldValue(resource.content);
    const after: WordPressJobRecord['after'] = {};
    const changedFields: WordPressChangedField[] = [];

    if (typeof args.suggestedTitle === 'string' && args.suggestedTitle !== currentTitle) {
      after.title = args.suggestedTitle;
      changedFields.push('title');
    }

    if (typeof args.suggestedContent === 'string' && args.suggestedContent !== currentContent) {
      after.content = args.suggestedContent;
      changedFields.push('content');
    }

    if (!changedFields.length) {
      throw new RouteError(400, 'Podaj nowy title lub content, aby utworzyc podglad.');
    }

    const createdAt = nowIso();
    const job = await createWordPressJob({
      userId: args.uid,
      connectionId: connection.id,
      projectId: connection.projectId ?? null,
      type: 'update_page_title_content',
      targetType: args.targetType,
      targetId: args.targetId,
      targetUrl: resource.link ?? null,
      before: {
        title: currentTitle,
        content: currentContent,
      },
      after,
      changedFields,
      status: 'preview',
      error: null,
      createdAt,
      appliedAt: null,
    });

    return {
      ok: true,
      jobId: job.id,
      status: 'preview',
      targetType: job.targetType,
      targetId: job.targetId,
      targetUrl: job.targetUrl ?? null,
      currentTitle,
      currentContent,
      suggestedTitle: after.title ?? currentTitle,
      suggestedContent: after.content ?? currentContent,
      changedFields,
      createdAt,
    };
  } catch (error) {
    const routeError = buildRouteError(error, 'Nie udalo sie utworzyc podgladu WordPress.');
    if (routeError.status === 401) {
      await markRuntimeConnectionFailure(connection, routeError.message);
    }
    throw routeError;
  }
}

export async function applyWordPressPreviewJob(
  uid: string,
  jobId: string,
): Promise<WordPressApplyResponse> {
  const job = await getWordPressJob(jobId);
  if (!job) {
    throw new RouteError(404, 'Nie znaleziono WordPress job.');
  }

  if (job.userId !== uid) {
    throw new RouteError(403, 'Forbidden');
  }

  if (job.status === 'applied') {
    throw new RouteError(409, 'Ten job zostal juz zastosowany.');
  }

  const payload: Record<string, unknown> = {};

  if (typeof job.after.title === 'string') {
    payload.title = job.after.title;
  }
  if (typeof job.after.content === 'string') {
    payload.content = job.after.content;
  }

  if (!Object.keys(payload).length) {
    const message = 'Preview job nie zawiera zmian do wdrozenia.';
    await failJob(job.id, message);
    throw new RouteError(400, message);
  }

  let connection: WordPressConnectionRecord;
  let applicationPassword: string;

  try {
    const auth = await getConnectedWordPressAuth(uid);
    connection = auth.connection;
    applicationPassword = auth.applicationPassword;
  } catch (error) {
    const routeError = buildRouteError(error, 'Nie udalo sie zastosowac zmian w WordPress.');
    await failJob(job.id, routeError.message);
    throw routeError;
  }

  if (!isJobBoundToCurrentConnection(job, connection)) {
    const message = 'Ten preview job pochodzi z innego polaczenia WordPress. Wygeneruj nowy podglad.';
    await failJob(job.id, message);
    throw new RouteError(409, message);
  }

  try {
    const updatedResource = await wordpressRequest<WordPressResourceResponse>({
      siteUrl: connection.siteUrl,
      username: connection.wpUsername,
      applicationPassword,
      path: `/wp-json/wp/v2/${pluralizeTargetType(job.targetType)}/${job.targetId}`,
      method: 'POST',
      body: payload,
    });

    const appliedAt = nowIso();
    await updateWordPressJob(job.id, {
      status: 'applied',
      appliedAt,
      error: null,
      targetUrl: updatedResource.link ?? job.targetUrl ?? null,
    });

    return {
      ok: true,
      status: 'applied',
      jobId: job.id,
      updatedItem: normalizeWordPressItem(updatedResource, job.targetType),
    };
  } catch (error) {
    const routeError = buildRouteError(error, 'Nie udalo sie zastosowac zmian w WordPress.');
    await failJob(job.id, routeError.message);
    if (routeError.status === 401) {
      await markRuntimeConnectionFailure(connection, routeError.message);
    }
    throw routeError;
  }
}

export async function getConnectedWordPressCredentials(uid: string): Promise<{
  connection: WordPressConnectionRecord;
  applicationPassword: string;
}> {
  return getConnectedWordPressAuth(uid);
}