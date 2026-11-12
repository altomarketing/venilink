import type { H3Event } from 'h3'

const BOT_PATTERNS = [
  /bot/i, /spider/i, /crawl/i, /curl/i, /wget/i, /python/i,
  /headless/i, /scanner/i, /censys/i, /shodan/i
]

const IGNORED_PATHS = [
  'favicon.ico', 'robots.txt', 'sitemap.xml', '.env', 'wp-login.php',
  'wp-admin', 'xmlrpc.php', '.git', 'phpmyadmin', 'apple-app-site-association'
]

export function isSpamOrBot(slug: string, userAgent: string): boolean {
  if (IGNORED_PATHS.some(path => slug.toLowerCase().includes(path))) {
    return true
  }
  return BOT_PATTERNS.some(pattern => pattern.test(userAgent))
}

export async function notifyMissingLink(event: H3Event, slug: string) {
  const env = event.context.cloudflare?.env as Record<string, string | undefined> | undefined
  const token = env?.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN
  const chatId = env?.TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID

  if (!token || !chatId) return

  const req = event.node?.req
  const userAgent = getHeader(event, 'user-agent') || ''
  const referer = getHeader(event, 'referer') || 'Directo (sin referer)'
  const country = getHeader(event, 'cf-ipcountry') || 'Desconocido'

  if (isSpamOrBot(slug, userAgent)) return

  const message = [
    `⚠️ <b>404 en veni.link detectado</b>`,
    ``,
    `🔗 <b>Slug pedido:</b> <code>/${slug}</code>`,
    `🌐 <b>URL completa:</b> https://veni.link/${slug}`,
    `📍 <b>País:</b> ${country}`,
    `↩️ <b>Referer:</b> ${referer}`,
    `📱 <b>User-Agent:</b> <code>${userAgent.slice(0, 120)}</code>`,
    ``,
    `💡 <i>Podés crearlo en el Dashboard si era un link legítimo.</i>`
  ].join('\n')

  const url = `https://api.telegram.org/bot${token}/sendMessage`
  
  const fetchPromise = fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    })
  }).catch(() => {})

  // En Cloudflare Workers/Pages, waitUntil ejecuta la promesa en background
  // sin retrasar la respuesta/redirección al visitante
  if (event.context.cloudflare?.context?.waitUntil) {
    event.context.cloudflare.context.waitUntil(fetchPromise)
  } else {
    await fetchPromise
  }
}
