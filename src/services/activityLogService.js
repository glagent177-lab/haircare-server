import { supabase } from '../lib/supabase.js'
import { logger } from '../utils/logger.js'

export const activityLogService = {
  async log({ action, entityType, entityId, details, userId, ipAddress }) {
    try {
      const { error } = await supabase.from('activity_logs').insert({
        user_id: userId || null,
        action,
        entity_type: entityType,
        entity_id: entityId || null,
        details: details || null,
        ip_address: ipAddress || null,
      })

      if (error) logger.error('activityLog error:', error)
    } catch (err) {
      logger.error('activityLog exception:', err.message)
    }
  },

  async findAll(filters = {}) {
    let query = supabase
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(filters.limit || 100)

    if (filters.action) query = query.eq('action', filters.action)
    if (filters.entityType) query = query.eq('entity_type', filters.entityType)

    const { data, error } = await query

    if (error) {
      logger.error('findAll activity logs error:', error)
      return []
    }

    return data
  },
}
