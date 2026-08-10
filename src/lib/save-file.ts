import { downloadBlob } from '@/lib/export-download'

export interface SaveFilter {
  name: string
  extensions: string[]
}

function isTauriRuntime(): boolean {
  if (typeof window === 'undefined') return false
  return '__TAURI_INTERNALS__' in window
}

/**
 * Persist a blob to disk. In the Tauri desktop build this opens a native
 * "Save As" dialog and writes to the user-chosen path. In the browser/Docker
 * build it falls back to a same-origin anchor download.
 */
export async function saveBlob(blob: Blob, filename: string, filters?: SaveFilter[]): Promise<void> {
  if (!isTauriRuntime()) {
    downloadBlob(blob, filename)
    return
  }

  const [{ save }, { writeFile }] = await Promise.all([
    import('@tauri-apps/plugin-dialog'),
    import('@tauri-apps/plugin-fs'),
  ])
  const targetPath = await save({ defaultPath: filename, filters })
  if (!targetPath) return // user cancelled

  const bytes = new Uint8Array(await blob.arrayBuffer())
  await writeFile(targetPath, bytes)
}

export const WAV_FILTERS: SaveFilter[] = [{ name: 'WAV audio', extensions: ['wav'] }]
export const ZIP_FILTERS: SaveFilter[] = [{ name: 'ZIP archive', extensions: ['zip'] }]
export const PLAYPACK_FILTERS: SaveFilter[] = [{ name: 'Kheru Playpack', extensions: ['kheru'] }]
