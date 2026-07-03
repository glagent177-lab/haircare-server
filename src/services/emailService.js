import { Resend } from 'resend'
import { logger } from '../utils/logger.js'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM_EMAIL = process.env.EMAIL_FROM || 'onboarding@resend.dev'

export const emailService = {
  async sendBookingConfirmation(booking) {
    const { email, client_name, service_name, barber_name, date, time, service_price, confirmation_token } = booking

    if (!email) return

    const confirmUrl = `${process.env.SERVER_ORIGIN || 'https://haircare-server-pj24.onrender.com'}/api/bookings/confirm/${confirmation_token}`

    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        subject: 'Подтверждение записи — HairCare Barbershop',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; background: #111; color: #fff; padding: 40px; border-radius: 16px;">
            <div style="text-align: center; margin-bottom: 32px;">
              <h1 style="color: #D4AF37; font-size: 28px; margin: 0;">HairCare</h1>
              <p style="color: #888; font-size: 14px; margin: 4px 0 0;">Barbershop</p>
            </div>

            <p style="font-size: 16px; color: #ddd;">Здравствуйте, <strong style="color: #fff;">${client_name}</strong>!</p>
            <p style="font-size: 14px; color: #aaa; margin-bottom: 24px;">
              Вы записаны. Пожалуйста, подтвердите запись:
            </p>

            <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #333; color: #888; font-size: 14px;">Услуга</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #333; color: #fff; font-size: 14px; text-align: right;">${service_name}</td>
              </tr>
              ${service_price ? `<tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #333; color: #888; font-size: 14px;">Цена</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #333; color: #D4AF37; font-size: 14px; text-align: right;">${service_price} ₽</td>
              </tr>` : ''}
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #333; color: #888; font-size: 14px;">Мастер</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #333; color: #fff; font-size: 14px; text-align: right;">${barber_name}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #333; color: #888; font-size: 14px;">Дата</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #333; color: #fff; font-size: 14px; text-align: right;">${date}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #888; font-size: 14px;">Время</td>
                <td style="padding: 10px 0; color: #fff; font-size: 14px; text-align: right;">${time}</td>
              </tr>
            </table>

            <div style="text-align: center; margin: 32px 0;">
              <a href="${confirmUrl}" style="display: inline-block; background: #D4AF37; color: #000; text-decoration: none; font-size: 18px; font-weight: bold; padding: 16px 40px; border-radius: 12px;">
                Подтвердить запись
              </a>
            </div>

            <p style="font-size: 13px; color: #666; text-align: center;">
              Если вы не подтвердите запись в течение 30 минут, она будет автоматически отменена.
            </p>
            <p style="font-size: 12px; color: #555; text-align: center; margin-top: 8px;">
              Если что-то пошло не так, позвоните нам по телефону, указанному на сайте.
            </p>
          </div>
        `,
      })
      logger.info(`Confirmation email sent to ${email} for booking #${booking.id}`)
    } catch (err) {
      logger.error(`Failed to send email to ${email}:`, err.message)
    }
  },
}
