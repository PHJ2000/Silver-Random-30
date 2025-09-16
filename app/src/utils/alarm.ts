let audioContext: AudioContext | null = null

export async function playAlarm(volume = 0.7) {
  if (typeof window === 'undefined') return
  try {
    if (!audioContext) {
      audioContext = new AudioContext()
    }
    if (audioContext.state === 'suspended') {
      await audioContext.resume()
    }
    const osc = audioContext.createOscillator()
    const gain = audioContext.createGain()
    gain.gain.value = Math.max(0, Math.min(1, volume))
    osc.type = 'triangle'
    osc.frequency.value = 880
    osc.connect(gain)
    gain.connect(audioContext.destination)
    osc.start()
    osc.stop(audioContext.currentTime + 1.5)
  } catch (error) {
    console.warn('Failed to play alarm', error)
  }
}
