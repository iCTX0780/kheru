/** Slugify project titles for safe download filenames. */
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

/** Base filename for exports — project title only (flat script model). */
export function exportBaseName(projectTitle: string, _ignoredChapterTitle?: string): string {
  return slugifyExportName(projectTitle)
}
