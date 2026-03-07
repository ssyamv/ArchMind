/**
 * #62 RBAC 权限矩阵单元测试
 */

import { describe, it, expect } from 'vitest'
import { hasPermission, getRolePermissions, ROLE_LEVELS } from '~/lib/auth/permissions'

describe('RBAC 权限矩阵', () => {
  describe('角色等级', () => {
    it('角色等级应满足 guest < viewer < editor < admin < owner', () => {
      expect(ROLE_LEVELS.guest).toBeLessThan(ROLE_LEVELS.viewer)
      expect(ROLE_LEVELS.viewer).toBeLessThan(ROLE_LEVELS.editor)
      expect(ROLE_LEVELS.editor).toBeLessThan(ROLE_LEVELS.admin)
      expect(ROLE_LEVELS.admin).toBeLessThan(ROLE_LEVELS.owner)
    })

    it('member 应与 editor 等级相同（向后兼容）', () => {
      expect(ROLE_LEVELS.member).toBe(ROLE_LEVELS.editor)
    })
  })

  describe('owner 权限', () => {
    it('owner 拥有所有权限', () => {
      expect(hasPermission('owner', 'workspace', 'delete')).toBe(true)
      expect(hasPermission('owner', 'workspace', 'manage')).toBe(true)
      expect(hasPermission('owner', 'document', 'delete')).toBe(true)
      expect(hasPermission('owner', 'prd', 'delete')).toBe(true)
      expect(hasPermission('owner', 'member', 'manage')).toBe(true)
    })
  })

  describe('admin 权限', () => {
    it('admin 不能删除工作区', () => {
      expect(hasPermission('admin', 'workspace', 'delete')).toBe(false)
    })

    it('admin 可以管理工作区设置', () => {
      expect(hasPermission('admin', 'workspace', 'manage')).toBe(true)
    })

    it('admin 可以删除 PRD 和原型', () => {
      expect(hasPermission('admin', 'prd', 'delete')).toBe(true)
      expect(hasPermission('admin', 'prototype', 'delete')).toBe(true)
    })

    it('admin 可以管理成员', () => {
      expect(hasPermission('admin', 'member', 'manage')).toBe(true)
    })
  })

  describe('editor 权限', () => {
    it('editor 可以创建/编辑内容', () => {
      expect(hasPermission('editor', 'document', 'write')).toBe(true)
      expect(hasPermission('editor', 'prd', 'write')).toBe(true)
      expect(hasPermission('editor', 'prototype', 'write')).toBe(true)
    })

    it('editor 不能删除 PRD（只有 admin+ 才可以）', () => {
      expect(hasPermission('editor', 'prd', 'delete')).toBe(false)
    })

    it('editor 不能删除原型（只有 admin+ 才可以）', () => {
      expect(hasPermission('editor', 'prototype', 'delete')).toBe(false)
    })

    it('editor 不能管理 Webhook', () => {
      expect(hasPermission('editor', 'webhook', 'manage')).toBe(false)
    })

    it('editor 不能管理成员', () => {
      expect(hasPermission('editor', 'member', 'manage')).toBe(false)
    })

    it('editor 可以删除文档和逻辑图', () => {
      expect(hasPermission('editor', 'document', 'delete')).toBe(true)
      expect(hasPermission('editor', 'logic_map', 'delete')).toBe(true)
    })
  })

  describe('viewer 权限', () => {
    it('viewer 可以读取所有资源', () => {
      expect(hasPermission('viewer', 'document', 'read')).toBe(true)
      expect(hasPermission('viewer', 'prd', 'read')).toBe(true)
      expect(hasPermission('viewer', 'prototype', 'read')).toBe(true)
      expect(hasPermission('viewer', 'logic_map', 'read')).toBe(true)
      expect(hasPermission('viewer', 'workspace', 'read')).toBe(true)
      expect(hasPermission('viewer', 'member', 'read')).toBe(true)
    })

    it('viewer 不能创建文档', () => {
      expect(hasPermission('viewer', 'document', 'write')).toBe(false)
    })

    it('viewer 不能修改工作区设置', () => {
      expect(hasPermission('viewer', 'workspace', 'manage')).toBe(false)
    })
  })

  describe('guest 权限', () => {
    it('guest 没有任何权限', () => {
      expect(hasPermission('guest', 'document', 'read')).toBe(false)
      expect(hasPermission('guest', 'prd', 'read')).toBe(false)
      expect(hasPermission('guest', 'workspace', 'read')).toBe(false)
    })
  })

  describe('向后兼容（member 角色）', () => {
    it('member 角色的权限等价于 editor', () => {
      const resources = ['document', 'prd', 'prototype', 'logic_map'] as const
      const actions = ['read', 'write', 'delete'] as const

      for (const resource of resources) {
        for (const action of actions) {
          expect(hasPermission('member', resource, action)).toBe(hasPermission('editor', resource, action))
        }
      }
    })
  })

  describe('getRolePermissions', () => {
    it('viewer 的权限列表包含所有 read 权限', () => {
      const permissions = getRolePermissions('viewer')
      expect(permissions).toContain('document:read')
      expect(permissions).toContain('prd:read')
      expect(permissions).toContain('workspace:read')
    })

    it('viewer 的权限列表不包含 write 权限', () => {
      const permissions = getRolePermissions('viewer')
      expect(permissions).not.toContain('document:write')
      expect(permissions).not.toContain('prd:write')
    })

    it('owner 拥有最多权限', () => {
      const ownerPerms = getRolePermissions('owner')
      const adminPerms = getRolePermissions('admin')
      expect(ownerPerms.length).toBeGreaterThan(adminPerms.length)
    })
  })
})
