/**
 * 工作区成员与邀请 DAO
 */

import { dbClient } from '../client'

export interface WorkspaceMember {
  id: string
  workspaceId: string
  userId: string
  role: 'owner' | 'admin' | 'member'
  joinedAt: string
  // 关联用户信息
  userEmail?: string
  userFullName?: string
  userAvatarUrl?: string
  username?: string
}

export interface WorkspaceInvitation {
  id: string
  workspaceId: string
  inviterId: string
  email: string
  role: 'admin' | 'member'
  token: string
  status: 'pending' | 'accepted' | 'expired'
  expiresAt: string
  createdAt: string
  // 关联数据
  workspaceName?: string
  inviterName?: string
}

export interface CreateInvitationInput {
  workspaceId: string
  inviterId: string
  email: string
  role: 'admin' | 'member'
  token: string
  expiresAt: Date
}

export class WorkspaceMemberDAO {
  /**
   * 获取工作区成员列表（含用户信息）
   */
  static async getMembers (workspaceId: string): Promise<WorkspaceMember[]> {
    const sql = `
      SELECT
        wm.id,
        wm.workspace_id,
        wm.user_id,
        wm.role,
        wm.joined_at,
        u.email as user_email,
        u.full_name as user_full_name,
        u.avatar_url as user_avatar_url,
        u.username
      FROM workspace_members wm
      JOIN users u ON u.id = wm.user_id
      WHERE wm.workspace_id = $1
      ORDER BY wm.joined_at ASC
    `
    const result = await dbClient.query<any>(sql, [workspaceId])
    return result.rows.map(row => this.mapRowToMember(row))
  }

  /**
   * 判断用户是否已是工作区成员
   */
  static async isMember (workspaceId: string, userId: string): Promise<boolean> {
    const sql = 'SELECT id FROM workspace_members WHERE workspace_id = $1 AND user_id = $2'
    const result = await dbClient.query<any>(sql, [workspaceId, userId])
    return result.rows.length > 0
  }

  /**
   * 添加成员
   */
  static async addMember (workspaceId: string, userId: string, role: 'owner' | 'admin' | 'member' = 'member'): Promise<WorkspaceMember> {
    const id = crypto.randomUUID()
    const sql = `
      INSERT INTO workspace_members (id, workspace_id, user_id, role)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (workspace_id, user_id) DO NOTHING
      RETURNING *
    `
    const result = await dbClient.query<any>(sql, [id, workspaceId, userId, role])
    if (result.rows.length === 0) {
      // 已存在，直接查询返回
      const existing = await dbClient.query<any>(
        'SELECT * FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
        [workspaceId, userId]
      )
      return this.mapRowToMember(existing.rows[0])
    }
    return this.mapRowToMember(result.rows[0])
  }

  /**
   * 移除成员
   */
  static async removeMember (workspaceId: string, userId: string): Promise<boolean> {
    const sql = 'DELETE FROM workspace_members WHERE workspace_id = $1 AND user_id = $2'
    const result = await dbClient.query(sql, [workspaceId, userId])
    return result.rowCount! > 0
  }

  // ============================================
  // 邀请相关
  // ============================================

  /**
   * 创建邀请记录
   */
  static async createInvitation (input: CreateInvitationInput): Promise<WorkspaceInvitation> {
    const id = crypto.randomUUID()
    const sql = `
      INSERT INTO workspace_invitations (id, workspace_id, inviter_id, email, role, token, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `
    const result = await dbClient.query<any>(sql, [
      id,
      input.workspaceId,
      input.inviterId,
      input.email,
      input.role,
      input.token,
      input.expiresAt.toISOString()
    ])
    return this.mapRowToInvitation(result.rows[0])
  }

  /**
   * 根据 token 获取邀请（含工作区与邀请人信息）
   */
  static async getInvitationByToken (token: string): Promise<WorkspaceInvitation | null> {
    const sql = `
      SELECT
        wi.*,
        w.name as workspace_name,
        u.full_name as inviter_name
      FROM workspace_invitations wi
      JOIN workspaces w ON w.id = wi.workspace_id
      JOIN users u ON u.id = wi.inviter_id
      WHERE wi.token = $1
    `
    const result = await dbClient.query<any>(sql, [token])
    if (result.rows.length === 0) return null
    return this.mapRowToInvitation(result.rows[0])
  }

  /**
   * 获取工作区的待处理邀请列表
   */
  static async getPendingInvitations (workspaceId: string): Promise<WorkspaceInvitation[]> {
    const sql = `
      SELECT * FROM workspace_invitations
      WHERE workspace_id = $1 AND status = 'pending' AND expires_at > NOW()
      ORDER BY created_at DESC
    `
    const result = await dbClient.query<any>(sql, [workspaceId])
    return result.rows.map(row => this.mapRowToInvitation(row))
  }

  /**
   * 更新邀请状态
   */
  static async updateInvitationStatus (token: string, status: 'accepted' | 'expired'): Promise<boolean> {
    const sql = `UPDATE workspace_invitations SET status = $1 WHERE token = $2`
    const result = await dbClient.query(sql, [status, token])
    return result.rowCount! > 0
  }

  /**
   * 检查邮箱是否有待处理邀请
   */
  static async hasPendingInvitation (workspaceId: string, email: string): Promise<boolean> {
    const sql = `
      SELECT id FROM workspace_invitations
      WHERE workspace_id = $1 AND email = $2 AND status = 'pending' AND expires_at > NOW()
    `
    const result = await dbClient.query<any>(sql, [workspaceId, email])
    return result.rows.length > 0
  }

  private static mapRowToMember (row: any): WorkspaceMember {
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      userId: row.user_id,
      role: row.role,
      joinedAt: row.joined_at,
      userEmail: row.user_email,
      userFullName: row.user_full_name,
      userAvatarUrl: row.user_avatar_url,
      username: row.username
    }
  }

  private static mapRowToInvitation (row: any): WorkspaceInvitation {
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      inviterId: row.inviter_id,
      email: row.email,
      role: row.role,
      token: row.token,
      status: row.status,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      workspaceName: row.workspace_name,
      inviterName: row.inviter_name
    }
  }
}
