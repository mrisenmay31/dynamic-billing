import { adminClient } from '@/lib/supabase/admin'

interface AuditParams {
  firmId: string
  userId: string | null
  action: string
  entityType: string
  entityId: string | null
  details?: Record<string, unknown>
}

export async function logAudit(params: AuditParams): Promise<void> {
  const { error } = await adminClient.from('audit_logs').insert({
    firm_id: params.firmId,
    user_id: params.userId,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId ?? undefined,
    details: (params.details ?? null) as import('@/types/supabase').Json | null,
  })

  if (error) {
    console.error('[audit] failed to write audit log', { params, error })
  }
}
