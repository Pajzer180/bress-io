import 'server-only';

import { z } from 'zod';
import { optionalTrimmedString } from '@/lib/server/schemas/shared';

const returnToSchema = optionalTrimmedString(500)
  .transform((value) => value ?? '/dashboard/analityka');

export const gscConnectRequestSchema = z.object({
  projectId: z.string().trim().min(1).max(200),
  returnTo: returnToSchema,
}).strict();

export const gscSelectSiteRequestSchema = z.object({
  projectId: z.string().trim().min(1).max(200),
  propertyUrl: z.string().trim().min(1).max(2_048),
}).strict();

export const gscSitesQuerySchema = z.object({
  projectId: z.string().trim().min(1).max(200),
}).strict();

export const gscCallbackQuerySchema = z.object({
  code: optionalTrimmedString(4_096),
  error: optionalTrimmedString(200),
  state: z.string().trim().min(1).max(500),
}).superRefine((value, ctx) => {
  if (!value.code && !value.error) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['code'],
      message: 'Missing OAuth code or error.',
    });
  }
});