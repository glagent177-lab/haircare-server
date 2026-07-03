import { supabase } from '../lib/supabase.js'
import { logger } from '../utils/logger.js'

export const clientRepository = {
  async findByPhone(phone) {
    const cleaned = phone.replace(/\D/g, '')
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .or(`phone.eq.${phone},phone.eq.${cleaned}`)
      .maybeSingle()

    if (error) logger.error('findByPhone error:', error)
    return data
  },

  async findOrCreate(name, phone) {
    const existing = await this.findByPhone(phone)
    if (existing) return existing

    const { data, error } = await supabase
      .from('clients')
      .insert({ name, phone })
      .select()
      .single()

    if (error) {
      logger.error('findOrCreate client error:', error)
      return null
    }

    return data
  },

  async findAll(filters = {}) {
    let query = supabase.from('clients').select('*').order('created_at', { ascending: false })

    if (filters.search) {
      query = query.or(`name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`)
    }

    const { data, error } = await query

    if (error) {
      logger.error('findAll clients error:', error)
      return []
    }

    return data
  },

  async findById(id) {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      logger.error('findById client error:', error)
      return null
    }

    return data
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from('clients')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      logger.error('update client error:', error)
      throw error
    }

    return data
  },
}
