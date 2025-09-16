import type { Request, Response } from 'express'
import { Router } from 'express'
import { sendDiscord } from '../utils/discord.js'

const router = Router()

router.post('/discord/test', async (req: Request, res: Response) => {
  const message = typeof req.body?.message === 'string' ? req.body.message : '실랜디 웹훅 테스트 메시지'
  await sendDiscord(`🔔 ${message}`)
  res.json({ ok: true })
})

export default router
