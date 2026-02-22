/**
 * DocumentDAO 单元测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { DocumentDAO } from '~/lib/db/dao/document-dao'

// Mock 数据库客户端
vi.mock('~/lib/db/client', () => ({
  dbClient: {
    query: vi.fn(),
    getClient: vi.fn(),
    transaction: vi.fn()
  }
}))

import { dbClient } from '~/lib/db/client'

describe('DocumentDAO', () => {
  const mockDbClient = dbClient as any

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('create', () => {
    it('should create a new document', async () => {
      const mockDoc = {
        id: 'doc-123',
        title: 'Test Document',
        filePath: '/path/to/file.pdf',
        fileType: 'pdf',
        fileSize: 1024,
        content: 'Test content',
        status: 'uploaded',
        processingStatus: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      mockDbClient.query.mockResolvedValueOnce({
        rows: [mockDoc],
        rowCount: 1
      })

      const result = await DocumentDAO.create({
        title: 'Test Document',
        filePath: '/path/to/file.pdf',
        fileType: 'pdf',
        fileSize: 1024,
        content: 'Test content'
      })

      expect(result).toBeDefined()
      expect(result.title).toBe('Test Document')
      expect(mockDbClient.query).toHaveBeenCalled()
    })

    it('should use default values for optional fields', async () => {
      const mockDoc = {
        id: 'doc-123',
        title: 'Test',
        file_path: '/path',
        file_type: 'pdf',
        file_size: 1024,
        status: 'uploaded',
        processing_status: 'pending',
        chunks_count: 0,
        vectors_count: 0,
        retry_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      mockDbClient.query.mockResolvedValueOnce({
        rows: [mockDoc],
        rowCount: 1
      })

      const result = await DocumentDAO.create({
        title: 'Test',
        filePath: '/path',
        fileType: 'pdf',
        fileSize: 1024
      })

      expect(result).toBeDefined()
    })
  })

  describe('findById', () => {
    it('should return document when found', async () => {
      const mockDoc = {
        id: 'doc-123',
        title: 'Test Document',
        file_path: '/path',
        file_type: 'pdf',
        file_size: 1024,
        status: 'uploaded',
        processing_status: 'completed',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      mockDbClient.query.mockResolvedValueOnce({
        rows: [mockDoc],
        rowCount: 1
      })

      const result = await DocumentDAO.findById('doc-123')

      expect(result).toBeDefined()
      expect(result?.id).toBe('doc-123')
      expect(mockDbClient.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM documents'),
        ['doc-123']
      )
    })

    it('should return null when not found', async () => {
      mockDbClient.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0
      })

      const result = await DocumentDAO.findById('non-existent')

      expect(result).toBeNull()
    })
  })

  describe('findAll', () => {
    it('should return all documents with default options', async () => {
      const mockDocs = [
        { id: 'doc-1', title: 'Document 1', created_at: new Date().toISOString() },
        { id: 'doc-2', title: 'Document 2', created_at: new Date().toISOString() }
      ]

      mockDbClient.query.mockResolvedValueOnce({
        rows: mockDocs,
        rowCount: 2
      })

      const result = await DocumentDAO.findAll()

      expect(result.length).toBe(2)
      expect(mockDbClient.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY created_at DESC'),
        expect.arrayContaining([50, 0])
      )
    })

    it('should filter by workspaceId', async () => {
      mockDbClient.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0
      })

      await DocumentDAO.findAll({ workspaceId: 'ws-123' })

      expect(mockDbClient.query).toHaveBeenCalledWith(
        expect.stringContaining('workspace_id = $1'),
        expect.arrayContaining(['ws-123'])
      )
    })

    it('should apply pagination', async () => {
      mockDbClient.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0
      })

      await DocumentDAO.findAll({ limit: 10, offset: 20 })

      expect(mockDbClient.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([10, 20])
      )
    })

    it('should support different order options', async () => {
      mockDbClient.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0
      })

      await DocumentDAO.findAll({ orderBy: 'title', order: 'ASC' })

      expect(mockDbClient.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY title ASC'),
        expect.any(Array)
      )
    })
  })

  describe('update', () => {
    it('should update document fields', async () => {
      const mockUpdatedDoc = {
        id: 'doc-123',
        title: 'Updated Title',
        content: 'Updated content',
        updated_at: new Date().toISOString()
      }

      mockDbClient.query.mockResolvedValueOnce({
        rows: [mockUpdatedDoc],
        rowCount: 1
      })

      const result = await DocumentDAO.update('doc-123', {
        title: 'Updated Title',
        content: 'Updated content'
      })

      expect(result).toBeDefined()
      expect(mockDbClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE documents'),
        expect.any(Array)
      )
    })

    it('should return null when document not found', async () => {
      mockDbClient.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0
      })

      const result = await DocumentDAO.update('non-existent', { title: 'New Title' })

      expect(result).toBeNull()
    })
  })

  describe('delete', () => {
    it('should return true when document deleted', async () => {
      mockDbClient.query.mockResolvedValueOnce({
        rowCount: 1
      })

      const result = await DocumentDAO.delete('doc-123')

      expect(result).toBe(true)
      expect(mockDbClient.query).toHaveBeenCalledWith(
        'DELETE FROM documents WHERE id = $1',
        ['doc-123']
      )
    })

    it('should return false when document not found', async () => {
      mockDbClient.query.mockResolvedValueOnce({
        rowCount: 0
      })

      const result = await DocumentDAO.delete('non-existent')

      expect(result).toBe(false)
    })
  })

  describe('count', () => {
    it('should return total document count', async () => {
      mockDbClient.query.mockResolvedValueOnce({
        rows: [{ count: '42' }]
      })

      const result = await DocumentDAO.count()

      expect(result).toBe(42)
    })

    it('should filter by workspaceId', async () => {
      mockDbClient.query.mockResolvedValueOnce({
        rows: [{ count: '10' }]
      })

      const result = await DocumentDAO.count({ workspaceId: 'ws-123' })

      expect(result).toBe(10)
      expect(mockDbClient.query).toHaveBeenCalledWith(
        expect.stringContaining('workspace_id'),
        ['ws-123']
      )
    })
  })

  describe('findByFileType', () => {
    it('should return documents of specified type', async () => {
      const mockDocs = [
        { id: 'doc-1', file_type: 'pdf' },
        { id: 'doc-2', file_type: 'pdf' }
      ]

      mockDbClient.query.mockResolvedValueOnce({
        rows: mockDocs,
        rowCount: 2
      })

      const result = await DocumentDAO.findByFileType('pdf')

      expect(result.length).toBe(2)
      expect(mockDbClient.query).toHaveBeenCalledWith(
        expect.stringContaining("file_type = $1"),
        ['pdf']
      )
    })
  })

  describe('findByHash', () => {
    it('should return document with matching hash', async () => {
      const mockDoc = {
        id: 'doc-123',
        content_hash: 'abc123',
        title: 'Duplicate Document'
      }

      mockDbClient.query.mockResolvedValueOnce({
        rows: [mockDoc],
        rowCount: 1
      })

      const result = await DocumentDAO.findByHash('abc123')

      expect(result).toBeDefined()
      expect(result?.contentHash).toBe('abc123')
    })

    it('should return null when no match found', async () => {
      mockDbClient.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0
      })

      const result = await DocumentDAO.findByHash('non-existent-hash')

      expect(result).toBeNull()
    })
  })

  describe('findByIds', () => {
    it('空数组直接返回空 Map', async () => {
      const result = await DocumentDAO.findByIds([])

      expect(result).toBeInstanceOf(Map)
      expect(result.size).toBe(0)
      expect(mockDbClient.query).not.toHaveBeenCalled()
    })

    it('批量查询并返回 Map', async () => {
      const rows = [
        { id: 'doc-1', title: 'Doc 1', file_path: '/1', file_type: 'pdf', file_size: 100, status: 'uploaded', processing_status: 'completed', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { id: 'doc-2', title: 'Doc 2', file_path: '/2', file_type: 'docx', file_size: 200, status: 'uploaded', processing_status: 'pending', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
      ]
      mockDbClient.query.mockResolvedValueOnce({ rows, rowCount: 2 })

      const result = await DocumentDAO.findByIds(['doc-1', 'doc-2'])

      expect(result).toBeInstanceOf(Map)
      expect(result.size).toBe(2)
      expect(result.get('doc-1')?.title).toBe('Doc 1')
      expect(result.get('doc-2')?.title).toBe('Doc 2')
    })

    it('SQL 使用 IN 占位符', async () => {
      mockDbClient.query.mockResolvedValueOnce({ rows: [] })

      await DocumentDAO.findByIds(['a', 'b', 'c'])

      const [sql, params] = mockDbClient.query.mock.calls[0]
      expect(sql).toContain('IN ($1, $2, $3)')
      expect(params).toEqual(['a', 'b', 'c'])
    })

    it('数据库不返回某些 id 时 Map 中不包含对应键', async () => {
      const rows = [
        { id: 'doc-1', title: 'Doc 1', file_path: '/1', file_type: 'pdf', file_size: 100, status: 'uploaded', processing_status: 'completed', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
      ]
      mockDbClient.query.mockResolvedValueOnce({ rows, rowCount: 1 })

      const result = await DocumentDAO.findByIds(['doc-1', 'doc-missing'])

      expect(result.has('doc-1')).toBe(true)
      expect(result.has('doc-missing')).toBe(false)
    })
  })

  describe('updateProcessingStatus', () => {
    it('should update status with all details', async () => {
      const mockUpdatedDoc = {
        id: 'doc-123',
        processing_status: 'completed',
        chunks_count: 10,
        vectors_count: 10
      }

      mockDbClient.query.mockResolvedValueOnce({
        rows: [mockUpdatedDoc],
        rowCount: 1
      })

      const result = await DocumentDAO.updateProcessingStatus('doc-123', 'completed', {
        chunksCount: 10,
        vectorsCount: 10,
        completedAt: new Date()
      })

      expect(result).toBeDefined()
    })

    it('should update status with error', async () => {
      const mockUpdatedDoc = {
        id: 'doc-123',
        processing_status: 'failed',
        processing_error: 'Error message'
      }

      mockDbClient.query.mockResolvedValueOnce({
        rows: [mockUpdatedDoc],
        rowCount: 1
      })

      const result = await DocumentDAO.updateProcessingStatus('doc-123', 'failed', {
        error: 'Error message'
      })

      expect(result).toBeDefined()
    })
  })
})
