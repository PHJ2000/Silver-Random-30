import { Router } from 'express'
import type { ServerConfig } from '../../../shared/types.js'

const router = Router()

router.get('/', (_req, res) => {
  const config: ServerConfig = {
    hasDiscordWebhook: Boolean(process.env.DISCORD_WEBHOOK_URL),
    port: Number.parseInt(process.env.PORT ?? '8080', 10),
    timezone: process.env.TZ ?? 'Asia/Seoul',
    apiKey: process.env.API_KEY ?? null,
  }
  res.json(config)
})

export default router
