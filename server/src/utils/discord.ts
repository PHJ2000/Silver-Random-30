export interface DiscordEmbed {
  title?: string
  description?: string
  color?: number
  fields?: Array<{ name: string; value: string; inline?: boolean }>
}

export async function sendDiscord(content: string, embeds?: DiscordEmbed[], overrideUrl?: string) {
  const urls = [process.env.DISCORD_WEBHOOK_URL, overrideUrl].filter(Boolean) as string[]
  await Promise.all(
    urls.map((url) =>
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, embeds }),
      }).catch((error) => {
        console.warn('Failed to send Discord webhook', error)
      }),
    ),
  )
}
