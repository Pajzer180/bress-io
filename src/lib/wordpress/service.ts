import 'server-only';

import { randomUUID } from 'crypto';
import { createChangeJob, updateChangeJob } from '@/lib/server/changeJobs';
import {
  assertProjectOwnedByUser,
  RouteError,
} from '@/lib/server/firebaseAuth';
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
import type { ChangeJobChangeType } from '@/types/changeJobs';
import type { ProjectWordPressState } from '@/types/project';
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

interface WordPressYoastHeadJson {
  description?: string;
}

interface WordPressResourceResponse {
  id: number;
  slug?: string;
  status?: string;
  link?: string;
  title?: WordPressTextField;
  content?: WordPressTextField;
  meta?: Record<string, unknown>;
  yoast_head_json?: WordPressYoastHeadJson | null;
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
  projectId?: string | null;
  targetType: WordPressTargetType;
  targetId: number;
  suggestedTitle?: string;
  suggestedContent?: string;
  suggestedMetaDescription?: string;
}

interface PreparedPreviewChangeSet {
  changeType: ChangeJobChangeType;
  changedFields: WordPressChangedField[];
  beforeValue: Record<string, unknown>;
  proposedValue: Record<string, unknown>;
  legacyAfter: WordPressJobRecord['after'];
  previewSummary: string;
  suggestedTitle: string;
  suggestedContent: string;
  suggestedMetaDescription: string;
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

function extractOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function extractMetaDescription(resource: WordPressResourceResponse): string | null {
  const yoastDescription = extractOptionalString(resource.yoast_head_json?.description);
  if (yoastDescription) {
    return yoastDescription;
  }

  const meta = resource.meta;
  if (!meta || typeof meta !== 'object') {
    return null;
  }

  const candidateKeys = [
    'description',
    'meta_description',
    '_yoast_wpseo_metadesc',
    'yoast_wpseo_metadesc',
    'rank_math_description',
    '_aioseo_description',
    'aioseo_description',
  ];

  for (const key of candidateKeys) {
    const candidate = extractOptionalString(meta[key]);
    if (candidate) {
      return candidate;
    }
  }

  return null;
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

function normalizePreviewInput(value: string | undefined): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  return value.trim().length > 0 ? value : undefined;
}

function resolvePreviewProjectId(
  explicitProjectId: string | null | undefined,
  connection: WordPressConnectionRecord,
): string {
  const requestedProjectId = explicitProjectId?.trim() ?? '';
  const connectionProjectId = connection.projectId?.trim() ?? '';

  if (requestedProjectId && connectionProjectId && requestedProjectId !== connectionProjectId) {
    throw new RouteError(409, 'To polaczenie WordPress jest przypisane do innego projektu.', {
      code: 'WORDPRESS_PROJECT_MISMATCH',
    });
  }

  const resolvedProjectId = requestedProjectId || connectionProjectId;
  if (!resolvedProjectId) {
    throw new RouteError(409, 'Brakuje projektu dla polaczenia WordPress.', {
      code: 'WORDPRESS_PROJECT_MISSING',
    });
  }

  return resolvedProjectId;
}

function mapSingleFieldToChangeType(field: WordPressChangedField): ChangeJobChangeType {
  switch (field) {
    case 'title':
      return 'title';
    case 'content':
      return 'content';
    case 'meta_description':
      return 'meta_description';
    default:
      return 'other';
  }
}

function formatChangedField(field: WordPressChangedField): string {
  if (field === 'meta_description') {
    return 'meta description';
  }

  return field;
}

function buildPreviewSummary(args: {
  targetType: WordPressTargetType;
  targetId: number;
  targetUrl: string;
  currentTitle: string;
  changedFields: WordPressChangedField[];
}): string {
  const fieldSummary = args.changedFields.map(formatChangedField).join(', ');
  const entityLabel = args.targetType === 'page' ? 'strony' : 'wpisu';
  const targetLabel = args.currentTitle.trim() || args.targetUrl || `ID ${args.targetId}`;
  return `Zmiana ${fieldSummary} dla ${entityLabel} ${targetLabel}`;
}

function supportsLegacyWordPressPreview(changedFields: WordPressChangedField[]): boolean {
  return changedFields.length > 0
    && changedFields.every((field) => field === 'title' || field === 'content');
}

function preparePreviewChangeSet(args: {
  targetType: WordPressTargetType;
  targetId: number;
  targetUrl: string;
  currentTitle: string;
  currentContent: string;
  currentMetaDescription: string | null;
  suggestedTitle?: string;
  suggestedContent?: string;
  suggestedMetaDescription?: string;
}): PreparedPreviewChangeSet {
  const nextTitle = normalizePreviewInput(args.suggestedTitle);
  const nextContent = normalizePreviewInput(args.suggestedContent);
  const nextMetaDescription = normalizePreviewInput(args.suggestedMetaDescription);
  const currentMetaDescription = args.currentMetaDescription;
  const beforeValue: Record<string, unknown> = {};
  const proposedValue: Record<string, unknown> = {};
  const legacyAfter: WordPressJobRecord['after'] = {};
  const changedFields: WordPressChangedField[] = [];

  if (nextTitle !== undefined && nextTitle !== args.currentTitle) {
    beforeValue.title = args.currentTitle;
    proposedValue.title = nextTitle;
    legacyAfter.title = nextTitle;
    changedFields.push('title');
  }

  if (nextContent !== undefined && nextContent !== args.currentContent) {
    beforeValue.content = args.currentContent;
    proposedValue.content = nextContent;
    legacyAfter.content = nextContent;
    changedFields.push('content');
  }

  if (nextMetaDescription !== undefined && nextMetaDescription !== (currentMetaDescription ?? '')) {
    beforeValue.metaDescription = currentMetaDescription;
    proposedValue.metaDescription = nextMetaDescription;
    changedFields.push('meta_description');
  }

  if (!changedFields.length) {
    throw new RouteError(400, 'Podaj nowy title, content lub meta description, aby utworzyc podglad.');
  }

  const changeType = changedFields.length === 1
    ? mapSingleFieldToChangeType(changedFields[0])
    : 'other';

  return {
    changeType,
    changedFields,
    beforeValue,
    proposedValue,
    legacyAfter,
    previewSummary: buildPreviewSummary({
      targetType: args.targetType,
      targetId: args.targetId,
      targetUrl: args.targetUrl,
      currentTitle: args.currentTitle,
      changedFields,
    }),
    suggestedTitle: nextTitle ?? args.currentTitle,
    suggestedContent: nextContent ?? args.currentContent,
    suggestedMetaDescription: nextMetaDescription ?? currentMetaDescription ?? '',
  };
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
  let persistedChangeJobId: string | null = null;

  try {
    const projectId = resolvePreviewProjectId(args.projectId, connection);
    await assertProjectOwnedByUser(args.uid, projectId);

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
    const currentMetaDescription = extractMetaDescription(resource);
    const targetUrl = resource.link ?? null;
    const pageUrl = targetUrl ?? connection.siteUrl;
    const previewChangeSet = preparePreviewChangeSet({
      targetType: args.targetType,
      targetId: args.targetId,
      targetUrl: pageUrl,
      currentTitle,
      currentContent,
      currentMetaDescription,
      suggestedTitle: args.suggestedTitle,
      suggestedContent: args.suggestedContent,
      suggestedMetaDescription: args.suggestedMetaDescription,
    });

    const createdAt = Date.now();
    const requestId = randomUUID();
    const jobId = `cj_${randomUUID()}`;

    const changeJob = await createChangeJob({
      projectId,
      uid: args.uid,
      quickWinId: null,
      pageUrl,
      entityType: args.targetType === 'page' ? 'wp_page' : 'wp_post',
      entityId: String(args.targetId),
      changeType: previewChangeSet.changeType,
      beforeValue: previewChangeSet.beforeValue,
      proposedValue: previewChangeSet.proposedValue,
      appliedValue: null,
      rollbackValue: null,
      previewSummary: previewChangeSet.previewSummary,
      source: 'manual',
      status: 'preview_ready',
      requestId,
      error: null,
      createdAt,
      updatedAt: createdAt,
      approvedAt: null,
      appliedAt: null,
      rolledBackAt: null,
    }, jobId);
    persistedChangeJobId = changeJob.id;

    if (supportsLegacyWordPressPreview(previewChangeSet.changedFields)) {
      await createWordPressJob({
        userId: args.uid,
        connectionId: connection.id,
        projectId,
        connectionSiteUrl: connection.siteUrl,
        type: 'update_page_title_content',
        targetType: args.targetType,
        targetId: args.targetId,
        targetUrl,
        before: {
          title: currentTitle,
          content: currentContent,
          metaDescription: currentMetaDescription,
        },
        after: previewChangeSet.legacyAfter,
        changedFields: previewChangeSet.changedFields,
        status: 'preview',
        error: null,
        createdAt: nowIso(),
        appliedAt: null,
      }, changeJob.id);
    }

    return {
      ok: true,
      jobId: changeJob.id,
      projectId,
      status: 'preview_ready',
      changeType: previewChangeSet.changeType,
      pageUrl,
      targetType: args.targetType,
      targetId: args.targetId,
      targetUrl,
      beforeValue: changeJob.beforeValue,
      proposedValue: changeJob.proposedValue,
      previewSummary: changeJob.previewSummary,
      requestId: changeJob.requestId,
      currentTitle,
      currentContent,
      currentMetaDescription,
      suggestedTitle: previewChangeSet.suggestedTitle,
      suggestedContent: previewChangeSet.suggestedContent,
      suggestedMetaDescription: previewChangeSet.suggestedMetaDescription,
      changedFields: previewChangeSet.changedFields,
      createdAt: changeJob.createdAt,
    };
  } catch (error) {
    const routeError = buildRouteError(error, 'Nie udalo sie utworzyc podgladu WordPress.');

    if (persistedChangeJobId) {
      try {
        await updateChangeJob(persistedChangeJobId, {
          status: 'failed',
          error: {
            message: routeError.message,
          },
          updatedAt: Date.now(),
        });
      } catch {
        // Ignore secondary persistence errors so the original route error is preserved.
      }
    }

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