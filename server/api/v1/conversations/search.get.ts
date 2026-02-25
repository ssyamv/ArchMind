import { z } from 'zod'
import { ilike, and, eq, desc, or } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { dbClient } from '~/lib/db/client'
import { conversations } from '~/lib/db/schema'
import { requireAuth } from '~/server/utils/auth-helpers'
import { ErrorMessages } from '~/server/utils/errors'

const QuerySchema = z.object({
  q: z.string().min(1).max(200),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20)
})

export default defineEventHandler(async (event) => {
  try {
    const userId = requireAuth(event)
    const query = await getValidatedQuery(event, QuerySchema.parse)

    const keyword = `%${query.q}%`
    const offset = (query.page - 1) * query.limit

    const pool = dbClient.getPool()
    const db = drizzle(pool)

    const results = await db
      .select({
        id: conversations.id,
        title: conversations.title,
        summary: conversations.summary,
        messageCount: conversations.messageCount,
        prdId: conversations.prdId,
        createdAt: conversations.createdAt,
        updatedAt: conversations.updatedAt
      })
      .from(conversations)
      .where(
        and(
          eq(conversations.userId, userId),
          or(
            ilike(conversations.title, keyword),
            ilike(conversations.summary, keyword)
          )
        )
      )
      .orderBy(desc(conversations.updatedAt))
      .limit(query.limit)
      .offset(offset)

    return {
      success: true,
      data: results,
      pagination: {
        page: query.page,
        limit: query.limit,
        total: results.length
      }
    }
  } catch (error) {
    console.error('Conversation search error:', error)
    setResponseStatus(event, 500)
    return {
      success: false,
      message: error instanceof Error ? error.message : ErrorMessages.UNKNOWN_ERROR
    }
  }
})
