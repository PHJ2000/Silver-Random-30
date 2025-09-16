import { useEffect } from 'react'
import { useSettingsStore } from '../store/settings'
import { exportSettings } from '../store/settings'

async function writeToHandle(handle: globalThis.FileSystemFileHandle, contents: string) {
  try {
    const writable = await handle.createWritable()
    await writable.write(contents)
    await writable.close()
  } catch (error) {
    console.warn('Failed to write settings file', error)
  }
}

export function useSettingsFileSync() {
  const { settings, fileHandle } = useSettingsStore((state) => ({
    settings: state.settings,
    fileHandle: state.fileHandle,
  }))

  useEffect(() => {
    if (!fileHandle) return
    const json = exportSettings()
    void writeToHandle(fileHandle, json)
  }, [fileHandle, settings])
}
