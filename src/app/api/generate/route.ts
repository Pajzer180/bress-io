import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { NextResponse } from 'next/server';
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  setDoc,
  increment,
} from 'firebase/firestore';
import { writeChangeHistory } from '@/lib/changeHistory';
import { getClientDb } from '@/lib/firebase';
import {
  assertProjectOwnedByUser,
  requireAuthenticatedUid,
  toRouteErrorResponse,
} from '@/lib/server/firebaseAuth';
import type { ActionType, ChangeSource, EntityType } from '@/types/history';

interface SeoAction {
  action: string;
  selector: string;
  value: string;
  type: 'replace_text' | 'replace_meta' | 'add_class';
}

interface GenerateRequestBody {
  instruction: string;
  clientId?: string;
  projectId?: string;
  userId?: string;
  siteUrl?: string;
  pageUrl?: string;
  source?: ChangeSource;
  entityType?: EntityType;
  entityId?: string | null;
}

function inferActionType(action: SeoAction): ActionType {
  const text = `${action.action} ${action.selector}`.toLowerCase();
  if (text.includes('meta') && text.includes('description')) return 'update_meta_description';
  if (text.includes('title')) return 'update_title';
  if (text.includes('h1')) return 'update_h1';
  if (text.includes('h2')) return 'update_h2';
  if (text.includes('canonical')) return 'update_canonical';
  if (text.includes('robots')) return 'update_robots';
  if (action.type === 'replace_text') return 'update_content';
  return 'update_other';
}

const SYSTEM_PROMPT = `Jestes Inzynierem SEO. Na podstawie instrukcji uzytkownika wygeneruj JSON dla skryptu JS Snippet. Format odpowiedzi to WYLACZNIE poprawny JSON o strukturze: { action: string, selector: string, value: string, type: 'replace_text' | 'replace_meta' | 'add_class' }. Nie dodawaj zadnych znacznikow markdown (jak \`\`\`json) ani komentarzy.`;

export async function POST(req: Request) {
  try {
    const uid = await requireAuthenticatedUid(req);
    const {
      instruction,
      clientId = '123',
      projectId,
      siteUrl,
      pageUrl,
      source = 'chat',
      entityType = 'unknown',
      entityId = null,
    }: GenerateRequestBody = await req.json();

    if (projectId) {
      await assertProjectOwnedByUser(uid, projectId);
    }

    const requestId = crypto.randomUUID();

    // 1. Wywolanie Claude Sonnet
    const { text } = await generateText({
      model: anthropic('claude-sonnet-4-6'),
      system: SYSTEM_PROMPT,
      prompt: instruction,
    });

    // 2. Parsowanie JSON z odpowiedzi modelu
    let parsed: SeoAction;
    try {
      parsed = JSON.parse(text) as SeoAction;
    } catch (parseErr) {
      console.error('[generate] Blad parsowania JSON z Claude:', parseErr);
      console.error('[generate] Surowa odpowiedz modelu:', text);
      return NextResponse.json(
        { error: 'Agent zwrocil nieprawidlowy JSON', raw: text },
        { status: 500 },
      );
    }

    // 3. Zapis optymalizacji do Firestore
    const db = getClientDb();
    const actionRef = await addDoc(collection(db, 'seo_actions'), {
      clientId,
      actionData: parsed,
      status: 'active',
      createdAt: serverTimestamp(),
      projectId: projectId ?? null,
      userId: uid,
      siteUrl: siteUrl ?? null,
      pageUrl: pageUrl ?? null,
      requestId,
    });

    // 3b. Obowiazkowy wpis historii zmian (preview)
    if (projectId && siteUrl && pageUrl) {
      await writeChangeHistory({
        projectId,
        userId: uid,
        siteUrl,
        pageUrl,
        actionType: inferActionType(parsed),
        source,
        status: 'preview',
        beforeValue: '',
        afterValue: parsed.value ?? '',
        summary: parsed.action || 'SEO action preview',
        entityType,
        entityId,
        actionId: actionRef.id,
        requestId,
      });
    }

    // 4. Odejmij 10 kredytow - merge:true tworzy dokument jesli nie istnieje
    try {
      await setDoc(
        doc(db, 'clients', clientId),
        { credits: increment(-10) },
        { merge: true },
      );
    } catch (creditsErr) {
      console.error('[generate] Blad aktualizacji kredytow (cichy):', creditsErr);
    }

    return NextResponse.json({
      ...parsed,
      actionId: actionRef.id,
      requestId,
    });
  } catch (error) {
    console.error('[generate] Nieobsluzony blad:', error);
    return toRouteErrorResponse(error);
  }
}