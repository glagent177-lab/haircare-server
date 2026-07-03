import { AppError } from '../utils/errors.js'
import { logger } from '../utils/logger.js'

export function errorHandler(err, _req, res, _next) {
  if (err instanceof AppError) {
    logger.warn(`${err.name}: ${err.message}`)
    return res.status(err.statusCode).json({
      error: err.message,
      ...(err.details ? { details: err.details } : {}),
    })
  }

  logger.error('Unhandled error:', {
    message: err.message,
    stack: err.stack?.split('\n').slice(0, 3).join('\n'),
    url: _req.originalUrl,
    method: _req.method,
  })

  res.status(500).json({
    error: 'Внутренняя ошибка сервера',
  })
}
