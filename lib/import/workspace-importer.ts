/**
 * 工作区数据导入器
 * 解析导出的 ZIP 文件，检测冲突，执行导入
 */

import * as fs from 'fs/promises'
import JSZip from 'jszip'
import { dbClient } from '~/lib/db/client'
import type { ExportManifest } from '~/lib/export/workspace-exporter'

export type ConflictStrategy = 'skip' | 'overwrite' | 'rename' | 'merge'

export interface ImportAnalysis {
  documentCount: number
  prdCount: number
  prototypeCount: number
  conflicts: {
    documents: ConflictItem[]
    prds: ConflictItem[]
  }
}

export interface ConflictItem {
  id: string
  title: string
  reason: string
}

export interface ImportResult {
  total: number
  succeeded: number
  failed: number
  skipped: number
  errors: { id: string; message: string }[]
}

const MAX_IMPORT_SIZE = 2 * 1024 * 1024 * 1024 // 2GB
const MAX_DOCUMENT_COUNT = 1000

export class WorkspaceImporter {
  /**
   * 第一步：解析 ZIP，返回冲突检测报告
   */
  async analyze (zipPath: string, targetWorkspaceId: string): Promise<ImportAnalysis> {
    const stats = await fs.stat(zipPath)
    if (stats.size > MAX_IMPORT_SIZE) {
      throw new Error(`导入文件过大（${Math.round(stats.size / 1024 / 1024)}MB），最大支持 2GB`)
    }

    const zip = await this.loadZip(zipPath)
    const manifest = await this.readManifest(zip)
    this.validateManifest(manifest)

    if (manifest.counts.documents > MAX_DOCUMENT_COUNT) {
      throw new Error(`文档数量超出限制：${manifest.counts.documents}，最多支持 ${MAX_DOCUMENT_COUNT} 个`)
    }

    const conflicts = {
      documents: await this.detectDocumentConflicts(zip, targetWorkspaceId),
      prds: await this.detectPRDConflicts(zip, targetWorkspaceId),
    }

    return {
      documentCount: manifest.counts.documents,
      prdCount: manifest.counts.prds,
      prototypeCount: manifest.counts.prototypes,
      conflicts,
    }
  }

  /**
   * 第二步：执行导入（在事务中，失败全部回滚）
   */
  async execute (
    zipPath: string,
    targetWorkspaceId: string,
    userId: string,
    strategy: ConflictStrategy
  ): Promise<ImportResult> {
    const zip = await this.loadZip(zipPath)

    const result: ImportResult = {
      total: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
      errors: [],
    }

    // 直接使用 dbClient 执行事务 SQL
    try {
      await dbClient.query('BEGIN')

      // 导入文档
      const docResult = await this.importDocuments(zip, targetWorkspaceId, userId, strategy)
      this.mergeResult(result, docResult)

      // 导入 PRD
      const prdResult = await this.importPRDs(zip, targetWorkspaceId, userId, strategy)
      this.mergeResult(result, prdResult)

      // 导入原型
      const protoResult = await this.importPrototypes(zip, targetWorkspaceId, userId, strategy)
      this.mergeResult(result, protoResult)

      await dbClient.query('COMMIT')
    } catch (e: any) {
      await dbClient.query('ROLLBACK').catch(() => {})
      throw new Error(`导入失败，已全部回滚：${e?.message}`)
    }

    return result
  }

  private mergeResult (target: ImportResult, source: ImportResult) {
    target.total += source.total
    target.succeeded += source.succeeded
    target.failed += source.failed
    target.skipped += source.skipped
    target.errors.push(...source.errors)
  }

  private async loadZip (zipPath: string): Promise<JSZip> {
    const buffer = await fs.readFile(zipPath)
    return await JSZip.loadAsync(buffer)
  }

  private async readManifest (zip: JSZip): Promise<ExportManifest> {
    const manifestFile = zip.file('manifest.json')
    if (!manifestFile) throw new Error('manifest.json 不存在，请确保文件为 ArchMind 导出格式')

    const content = await manifestFile.async('string')
    try {
      return JSON.parse(content)
    } catch {
      throw new Error('manifest.json 格式无效')
    }
  }

  private validateManifest (manifest: ExportManifest) {
    if (!manifest.version) {
      throw new Error('导出文件缺少版本信息')
    }
    if (manifest.version !== '1.0') {
      throw new Error(`不支持的导出格式版本：${manifest.version}`)
    }
  }

  private async detectDocumentConflicts (zip: JSZip, workspaceId: string): Promise<ConflictItem[]> {
    const indexFile = zip.file('documents/index.json')
    if (!indexFile) return []

    const index = JSON.parse(await indexFile.async('string'))
    const conflicts: ConflictItem[] = []

    for (const item of index) {
      const existing = await dbClient.query(
        'SELECT id FROM documents WHERE workspace_id = $1 AND title = $2',
        [workspaceId, item.title]
      )
      if (existing.rows.length > 0) {
        conflicts.push({
          id: item.id,
          title: item.title,
          reason: '同名文档已存在',
        })
      }
    }

    return conflicts
  }

  private async detectPRDConflicts (zip: JSZip, workspaceId: string): Promise<ConflictItem[]> {
    const indexFile = zip.file('prd/index.json')
    if (!indexFile) return []

    const index = JSON.parse(await indexFile.async('string'))
    const conflicts: ConflictItem[] = []

    for (const item of index) {
      const existing = await dbClient.query(
        'SELECT id FROM prd_documents WHERE workspace_id = $1 AND title = $2',
        [workspaceId, item.title]
      )
      if (existing.rows.length > 0) {
        conflicts.push({
          id: item.id,
          title: item.title,
          reason: '同名 PRD 已存在',
        })
      }
    }

    return conflicts
  }

  private async importDocuments (
    zip: JSZip,
    workspaceId: string,
    userId: string,
    strategy: ConflictStrategy
  ): Promise<ImportResult> {
    const indexFile = zip.file('documents/index.json')
    if (!indexFile) return { total: 0, succeeded: 0, failed: 0, skipped: 0, errors: [] }

    const index = JSON.parse(await indexFile.async('string'))
    const result: ImportResult = { total: index.length, succeeded: 0, failed: 0, skipped: 0, errors: [] }

    for (const item of index) {
      try {
        const existing = await dbClient.query(
          'SELECT id FROM documents WHERE workspace_id = $1 AND title = $2',
          [workspaceId, item.title]
        )

        let finalTitle = item.title

        if (existing.rows.length > 0) {
          if (strategy === 'skip') {
            result.skipped++
            continue
          } else if (strategy === 'rename') {
            finalTitle = `${item.title} (导入 ${new Date().toISOString().split('T')[0]})`
          } else if (strategy === 'overwrite') {
            await dbClient.query('DELETE FROM documents WHERE id = $1', [existing.rows[0].id])
          } else if (strategy === 'merge') {
            const newTags = item.tags || []
            if (newTags.length > 0) {
              await dbClient.query(
                `UPDATE documents SET tags = array_cat(COALESCE(tags, ARRAY[]::text[]), $1), updated_at = NOW() WHERE id = $2`,
                [newTags, existing.rows[0].id]
              )
            }
            result.succeeded++
            continue
          }
        }

        await dbClient.query(
          `INSERT INTO documents (id, workspace_id, user_id, title, category, tags, status, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'pending', NOW(), NOW())`,
          [workspaceId, userId, finalTitle, item.category || null, item.tags || []]
        )

        result.succeeded++
      } catch (e: any) {
        result.failed++
        result.errors.push({ id: item.id, message: e?.message })
      }
    }

    return result
  }

  private async importPRDs (
    zip: JSZip,
    workspaceId: string,
    userId: string,
    strategy: ConflictStrategy
  ): Promise<ImportResult> {
    const indexFile = zip.file('prd/index.json')
    if (!indexFile) return { total: 0, succeeded: 0, failed: 0, skipped: 0, errors: [] }

    const index = JSON.parse(await indexFile.async('string'))
    const result: ImportResult = { total: index.length, succeeded: 0, failed: 0, skipped: 0, errors: [] }

    for (const item of index) {
      try {
        // 读取 PRD 内容（优先使用固定文件名 content.md）
        let contentFile = zip.file(`prd/${item.id}/content.md`)
        if (!contentFile) {
          // 向后兼容：尝试旧版基于标题的文件名
          const safeTitle = String(item.title).replace(/[/\\?%*:|"<>]/g, '-').slice(0, 50)
          contentFile = zip.file(`prd/${item.id}/${safeTitle}.md`)
        }

        if (!contentFile) {
          result.failed++
          result.errors.push({ id: item.id, message: '内容文件不存在' })
          continue
        }

        const content = await contentFile.async('string')

        const existing = await dbClient.query(
          'SELECT id FROM prd_documents WHERE workspace_id = $1 AND title = $2',
          [workspaceId, item.title]
        )

        let finalTitle = item.title

        if (existing.rows.length > 0) {
          if (strategy === 'skip' || strategy === 'merge') {
            result.skipped++
            continue
          } else if (strategy === 'rename') {
            finalTitle = `${item.title} (导入 ${new Date().toISOString().split('T')[0]})`
          } else if (strategy === 'overwrite') {
            await dbClient.query('DELETE FROM prd_documents WHERE id = $1', [existing.rows[0].id])
          }
        }

        // 直接 INSERT，不走 DAO（确保在同一事务中）
        await dbClient.query(
          `INSERT INTO prd_documents (id, user_id, workspace_id, title, content, user_input, model_used, status, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, '', 'imported', 'draft', NOW(), NOW())`,
          [userId, workspaceId, finalTitle, content]
        )

        result.succeeded++
      } catch (e: any) {
        result.failed++
        result.errors.push({ id: item.id, message: e?.message })
      }
    }

    return result
  }

  private async importPrototypes (
    zip: JSZip,
    workspaceId: string,
    userId: string,
    strategy: ConflictStrategy
  ): Promise<ImportResult> {
    const indexFile = zip.file('prototypes/index.json')
    if (!indexFile) return { total: 0, succeeded: 0, failed: 0, skipped: 0, errors: [] }

    const index = JSON.parse(await indexFile.async('string'))
    const result: ImportResult = { total: index.length, succeeded: 0, failed: 0, skipped: 0, errors: [] }

    for (const item of index) {
      try {
        const existing = await dbClient.query(
          'SELECT id FROM prototypes WHERE workspace_id = $1 AND name = $2',
          [workspaceId, item.name]
        )

        let finalName = item.name

        if (existing.rows.length > 0) {
          if (strategy === 'skip' || strategy === 'merge') {
            result.skipped++
            continue
          } else if (strategy === 'rename') {
            finalName = `${item.name} (导入 ${new Date().toISOString().split('T')[0]})`
          } else if (strategy === 'overwrite') {
            await dbClient.query('DELETE FROM prototypes WHERE id = $1', [existing.rows[0].id])
          }
        }

        const protoResult = await dbClient.query(
          `INSERT INTO prototypes (id, workspace_id, user_id, name, type, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW(), NOW()) RETURNING id`,
          [workspaceId, userId, finalName, item.type || 'web']
        )
        const protoId = protoResult.rows[0]?.id

        // 导入页面
        if (protoId) {
          const pageFiles = Object.keys(zip.files).filter(f =>
            f.startsWith(`prototypes/${item.id}/pages/`) && f.endsWith('.html')
          )
          for (const pagePath of pageFiles) {
            const pageFile = zip.file(pagePath)
            if (!pageFile) continue
            const htmlContent = await pageFile.async('string')
            const slug = pagePath.split('/').pop()?.replace('.html', '') || 'index'
            await dbClient.query(
              `INSERT INTO prototype_pages (id, prototype_id, slug, html_content, created_at, updated_at)
               VALUES (gen_random_uuid(), $1, $2, $3, NOW(), NOW())`,
              [protoId, slug, htmlContent]
            )
          }
        }

        result.succeeded++
      } catch (e: any) {
        result.failed++
        result.errors.push({ id: item.id, message: e?.message })
      }
    }

    return result
  }
}
