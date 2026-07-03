import { supabase } from '../lib/supabase.js'
import { logger } from '../utils/logger.js'

export const appointmentRepository = {
  async findByMasterAndDate(master, date) {
    const { data, error } = await supabase
      .from('appointments')
      .select('time, service_name, duration, status')
      .eq('barber_name', master)
      .eq('date', date)
      .not('status', 'in', '("cancelled")')

    if (error) {
      logger.error('findByMasterAndDate error:', error)
      return []
    }

    return data.map((a) => ({
      time: a.time.slice(0, 5),
      service: a.service_name,
    }))
  },

  async create(data) {
    const { data: appointment, error } = await supabase
      .from('appointments')
      .insert({
        client_name: data.name,
        client_phone: data.phone,
        service_name: data.service,
        service_price: data.price ? parseInt(data.price) : 0,
        barber_name: data.master,
        date: data.date,
        time: data.time,
        duration: data.duration || 60,
        status: 'pending',
        client_id: data.client_id || null,
        barber_id: data.barber_id || null,
      })
      .select()
      .single()

    if (error) {
      logger.error('create appointment error:', error)
      throw error
    }

    return appointment
  },

  async findOverlapping(master, date, time, duration) {
    const timeEnd = addMinutes(time, duration)

    const { data, error } = await supabase
      .from('appointments')
      .select('time, duration')
      .eq('barber_name', master)
      .eq('date', date)
      .not('status', 'in', '("cancelled")')

    if (error) {
      logger.error('findOverlapping error:', error)
      return false
    }

    return data.some((a) => {
      const aStart = a.time.slice(0, 5)
      const aEnd = addMinutes(aStart, a.duration)
      return time < aEnd && timeEnd > aStart
    })
  },

  async findAll(filters = {}) {
    let query = supabase.from('appointments').select('*')

    if (filters.date) query = query.eq('date', filters.date)
    if (filters.date_gte) query = query.gte('date', filters.date_gte)
    if (filters.date_lte) query = query.lte('date', filters.date_lte)
    if (filters.status) query = query.eq('status', filters.status)
    if (filters.barber_id) query = query.eq('barber_id', filters.barber_id)
    if (filters.client_id) query = query.eq('client_id', filters.client_id)

    if (filters.upcoming) {
      const today = new Date().toISOString().split('T')[0]
      query = query.gte('date', today).not('status', 'in', '("cancelled","completed")')
    }

    query = query.order('date', { ascending: filters.upcoming ? true : false })
      .order('time', { ascending: filters.upcoming ? true : false })

    if (filters.limit) query = query.limit(filters.limit)

    const { data, error } = await query

    if (error) {
      logger.error('findAll appointments error:', error)
      return []
    }

    return data
  },

  async findById(id) {
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      logger.error('findById appointment error:', error)
      return null
    }

    return data
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from('appointments')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      logger.error('update appointment error:', error)
      throw error
    }

    return data
  },

  async delete(id) {
    const { error } = await supabase
      .from('appointments')
      .delete()
      .eq('id', id)

    if (error) {
      logger.error('delete appointment error:', error)
      throw error
    }

    return true
  },

  async getTodayCount() {
    const today = new Date().toISOString().split('T')[0]
    const { count, error } = await supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('date', today)

    if (error) {
      logger.error('getTodayCount error:', error)
      return 0
    }

    return count
  },

  async getStats(startDate, endDate) {
    const { data, error } = await supabase
      .from('appointments')
      .select('date, service_price, status, service_name, barber_name, barber_id, client_id')
      .gte('date', startDate)
      .lte('date', endDate)

    if (error) {
      logger.error('getStats error:', error)
      return { total: 0, revenue: 0, byService: [], byBarber: [], newClients: 0 }
    }

    const completed = data.filter((a) => a.status === 'completed')
    const revenue = completed.reduce((sum, a) => sum + (a.service_price || 0), 0)
    const byService = aggregateByField(completed, 'service_name')
    const byBarber = aggregateByField(completed, 'barber_name')

    return { total: data.length, revenue, byService, byBarber }
  },
}

function addMinutes(time, minutes) {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + minutes
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function aggregateByField(data, field) {
  const map = new Map()
  data.forEach((item) => {
    const key = item[field]
    if (!key) return
    if (!map.has(key)) map.set(key, 0)
    map.set(key, map.get(key) + 1)
  })
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
}
