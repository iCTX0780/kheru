const OPFS_ROOT = 'kheru-audio'

function isOpfsAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'storage' in navigator && 'getDirectory' in navigator.storage
}

async function getRootDir(): Promise<FileSystemDirectoryHandle> {
  return navigator.storage.getDirectory()
}

async function ensureDir(parent: FileSystemDirectoryHandle, name: string): Promise<FileSystemDirectoryHandle> {
  return parent.getDirectoryHandle(name, { create: true })
}

async function paragraphGenerationPath(
  projectId: string,
  paragraphId: string,
  generationId: string
): Promise<FileSystemFileHandle> {
  const root = await getRootDir()
  const appDir = await ensureDir(root, OPFS_ROOT)
  const projectDir = await ensureDir(appDir, projectId)
  const paragraphsDir = await ensureDir(projectDir, 'paragraphs')
  const paragraphDir = await ensureDir(paragraphsDir, paragraphId)
  return paragraphDir.getFileHandle(`${generationId}.wav`, { create: true })
}

async function chapterPath(projectId: string, chapterId: string): Promise<FileSystemFileHandle> {
  const root = await getRootDir()
  const appDir = await ensureDir(root, OPFS_ROOT)
  const projectDir = await ensureDir(appDir, projectId)
  const chaptersDir = await ensureDir(projectDir, 'chapters')
  return chaptersDir.getFileHandle(`${chapterId}.wav`, { create: true })
}

export function opfsAudioSupported(): boolean {
  return isOpfsAvailable()
}

export async function saveParagraphAudioOpfs(
  projectId: string,
  paragraphId: string,
  generationId: string,
  blob: Blob
): Promise<void> {
  if (!isOpfsAvailable()) return
  const handle = await paragraphGenerationPath(projectId, paragraphId, generationId)
  const writable = await handle.createWritable()
  await writable.write(blob)
  await writable.close()
}

export async function loadParagraphAudioOpfs(
  projectId: string,
  paragraphId: string,
  generationId: string
): Promise<Blob | null> {
  if (!isOpfsAvailable()) return null
  try {
    const root = await getRootDir()
    const appDir = await root.getDirectoryHandle(OPFS_ROOT)
    const projectDir = await appDir.getDirectoryHandle(projectId)
    const paragraphsDir = await projectDir.getDirectoryHandle('paragraphs')
    const paragraphDir = await paragraphsDir.getDirectoryHandle(paragraphId)
    const handle = await paragraphDir.getFileHandle(`${generationId}.wav`)
    return handle.getFile()
  } catch {
    return null
  }
}

/** Legacy flat path: paragraphs/{paragraphId}.wav (pre-v2). */
export async function loadLegacyParagraphAudioOpfs(
  projectId: string,
  paragraphId: string
): Promise<Blob | null> {
  if (!isOpfsAvailable()) return null
  try {
    const root = await getRootDir()
    const appDir = await root.getDirectoryHandle(OPFS_ROOT)
    const projectDir = await appDir.getDirectoryHandle(projectId)
    const paragraphsDir = await projectDir.getDirectoryHandle('paragraphs')
    const handle = await paragraphsDir.getFileHandle(`${paragraphId}.wav`)
    return handle.getFile()
  } catch {
    return null
  }
}

export async function saveChapterAudioOpfs(
  projectId: string,
  chapterId: string,
  blob: Blob
): Promise<void> {
  if (!isOpfsAvailable()) return
  const handle = await chapterPath(projectId, chapterId)
  const writable = await handle.createWritable()
  await writable.write(blob)
  await writable.close()
}

export async function loadChapterAudioOpfs(
  projectId: string,
  chapterId: string
): Promise<Blob | null> {
  if (!isOpfsAvailable()) return null
  try {
    const root = await getRootDir()
    const appDir = await root.getDirectoryHandle(OPFS_ROOT)
    const projectDir = await appDir.getDirectoryHandle(projectId)
    const chaptersDir = await projectDir.getDirectoryHandle('chapters')
    const handle = await chaptersDir.getFileHandle(`${chapterId}.wav`)
    return handle.getFile()
  } catch {
    return null
  }
}

export async function deleteChapterAudioOpfs(projectId: string, chapterId: string): Promise<void> {
  if (!isOpfsAvailable()) return
  try {
    const root = await getRootDir()
    const appDir = await root.getDirectoryHandle(OPFS_ROOT)
    const projectDir = await appDir.getDirectoryHandle(projectId)
    const chaptersDir = await projectDir.getDirectoryHandle('chapters')
    await chaptersDir.removeEntry(`${chapterId}.wav`)
  } catch {
    /* ignore */
  }
}

export async function deleteParagraphGenerationAudioOpfs(
  projectId: string,
  paragraphId: string,
  generationId: string
): Promise<void> {
  if (!isOpfsAvailable()) return
  try {
    const root = await getRootDir()
    const appDir = await root.getDirectoryHandle(OPFS_ROOT)
    const projectDir = await appDir.getDirectoryHandle(projectId)
    const paragraphsDir = await projectDir.getDirectoryHandle('paragraphs')
    const paragraphDir = await paragraphsDir.getDirectoryHandle(paragraphId)
    await paragraphDir.removeEntry(`${generationId}.wav`)
  } catch {
    /* ignore */
  }
}

export async function deleteParagraphAudioOpfs(projectId: string, paragraphId: string): Promise<void> {
  if (!isOpfsAvailable()) return
  try {
    const root = await getRootDir()
    const appDir = await root.getDirectoryHandle(OPFS_ROOT)
    const projectDir = await appDir.getDirectoryHandle(projectId)
    const paragraphsDir = await projectDir.getDirectoryHandle('paragraphs')
    await paragraphsDir.removeEntry(`${paragraphId}.wav`)
  } catch {
    /* ignore legacy flat file */
  }
  try {
    const root = await getRootDir()
    const appDir = await root.getDirectoryHandle(OPFS_ROOT)
    const projectDir = await appDir.getDirectoryHandle(projectId)
    const paragraphsDir = await projectDir.getDirectoryHandle('paragraphs')
    await paragraphsDir.removeEntry(paragraphId, { recursive: true })
  } catch {
    /* ignore */
  }
}

/** Recursively remove the entire `kheru-audio/{projectId}` tree (all paragraph
 * takes, legacy flat files, and chapter/full-mix WAVs). */
export async function deleteProjectAudioOpfs(projectId: string): Promise<void> {
  if (!isOpfsAvailable()) return
  try {
    const root = await getRootDir()
    const appDir = await root.getDirectoryHandle(OPFS_ROOT)
    await appDir.removeEntry(projectId, { recursive: true })
  } catch {
    /* ignore (unsupported or already absent) */
  }
}

/** Sum the byte size of every file under `kheru-audio/{projectId}`. Returns 0
 * when OPFS is unavailable or the project has no audio. */
export async function measureProjectOpfs(projectId: string): Promise<number> {
  if (!isOpfsAvailable()) return 0
  try {
    const root = await getRootDir()
    const appDir = await root.getDirectoryHandle(OPFS_ROOT)
    const projectDir = await appDir.getDirectoryHandle(projectId)
    return await measureDir(projectDir)
  } catch {
    return 0
  }
}

async function measureDir(dir: FileSystemDirectoryHandle): Promise<number> {
  let total = 0
  // FileSystemDirectoryHandle is async-iterable over [name, handle] entries.
  for await (const [, handle] of dir as unknown as AsyncIterable<
    [string, FileSystemFileHandle | FileSystemDirectoryHandle]
  >) {
    if (handle.kind === 'file') {
      try {
        const file = await handle.getFile()
        total += file.size
      } catch {
        /* skip unreadable entry */
      }
    } else {
      total += await measureDir(handle)
    }
  }
  return total
}
