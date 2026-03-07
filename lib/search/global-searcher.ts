/**
 * 全局搜索引擎（#70）
 * 跨资源类型搜索：文档、PRD、逻辑图
 */

import { dbClient } from '../db/client'

export type SearchType = 'document' | 'prd' | 'logic_map'

export interface SearchResultItem {
  id: string
  type: SearchType
  title: string
  snippet: string | null    // 命中内容摘要
  relevance: number         // 0-1 相关度
  createdAt: string
  workspaceId: string
  extra?: Record<string, unknown>  // 额外字段（如 PRD 状态、文档类型）
}

export interface SearchResults {
  document: SearchResultItem[]
  prd: SearchResultItem[]
  logic_map: SearchResultItem[]
  total: number
}

export class GlobalSearcher {
  async search (
    query: string,
    workspaceId: string,
    types: SearchType[] = ['document', 'prd', 'logic_map']
  ): Promise<SearchResults> {
    const tasks = types.map(type => this.searchByType(query, type, workspaceId))
    const settled = await Promise.allSettled(tasks)

    const results: SearchResults = { document: [], prd: [], logic_map: [], total: 0 }

    types.forEach((type, i) => {
      const r = settled[i]
      if (r.status === 'fulfilled') {
        results[type] = r.value
        results.total += r.value.length
      }
    })

    return results
  }

  private async searchByType (
    query: string,
    type: SearchType,
    workspaceId: string
  ): Promise<SearchResultItem[]> {
    switch (type) {
      case 'document': return this.searchDocuments(query, workspaceId)
      case 'prd': return this.searchPRDs(query, workspaceId)
      case 'logic_map': return this.searchLogicMaps(query, workspaceId)
    }
  }

  private async searchDocuments (query: string, workspaceId: string): Promise<SearchResultItem[]> {
    const sql = `
      SELECT id, title, content, created_at,
             ts_rank(to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(content,'')),
                     plainto_tsquery('simple', $1)) as rank
      FROM documents
      WHERE workspace_id = $2
        AND status NOT IN ('failed')
        AND (
          title ILIKE $3
          OR to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(content,'')) @@ plainto_tsquery('simple', $1)
        )
      ORDER BY rank DESC, created_at DESC
      LIMIT 5
    `
    const like = `%${query}%`
    const result = await dbClient.query<any>(sql, [query, workspaceId, like])
    return result.rows.map(r => ({
      id: r.id,
      type: 'document' as const,
      title: r.title,
      snippet: this.extractSnippet(r.content, query),
      relevance: Math.min(1, parseFloat(r.rank) || 0.5),
      createdAt: r.created_at,
      workspaceId,
    }))
  }

  private async searchPRDs (query: string, workspaceId: string): Promise<SearchResultItem[]> {
    const sql = `
      SELECT id, title, content, status, created_at,
             ts_rank(to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(content,'')),
                     plainto_tsquery('simple', $1)) as rank
      FROM prd_documents
      WHERE workspace_id = $2
        AND (
          title ILIKE $3
          OR to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(content,'')) @@ plainto_tsquery('simple', $1)
        )
      ORDER BY rank DESC, created_at DESC
      LIMIT 5
    `
    const like = `%${query}%`
    const result = await dbClient.query<any>(sql, [query, workspaceId, like])
    return result.rows.map(r => ({
      id: r.id,
      type: 'prd' as const,
      title: r.title,
      snippet: this.extractSnippet(r.content, query),
      relevance: Math.min(1, parseFloat(r.rank) || 0.5),
      createdAt: r.created_at,
      workspaceId,
      extra: { status: r.status },
    }))
  }

  private async searchLogicMaps (query: string, workspaceId: string): Promise<SearchResultItem[]> {
    const sql = `
      SELECT id, title, type, mermaid_code, created_at,
             ts_rank(to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(mermaid_code,'')),
                     plainto_tsquery('simple', $1)) as rank
      FROM mermaid_logic_maps
      WHERE workspace_id = $2
        AND (
          title ILIKE $3
          OR to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(mermaid_code,'')) @@ plainto_tsquery('simple', $1)
        )
      ORDER BY rank DESC, created_at DESC
      LIMIT 5
    `
    const like = `%${query}%`
    const result = await dbClient.query<any>(sql, [query, workspaceId, like])
    return result.rows.map(r => ({
      id: r.id,
      type: 'logic_map' as const,
      title: r.title,
      snippet: this.extractSnippet(r.mermaid_code, query),
      relevance: Math.min(1, parseFloat(r.rank) || 0.5),
      createdAt: r.created_at,
      workspaceId,
      extra: { diagramType: r.type },
    }))
  }

  /** 从长文本中提取命中词附近的摘要（最多 100 字） */
  private extractSnippet (content: string | null, query: string): string | null {
    if (!content) return null
    const idx = content.toLowerCase().indexOf(query.toLowerCase())
    if (idx === -1) return content.slice(0, 100)
    const start = Math.max(0, idx - 30)
    const end = Math.min(content.length, idx + 70)
    return (start > 0 ? '...' : '') + content.slice(start, end) + (end < content.length ? '...' : '')
  }

  async suggestions (query: string, workspaceId: string): Promise<string[]> {
    if (query.length < 2) return []
    const sql = `
      SELECT DISTINCT title FROM (
        SELECT title FROM documents WHERE workspace_id = $1 AND title ILIKE $2
        UNION ALL
        SELECT title FROM prd_documents WHERE workspace_id = $1 AND title ILIKE $2
        UNION ALL
        SELECT title FROM mermaid_logic_maps WHERE workspace_id = $1 AND title ILIKE $2
      ) t
      ORDER BY title
      LIMIT 8
    `
    const result = await dbClient.query<{ title: string }>(sql, [workspaceId, `%${query}%`])
    return result.rows.map(r => r.title)
  }
}

export const globalSearcher = new GlobalSearcher()
