import { supabase } from '../lib/supabase.js'
import { logger } from '../utils/logger.js'

export const settingsRepository = {
  async getAll() {
    const { data, error } = await supabase
      .from('settings')
      .select('key, value')

    if (error) {
      logger.error('getAll settings error:', error)
      return {}
    }

    const map = {}
    data.forEach((s) => { map[s.key] = s.value })
    return map
  },

  async get(key) {
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', key)
      .maybeSingle()

    if (error) {
      logger.error('get setting error:', error)
      return null
    }

    return data?.value ?? null
  },

  async set(key, value) {
    const { error } = await supabase
      .from('settings')
      .upsert({ key, value }, { onConflict: 'key' })

    if (error) {
      logger.error('set setting error:', error)
      throw error
    }

    return true
  },

  async getInt(key, defaultValue = 0) {
    const val = await this.get(key)
    if (val === null) return defaultValue
    return parseInt(val, 10)
  },

  async getString(key, defaultValue = '') {
    const val = await this.get(key)
    if (val === null) return defaultValue
    return String(val).replace(/^"(.*)"$/, '$1')
  },
}
