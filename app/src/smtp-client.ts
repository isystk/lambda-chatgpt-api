import nodemailer, { type TransportOptions } from 'nodemailer'

const SMTP_SERVER = process.env.SMTP_SERVER ?? 'localhost'
const SMTP_PORT = process.env.SMTP_PORT ?? '25'
const SMTP_SECURE = process.env.SMTP_SECURE ?? 'false'
const SMTP_USER = process.env.SMTP_USER ?? ''
const SMTP_PASS = process.env.SMTP_PASS ?? ''
const MAIL_FROM_ADDRESS = process.env.MAIL_FROM_ADDRESS ?? ''

type MailOptions = {
  from: string
  to: string
  subject: string
  text: string
}

class SmtpClient {
  private transporter
  constructor() {
    const options = {
      host: SMTP_SERVER,
      port: Number(SMTP_PORT),
      secure: SMTP_SECURE === 'true',
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    } as TransportOptions
    this.transporter = nodemailer.createTransport(options)
  }

  async mailSend(
    fromEmail: string | undefined = MAIL_FROM_ADDRESS,
    toEmail: string,
    subject: string,
    bodyText: string
  ) {
    const mailOptions = {
      from: fromEmail,
      to: toEmail,
      subject: subject,
      text: bodyText,
    } as MailOptions
    const info = await this.transporter.sendMail(mailOptions)
    console.log(info)
  }
}

export { SmtpClient }
