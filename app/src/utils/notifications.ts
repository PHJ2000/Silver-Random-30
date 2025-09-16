export function ensureNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission === 'default') {
    Notification.requestPermission().catch(() => undefined)
  }
}

export function notifyTimerFinished() {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission !== 'granted') return
  try {
    new Notification('실랜디 30', {
      body: '타이머가 종료되었습니다. 수고하셨습니다!',
    })
  } catch (error) {
    console.warn('Failed to show notification', error)
  }
}
