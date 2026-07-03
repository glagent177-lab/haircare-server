import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'

import { bookingService } from './src/services/bookingService.js'
import { activityLogService } from './src/services/activityLogService.js'
import { appointmentRepository } from './src/repositories/appointmentRepository.js'
import { clientRepository } from './src/repositories/clientRepository.js'
import { barberRepository } from './src/repositories/barberRepository.js'
import { serviceRepository } from './src/repositories/serviceRepository.js'
import { settingsRepository } from './src/repositories/settingsRepository.js'
import { supabase } from './src/lib/supabase.js'
import { validateBookingInput, validateBookingQuery } from './src/validators/bookingValidator.js'
import { errorHandler } from './src/middleware/errorHandler.js'
import { AppError, NotFoundError } from './src/utils/errors.js'
import { logger } from './src/utils/logger.js'

const app = express()
const PORT = process.env.PORT || 3001

// HTTPS редирект (production)
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] !== 'https') {
      return res.redirect(`https://${req.headers.host}${req.url}`)
    }
    next()
  })
}

// Безопасные HTTP-заголовки
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https://images.unsplash.com'],
      frameSrc: ["'self'", 'https://www.google.com'],
      connectSrc: ["'self'", 'https://lbahweyfekoguzohkjju.supabase.co'],
      upgradeInsecureRequests: [],
    },
  },
}))

// CORS — только разрешённые источники
const ALLOWED_ORIGINS = [
  process.env.CLIENT_ORIGIN,
  process.env.ADMIN_ORIGIN,
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
].filter(Boolean)

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      cb(null, true)
    } else {
      cb(null, false)
    }
  },
  credentials: true,
}))

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много запросов. Попробуйте позже.' },
})

const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много запросов. Попробуйте позже.' },
})

app.use('/api/admin', adminLimiter)
app.use('/api', generalLimiter)

app.use(express.json())

// ──────────────────────────────────────────────
//  PUBLIC API — для клиентского сайта
// ──────────────────────────────────────────────

// GET /api/bookings — занятые слоты (мастер + дата)
app.get('/api/bookings', async (req, res, next) => {
  try {
    const { master, date } = validateBookingQuery(req.query.master, req.query.date)
    const bookings = await bookingService.getBookedTimes(master, date)
    const taken = bookings.map((b) => b.time)
    res.json({ date, master, taken, bookings })
  } catch (err) {
    next(err)
  }
})

// POST /api/bookings — создание записи
app.post('/api/bookings', async (req, res, next) => {
  try {
    const data = validateBookingInput(req.body)
    const appointment = await bookingService.createBooking(data)
    res.status(201).json({
      success: true,
      booking: {
        id: appointment.id,
        name: appointment.client_name,
        phone: appointment.client_phone,
        service: appointment.service_name,
        master: appointment.barber_name,
        date: appointment.date,
        time: appointment.time,
        price: appointment.service_price ? `${appointment.service_price} ₽` : '',
        createdAt: appointment.created_at,
      },
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/services — публичный список услуг
app.get('/api/services', async (_req, res, next) => {
  try {
    const services = await serviceRepository.findAllActive()
    res.json(services)
  } catch (err) {
    next(err)
  }
})

// GET /api/barbers — публичный список мастеров
app.get('/api/barbers', async (_req, res, next) => {
  try {
    const barbers = await barberRepository.findAllActive()
    res.json(barbers)
  } catch (err) {
    next(err)
  }
})

// GET /api/reviews — публичные отзывы
app.get('/api/reviews', async (_req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('is_approved', true)
      .order('created_at', { ascending: false })

    if (error) throw error
    res.json(data)
  } catch (err) {
    next(err)
  }
})

// GET /api/bookings/confirm/:token — подтверждение записи по email
app.get('/api/bookings/confirm/:token', async (req, res, next) => {
  try {
    const { token } = req.params
    const appointment = await appointmentRepository.findByConfirmationToken(token)

    if (!appointment) {
      return res.status(404).type('html').send(CONFIRM_PAGE(false, 'Ссылка недействительна или запись уже подтверждена'))
    }

    if (appointment.status === 'confirmed') {
      return res.type('html').send(CONFIRM_PAGE(true, 'Запись уже была подтверждена ранее'))
    }

    await appointmentRepository.confirmByToken(token)

    res.type('html').send(CONFIRM_PAGE(true, 'Запись успешно подтверждена! Ждём вас в назначенное время.'))
  } catch (err) {
    next(err)
  }
})

const CONFIRM_PAGE = (success, message) => `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${success ? 'Запись подтверждена' : 'Ошибка'} — HairCare</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #111; color: #fff;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; padding: 20px;
    }
    .card {
      background: #1a1a1a; border: 1px solid #333;
      border-radius: 20px; padding: 48px 40px;
      max-width: 440px; width: 100%; text-align: center;
    }
    .icon {
      width: 72px; height: 72px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 24px;
      ${success ? 'background: rgba(212,175,55,0.15); border: 2px solid #D4AF37;' : 'background: rgba(255,68,68,0.15); border: 2px solid #f44;'}
    }
    h1 { font-size: 24px; margin-bottom: 12px; }
    p { color: #999; font-size: 15px; line-height: 1.5; }
    .back { display: inline-block; margin-top: 24px; color: #D4AF37; text-decoration: none; font-size: 14px; }
    .back:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">
      ${success
        ? '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>'
        : '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f44" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>'
      }
    </div>
    <h1>${success ? 'Запись подтверждена!' : 'Ошибка'}</h1>
    <p>${message}</p>
    <a class="back" href="https://cw955313.tw1.ru">Вернуться на сайт</a>
  </div>
</body>
</html>`

// GET /api/health — проверка сервера
app.get('/api/health', async (_req, res) => {
  try {
    const { data } = await supabase.from('appointments').select('id', { count: 'exact', head: true })
    res.json({ status: 'ok', storage: 'supabase', bookingsCount: data?.length || 0 })
  } catch {
    res.json({ status: 'degraded', storage: 'supabase', error: 'db connection failed' })
  }
})

// ──────────────────────────────────────────────
//  ADMIN API
// ──────────────────────────────────────────────

// ── Записи ──
app.get('/api/admin/appointments', async (req, res, next) => {
  try {
    const { date, date_gte, date_lte, status } = req.query
    const appointments = await appointmentRepository.findAll({ date, date_gte, date_lte, status })
    res.json(appointments)
  } catch (err) {
    next(err)
  }
})

app.get('/api/admin/appointments/today', async (_req, res, next) => {
  try {
    const appointments = await bookingService.getTodayAppointments()
    res.json(appointments)
  } catch (err) {
    next(err)
  }
})

app.get('/api/admin/appointments/upcoming', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 10
    const appointments = await bookingService.getUpcomingAppointments(limit)
    res.json(appointments)
  } catch (err) {
    next(err)
  }
})

app.patch('/api/admin/appointments/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body
    const validStatuses = ['pending', 'confirmed', 'completed', 'no_show', 'cancelled']
    if (!validStatuses.includes(status)) {
      throw new AppError('Некорректный статус', 400)
    }
    const appointment = await bookingService.updateAppointmentStatus(req.params.id, status, null)
    res.json(appointment)
  } catch (err) {
    next(err)
  }
})

app.patch('/api/admin/appointments/:id', async (req, res, next) => {
  try {
    const { date, time, service_name, barber_name, admin_comment } = req.body
    const updates = {}
    if (date) updates.date = date
    if (time) updates.time = time
    if (service_name) updates.service_name = service_name
    if (barber_name) updates.barber_name = barber_name
    if (admin_comment !== undefined) updates.admin_comment = admin_comment

    const appointment = await appointmentRepository.update(req.params.id, updates)

    await activityLogService.log({
      action: 'appointment.updated',
      entityType: 'appointment',
      entityId: req.params.id,
      details: updates,
    })

    res.json(appointment)
  } catch (err) {
    next(err)
  }
})

app.delete('/api/admin/appointments/:id', async (req, res, next) => {
  try {
    await appointmentRepository.delete(req.params.id)

    await activityLogService.log({
      action: 'appointment.deleted',
      entityType: 'appointment',
      entityId: req.params.id,
    })

    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

// ── Клиенты ──
app.get('/api/admin/clients', async (req, res, next) => {
  try {
    const clients = await clientRepository.findAll({ search: req.query.search })
    res.json(clients)
  } catch (err) {
    next(err)
  }
})

app.get('/api/admin/clients/:id', async (req, res, next) => {
  try {
    const client = await clientRepository.findById(req.params.id)
    if (!client) throw new NotFoundError('Клиент не найден')
    const history = await appointmentRepository.findAll({ client_id: req.params.id })
    res.json({ ...client, history })
  } catch (err) {
    next(err)
  }
})

// ── Мастера ──
app.get('/api/admin/barbers', async (_req, res, next) => {
  try {
    const barbers = await barberRepository.findAll()
    res.json(barbers)
  } catch (err) {
    next(err)
  }
})

app.post('/api/admin/barbers', async (req, res, next) => {
  try {
    const barber = await barberRepository.create(req.body)

    await activityLogService.log({
      action: 'barber.created',
      entityType: 'barber',
      details: { name: req.body.name },
    })

    res.status(201).json(barber)
  } catch (err) {
    next(err)
  }
})

app.put('/api/admin/barbers/:id', async (req, res, next) => {
  try {
    const barber = await barberRepository.update(req.params.id, req.body)

    await activityLogService.log({
      action: 'barber.updated',
      entityType: 'barber',
      entityId: req.params.id,
    })

    res.json(barber)
  } catch (err) {
    next(err)
  }
})

app.delete('/api/admin/barbers/:id', async (req, res, next) => {
  try {
    await barberRepository.delete(req.params.id)

    await activityLogService.log({
      action: 'barber.deleted',
      entityType: 'barber',
      entityId: req.params.id,
    })

    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

// ── Услуги ──
app.get('/api/admin/services', async (_req, res, next) => {
  try {
    const services = await serviceRepository.findAll()
    res.json(services)
  } catch (err) {
    next(err)
  }
})

app.post('/api/admin/services', async (req, res, next) => {
  try {
    const service = await serviceRepository.create(req.body)

    await activityLogService.log({
      action: 'service.created',
      entityType: 'service',
      details: { title: req.body.title },
    })

    res.status(201).json(service)
  } catch (err) {
    next(err)
  }
})

app.put('/api/admin/services/:id', async (req, res, next) => {
  try {
    const service = await serviceRepository.update(req.params.id, req.body)

    await activityLogService.log({
      action: 'service.updated',
      entityType: 'service',
      entityId: req.params.id,
    })

    res.json(service)
  } catch (err) {
    next(err)
  }
})

app.delete('/api/admin/services/:id', async (req, res, next) => {
  try {
    await serviceRepository.delete(req.params.id)

    await activityLogService.log({
      action: 'service.deleted',
      entityType: 'service',
      entityId: req.params.id,
    })

    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

// ── Статистика ──
app.get('/api/admin/stats', async (req, res, next) => {
  try {
    const today = new Date()
    const weekAgo = new Date(today)
    weekAgo.setDate(weekAgo.getDate() - 7)
    const monthAgo = new Date(today)
    monthAgo.setMonth(monthAgo.getMonth() - 1)

    const todayStr = today.toISOString().split('T')[0]
    const weekAgoStr = weekAgo.toISOString().split('T')[0]
    const monthAgoStr = monthAgo.toISOString().split('T')[0]

    const [todayStats, weekStats, monthStats, todayCount, allMonth, totalClients] = await Promise.all([
      appointmentRepository.getStats(todayStr, todayStr),
      appointmentRepository.getStats(weekAgoStr, todayStr),
      appointmentRepository.getStats(monthAgoStr, todayStr),
      appointmentRepository.getTodayCount(),
      appointmentRepository.findAll({
        date_gte: monthAgoStr,
        limit: 10000,
      }),
      supabase.from('clients').select('id, created_at', { count: 'exact' }),
    ])

    // Новые клиенты за месяц
    const allMonthData = allMonth || []
    const newClients = totalClients.data
      ? totalClients.data.filter((c) => c.created_at >= monthAgoStr).length
      : 0

    // Средний чек
    const completedMonth = allMonthData.filter((a) => a.status === 'completed')
    const totalRevenue = completedMonth.reduce((sum, a) => sum + (a.service_price || 0), 0)
    const avgCheck = completedMonth.length > 0 ? Math.round(totalRevenue / completedMonth.length) : 0

    // Повторные клиенты
    const clientIds = new Set()
    const repeatClients = new Set()
    allMonthData.forEach((a) => {
      if (clientIds.has(a.client_id)) repeatClients.add(a.client_id)
      else clientIds.add(a.client_id)
    })
    const repeatRate = clientIds.size > 0 ? Math.round((repeatClients.size / clientIds.size) * 100) : 0

    // Загрузка мастеров
    const barbers = await barberRepository.findAll()
    const totalWorkingDays = 22 // примерно
    const barberLoad = barbers.map((b) => {
      const barberApps = allMonthData.filter((a) => a.barber_id === b.id && a.status !== 'cancelled')
      const totalSlots = totalWorkingDays * 8 // 8 слотов в день
      const usedSlots = barberApps.length
      return {
        name: b.name,
        loadPct: Math.min(Math.round((usedSlots / totalSlots) * 100), 100),
      }
    })

    res.json({
      today: { count: todayCount, revenue: todayStats.revenue },
      week: { count: weekStats.total, revenue: weekStats.revenue },
      month: { count: monthStats.total, revenue: monthStats.revenue },
      popularServices: monthStats.byService,
      popularBarbers: monthStats.byBarber,
      newClients,
      avgCheck,
      repeatRate,
      barberLoad,
    })
  } catch (err) {
    next(err)
  }
})

// ── Настройки ──
app.get('/api/admin/settings', async (_req, res, next) => {
  try {
    const settings = await settingsRepository.getAll()
    res.json(settings)
  } catch (err) {
    next(err)
  }
})

app.put('/api/admin/settings', async (req, res, next) => {
  try {
    const entries = Object.entries(req.body)
    for (const [key, value] of entries) {
      await settingsRepository.set(key, value)
    }

    await activityLogService.log({
      action: 'settings.updated',
      entityType: 'settings',
      details: { keys: entries.map(([k]) => k) },
    })

    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

// ── Логи активности ──
app.get('/api/admin/logs', async (req, res, next) => {
  try {
    const logs = await activityLogService.findAll({
      action: req.query.action,
      entityType: req.query.entity_type,
      limit: parseInt(req.query.limit) || 100,
    })
    res.json(logs)
  } catch (err) {
    next(err)
  }
})

// ── Отзывы (админка) ──
app.get('/api/admin/reviews', async (_req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    res.json(data)
  } catch (err) {
    next(err)
  }
})

app.patch('/api/admin/reviews/:id', async (req, res, next) => {
  try {
    const { is_approved, is_visible } = req.body
    const updates = {}
    if (is_approved !== undefined) updates.is_approved = is_approved
    if (is_visible !== undefined) updates.is_visible = is_visible

    const { data, error } = await supabase
      .from('reviews')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single()

    if (error) throw error
    res.json(data)
  } catch (err) {
    next(err)
  }
})

app.delete('/api/admin/reviews/:id', async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('reviews')
      .delete()
      .eq('id', req.params.id)

    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

// ── Платежи (админка) ──
app.get('/api/admin/payments', async (_req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('payments')
      .select('*, appointment:appointments(*)')
      .order('created_at', { ascending: false })

    if (error) throw error
    res.json(data)
  } catch (err) {
    next(err)
  }
})

app.post('/api/admin/payments', async (req, res, next) => {
  try {
    const { appointment_id, amount, method, status } = req.body
    const { data, error } = await supabase
      .from('payments')
      .insert({ appointment_id, amount, method, status: status || 'completed' })
      .select()
      .single()

    if (error) throw error
    res.status(201).json(data)
  } catch (err) {
    next(err)
  }
})

app.patch('/api/admin/payments/:id', async (req, res, next) => {
  try {
    const { status } = req.body
    const { data, error } = await supabase
      .from('payments')
      .update({ status })
      .eq('id', req.params.id)
      .select()
      .single()

    if (error) throw error
    res.json(data)
  } catch (err) {
    next(err)
  }
})

// ── Расписание (админка) ──
// Рабочие часы мастера
app.get('/api/admin/barbers/:id/working-hours', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('working_hours')
      .select('*')
      .eq('barber_id', req.params.id)
      .order('day_of_week')

    if (error) throw error
    res.json(data)
  } catch (err) {
    next(err)
  }
})

app.put('/api/admin/barbers/:id/working-hours', async (req, res, next) => {
  try {
    const hours = req.body.hours || []
    const records = hours.map((h) => ({
      barber_id: req.params.id,
      day_of_week: h.day_of_week,
      start_time: h.start_time,
      end_time: h.end_time,
      is_working: h.is_working ?? true,
    }))

    const { error } = await supabase
      .from('working_hours')
      .upsert(records, { onConflict: 'barber_id,day_of_week' })

    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

// Выходные дни мастера
app.get('/api/admin/barbers/:id/days-off', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('days_off')
      .select('*')
      .eq('barber_id', req.params.id)
      .order('date')

    if (error) throw error
    res.json(data)
  } catch (err) {
    next(err)
  }
})

app.post('/api/admin/barbers/:id/days-off', async (req, res, next) => {
  try {
    const { date, reason } = req.body
    const { data, error } = await supabase
      .from('days_off')
      .insert({ barber_id: req.params.id, date, reason })
      .select()
      .single()

    if (error) throw error
    res.status(201).json(data)
  } catch (err) {
    next(err)
  }
})

app.delete('/api/admin/days-off/:id', async (req, res, next) => {
  try {
    const { error } = await supabase.from('days_off').delete().eq('id', req.params.id)
    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

// ──────────────────────────────────────────────
//  Middleware ошибок
// ──────────────────────────────────────────────
app.use(errorHandler)

app.listen(PORT, () => {
  logger.info(`Сервер запущен на http://localhost:${PORT}`)
})
