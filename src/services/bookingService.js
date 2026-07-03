import { supabase } from '../lib/supabase.js'
import { appointmentRepository } from '../repositories/appointmentRepository.js'
import { clientRepository } from '../repositories/clientRepository.js'
import { serviceRepository } from '../repositories/serviceRepository.js'
import { barberRepository } from '../repositories/barberRepository.js'
import { activityLogService } from './activityLogService.js'

import { ConflictError, AppError } from '../utils/errors.js'
import { logger } from '../utils/logger.js'

export const bookingService = {
  async getBookedTimes(master, date) {
    return appointmentRepository.findByMasterAndDate(master, date)
  },

  async createBooking(data) {
    const { name, phone, service, master, date, time, price } = data
    const lockKey = 'booking_' + master.replace(/[^a-zA-Z0-9_]/g, '_') + '_' + date

    let lockAcquired = false
    try {
      const { error: lockError } = await supabase.rpc('acquire_booking_lock', {
        lock_key: lockKey,
        lock_timeout_ms: 5000,
      })
      lockAcquired = !lockError
    } catch {
      lockAcquired = false
    }

    if (!lockAcquired) {
      logger.warn('Lock unavailable, using direct overlap check')
    }

    try {
      const hasOverlap = await appointmentRepository.findOverlapping(master, date, time, 60)
      if (hasOverlap) {
        throw new ConflictError('Это время уже занято. Пожалуйста, выберите другое.')
      }

      const barber = await barberRepository.findByName(master)
      if (barber) {
        const isOff = await this._checkBarberAvailability(barber.id, date, time)
        if (isOff) {
          throw new AppError('Мастер не работает в выбранное время', 400)
        }
      }

      const client = await clientRepository.findOrCreate(name, phone)

      const appointment = await appointmentRepository.create({
        name, phone, service, master, date, time, price,
        client_id: client?.id || null,
        barber_id: barber?.id || null,
      })

      activityLogService.log({
        action: 'appointment.created',
        entityType: 'appointment',
        entityId: appointment.id,
        details: { name, phone, service, master, date, time },
      }).catch(() => {})

      logger.info('Новая запись:', { id: appointment.id, name, service, master, date, time })
      return appointment
    } finally {
      if (lockAcquired) {
        try { await supabase.rpc('release_booking_lock', { lock_key: lockKey }) } catch (_) {}
      }
    }
  },

  async _checkBarberAvailability(barberId, date, time) {
    const dayOfWeek = new Date(date + 'T12:00:00').getDay()
    const { data: wh } = await supabase
      .from('working_hours')
      .select('*')
      .eq('barber_id', barberId)
      .eq('day_of_week', dayOfWeek)
      .maybeSingle()

    if (!wh) return false
    if (!wh.is_working) return true

    const { data: dayOff } = await supabase
      .from('days_off')
      .select('id')
      .eq('barber_id', barberId)
      .eq('date', date)
      .maybeSingle()

    if (dayOff) return true

    const { data: vacation } = await supabase
      .from('vacations')
      .select('id')
      .eq('barber_id', barberId)
      .lte('start_date', date)
      .gte('end_date', date)
      .maybeSingle()

    if (vacation) return true

    const { data: breaks } = await supabase
      .from('breaks')
      .select('*')
      .eq('barber_id', barberId)
      .eq('date', date)

    if (breaks) {
      for (const b of breaks) {
        if (time >= b.start_time.slice(0, 5) && time < b.end_time.slice(0, 5)) {
          return true
        }
      }
    }

    return false
  },

  async updateAppointmentStatus(id, status, changedBy) {
    const appointment = await appointmentRepository.update(id, { status })

    await activityLogService.log({
      action: 'appointment.' + status,
      entityType: 'appointment',
      entityId: id,
      details: { newStatus: status },
    })



    return appointment
  },

  async getTodayAppointments() {
    const today = new Date().toISOString().split('T')[0]
    return appointmentRepository.findAll({ date: today })
  },

  async getUpcomingAppointments(limit = 10) {
    return appointmentRepository.findAll({ upcoming: true, limit })
  },
}
