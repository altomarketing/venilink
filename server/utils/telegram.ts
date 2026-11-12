import type { H3Event } from 'h3'
import process from 'node:process'

const BOT_PATTERNS = [
  /bot/i,
  /spider/i,
  /crawl/i,
  /curl/i,
  /wget/i,
  /python/i,
  /headless/i,
  /scanner/i,
  /censys/i,
  /shodan/i,
  /go-http-client/i,
]

const IGNORED_PATHS = [
  'favicon.ico',
  'robots.txt',
  'sitemap.xml',
  '.env',
  'wp-login.php',
  'wp-admin',
  'xmlrpc.php',
  '.git',
  'phpmyadmin',
  'apple-app-site-association',
  '.well-known',
]

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function isSpamOrBot(slug: string, userAgent: string): boolean {
  const lowerSlug = slug.toLowerCase()
  if (IGNORED_PATHS.some(path => lowerSlug.includes(path))) {
    return true
  }
  return BOT_PATTERNS.some(pattern => pattern.test(userAgent))
}

export function notifyMissingLink(event: H3Event, slug: string): void {
  const config = useRuntimeConfig(event)
  const cfEnv = event.context.cloudflare?.env as Record<string, string | undefined> | undefined

  const token = config.telegramBotToken
    || cfEnv?.TELEGRAM_BOT_TOKEN
    || cfEnv?.NUXT_TELEGRAM_BOT_TOKEN
    || process.env.TELEGRAM_BOT_TOKEN
  const chatId = config.telegramChatId
    || cfEnv?.TELEGRAM_CHAT_ID
    || cfEnv?.NUXT_TELEGRAM_CHAT_ID
    || process.env.TELEGRAM_CHAT_ID

  if (!token || !chatId)
    return

  const userAgent = getHeader(event, 'user-agent') || ''
  const verifiedBot = event.context.cloudflare?.request?.cf?.botManagement?.verifiedBot
  if (verifiedBot || isSpamOrBot(slug, userAgent))
    return

  const referer = getHeader(event, 'referer') || 'Directo (sin referer)'
  const country = String(
    event.context.cloudflare?.request?.cf?.country
    || getHeader(event, 'cf-ipcountry')
    || 'Desconocido',
  )

  const safeSlug = escapeHtml(slug)
  const safeCountry = escapeHtml(country)
  const safeReferer = escapeHtml(referer)
  const safeUa = escapeHtml(userAgent.slice(0, 120))

  const message = [
    `⚠️ <b>404 en veni.link detectado</b>`,
    ``,
    `🔗 <b>Slug pedido:</b> <code>/${safeSlug}</code>`,
    `🌐 <b>URL completa:</b> https://veni.link/${safeSlug}`,
    `📍 <b>País:</b> ${safeCountry}`,
    `↩️ <b>Referer:</b> ${safeReferer}`,
    `📱 <b>User-Agent:</b> <code>${safeUa}</code>`,
    ``,
    `💡 <i>Podés crearlo en el Dashboard si era un link legítimo.</i>`,
  ].join('\n')

  const url = `https://api.telegram.org/bot${token}/sendMessage`

  const sendPromise = fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  }).then(() => {}).catch((error) => {
    console.error({ event: 'telegram.notification.failed', error: String(error) })
  })

  if (event.context.cloudflare?.context?.waitUntil) {
    event.context.cloudflare.context.waitUntil(sendPromise)
  }
}
