#!/usr/bin/env tsx
/**
 * PRD 预设模板种子脚本（#67）
 * 将 6 个内置模板写入数据库
 *
 * 运行：pnpm tsx scripts/seed-prd-templates.ts
 */

import 'dotenv/config'
import { readFileSync } from 'fs'
import { join } from 'path'
import { dbClient } from '../lib/db/client'
import { PRDTemplateDAO } from '../lib/db/dao/prd-template-dao'

const TEMPLATES = ['standard', 'api-design', 'bug-fix-spec', 'feature-brief', 'onboarding-flow', 'data-model']

async function seed () {
  console.log('🌱 开始写入 PRD 预设模板...')

  for (const name of TEMPLATES) {
    const filePath = join(import.meta.dirname ?? process.cwd(), '../lib/prd/templates', `${name}.json`)
    const templateData = JSON.parse(readFileSync(filePath, 'utf-8'))

    // 检查是否已存在（幂等）
    const existing = await dbClient.query(
      'SELECT id FROM prd_templates WHERE type = $1 AND is_builtin = true',
      [templateData.type]
    )

    if (existing.rows.length > 0) {
      console.log(`  ⏭  跳过已存在的模板：${templateData.name}`)
      continue
    }

    await PRDTemplateDAO.create({
      name: templateData.name,
      description: templateData.description,
      type: templateData.type,
      sections: templateData.sections,
      systemPrompt: templateData.systemPrompt ?? null,
      isBuiltin: true,
      workspaceId: null,
      userId: null,
    })

    console.log(`  ✅ 写入模板：${templateData.name}`)
  }

  console.log('✨ 种子数据写入完成')
  process.exit(0)
}

seed().catch((e) => {
  console.error('❌ 写入失败：', e)
  process.exit(1)
})
