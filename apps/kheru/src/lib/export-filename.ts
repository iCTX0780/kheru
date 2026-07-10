/** Slugify project/chapter titles for safe download filenames. */
export function slugifyExportName(...parts: string[]): string {
  const slug = parts
    .map((part) =>
      part
        .trim()
        .toLowerCase()
        .replace(/['']/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
    )
    .filter(Boolean)
    .join('-')

  return slug || 'untitled'
}

export function exportBaseName(projectTitle: string, chapterTitle: string): string {
  return slugifyExportName(projectTitle, chapterTitle)
}
