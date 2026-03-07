/**
 * 工作区数据导出器
 * 导出为 ZIP 格式，包含文档、PRD、原型等资源
 */

import { randomUUID } from 'crypto'
import * as path from 'path'
import * as fs from 'fs/promises'
import JSZip from 'jszip'
import { dbClient } from '~/lib/db/client'

export interface ExportOptions {
  workspaceId: string
  workspaceName: string
  includeDocuments?: boolean
  includePRDs?: boolean
  includePrototypes?: boolean
  includeOriginalFiles?: boolean
  includeSnapshots?: boolean
  dateFrom?: string
  dateTo?: string
}

export interface ExportManifest {
  version: string
  workspaceId: string
  workspaceName: string
  exportedAt: string
  counts: {
    documents: number
    prds: number
    prototypes: number
  }
}

export class WorkspaceExporter {
  private onProgress?: (stage: string, progress: number) => void

  setProgressCallback (fn: (stage: string, progress: number) => void) {
    this.onProgress = fn
  }

  /**
   * 导出工作区数据为 ZIP 文件
   * @returns ZIP 文件的临时路径
   */
  async export (options: ExportOptions): Promise<string> {
    const zip = new JSZip()
    const counts = { documents: 0, prds: 0, prototypes: 0 }

    this.onProgress?.('preparing', 0)

    // 并行导出各资源
    const tasks = []

    if (options.includeDocuments !== false) {
      tasks.push(
        this.exportDocuments(zip, options)
          .then(count => { counts.documents = count })
      )
    }

    if (options.includePRDs !== false) {
      tasks.push(
        this.exportPRDs(zip, options)
          .then(count => { counts.prds = count })
      )
    }

    if (options.includePrototypes !== false) {
      tasks.push(
        this.exportPrototypes(zip, options)
          .then(count => { counts.prototypes = count })
      )
    }

    await Promise.all(tasks)

    this.onProgress?.('packaging', 90)

    // 写入 manifest.json
    const manifest: ExportManifest = {
      version: '1.0',
      workspaceId: options.workspaceId,
      workspaceName: options.workspaceName,
      exportedAt: new Date().toISOString(),
      counts,
    }
    zip.file('manifest.json', JSON.stringify(manifest, null, 2))

    // 生成 ZIP
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })

    // 写入临时文件
    const tmpDir = process.env.VERCEL ? '/tmp' : path.join(process.cwd(), '.tmp')
    await fs.mkdir(tmpDir, { recursive: true })

    const zipPath = path.join(tmpDir, `export-${randomUUID()}.zip`)
    await fs.writeFile(zipPath, zipBuffer)

    this.onProgress?.('done', 100)

    return zipPath
  }

  private appendDateFilter (params: any[], options: ExportOptions, alias?: string): string {
    const prefix = alias ? `${alias}.` : ''
    let sql = ''
    if (options.dateFrom) {
      params.push(options.dateFrom)
      sql += ` AND ${prefix}created_at >= $${params.length}`
    }
    if (options.dateTo) {
      params.push(options.dateTo)
      sql += ` AND ${prefix}created_at <= $${params.length}`
    }
    return sql
  }

  private async exportDocuments (zip: JSZip, options: ExportOptions): Promise<number> {
    this.onProgress?.('exporting_documents', 10)
    const folder = zip.folder('documents')!

    const params: any[] = [options.workspaceId]
    let sql = `SELECT id, title, content, file_path, category, tags, metadata, created_at
               FROM documents WHERE workspace_id = $1`
    sql += this.appendDateFilter(params, options)
    sql += ' ORDER BY created_at ASC LIMIT 1000'

    const result = await dbClient.query<any>(sql, params)
    const docs = result.rows

    const index = docs.map((d: any) => ({
      id: d.id,
      title: d.title,
      fileName: d.metadata?.originalFileName || d.file_path?.split('/').pop(),
      tags: d.tags || [],
      category: d.category,
      createdAt: d.created_at,
    }))

    folder.file('index.json', JSON.stringify(index, null, 2))

    // 如果需要原始文件，尝试从存储中读取
    if (options.includeOriginalFiles) {
      const filesFolder = folder.folder('files')!
      for (const doc of docs) {
        if (!doc.file_path) continue
        try {
          const { getStorageClient } = await import('~/lib/storage/storage-factory')
          const storage = getStorageClient()
          const { buffer } = await storage.getFile(doc.file_path)
          const fileName = doc.metadata?.originalFileName || doc.file_path.split('/').pop() || `${doc.id}.bin`
          filesFolder.file(fileName, buffer)
        } catch (e) {
          console.warn(`[Export] 无法读取文件 ${doc.file_path}:`, e)
        }
      }
    }

    return docs.length
  }

  private async exportPRDs (zip: JSZip, options: ExportOptions): Promise<number> {
    this.onProgress?.('exporting_prds', 40)
    const folder = zip.folder('prd')!

    const params: any[] = [options.workspaceId]
    let sql = `SELECT id, title, content, status, rating, model_used, created_at
               FROM prd_documents WHERE workspace_id = $1`
    sql += this.appendDateFilter(params, options)
    sql += ' ORDER BY created_at ASC LIMIT 1000'

    const result = await dbClient.query<any>(sql, params)
    const prds = result.rows

    const index = prds.map((p: any) => ({
      id: p.id,
      title: p.title,
      status: p.status,
      rating: p.rating,
      createdAt: p.created_at,
    }))

    folder.file('index.json', JSON.stringify(index, null, 2))

    // 导出每个 PRD 的内容（使用固定文件名 content.md 确保导入可读取）
    for (const prd of prds) {
      const prdFolder = folder.folder(`${prd.id}`)!
      prdFolder.file('content.md', prd.content || '')

      // 导出 PRD 版本快照
      if (options.includeSnapshots) {
        try {
          const snapshots = await dbClient.query<any>(
            `SELECT id, title, content, type, created_at FROM prd_snapshots WHERE prd_id = $1 ORDER BY created_at ASC`,
            [prd.id]
          )
          if (snapshots.rows.length > 0) {
            const snapshotsFolder = prdFolder.folder('snapshots')!
            snapshotsFolder.file('index.json', JSON.stringify(snapshots.rows.map(s => ({
              id: s.id, title: s.title, type: s.type, createdAt: s.created_at,
            })), null, 2))
            for (const snap of snapshots.rows) {
              snapshotsFolder.file(`${snap.id}.md`, snap.content || '')
            }
          }
        } catch {
          // prd_snapshots 表不存在时静默跳过
        }
      }
    }

    return prds.length
  }

  private async exportPrototypes (zip: JSZip, options: ExportOptions): Promise<number> {
    this.onProgress?.('exporting_prototypes', 70)
    const folder = zip.folder('prototypes')!

    const params: any[] = [options.workspaceId]
    let sql = `SELECT id, name, type, created_at
               FROM prototypes WHERE workspace_id = $1`
    sql += this.appendDateFilter(params, options)
    sql += ' ORDER BY created_at ASC LIMIT 1000'

    const result = await dbClient.query<any>(sql, params)
    const prototypes = result.rows

    const index = prototypes.map((p: any) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      createdAt: p.created_at,
    }))

    folder.file('index.json', JSON.stringify(index, null, 2))

    // 导出每个原型的页面
    for (const prototype of prototypes) {
      const protoFolder = folder.folder(`${prototype.id}`)!
      const pagesFolder = protoFolder.folder('pages')!

      const pages = await dbClient.query<any>(
        'SELECT slug, html_content FROM prototype_pages WHERE prototype_id = $1',
        [prototype.id]
      )

      for (const page of pages.rows) {
        pagesFolder.file(`${page.slug}.html`, page.html_content || '')
      }
    }

    return prototypes.length
  }
}
