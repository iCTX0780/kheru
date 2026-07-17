import { revokeManagedBlobUrl } from '@/lib/client-tts/blob-registry'
import {
  deleteChapterAudioOpfs,
  deleteParagraphAudioOpfs,
} from '@/lib/client-tts/opfs'
import type { Paragraph } from '@/stores/studio'
import type { ProjectChapter } from '@/lib/project-db'

export function releaseParagraphAudio(paragraph: Paragraph): void {
  revokeManagedBlobUrl(paragraph.audioUrl)
  for (const generation of paragraph.generations ?? []) {
    revokeManagedBlobUrl(generation.audioUrl)
  }
}

export function releaseChapterAudioResources(
  projectId: string,
  chapter: ProjectChapter
): void {
  revokeManagedBlobUrl(chapter.chapter.audioUrl)
  for (const paragraph of chapter.paragraphs) {
    releaseParagraphAudio(paragraph)
    void deleteParagraphAudioOpfs(projectId, paragraph.id)
  }
  void deleteChapterAudioOpfs(projectId, chapter.id)
}
