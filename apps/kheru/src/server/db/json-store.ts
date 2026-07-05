import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { DATA_DIR } from '@/server/tts/paths'

mkdirSync(DATA_DIR, { recursive: true })

const PROJECTS_FILE = resolve(DATA_DIR, 'projects.json')
const GENERATIONS_FILE = resolve(DATA_DIR, 'generations.json')

function readJson<T>(path: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T
  } catch {
    return fallback
  }
}

function writeJsonAtomic(path: string, data: unknown): void {
  const tmp = `${path}.tmp`
  writeFileSync(tmp, JSON.stringify(data, null, 2))
  renameSync(tmp, path)
}

export interface ProjectRecord {
  id: string
  name: string
  paragraphs: unknown[]
  updatedAt: string
}

export const jsonStore = {
  listProjects(): ProjectRecord[] {
    return readJson<ProjectRecord[]>(PROJECTS_FILE, [])
  },

  upsertProject(project: ProjectRecord): ProjectRecord {
    const projects = this.listProjects()
    const idx = projects.findIndex((p) => p.id === project.id)
    const next = { ...project, updatedAt: new Date().toISOString() }
    if (idx === -1) projects.push(next)
    else projects[idx] = next
    writeJsonAtomic(PROJECTS_FILE, projects)
    return next
  },

  appendGeneration(entry: { runId: string; createdAt?: string }): void {
    const generations = readJson<{ runId: string; createdAt: string }[]>(GENERATIONS_FILE, [])
    generations.push({ runId: entry.runId, createdAt: entry.createdAt ?? new Date().toISOString() })
    writeJsonAtomic(GENERATIONS_FILE, generations)
  },
}
