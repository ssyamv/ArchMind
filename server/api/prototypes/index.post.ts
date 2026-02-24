import { PrototypeDAO, PrototypePageDAO } from '~/lib/db/dao/prototype-dao'
import type { PrototypeCreateRequest } from '~/types/prototype'

export default defineEventHandler(async (event) => {
  const t = useServerT(event)
  try {
    const userId = requireAuth(event)
    const body = await readBody<PrototypeCreateRequest>(event)

    if (!body.title || !body.pages?.length) {
      setResponseStatus(event, 400)
      return { success: false, message: t('errors.titleAndPagesRequired') }
    }

    const prototype = await PrototypeDAO.create({
      prdId: body.prdId,
      userId,
      title: body.title,
      description: body.description,
      currentVersion: 1,
      status: 'draft',
      deviceType: 'responsive'
    })

    const pages = await PrototypePageDAO.batchCreate(
      body.pages.map((p, index) => ({
        prototypeId: prototype.id,
        pageName: p.pageName,
        pageSlug: p.pageSlug,
        htmlContent: p.htmlContent,
        sortOrder: p.sortOrder ?? index,
        isEntryPage: p.isEntryPage ?? index === 0
      }))
    )

    return {
      success: true,
      data: { prototype, pages }
    }
  } catch (error) {
    setResponseStatus(event, 500)
    return {
      success: false,
      message: error instanceof Error ? error.message : t(ErrorKeys.UNKNOWN_ERROR)
    }
  }
})
