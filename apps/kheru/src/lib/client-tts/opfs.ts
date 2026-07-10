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

async function paragraphPath(projectId: string, paragraphId: string): Promise<FileSystemFileHandle> {
  const root = await getRootDir()
  const appDir = await ensureDir(root, OPFS_ROOT)
  const projectDir = await ensureDir(appDir, projectId)
  const paragraphsDir = await ensureDir(projectDir, 'paragraphs')
  return paragraphsDir.getFileHandle(`${paragraphId}.wav`, { create: true })
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
  blob: Blob
): Promise<void> {
  if (!isOpfsAvailable()) return
  const handle = await paragraphPath(projectId, paragraphId)
  const writable = await handle.createWritable()
  await writable.write(blob)
  await writable.close()
}

export async function loadParagraphAudioOpfs(
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
    const file = await handle.getFile()
    return file
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

export async function deleteParagraphAudioOpfs(projectId: string, paragraphId: string): Promise<void> {
  if (!isOpfsAvailable()) return
  try {
    const root = await getRootDir()
    const appDir = await root.getDirectoryHandle(OPFS_ROOT)
    const projectDir = await appDir.getDirectoryHandle(projectId)
    const paragraphsDir = await projectDir.getDirectoryHandle('paragraphs')
    await paragraphsDir.removeEntry(`${paragraphId}.wav`)
  } catch {
    /* ignore */
  }
}
