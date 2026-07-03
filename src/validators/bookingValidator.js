import { ValidationError } from '../utils/errors.js'

const PHONE_REGEX = /^(\+7|8)?[\s\-]?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}$/

export function validateBookingInput(data) {
  const { name, phone, service, master, date, time } = data

  if (!name || !name.trim()) {
    throw new ValidationError('Укажите имя')
  }

  if (!phone || !phone.trim()) {
    throw new ValidationError('Укажите номер телефона')
  }

  if (!PHONE_REGEX.test(phone.trim())) {
    throw new ValidationError('Введите корректный номер телефона (например, +7 (999) 123-45-67)')
  }

  if (!service || !service.trim()) {
    throw new ValidationError('Выберите услугу')
  }

  if (!master || !master.trim()) {
    throw new ValidationError('Выберите мастера')
  }

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new ValidationError('Укажите корректную дату')
  }

  if (!time || !/^\d{2}:\d{2}$/.test(time)) {
    throw new ValidationError('Укажите корректное время')
  }

  return {
    name: name.trim(),
    phone: phone.trim(),
    service: service.trim(),
    master: master.trim(),
    date,
    time,
    price: data.price || '',
  }
}

export function validateBookingQuery(master, date) {
  if (!master) throw new ValidationError('Не указан мастер')
  if (!date) throw new ValidationError('Не указана дата')
  return { master: master.trim(), date }
}
