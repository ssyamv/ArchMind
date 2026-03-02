import { z } from 'zod'
import { PRDDAO } from '~/lib/db/dao/prd-dao'
import { ErrorMessages } from '~/server/utils/errors'

const UpdateTitleSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(200, '标题不能超过 200 字符')
})

export default defineEventHandler(async (event) => {
  try {
    const userId = requireAuth(event)
    const prdId = getRouterParam(event, 'id')

    if (!prdId) {
      setResponseStatus(event, 400)
      return { success: false, message: '缺少 PRD ID' }
    }

    // 验证请求体
    const body = await readBody(event)
    const { title } = UpdateTitleSchema.parse(body)

    // 检查 PRD 是否存在
    const prd = await PRDDAO.findById(prdId)
    if (!prd) {
      setResponseStatus(event, 404)
      return { success: false, message: 'PRD 不存在' }
    }

    // 权限检查：只有创建者可以修改标题
    if (prd.userId !== userId) {
      setResponseStatus(event, 403)
      return { success: false, message: '无权修改此 PRD' }
    }

    // 更新标题
    const updated = await PRDDAO.updateTitle(prdId, title)

    return {
      success: true,
      data: updated
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      setResponseStatus(event, 400)
      return {
        success: false,
        message: error.errors[0]?.message || '请求参数错误'
      }
    }

    setResponseStatus(event, 500)
    return {
      success: false,
      message: error instanceof Error ? error.message : ErrorMessages.UNKNOWN_ERROR
    }
  }
})
