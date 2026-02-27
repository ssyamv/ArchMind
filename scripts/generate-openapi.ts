#!/usr/bin/env tsx
/**
 * OpenAPI 3.0 文档生成脚本
 *
 * 基于手动声明的 API schema 自动生成 OpenAPI 3.0 规范 JSON 文件。
 * 生成文件：docs/api/openapi.json
 *
 * 运行方式：
 *   pnpm docs:api
 *
 * 说明：
 *   由于 Nuxt 3 服务端路由不暴露完整的 schema 元数据，本脚本采用
 *   手动声明方式，完整覆盖 server/api/v1/ 下的全部端点。
 *   生成的 JSON 文件供 Scalar UI（/api-docs）和外部工具（Swagger Editor、Redoc 等）使用。
 */

import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

// ─── 复用响应结构 ─────────────────────────────────────────────────────────────

const errorResponse = {
  description: '错误响应',
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/Error' }
    }
  }
}

const stdErrors = {
  '400': errorResponse,
  '401': { description: '未认证', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
  '403': { description: '无权限', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
  '404': { description: '资源不存在', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
  '500': { description: '服务器内部错误', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } }
}

function ok(description: string, dataSchema?: object) {
  return {
    '200': {
      description,
      content: {
        'application/json': {
          schema: dataSchema || { type: 'object', properties: { success: { type: 'boolean' } } }
        }
      }
    }
  }
}

function okData(description: string, schemaRef: string) {
  return ok(description, {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      data: { $ref: `#/components/schemas/${schemaRef}` }
    }
  })
}

function okList(description: string, schemaRef: string) {
  return ok(description, {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      data: { type: 'array', items: { $ref: `#/components/schemas/${schemaRef}` } }
    }
  })
}

function pathParam(name: string, description?: string) {
  return { name, in: 'path' as const, required: true, schema: { type: 'string', format: 'uuid' }, description }
}

// ─── OpenAPI 基础结构 ─────────────────────────────────────────────────────────

const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'ArchMind AI API',
    description: [
      '本地优先的 AI 文档处理平台 API — 将历史文档转化为 PRD 和原型。',
      '',
      '## 认证方式',
      '所有需要认证的端点均通过 **HTTP-Only JWT Cookie**（`auth_token`）进行身份验证。',
      '登录成功后，Cookie 由服务器自动写入，有效期 7 天。',
      '',
      '## 版本控制',
      '所有端点均在 `/api/v1/` 前缀下。旧版 `/api/*` 路径会通过 307 重定向自动转发。',
      '',
      '## 流式响应',
      'PRD 生成、原型生成、对话等端点返回 **Server-Sent Events（SSE）** 流式响应。',
      '前端使用 `EventSource` 或 `fetch` + 流读取消费。'
    ].join('\n'),
    version: '0.2.1',
    contact: {
      name: 'ArchMind Team',
      url: 'https://github.com/ssyamv/ArchMind'
    },
    license: { name: 'MIT' }
  },
  servers: [
    { url: 'http://localhost:3000', description: '本地开发服务器' },
    { url: 'https://archmind.vercel.app', description: '生产环境（Vercel）' }
  ],
  tags: [
    { name: 'auth', description: '认证与授权' },
    { name: 'user', description: '用户资料与设置' },
    { name: 'workspaces', description: '工作区管理（多租户）' },
    { name: 'documents', description: '文档上传与管理' },
    { name: 'search', description: '混合搜索（RAG）' },
    { name: 'prd', description: 'PRD 文档生成与管理' },
    { name: 'prototypes', description: 'HTML 原型生成与管理' },
    { name: 'logic-maps', description: '功能逻辑图生成' },
    { name: 'conversations', description: '对话历史' },
    { name: 'chat', description: '实时 AI 对话' },
    { name: 'comments', description: '评论系统（团队协作）' },
    { name: 'ai', description: 'AI 模型配置' },
    { name: 'assets', description: '资源管理与 AI 生图' },
    { name: 'tags', description: '标签管理' },
    { name: 'categories', description: '分类管理' },
    { name: 'invitations', description: '工作区邀请' },
    { name: 'share', description: '文档分享' },
    { name: 'system', description: '系统状态' }
  ],
  components: {
    securitySchemes: {
      cookieAuth: {
        type: 'apiKey' as const,
        in: 'cookie' as const,
        name: 'auth_token',
        description: 'HTTP-Only JWT Cookie，登录后由服务器自动设置，有效期 7 天'
      }
    },
    schemas: {
      Error: {
        type: 'object',
        required: ['message'],
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string', example: '操作失败' },
          statusCode: { type: 'integer', example: 400 }
        }
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          username: { type: 'string' },
          fullName: { type: 'string', nullable: true },
          avatarUrl: { type: 'string', nullable: true },
          isActive: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      },
      WorkspaceMember: {
        type: 'object',
        properties: {
          userId: { type: 'string', format: 'uuid' },
          role: { type: 'string', enum: ['owner', 'admin', 'member'] },
          joinedAt: { type: 'string', format: 'date-time' },
          user: { $ref: '#/components/schemas/User' }
        }
      },
      Workspace: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          description: { type: 'string', nullable: true },
          icon: { type: 'string', example: '📁' },
          color: { type: 'string', example: '#6366f1' },
          isDefault: { type: 'boolean' },
          memberCount: { type: 'integer' },
          createdAt: { type: 'string', format: 'date-time' }
        }
      },
      Document: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          title: { type: 'string' },
          fileType: { type: 'string', enum: ['pdf', 'docx', 'md', 'txt'] },
          fileSize: { type: 'integer', description: '文件大小（字节）' },
          processingStatus: {
            type: 'string',
            enum: ['pending', 'processing', 'completed', 'failed', 'retrying']
          },
          chunksCount: { type: 'integer', nullable: true },
          vectorsCount: { type: 'integer', nullable: true },
          workspaceId: { type: 'string', format: 'uuid', nullable: true },
          categoryId: { type: 'string', format: 'uuid', nullable: true },
          currentVersion: { type: 'integer', default: 1 },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      },
      DocumentChunk: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          documentId: { type: 'string', format: 'uuid' },
          content: { type: 'string' },
          chunkIndex: { type: 'integer' },
          metadata: { type: 'object' }
        }
      },
      DocumentVersion: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          documentId: { type: 'string', format: 'uuid' },
          version: { type: 'integer' },
          fileSize: { type: 'integer' },
          changeSummary: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' }
        }
      },
      SearchResult: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          documentId: { type: 'string', format: 'uuid' },
          documentTitle: { type: 'string' },
          contentPreview: { type: 'string', description: '内容摘要（最多 200 字符）' },
          fullContent: { type: 'string' },
          similarity: { type: 'number', minimum: 0, maximum: 1 },
          chunkIndex: { type: 'integer' }
        }
      },
      PrdDocument: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          title: { type: 'string' },
          content: { type: 'string', description: 'Markdown 格式的 PRD 内容' },
          status: { type: 'string', enum: ['draft', 'review', 'approved', 'archived'] },
          workspaceId: { type: 'string', format: 'uuid', nullable: true },
          referenceCount: { type: 'integer' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      },
      Prototype: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          title: { type: 'string' },
          status: { type: 'string', enum: ['draft', 'review', 'approved'] },
          workspaceId: { type: 'string', format: 'uuid', nullable: true },
          prdId: { type: 'string', format: 'uuid', nullable: true },
          pages: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                pageName: { type: 'string' },
                slug: { type: 'string' },
                htmlContent: { type: 'string' },
                sortOrder: { type: 'integer' }
              }
            }
          },
          createdAt: { type: 'string', format: 'date-time' }
        }
      },
      LogicMap: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          prdId: { type: 'string', format: 'uuid' },
          title: { type: 'string' },
          graphData: { type: 'object', description: 'JSON 格式的逻辑图节点与边数据' },
          coverageScore: { type: 'number', minimum: 0, maximum: 1 },
          createdAt: { type: 'string', format: 'date-time' }
        }
      },
      Comment: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          content: { type: 'string' },
          targetType: { type: 'string', enum: ['prd', 'document', 'prototype'] },
          targetId: { type: 'string', format: 'uuid' },
          parentId: { type: 'string', format: 'uuid', nullable: true },
          isResolved: { type: 'boolean' },
          author: { $ref: '#/components/schemas/User' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      },
      ActivityLog: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          action: { type: 'string', description: '操作类型，如 create_document、update_prd 等' },
          entityType: { type: 'string' },
          entityId: { type: 'string', format: 'uuid' },
          metadata: { type: 'object' },
          actor: { $ref: '#/components/schemas/User' },
          createdAt: { type: 'string', format: 'date-time' }
        }
      },
      Conversation: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          prdId: { type: 'string', format: 'uuid' },
          title: { type: 'string', nullable: true },
          messages: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                role: { type: 'string', enum: ['user', 'assistant'] },
                content: { type: 'string' },
                createdAt: { type: 'string', format: 'date-time' }
              }
            }
          },
          createdAt: { type: 'string', format: 'date-time' }
        }
      },
      AIProvider: {
        type: 'object',
        properties: {
          provider: { type: 'string', enum: ['anthropic', 'openai', 'google', 'glm', 'qwen', 'wenxin', 'deepseek', 'ollama'] },
          isEnabled: { type: 'boolean' },
          baseUrl: { type: 'string', nullable: true, description: '自定义 API Base URL（用于中转站）' },
          models: { type: 'array', items: { type: 'string' }, description: '用户选择的可用模型列表' }
        }
      },
      Tag: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          color: { type: 'string', example: '#6366f1' },
          workspaceId: { type: 'string', format: 'uuid', nullable: true },
          createdAt: { type: 'string', format: 'date-time' }
        }
      },
      Category: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          parentId: { type: 'string', format: 'uuid', nullable: true },
          sortOrder: { type: 'integer' },
          workspaceId: { type: 'string', format: 'uuid', nullable: true },
          createdAt: { type: 'string', format: 'date-time' }
        }
      },
      Asset: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          url: { type: 'string', format: 'uri' },
          mimeType: { type: 'string' },
          fileSize: { type: 'integer' },
          prdId: { type: 'string', format: 'uuid', nullable: true },
          createdAt: { type: 'string', format: 'date-time' }
        }
      },
      Pagination: {
        type: 'object',
        properties: {
          total: { type: 'integer' },
          page: { type: 'integer' },
          limit: { type: 'integer' },
          totalPages: { type: 'integer' }
        }
      }
    }
  },
  security: [{ cookieAuth: [] }],
  paths: {

    // ═══════════════════════════════════════════════════════════════════════════
    // 认证 (auth)
    // ═══════════════════════════════════════════════════════════════════════════

    '/api/v1/auth/register': {
      post: {
        tags: ['auth'],
        summary: '用户注册',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email', example: 'user@example.com' },
                  password: { type: 'string', minLength: 8, example: 'SecurePass123' },
                  username: { type: 'string', minLength: 2, maxLength: 50 },
                  fullName: { type: 'string', maxLength: 100, nullable: true }
                }
              }
            }
          }
        },
        responses: {
          ...ok('注册成功', {
            type: 'object',
            properties: { success: { type: 'boolean' }, user: { $ref: '#/components/schemas/User' } }
          }),
          ...stdErrors
        }
      }
    },

    '/api/v1/auth/login': {
      post: {
        tags: ['auth'],
        summary: '用户登录',
        description: '登录成功后服务器自动写入 HTTP-Only Cookie `auth_token`，后续请求自动携带。',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 1 }
                }
              }
            }
          }
        },
        responses: {
          ...ok('登录成功（设置 HTTP-Only Cookie）', {
            type: 'object',
            properties: { success: { type: 'boolean' }, user: { $ref: '#/components/schemas/User' } }
          }),
          '401': { description: '邮箱或密码错误', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '403': { description: '账号已禁用', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } }
        }
      }
    },

    '/api/v1/auth/logout': {
      post: {
        tags: ['auth'],
        summary: '退出登录',
        description: '清除 `auth_token` Cookie。',
        responses: {
          ...ok('退出成功')
        }
      }
    },

    '/api/v1/auth/me': {
      get: {
        tags: ['auth'],
        summary: '获取当前登录用户信息',
        responses: {
          ...okData('当前用户信息', 'User'),
          '401': { description: '未登录', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } }
        }
      }
    },

    '/api/v1/auth/forgot-password': {
      post: {
        tags: ['auth'],
        summary: '忘记密码（发送重置邮件）',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email'],
                properties: { email: { type: 'string', format: 'email' } }
              }
            }
          }
        },
        responses: {
          ...ok('重置邮件已发送（无论邮箱是否存在均返回成功，防止用户枚举）')
        }
      }
    },

    '/api/v1/auth/reset-password': {
      post: {
        tags: ['auth'],
        summary: '重置密码',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['token', 'newPassword'],
                properties: {
                  token: { type: 'string', description: '邮件中的重置令牌' },
                  newPassword: { type: 'string', minLength: 8 }
                }
              }
            }
          }
        },
        responses: {
          ...ok('密码重置成功'),
          '400': { description: '令牌无效或已过期', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } }
        }
      }
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // 用户 (user)
    // ═══════════════════════════════════════════════════════════════════════════

    '/api/v1/user': {
      put: {
        tags: ['user'],
        summary: '更新用户信息',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  username: { type: 'string', minLength: 2, maxLength: 50 },
                  fullName: { type: 'string', maxLength: 100, nullable: true }
                }
              }
            }
          }
        },
        responses: {
          ...okData('更新成功', 'User'),
          ...stdErrors
        }
      }
    },

    '/api/v1/user/password': {
      put: {
        tags: ['user'],
        summary: '修改密码',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['currentPassword', 'newPassword'],
                properties: {
                  currentPassword: { type: 'string' },
                  newPassword: { type: 'string', minLength: 8 }
                }
              }
            }
          }
        },
        responses: {
          ...ok('密码修改成功'),
          '401': { description: '当前密码错误', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } }
        }
      }
    },

    '/api/v1/user/avatar': {
      post: {
        tags: ['user'],
        summary: '上传用户头像',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['file'],
                properties: {
                  file: { type: 'string', format: 'binary', description: '图片文件（JPG/PNG/WebP，最大 5MB）' }
                }
              }
            }
          }
        },
        responses: {
          ...ok('上传成功', {
            type: 'object',
            properties: { success: { type: 'boolean' }, avatarUrl: { type: 'string', format: 'uri' } }
          }),
          ...stdErrors
        }
      }
    },

    '/api/v1/user/avatar/{userId}': {
      get: {
        tags: ['user'],
        summary: '获取用户头像',
        security: [],
        parameters: [pathParam('userId', '用户 ID')],
        responses: {
          '302': { description: '重定向到头像图片 URL' },
          '404': { description: '用户不存在或无头像', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } }
        }
      }
    },

    '/api/v1/user/avatar/generate': {
      post: {
        tags: ['user'],
        summary: 'AI 生成头像',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['prompt'],
                properties: {
                  prompt: { type: 'string', description: '头像描述（英文效果更佳）' },
                  style: { type: 'string', enum: ['realistic', 'cartoon', 'pixel', 'abstract'] }
                }
              }
            }
          }
        },
        responses: {
          ...ok('生成成功', {
            type: 'object',
            properties: { success: { type: 'boolean' }, avatarUrl: { type: 'string', format: 'uri' } }
          }),
          ...stdErrors
        }
      }
    },

    '/api/v1/user/avatar/default': {
      post: {
        tags: ['user'],
        summary: '重置为默认头像（基于用户名首字母生成）',
        responses: {
          ...ok('重置成功', {
            type: 'object',
            properties: { success: { type: 'boolean' }, avatarUrl: { type: 'string', format: 'uri' } }
          }),
          ...stdErrors
        }
      }
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // 工作区 (workspaces)
    // ═══════════════════════════════════════════════════════════════════════════

    '/api/v1/workspaces': {
      get: {
        tags: ['workspaces'],
        summary: '获取当前用户的工作区列表',
        responses: {
          ...okList('工作区列表', 'Workspace'),
          ...stdErrors
        }
      },
      post: {
        tags: ['workspaces'],
        summary: '创建工作区',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string', minLength: 1, maxLength: 100 },
                  description: { type: 'string', maxLength: 500, nullable: true },
                  icon: { type: 'string', default: '📁' },
                  color: { type: 'string', default: '#6366f1' }
                }
              }
            }
          }
        },
        responses: {
          ...okData('创建成功', 'Workspace'),
          ...stdErrors
        }
      }
    },

    '/api/v1/workspaces/{id}': {
      get: {
        tags: ['workspaces'],
        summary: '获取工作区详情',
        parameters: [pathParam('id', '工作区 ID')],
        responses: {
          ...okData('工作区详情', 'Workspace'),
          ...stdErrors
        }
      },
      patch: {
        tags: ['workspaces'],
        summary: '更新工作区（需 admin 权限）',
        parameters: [pathParam('id', '工作区 ID')],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string', minLength: 1, maxLength: 100 },
                  description: { type: 'string', nullable: true },
                  icon: { type: 'string' },
                  color: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          ...okData('更新成功', 'Workspace'),
          ...stdErrors
        }
      },
      delete: {
        tags: ['workspaces'],
        summary: '删除工作区（需 owner 权限）',
        parameters: [pathParam('id', '工作区 ID')],
        responses: {
          ...ok('删除成功'),
          ...stdErrors
        }
      }
    },

    '/api/v1/workspaces/{id}/set-default': {
      post: {
        tags: ['workspaces'],
        summary: '将工作区设为默认',
        parameters: [pathParam('id', '工作区 ID')],
        responses: {
          ...ok('设置成功'),
          ...stdErrors
        }
      }
    },

    '/api/v1/workspaces/{id}/activities': {
      get: {
        tags: ['workspaces'],
        summary: '获取工作区活动日志',
        parameters: [
          pathParam('id', '工作区 ID'),
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } }
        ],
        responses: {
          ...ok('活动日志列表', {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  activities: { type: 'array', items: { $ref: '#/components/schemas/ActivityLog' } },
                  total: { type: 'integer' }
                }
              }
            }
          }),
          ...stdErrors
        }
      }
    },

    '/api/v1/workspaces/{id}/members': {
      get: {
        tags: ['workspaces'],
        summary: '获取工作区成员列表（需 member 权限）',
        parameters: [pathParam('id', '工作区 ID')],
        responses: {
          ...okList('成员列表', 'WorkspaceMember'),
          ...stdErrors
        }
      }
    },

    '/api/v1/workspaces/{id}/members/invite': {
      post: {
        tags: ['workspaces'],
        summary: '邀请新成员（需 admin 权限）',
        parameters: [pathParam('id', '工作区 ID')],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  role: { type: 'string', enum: ['admin', 'member'], default: 'member' }
                }
              }
            }
          }
        },
        responses: {
          ...ok('邀请邮件已发送'),
          ...stdErrors
        }
      }
    },

    '/api/v1/workspaces/{id}/members/{userId}': {
      delete: {
        tags: ['workspaces'],
        summary: '移除工作区成员（需 admin 权限）',
        parameters: [
          pathParam('id', '工作区 ID'),
          pathParam('userId', '要移除的用户 ID')
        ],
        responses: {
          ...ok('移除成功'),
          ...stdErrors
        }
      }
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // 邀请 (invitations)
    // ═══════════════════════════════════════════════════════════════════════════

    '/api/v1/invitations/{token}': {
      get: {
        tags: ['invitations'],
        summary: '查看邀请详情（无需认证）',
        security: [],
        parameters: [{ name: 'token', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          ...ok('邀请详情', {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  workspaceName: { type: 'string' },
                  inviterName: { type: 'string' },
                  email: { type: 'string', format: 'email' },
                  role: { type: 'string' },
                  expiresAt: { type: 'string', format: 'date-time' }
                }
              }
            }
          }),
          '404': { description: '邀请不存在或已过期', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } }
        }
      }
    },

    '/api/v1/invitations/{token}/accept': {
      post: {
        tags: ['invitations'],
        summary: '接受邀请（需登录）',
        parameters: [{ name: 'token', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          ...okData('加入工作区成功', 'Workspace'),
          ...stdErrors
        }
      }
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // 文档管理 (documents)
    // ═══════════════════════════════════════════════════════════════════════════

    '/api/v1/documents': {
      get: {
        tags: ['documents'],
        summary: '获取文档列表',
        parameters: [
          { name: 'workspace_id', in: 'query', schema: { type: 'string', format: 'uuid' }, description: '按工作区过滤' },
          { name: 'category_id', in: 'query', schema: { type: 'string', format: 'uuid' }, description: '按分类过滤' },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['pending', 'processing', 'completed', 'failed'] } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1, minimum: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50, minimum: 1, maximum: 100 } }
        ],
        responses: {
          ...ok('文档列表', {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  documents: { type: 'array', items: { $ref: '#/components/schemas/Document' } },
                  total: { type: 'integer' },
                  page: { type: 'integer' },
                  limit: { type: 'integer' }
                }
              }
            }
          }),
          ...stdErrors
        }
      },
      post: {
        tags: ['documents'],
        summary: '创建文档记录（不含文件上传）',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title'],
                properties: {
                  title: { type: 'string' },
                  workspaceId: { type: 'string', format: 'uuid', nullable: true }
                }
              }
            }
          }
        },
        responses: {
          ...okData('创建成功', 'Document'),
          ...stdErrors
        }
      }
    },

    '/api/v1/documents/upload': {
      post: {
        tags: ['documents'],
        summary: '上传单个文档（自动解析 + 向量化）',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['file'],
                properties: {
                  file: { type: 'string', format: 'binary', description: '文档文件（PDF/DOCX/MD/TXT）' },
                  workspaceId: { type: 'string', format: 'uuid' },
                  title: { type: 'string', description: '可选标题，默认使用文件名' }
                }
              }
            }
          }
        },
        responses: {
          ...okData('上传成功，后台异步处理中', 'Document'),
          ...stdErrors
        }
      }
    },

    '/api/v1/documents/batch-upload': {
      post: {
        tags: ['documents'],
        summary: '批量上传文档（异步队列）',
        description: '立即返回 `taskId`，可通过 GET `/api/v1/documents/tasks/:taskId` 轮询进度。',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['files'],
                properties: {
                  files: {
                    type: 'array',
                    items: { type: 'string', format: 'binary' },
                    description: '多个文档文件（最多 20 个）'
                  },
                  workspaceId: { type: 'string', format: 'uuid' }
                }
              }
            }
          }
        },
        responses: {
          ...ok('批量任务已创建', {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              taskId: { type: 'string', description: '批量任务 ID，用于轮询进度' }
            }
          }),
          ...stdErrors
        }
      }
    },

    '/api/v1/documents/tasks/{taskId}': {
      get: {
        tags: ['documents'],
        summary: '查询批量上传任务进度',
        parameters: [{ name: 'taskId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          ...ok('任务进度', {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  taskId: { type: 'string' },
                  status: { type: 'string', enum: ['pending', 'processing', 'completed', 'failed'] },
                  total: { type: 'integer' },
                  processed: { type: 'integer' },
                  failed: { type: 'integer' },
                  errors: { type: 'array', items: { type: 'string' } }
                }
              }
            }
          }),
          ...stdErrors
        }
      }
    },

    '/api/v1/documents/search': {
      post: {
        tags: ['search'],
        summary: '文档混合搜索（RAG）',
        description: '支持三种模式：`keyword`（PostgreSQL 全文检索）、`vector`（pgvector 语义检索）、`hybrid`（RRF 融合，默认，准确率最高）。',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['query'],
                properties: {
                  query: { type: 'string', minLength: 1 },
                  mode: { type: 'string', enum: ['keyword', 'vector', 'hybrid'], default: 'hybrid' },
                  topK: { type: 'integer', minimum: 1, maximum: 50, default: 5 },
                  threshold: { type: 'number', minimum: 0, maximum: 1, default: 0.7 },
                  keywordWeight: { type: 'number', minimum: 0, maximum: 1, default: 0.3 },
                  vectorWeight: { type: 'number', minimum: 0, maximum: 1, default: 0.7 },
                  workspaceId: { type: 'string', format: 'uuid', nullable: true },
                  documentIds: { type: 'array', items: { type: 'string', format: 'uuid' }, description: '限定在特定文档范围内搜索' }
                }
              }
            }
          }
        },
        responses: {
          ...ok('搜索结果', {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  query: { type: 'string' },
                  mode: { type: 'string' },
                  totalResults: { type: 'integer' },
                  results: { type: 'array', items: { $ref: '#/components/schemas/SearchResult' } }
                }
              }
            }
          }),
          ...stdErrors
        }
      }
    },

    '/api/v1/documents/batch-status': {
      post: {
        tags: ['documents'],
        summary: '批量查询文档处理状态',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['documentIds'],
                properties: {
                  documentIds: { type: 'array', items: { type: 'string', format: 'uuid' }, maxItems: 100 }
                }
              }
            }
          }
        },
        responses: {
          ...ok('批量状态', {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'object', additionalProperties: { type: 'string' }, description: '{ documentId: status }' }
            }
          }),
          ...stdErrors
        }
      }
    },

    '/api/v1/documents/duplicates': {
      get: {
        tags: ['documents'],
        summary: '查找重复文档（基于 SHA-256 哈希）',
        parameters: [
          { name: 'workspace_id', in: 'query', schema: { type: 'string', format: 'uuid' } }
        ],
        responses: {
          ...ok('重复文档列表', {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    hash: { type: 'string' },
                    documents: { type: 'array', items: { $ref: '#/components/schemas/Document' } }
                  }
                }
              }
            }
          }),
          ...stdErrors
        }
      }
    },

    '/api/v1/documents/duplicates/cleanup': {
      post: {
        tags: ['documents'],
        summary: '清理重复文档（保留最新版本）',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  workspaceId: { type: 'string', format: 'uuid' },
                  dryRun: { type: 'boolean', default: false, description: '仅预览，不执行删除' }
                }
              }
            }
          }
        },
        responses: {
          ...ok('清理完成', {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'object', properties: { deletedCount: { type: 'integer' } } }
            }
          }),
          ...stdErrors
        }
      }
    },

    '/api/v1/documents/share': {
      post: {
        tags: ['share'],
        summary: '生成文档分享链接（预签名 URL）',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['documentId'],
                properties: {
                  documentId: { type: 'string', format: 'uuid' },
                  expiresIn: { type: 'integer', default: 3600, description: '有效期（秒）' }
                }
              }
            }
          }
        },
        responses: {
          ...ok('分享链接', {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              shareUrl: { type: 'string', format: 'uri' },
              expiresAt: { type: 'string', format: 'date-time' }
            }
          }),
          ...stdErrors
        }
      }
    },

    '/api/v1/documents/reindex': {
      post: {
        tags: ['documents'],
        summary: '触发文档重新向量化',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['documentIds'],
                properties: {
                  documentIds: { type: 'array', items: { type: 'string', format: 'uuid' } }
                }
              }
            }
          }
        },
        responses: {
          ...ok('重新索引任务已提交'),
          ...stdErrors
        }
      }
    },

    '/api/v1/documents/export': {
      post: {
        tags: ['documents'],
        summary: '导出文档（ZIP 打包）',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['documentIds'],
                properties: {
                  documentIds: { type: 'array', items: { type: 'string', format: 'uuid' } }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'ZIP 文件流',
            content: { 'application/zip': { schema: { type: 'string', format: 'binary' } } }
          },
          ...stdErrors
        }
      }
    },

    '/api/v1/documents/cache': {
      delete: {
        tags: ['documents'],
        summary: '清空文档搜索缓存',
        responses: {
          ...ok('缓存已清空'),
          ...stdErrors
        }
      }
    },

    '/api/v1/documents/{id}': {
      get: {
        tags: ['documents'],
        summary: '获取文档详情',
        parameters: [pathParam('id')],
        responses: {
          ...okData('文档详情', 'Document'),
          ...stdErrors
        }
      },
      put: {
        tags: ['documents'],
        summary: '更新文档元数据',
        parameters: [pathParam('id')],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string', nullable: true }
                }
              }
            }
          }
        },
        responses: {
          ...okData('更新成功', 'Document'),
          ...stdErrors
        }
      },
      delete: {
        tags: ['documents'],
        summary: '删除文档（含向量数据）',
        parameters: [pathParam('id')],
        responses: {
          ...ok('删除成功'),
          ...stdErrors
        }
      }
    },

    '/api/v1/documents/{id}/download': {
      get: {
        tags: ['documents'],
        summary: '下载文档（生成预签名 URL 并重定向）',
        parameters: [pathParam('id')],
        responses: {
          '302': { description: '重定向到预签名下载 URL' },
          ...stdErrors
        }
      }
    },

    '/api/v1/documents/{id}/status': {
      get: {
        tags: ['documents'],
        summary: '查询文档处理状态',
        parameters: [pathParam('id')],
        responses: {
          ...ok('处理状态', {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  documentId: { type: 'string', format: 'uuid' },
                  status: { type: 'string', enum: ['pending', 'processing', 'completed', 'failed'] },
                  progress: { type: 'number', minimum: 0, maximum: 100 },
                  error: { type: 'string', nullable: true }
                }
              }
            }
          }),
          ...stdErrors
        }
      }
    },

    '/api/v1/documents/{id}/events': {
      get: {
        tags: ['documents'],
        summary: '文档处理状态 SSE 实时推送',
        description: '通过 Server-Sent Events 实时推送处理进度。事件类型：`status`（状态变更）、`done`（完成）、`error`（失败）。',
        parameters: [pathParam('id')],
        responses: {
          '200': {
            description: 'SSE 事件流',
            content: { 'text/event-stream': { schema: { type: 'string' } } }
          },
          ...stdErrors
        }
      }
    },

    '/api/v1/documents/{id}/chunks': {
      get: {
        tags: ['documents'],
        summary: '获取文档分块列表',
        parameters: [
          pathParam('id'),
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } }
        ],
        responses: {
          ...ok('分块列表', {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  chunks: { type: 'array', items: { $ref: '#/components/schemas/DocumentChunk' } },
                  total: { type: 'integer' }
                }
              }
            }
          }),
          ...stdErrors
        }
      }
    },

    '/api/v1/documents/{id}/references': {
      get: {
        tags: ['documents'],
        summary: '获取文档被哪些 PRD 引用',
        parameters: [pathParam('id')],
        responses: {
          ...okList('引用列表', 'PrdDocument'),
          ...stdErrors
        }
      }
    },

    '/api/v1/documents/{id}/logs': {
      get: {
        tags: ['documents'],
        summary: '获取文档处理日志',
        parameters: [pathParam('id')],
        responses: {
          ...ok('处理日志', {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    level: { type: 'string', enum: ['info', 'warn', 'error'] },
                    message: { type: 'string' },
                    timestamp: { type: 'string', format: 'date-time' }
                  }
                }
              }
            }
          }),
          ...stdErrors
        }
      }
    },

    '/api/v1/documents/{id}/usage': {
      get: {
        tags: ['documents'],
        summary: '获取文档使用统计',
        parameters: [pathParam('id')],
        responses: {
          ...ok('使用统计', {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  searchCount: { type: 'integer' },
                  prdReferenceCount: { type: 'integer' },
                  lastUsedAt: { type: 'string', format: 'date-time', nullable: true }
                }
              }
            }
          }),
          ...stdErrors
        }
      }
    },

    '/api/v1/documents/{id}/versions': {
      get: {
        tags: ['documents'],
        summary: '获取文档版本历史',
        parameters: [pathParam('id')],
        responses: {
          ...ok('版本列表', {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  documentId: { type: 'string', format: 'uuid' },
                  currentVersion: { type: 'integer' },
                  totalVersions: { type: 'integer' },
                  versions: { type: 'array', items: { $ref: '#/components/schemas/DocumentVersion' } }
                }
              }
            }
          }),
          ...stdErrors
        }
      },
      post: {
        tags: ['documents'],
        summary: '上传新版本',
        parameters: [pathParam('id')],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['file'],
                properties: {
                  file: { type: 'string', format: 'binary' },
                  changeSummary: { type: 'string', description: '版本变更说明' }
                }
              }
            }
          }
        },
        responses: {
          ...okData('新版本已上传', 'DocumentVersion'),
          ...stdErrors
        }
      }
    },

    '/api/v1/documents/{id}/versions/{version}/download': {
      get: {
        tags: ['documents'],
        summary: '下载特定版本',
        parameters: [
          pathParam('id'),
          { name: 'version', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: {
          '302': { description: '重定向到预签名下载 URL' },
          ...stdErrors
        }
      }
    },

    '/api/v1/documents/{id}/category': {
      put: {
        tags: ['documents'],
        summary: '设置文档分类',
        parameters: [pathParam('id')],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['categoryId'],
                properties: {
                  categoryId: { type: 'string', format: 'uuid', nullable: true }
                }
              }
            }
          }
        },
        responses: {
          ...ok('分类已更新'),
          ...stdErrors
        }
      }
    },

    '/api/v1/documents/{id}/tags': {
      get: {
        tags: ['documents'],
        summary: '获取文档标签',
        parameters: [pathParam('id')],
        responses: {
          ...okList('标签列表', 'Tag'),
          ...stdErrors
        }
      },
      post: {
        tags: ['documents'],
        summary: '为文档添加标签',
        parameters: [pathParam('id')],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['tagId'],
                properties: { tagId: { type: 'string', format: 'uuid' } }
              }
            }
          }
        },
        responses: {
          ...ok('添加成功'),
          ...stdErrors
        }
      },
      put: {
        tags: ['documents'],
        summary: '批量更新文档标签（全量替换）',
        parameters: [pathParam('id')],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['tagIds'],
                properties: { tagIds: { type: 'array', items: { type: 'string', format: 'uuid' } } }
              }
            }
          }
        },
        responses: {
          ...ok('标签已更新'),
          ...stdErrors
        }
      }
    },

    '/api/v1/documents/{id}/tags/{tagId}': {
      delete: {
        tags: ['documents'],
        summary: '移除文档的指定标签',
        parameters: [
          pathParam('id'),
          pathParam('tagId', '标签 ID')
        ],
        responses: {
          ...ok('移除成功'),
          ...stdErrors
        }
      }
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // PRD 文档 (prd)
    // ═══════════════════════════════════════════════════════════════════════════

    '/api/v1/prd': {
      get: {
        tags: ['prd'],
        summary: '获取 PRD 列表',
        parameters: [
          { name: 'workspace_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } }
        ],
        responses: {
          ...ok('PRD 列表', {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  prds: { type: 'array', items: { $ref: '#/components/schemas/PrdDocument' } },
                  total: { type: 'integer' },
                  page: { type: 'integer' }
                }
              }
            }
          }),
          ...stdErrors
        }
      },
      post: {
        tags: ['prd'],
        summary: '创建 PRD 文档（直接写入，不经过 AI）',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title'],
                properties: {
                  title: { type: 'string' },
                  content: { type: 'string', description: 'Markdown 格式内容' },
                  workspaceId: { type: 'string', format: 'uuid', nullable: true }
                }
              }
            }
          }
        },
        responses: {
          ...okData('创建成功', 'PrdDocument'),
          ...stdErrors
        }
      }
    },

    '/api/v1/prd/stream': {
      post: {
        tags: ['prd'],
        summary: 'AI 流式生成 PRD',
        description: '调用 AI 模型基于 RAG 上下文生成 PRD，通过 SSE 实时返回生成内容。\n\n前端监听示例：\n```js\nconst response = await fetch("/api/v1/prd/stream", { method: "POST", body: JSON.stringify({...}) })\nconst reader = response.body.getReader()\n```',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['userInput'],
                properties: {
                  userInput: { type: 'string', description: '对 PRD 的需求描述' },
                  workspaceId: { type: 'string', format: 'uuid', nullable: true },
                  documentIds: { type: 'array', items: { type: 'string', format: 'uuid' }, description: 'RAG 检索范围' },
                  modelId: { type: 'string', description: '指定模型，默认使用系统配置' },
                  temperature: { type: 'number', minimum: 0, maximum: 2, default: 0.7 },
                  maxTokens: { type: 'integer', default: 8000 }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'SSE 流式内容（每帧为 Markdown 片段）',
            content: { 'text/event-stream': { schema: { type: 'string' } } }
          },
          ...stdErrors
        }
      }
    },

    '/api/v1/prd/{id}': {
      get: {
        tags: ['prd'],
        summary: '获取 PRD 详情',
        parameters: [pathParam('id')],
        responses: {
          ...okData('PRD 详情', 'PrdDocument'),
          ...stdErrors
        }
      },
      patch: {
        tags: ['prd'],
        summary: '更新 PRD 内容',
        parameters: [pathParam('id')],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  content: { type: 'string' },
                  status: { type: 'string', enum: ['draft', 'review', 'approved', 'archived'] }
                }
              }
            }
          }
        },
        responses: {
          ...okData('更新成功', 'PrdDocument'),
          ...stdErrors
        }
      },
      delete: {
        tags: ['prd'],
        summary: '删除 PRD',
        parameters: [pathParam('id')],
        responses: {
          ...ok('删除成功'),
          ...stdErrors
        }
      }
    },

    '/api/v1/prd/{id}/export': {
      get: {
        tags: ['prd'],
        summary: '导出 PRD（PDF 或 Word）',
        parameters: [
          pathParam('id'),
          { name: 'format', in: 'query', required: true, schema: { type: 'string', enum: ['pdf', 'docx'] } }
        ],
        responses: {
          '200': {
            description: '文件流',
            content: {
              'application/pdf': { schema: { type: 'string', format: 'binary' } },
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { schema: { type: 'string', format: 'binary' } }
            }
          },
          ...stdErrors
        }
      }
    },

    '/api/v1/prd/{id}/duplicate': {
      post: {
        tags: ['prd'],
        summary: '复制 PRD',
        parameters: [pathParam('id')],
        responses: {
          ...okData('复制成功', 'PrdDocument'),
          ...stdErrors
        }
      }
    },

    '/api/v1/prd/{id}/references': {
      get: {
        tags: ['prd'],
        summary: '获取 PRD 引用的文档列表',
        parameters: [pathParam('id')],
        responses: {
          ...okList('引用文档列表', 'Document'),
          ...stdErrors
        }
      }
    },

    '/api/v1/prd/{id}/logic-coverage': {
      get: {
        tags: ['prd'],
        summary: '获取 PRD 逻辑覆盖度分析',
        parameters: [pathParam('id')],
        responses: {
          ...ok('覆盖度报告', {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  coverageScore: { type: 'number', minimum: 0, maximum: 1 },
                  coveredPoints: { type: 'array', items: { type: 'string' } },
                  uncoveredPoints: { type: 'array', items: { type: 'string' } }
                }
              }
            }
          }),
          ...stdErrors
        }
      }
    },

    '/api/v1/prd/{id}/vectorize': {
      post: {
        tags: ['prd'],
        summary: '将 PRD 内容向量化（加入知识库）',
        parameters: [pathParam('id')],
        responses: {
          ...ok('向量化完成', {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'object', properties: { chunksCreated: { type: 'integer' } } }
            }
          }),
          ...stdErrors
        }
      },
      delete: {
        tags: ['prd'],
        summary: '删除 PRD 向量化数据（从知识库移除）',
        parameters: [pathParam('id')],
        responses: {
          ...ok('向量数据已删除'),
          ...stdErrors
        }
      }
    },

    '/api/v1/prd/references/{id}': {
      get: {
        tags: ['prd'],
        summary: '获取单条 PRD 引用详情',
        parameters: [pathParam('id', '引用 ID')],
        responses: {
          ...ok('引用详情'),
          ...stdErrors
        }
      }
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // 原型 (prototypes)
    // ═══════════════════════════════════════════════════════════════════════════

    '/api/v1/prototypes': {
      get: {
        tags: ['prototypes'],
        summary: '获取原型列表',
        parameters: [
          { name: 'workspace_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'prd_id', in: 'query', schema: { type: 'string', format: 'uuid' } }
        ],
        responses: {
          ...okList('原型列表', 'Prototype'),
          ...stdErrors
        }
      },
      post: {
        tags: ['prototypes'],
        summary: 'AI 生成原型（非流式）',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title', 'userInput'],
                properties: {
                  title: { type: 'string' },
                  userInput: { type: 'string' },
                  prdId: { type: 'string', format: 'uuid', nullable: true },
                  workspaceId: { type: 'string', format: 'uuid', nullable: true },
                  modelId: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          ...okData('生成成功', 'Prototype'),
          ...stdErrors
        }
      }
    },

    '/api/v1/prototypes/stream': {
      post: {
        tags: ['prototypes'],
        summary: 'AI 流式生成原型（SSE）',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title', 'userInput'],
                properties: {
                  title: { type: 'string' },
                  userInput: { type: 'string' },
                  prdId: { type: 'string', format: 'uuid', nullable: true },
                  workspaceId: { type: 'string', format: 'uuid', nullable: true },
                  modelId: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'SSE 流式 HTML 内容', content: { 'text/event-stream': { schema: { type: 'string' } } } },
          ...stdErrors
        }
      }
    },

    '/api/v1/prototypes/generate-from-prd': {
      post: {
        tags: ['prototypes'],
        summary: '从 PRD 一键生成原型',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['prdId'],
                properties: {
                  prdId: { type: 'string', format: 'uuid' },
                  modelId: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          ...okData('生成成功', 'Prototype'),
          ...stdErrors
        }
      }
    },

    '/api/v1/prototypes/{id}': {
      get: {
        tags: ['prototypes'],
        summary: '获取原型详情（含所有页面）',
        parameters: [pathParam('id')],
        responses: {
          ...okData('原型详情', 'Prototype'),
          ...stdErrors
        }
      },
      put: {
        tags: ['prototypes'],
        summary: '更新原型元数据',
        parameters: [pathParam('id')],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  status: { type: 'string', enum: ['draft', 'review', 'approved'] }
                }
              }
            }
          }
        },
        responses: {
          ...okData('更新成功', 'Prototype'),
          ...stdErrors
        }
      },
      delete: {
        tags: ['prototypes'],
        summary: '删除原型',
        parameters: [pathParam('id')],
        responses: {
          ...ok('删除成功'),
          ...stdErrors
        }
      }
    },

    '/api/v1/prototypes/{id}/pages': {
      get: {
        tags: ['prototypes'],
        summary: '获取原型页面列表',
        parameters: [pathParam('id')],
        responses: {
          ...ok('页面列表'),
          ...stdErrors
        }
      }
    },

    '/api/v1/prototypes/{id}/pages/{pageId}': {
      put: {
        tags: ['prototypes'],
        summary: '更新原型页面内容',
        parameters: [
          pathParam('id'),
          pathParam('pageId', '页面 ID')
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  pageName: { type: 'string' },
                  htmlContent: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          ...ok('页面已更新'),
          ...stdErrors
        }
      }
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // 逻辑图 (logic-maps)
    // ═══════════════════════════════════════════════════════════════════════════

    '/api/v1/logic-maps/generate-from-prd': {
      post: {
        tags: ['logic-maps'],
        summary: '从 PRD 生成逻辑图',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['prdId'],
                properties: {
                  prdId: { type: 'string', format: 'uuid' },
                  modelId: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          ...okData('生成成功', 'LogicMap'),
          ...stdErrors
        }
      }
    },

    '/api/v1/logic-maps/{id}': {
      get: {
        tags: ['logic-maps'],
        summary: '获取逻辑图详情',
        parameters: [pathParam('id')],
        responses: {
          ...okData('逻辑图详情', 'LogicMap'),
          ...stdErrors
        }
      }
    },

    '/api/v1/logic-coverage/batch': {
      get: {
        tags: ['logic-maps'],
        summary: '批量获取 PRD 逻辑覆盖度',
        parameters: [
          { name: 'prd_ids', in: 'query', required: true, schema: { type: 'string', description: '逗号分隔的 PRD ID 列表' } }
        ],
        responses: {
          ...ok('批量覆盖度', {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'object', additionalProperties: { type: 'number' }, description: '{ prdId: coverageScore }' }
            }
          }),
          ...stdErrors
        }
      }
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // 对话 (conversations)
    // ═══════════════════════════════════════════════════════════════════════════

    '/api/v1/conversations/{prdId}': {
      get: {
        tags: ['conversations'],
        summary: '获取 PRD 的对话历史',
        parameters: [pathParam('prdId', 'PRD ID')],
        responses: {
          ...okData('对话历史', 'Conversation'),
          ...stdErrors
        }
      },
      put: {
        tags: ['conversations'],
        summary: '更新对话（如重命名标题）',
        parameters: [pathParam('prdId', 'PRD ID')],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { title: { type: 'string' } }
              }
            }
          }
        },
        responses: {
          ...ok('更新成功'),
          ...stdErrors
        }
      }
    },

    '/api/v1/conversations/save': {
      post: {
        tags: ['conversations'],
        summary: '保存对话消息',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['prdId', 'messages'],
                properties: {
                  prdId: { type: 'string', format: 'uuid' },
                  messages: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['role', 'content'],
                      properties: {
                        role: { type: 'string', enum: ['user', 'assistant'] },
                        content: { type: 'string' }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        responses: {
          ...ok('保存成功'),
          ...stdErrors
        }
      }
    },

    '/api/v1/conversations/search': {
      get: {
        tags: ['conversations'],
        summary: '全文搜索对话历史',
        parameters: [
          { name: 'q', in: 'query', required: true, schema: { type: 'string', minLength: 1 }, description: '搜索关键词' },
          { name: 'workspaceId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } }
        ],
        responses: {
          ...ok('搜索结果', {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  conversations: { type: 'array', items: { $ref: '#/components/schemas/Conversation' } },
                  total: { type: 'integer' }
                }
              }
            }
          }),
          ...stdErrors
        }
      }
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // 实时对话 (chat)
    // ═══════════════════════════════════════════════════════════════════════════

    '/api/v1/chat/stream': {
      post: {
        tags: ['chat'],
        summary: 'AI 对话（SSE 流式）',
        description: '基于 RAG 的实时对话，支持多轮问答。支持文档范围过滤，上下文自动注入相关文档片段。',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['message'],
                properties: {
                  message: { type: 'string', description: '用户输入的消息' },
                  prdId: { type: 'string', format: 'uuid', nullable: true },
                  workspaceId: { type: 'string', format: 'uuid', nullable: true },
                  documentIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
                  history: {
                    type: 'array',
                    description: '历史消息（最近 N 轮）',
                    items: {
                      type: 'object',
                      properties: {
                        role: { type: 'string', enum: ['user', 'assistant'] },
                        content: { type: 'string' }
                      }
                    }
                  },
                  modelId: { type: 'string' },
                  ragEnabled: { type: 'boolean', default: true }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'SSE 流式对话内容', content: { 'text/event-stream': { schema: { type: 'string' } } } },
          ...stdErrors
        }
      }
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // 评论 (comments)
    // ═══════════════════════════════════════════════════════════════════════════

    '/api/v1/comments': {
      get: {
        tags: ['comments'],
        summary: '获取评论列表',
        parameters: [
          { name: 'targetType', in: 'query', required: true, schema: { type: 'string', enum: ['prd', 'document', 'prototype'] } },
          { name: 'targetId', in: 'query', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'includeResolved', in: 'query', schema: { type: 'boolean', default: false } }
        ],
        responses: {
          ...okList('评论列表', 'Comment'),
          ...stdErrors
        }
      },
      post: {
        tags: ['comments'],
        summary: '创建评论（支持回复）',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['content', 'targetType', 'targetId'],
                properties: {
                  content: { type: 'string', minLength: 1, maxLength: 5000 },
                  targetType: { type: 'string', enum: ['prd', 'document', 'prototype'] },
                  targetId: { type: 'string', format: 'uuid' },
                  parentId: { type: 'string', format: 'uuid', nullable: true, description: '父评论 ID（回复场景）' }
                }
              }
            }
          }
        },
        responses: {
          ...okData('创建成功', 'Comment'),
          ...stdErrors
        }
      }
    },

    '/api/v1/comments/{id}': {
      patch: {
        tags: ['comments'],
        summary: '编辑评论内容（仅作者）',
        parameters: [pathParam('id')],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['content'],
                properties: { content: { type: 'string', minLength: 1 } }
              }
            }
          }
        },
        responses: {
          ...okData('更新成功', 'Comment'),
          ...stdErrors
        }
      },
      delete: {
        tags: ['comments'],
        summary: '删除评论（仅作者或 admin）',
        parameters: [pathParam('id')],
        responses: {
          ...ok('删除成功'),
          ...stdErrors
        }
      }
    },

    '/api/v1/comments/{id}/resolve': {
      post: {
        tags: ['comments'],
        summary: '标记评论为已解决',
        parameters: [pathParam('id')],
        responses: {
          ...okData('已标记为解决', 'Comment'),
          ...stdErrors
        }
      }
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // AI 模型配置 (ai)
    // ═══════════════════════════════════════════════════════════════════════════

    '/api/v1/ai/models': {
      get: {
        tags: ['ai'],
        summary: '获取可用 AI 模型列表',
        description: '返回当前用户可用的所有 AI 模型，合并系统默认模型 + 用户自定义模型。',
        responses: {
          ...ok('模型列表', {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', example: 'claude-3.5-sonnet' },
                    name: { type: 'string' },
                    provider: { type: 'string' },
                    maxTokens: { type: 'integer' },
                    source: { type: 'string', enum: ['system', 'user'], description: 'user: 前缀为 user: 的用户自定义模型' }
                  }
                }
              }
            }
          }),
          ...stdErrors
        }
      }
    },

    '/api/v1/ai/providers': {
      get: {
        tags: ['ai'],
        summary: '获取支持的 AI 提供商列表',
        responses: {
          ...ok('提供商列表', {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', enum: ['anthropic', 'openai', 'google', 'glm', 'qwen', 'wenxin', 'deepseek', 'ollama'] },
                    name: { type: 'string' },
                    supportsCustomBaseUrl: { type: 'boolean' }
                  }
                }
              }
            }
          }),
          ...stdErrors
        }
      }
    },

    '/api/v1/ai/configs': {
      get: {
        tags: ['ai'],
        summary: '获取当前用户的 AI 配置',
        responses: {
          ...okList('AI 配置列表', 'AIProvider'),
          ...stdErrors
        }
      },
      post: {
        tags: ['ai'],
        summary: '保存 AI 提供商配置（新增或更新）',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['provider', 'apiKey'],
                properties: {
                  provider: { type: 'string', enum: ['anthropic', 'openai', 'google', 'glm', 'qwen', 'wenxin', 'deepseek', 'ollama'] },
                  apiKey: { type: 'string', description: 'API Key（保存时加密存储）' },
                  baseUrl: { type: 'string', nullable: true, description: '自定义 Base URL（API 中转站）' },
                  models: { type: 'array', items: { type: 'string' }, description: '用户选择启用的模型 ID 列表' }
                }
              }
            }
          }
        },
        responses: {
          ...ok('保存成功'),
          ...stdErrors
        }
      }
    },

    '/api/v1/ai/configs/{provider}': {
      delete: {
        tags: ['ai'],
        summary: '删除指定提供商的 AI 配置',
        parameters: [{ name: 'provider', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          ...ok('删除成功'),
          ...stdErrors
        }
      }
    },

    '/api/v1/ai/configs/{provider}/toggle': {
      patch: {
        tags: ['ai'],
        summary: '切换 AI 提供商启用/禁用状态',
        parameters: [{ name: 'provider', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['enabled'],
                properties: { enabled: { type: 'boolean' } }
              }
            }
          }
        },
        responses: {
          ...ok('状态已更新'),
          ...stdErrors
        }
      }
    },

    '/api/v1/ai/configs/validate': {
      post: {
        tags: ['ai'],
        summary: '验证 API Key 有效性（可同时获取可用模型列表）',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['provider', 'apiKey'],
                properties: {
                  provider: { type: 'string' },
                  apiKey: { type: 'string' },
                  baseUrl: { type: 'string', nullable: true },
                  fetchModels: { type: 'boolean', default: false, description: '是否同时从提供商获取模型列表' }
                }
              }
            }
          }
        },
        responses: {
          ...ok('验证结果', {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              valid: { type: 'boolean' },
              models: { type: 'array', items: { type: 'string' }, nullable: true },
              modelsFetched: { type: 'boolean' }
            }
          }),
          ...stdErrors
        }
      }
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // 资源管理 (assets)
    // ═══════════════════════════════════════════════════════════════════════════

    '/api/v1/assets': {
      get: {
        tags: ['assets'],
        summary: '获取资源列表',
        parameters: [
          { name: 'prd_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'workspace_id', in: 'query', schema: { type: 'string', format: 'uuid' } }
        ],
        responses: {
          ...okList('资源列表', 'Asset'),
          ...stdErrors
        }
      }
    },

    '/api/v1/assets/upload': {
      post: {
        tags: ['assets'],
        summary: '上传资源文件',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['file'],
                properties: {
                  file: { type: 'string', format: 'binary' },
                  prdId: { type: 'string', format: 'uuid', nullable: true }
                }
              }
            }
          }
        },
        responses: {
          ...okData('上传成功', 'Asset'),
          ...stdErrors
        }
      }
    },

    '/api/v1/assets/models': {
      get: {
        tags: ['assets'],
        summary: '获取支持 AI 生图的模型列表',
        responses: {
          ...ok('生图模型列表'),
          ...stdErrors
        }
      }
    },

    '/api/v1/assets/generate': {
      post: {
        tags: ['assets'],
        summary: 'AI 生成图像',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['prompt'],
                properties: {
                  prompt: { type: 'string', description: '图像描述（英文效果更佳）' },
                  modelId: { type: 'string', description: 'AI 生图模型' },
                  prdId: { type: 'string', format: 'uuid', nullable: true },
                  size: { type: 'string', default: '1024x1024', enum: ['512x512', '1024x1024', '1792x1024', '1024x1792'] }
                }
              }
            }
          }
        },
        responses: {
          ...okData('生成成功', 'Asset'),
          ...stdErrors
        }
      }
    },

    '/api/v1/assets/edit': {
      post: {
        tags: ['assets'],
        summary: 'AI 编辑图像',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['file', 'prompt'],
                properties: {
                  file: { type: 'string', format: 'binary', description: '原始图片' },
                  mask: { type: 'string', format: 'binary', description: '遮罩图片（可选）' },
                  prompt: { type: 'string' },
                  modelId: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          ...okData('编辑成功', 'Asset'),
          ...stdErrors
        }
      }
    },

    '/api/v1/assets/prd/{prdId}': {
      get: {
        tags: ['assets'],
        summary: '获取 PRD 关联的所有资源',
        parameters: [pathParam('prdId', 'PRD ID')],
        responses: {
          ...okList('资源列表', 'Asset'),
          ...stdErrors
        }
      }
    },

    '/api/v1/assets/{id}': {
      delete: {
        tags: ['assets'],
        summary: '删除资源',
        parameters: [pathParam('id')],
        responses: {
          ...ok('删除成功'),
          ...stdErrors
        }
      }
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // 标签 (tags)
    // ═══════════════════════════════════════════════════════════════════════════

    '/api/v1/tags': {
      get: {
        tags: ['tags'],
        summary: '获取标签列表',
        parameters: [
          { name: 'workspace_id', in: 'query', schema: { type: 'string', format: 'uuid' } }
        ],
        responses: {
          ...okList('标签列表', 'Tag'),
          ...stdErrors
        }
      },
      post: {
        tags: ['tags'],
        summary: '创建标签',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string', minLength: 1, maxLength: 50 },
                  color: { type: 'string', example: '#6366f1' },
                  workspaceId: { type: 'string', format: 'uuid', nullable: true }
                }
              }
            }
          }
        },
        responses: {
          ...okData('创建成功', 'Tag'),
          ...stdErrors
        }
      }
    },

    '/api/v1/tags/{id}': {
      get: {
        tags: ['tags'],
        summary: '获取标签详情',
        parameters: [pathParam('id')],
        responses: {
          ...okData('标签详情', 'Tag'),
          ...stdErrors
        }
      },
      patch: {
        tags: ['tags'],
        summary: '更新标签',
        parameters: [pathParam('id')],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string', minLength: 1, maxLength: 50 },
                  color: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          ...okData('更新成功', 'Tag'),
          ...stdErrors
        }
      },
      delete: {
        tags: ['tags'],
        summary: '删除标签',
        parameters: [pathParam('id')],
        responses: {
          ...ok('删除成功'),
          ...stdErrors
        }
      }
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // 分类 (categories)
    // ═══════════════════════════════════════════════════════════════════════════

    '/api/v1/categories': {
      get: {
        tags: ['categories'],
        summary: '获取分类树',
        parameters: [
          { name: 'workspace_id', in: 'query', schema: { type: 'string', format: 'uuid' } }
        ],
        responses: {
          ...okList('分类列表（扁平，含层级信息）', 'Category'),
          ...stdErrors
        }
      },
      post: {
        tags: ['categories'],
        summary: '创建分类',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string', minLength: 1, maxLength: 100 },
                  parentId: { type: 'string', format: 'uuid', nullable: true },
                  workspaceId: { type: 'string', format: 'uuid', nullable: true }
                }
              }
            }
          }
        },
        responses: {
          ...okData('创建成功', 'Category'),
          ...stdErrors
        }
      }
    },

    '/api/v1/categories/{id}': {
      get: {
        tags: ['categories'],
        summary: '获取分类详情',
        parameters: [pathParam('id')],
        responses: {
          ...okData('分类详情', 'Category'),
          ...stdErrors
        }
      },
      patch: {
        tags: ['categories'],
        summary: '更新分类',
        parameters: [pathParam('id')],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string', minLength: 1, maxLength: 100 }
                }
              }
            }
          }
        },
        responses: {
          ...okData('更新成功', 'Category'),
          ...stdErrors
        }
      },
      delete: {
        tags: ['categories'],
        summary: '删除分类（子分类移至根级）',
        parameters: [pathParam('id')],
        responses: {
          ...ok('删除成功'),
          ...stdErrors
        }
      }
    },

    '/api/v1/categories/{id}/move': {
      post: {
        tags: ['categories'],
        summary: '移动分类（更改父节点）',
        parameters: [pathParam('id')],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  newParentId: { type: 'string', format: 'uuid', nullable: true, description: 'null 表示移至根级' }
                }
              }
            }
          }
        },
        responses: {
          ...ok('移动成功'),
          ...stdErrors
        }
      }
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // 分享 (share)
    // ═══════════════════════════════════════════════════════════════════════════

    '/api/v1/share/{token}': {
      get: {
        tags: ['share'],
        summary: '通过分享令牌访问内容（无需认证）',
        security: [],
        parameters: [{ name: 'token', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          ...ok('分享内容'),
          '404': { description: '分享不存在或已过期', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } }
        }
      }
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // 系统 (system)
    // ═══════════════════════════════════════════════════════════════════════════

    '/api/v1/stats': {
      get: {
        tags: ['system'],
        summary: '获取系统统计数据（当前用户隔离）',
        responses: {
          ...ok('统计数据', {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  documents: { type: 'integer' },
                  prds: { type: 'integer' },
                  prototypes: { type: 'integer' },
                  vectors: { type: 'integer' },
                  workspaces: { type: 'integer' }
                }
              }
            }
          }),
          ...stdErrors
        }
      }
    },

    '/api/v1/health': {
      get: {
        tags: ['system'],
        summary: '健康检查',
        security: [],
        responses: {
          ...ok('服务正常', {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['ok', 'degraded', 'error'] },
              timestamp: { type: 'string', format: 'date-time' },
              services: {
                type: 'object',
                properties: {
                  database: { type: 'string' },
                  storage: { type: 'string' }
                }
              }
            }
          })
        }
      }
    },

    '/api/v1/openapi': {
      get: {
        tags: ['system'],
        summary: '获取 OpenAPI 规范（本文档）',
        security: [],
        responses: {
          '200': { description: 'OpenAPI 3.0.3 JSON', content: { 'application/json': { schema: { type: 'object' } } } }
        }
      }
    }
  }
}

// ─── 写入文件 ─────────────────────────────────────────────────────────────────

const outputDir = join(process.cwd(), 'docs', 'api')
mkdirSync(outputDir, { recursive: true })

const outputPath = join(outputDir, 'openapi.json')
writeFileSync(outputPath, JSON.stringify(openApiSpec, null, 2), 'utf-8')

const pathCount = Object.keys(openApiSpec.paths).length
const methodCount = Object.values(openApiSpec.paths).reduce(
  (acc, path) => acc + Object.keys(path as object).length, 0
)

console.log(`✓ OpenAPI 3.0 规范已生成：${outputPath}`)
console.log(`  路径数：${pathCount}`)
console.log(`  端点总数：${methodCount}`)
console.log(`  Schema 数：${Object.keys(openApiSpec.components.schemas).length}`)
console.log(`  版本：${openApiSpec.info.version}`)
console.log('')
console.log('查看方式：')
console.log('  - Scalar UI（开发服务器）：http://localhost:3000/api-docs')
console.log('  - Swagger Editor：https://editor.swagger.io（粘贴 JSON 内容）')
console.log('  - Redoc：npx @redocly/cli preview-docs docs/api/openapi.json')
