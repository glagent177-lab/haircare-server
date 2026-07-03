import { supabase } from '../lib/supabase.js'
import { logger } from '../utils/logger.js'

export const barberRepository = {
  async findAllActive() {
    const { data, error } = await supabase
      .from('barbers')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')

    if (error) {
      logger.error('findAllActive barbers error:', error)
      return []
    }

    return data
  },

  async findByName(name) {
    const { data, error } = await supabase
      .from('barbers')
      .select('*')
      .eq('name', name)
      .maybeSingle()

    if (error) logger.error('findByName barber error:', error)
    return data
  },

  async findAll() {
    const { data, error } = await supabase
      .from('barbers')
      .select('*')
      .order('sort_order')

    if (error) {
      logger.error('findAll barbers error:', error)
      return []
    }

    return data
  },

  async findById(id) {
    const { data, error } = await supabase
      .from('barbers')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      logger.error('findById barber error:', error)
      return null
    }

    return data
  },

  async create(data) {
    const { data: barber, error } = await supabase
      .from('barbers')
      .insert(data)
      .select()
      .single()

    if (error) {
      logger.error('create barber error:', error)
      throw error
    }

    return barber
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from('barbers')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      logger.error('update barber error:', error)
      throw error
    }

    return data
  },

  async delete(id) {
    const { error } = await supabase
      .from('barbers')
      .update({ is_active: false })
      .eq('id', id)

    if (error) {
      logger.error('delete barber error:', error)
      throw error
    }

    return true
  },
}
