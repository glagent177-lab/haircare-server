import { supabase } from '../lib/supabase.js'
import { logger } from '../utils/logger.js'

export const serviceRepository = {
  async findAllActive() {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')

    if (error) {
      logger.error('findAllActive services error:', error)
      return []
    }

    return data
  },

  async findByTitle(title) {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('title', title)
      .maybeSingle()

    if (error) logger.error('findByTitle service error:', error)
    return data
  },

  async findAll() {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .order('sort_order')

    if (error) {
      logger.error('findAll services error:', error)
      return []
    }

    return data
  },

  async findById(id) {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      logger.error('findById service error:', error)
      return null
    }

    return data
  },

  async create(data) {
    const { data: service, error } = await supabase
      .from('services')
      .insert(data)
      .select()
      .single()

    if (error) {
      logger.error('create service error:', error)
      throw error
    }

    return service
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from('services')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      logger.error('update service error:', error)
      throw error
    }

    return data
  },

  async delete(id) {
    const { error } = await supabase
      .from('services')
      .update({ is_active: false })
      .eq('id', id)

    if (error) {
      logger.error('delete service error:', error)
      throw error
    }

    return true
  },
}
