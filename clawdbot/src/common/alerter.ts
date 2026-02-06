import TelegramBot from 'node-telegram-bot-api';
import nodemailer from 'nodemailer';
import axios from 'axios';
import { logger } from './logger';

// Telegram 告警
export async function sendTelegramAlert(
  message: string,
  level: 'info' | 'warning' | 'critical' = 'info'
) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.ALERT_TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    logger.warn('Telegram alert not configured');
    return;
  }

  const emoji = {
    info: 'ℹ️',
    warning: '⚠️',
    critical: '🚨',
  };

  const fullMessage = `${emoji[level]} **Clawdbot Alert**\n\n${message}\n\n时间: ${new Date().toLocaleString('zh-CN')}`;

  try {
    const bot = new TelegramBot(token, { polling: false });
    await bot.sendMessage(chatId, fullMessage, { parse_mode: 'Markdown' });
    logger.info('Telegram alert sent');
  } catch (error) {
    logger.error('Failed to send Telegram alert:', error);
  }
}

// 邮件告警
export async function sendEmailAlert(subject: string, message: string) {
  const emailUser = process.env.EMAIL_USER;
  const emailPassword = process.env.EMAIL_PASSWORD;
  const alertEmail = process.env.ALERT_EMAIL;

  if (!emailUser || !emailPassword || !alertEmail) {
    logger.warn('Email alert not configured');
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: emailUser,
        pass: emailPassword,
      },
    });

    await transporter.sendMail({
      from: emailUser,
      to: alertEmail,
      subject: `[Clawdbot] ${subject}`,
      text: message,
      html: `<pre>${message}</pre>`,
    });

    logger.info('Email alert sent');
  } catch (error) {
    logger.error('Failed to send email alert:', error);
  }
}

// Webhook 告警
export async function sendWebhookAlert(data: any) {
  const webhookUrl = process.env.ALERT_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    await axios.post(webhookUrl, {
      timestamp: new Date().toISOString(),
      service: 'clawdbot',
      ...data,
    });
    logger.info('Webhook alert sent');
  } catch (error) {
    logger.error('Failed to send webhook alert:', error);
  }
}
