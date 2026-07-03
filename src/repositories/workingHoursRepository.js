import { supabase } from '../lib/supabase.js'
import { logger } from '../utils/logger.js'

export const workingHoursRepository = {
  async findByBarberId(barberId) {
    const { data, error } = await supabase
      .from('working_hours')
      .select('*')
      .eq('barber_id', barberId)
      .order('day_of_week')

    if (error) {
      logger.error('findByBarberId working hours error:', error)
      return []
    }

    return data
  },

  async upsert(barberId, hours) {
    const records = hours.map((h) => ({
      barber_id: barberId,
      day_of_week: h.dayOfWeek,
      start_time: h.startTime,
      end_time: h.endTime,
      is_working: h.isWorking ?? true,
    }))

    const { error } = await supabase
      .from('working_hours')
      .upsert(records, { onConflict: 'barber_id,day_of_week' })

    if (error) {
      logger.error('upsert working hours error:', error)
      throw error
    }

    return true
  },
}
