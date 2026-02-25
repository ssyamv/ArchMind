/**
 * 邮件发送工具
 * 使用 nodemailer 发送邮件
 */

import nodemailer from 'nodemailer'

interface EmailConfig {
  host: string
  port: number
  secure: boolean
  user: string
  pass: string
  from: string
}

interface SendEmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

function getEmailConfig(): EmailConfig {
  const config = useRuntimeConfig()
  return {
    host: (config.emailHost as string) || process.env.EMAIL_HOST || 'smtp.qq.com',
    port: (config.emailPort as number) || parseInt(process.env.EMAIL_PORT || '465'),
    secure: config.emailSecure !== undefined ? Boolean(config.emailSecure) : process.env.EMAIL_SECURE !== 'false',
    user: (config.emailUser as string) || process.env.EMAIL_USER || '',
    pass: (config.emailPass as string) || process.env.EMAIL_PASS || '',
    from: (config.emailFrom as string) || process.env.EMAIL_FROM || process.env.EMAIL_USER || ''
  }
}

function createTransporter() {
  const config = getEmailConfig()

  if (!config.user || !config.pass) {
    throw new Error('Email configuration is missing. Please set EMAIL_USER and EMAIL_PASS environment variables.')
  }

  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass
    }
  })
}

export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  try {
    const config = getEmailConfig()

    if (!config.user || !config.pass) {
      console.warn('Email not configured. Skipping email send.')
      console.log(`[DEV] Would send email to ${options.to}: ${options.subject}`)
      return false
    }

    const transporter = createTransporter()

    await transporter.sendMail({
      from: config.from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text
    })

    return true
  } catch (error) {
    console.error('Failed to send email:', error)
    return false
  }
}

export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export interface PasswordResetEmailData {
  email: string
  code: string
  resetUrl: string
}

export async function sendPasswordResetEmail(data: PasswordResetEmailData): Promise<boolean> {

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>密码重置</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f5f5; padding: 40px 0;">
        <tr>
          <td align="center">
            <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
              <!-- Header -->
              <tr>
                <td style="padding: 40px 40px 20px 40px; text-align: center; border-bottom: 1px solid #eee;">
                  <h1 style="margin: 0; color: #1a1a1a; font-size: 24px; font-weight: 600;">ArchMind</h1>
                </td>
              </tr>

              <!-- Content -->
              <tr>
                <td style="padding: 40px;">
                  <h2 style="margin: 0 0 20px 0; color: #1a1a1a; font-size: 20px; font-weight: 600;">重置您的密码</h2>
                  <p style="margin: 0 0 30px 0; color: #666; font-size: 16px; line-height: 1.6;">
                    您收到了这封邮件是因为您（或其他人）请求重置您的账户密码。
                  </p>

                  <!-- Verification Code -->
                  <div style="background-color: #f8f9fa; border-radius: 8px; padding: 30px; text-align: center; margin-bottom: 30px;">
                    <p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">您的验证码是：</p>
                    <div style="font-size: 36px; font-weight: 700; color: #1a1a1a; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                      ${data.code}
                    </div>
                  </div>

                  <!-- Reset Button -->
                  <div style="text-align: center; margin-bottom: 30px;">
                    <a href="${data.resetUrl}" style="display: inline-block; background-color: #1a1a1a; color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: 500;">
                      重置密码
                    </a>
                  </div>

                  <p style="margin: 0 0 20px 0; color: #666; font-size: 14px; line-height: 1.6;">
                    或者复制以下链接到浏览器：
                  </p>
                  <p style="margin: 0 0 30px 0; color: #666; font-size: 13px; word-break: break-all; background-color: #f8f9fa; padding: 12px; border-radius: 6px;">
                    ${data.resetUrl}
                  </p>

                  <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 16px; border-radius: 0 8px 8px 0;">
                    <p style="margin: 0; color: #856404; font-size: 14px;">
                      <strong>注意：</strong>此验证码将在 15 分钟后过期。如果您没有请求重置密码，请忽略此邮件。
                    </p>
                  </div>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding: 30px 40px; background-color: #f8f9fa; border-radius: 0 0 12px 12px;">
                  <p style="margin: 0 0 10px 0; color: #999; font-size: 12px; text-align: center;">
                    这是一封自动发送的邮件，请勿直接回复。
                  </p>
                  <p style="margin: 0; color: #999; font-size: 12px; text-align: center;">
                    © 2024 ArchMind AI. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `

  const text = `
ArchMind - 密码重置

您的验证码是: ${data.code}

请访问以下链接重置密码:
${data.resetUrl}

注意：此验证码将在 15 分钟后过期。如果您没有请求重置密码，请忽略此邮件。

© 2024 ArchMind AI. All rights reserved.
  `

  return sendEmail({
    to: data.email,
    subject: 'ArchMind - 密码重置验证码',
    html,
    text
  })
}

export interface WorkspaceInvitationEmailData {
  email: string
  inviterName: string
  workspaceName: string
  inviteUrl: string
  role: string
}

export async function sendWorkspaceInvitationEmail(data: WorkspaceInvitationEmailData): Promise<boolean> {
  const roleText = data.role === 'admin' ? '管理员' : '普通成员'

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>工作区邀请</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f5f5; padding: 40px 0;">
        <tr>
          <td align="center">
            <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
              <!-- Header -->
              <tr>
                <td style="padding: 40px 40px 20px 40px; text-align: center; border-bottom: 1px solid #eee;">
                  <h1 style="margin: 0; color: #1a1a1a; font-size: 24px; font-weight: 600;">ArchMind</h1>
                </td>
              </tr>

              <!-- Content -->
              <tr>
                <td style="padding: 40px;">
                  <h2 style="margin: 0 0 20px 0; color: #1a1a1a; font-size: 20px; font-weight: 600;">您收到了工作区邀请</h2>
                  <p style="margin: 0 0 20px 0; color: #666; font-size: 16px; line-height: 1.6;">
                    <strong>${data.inviterName}</strong> 邀请您加入工作区 <strong>${data.workspaceName}</strong>，担任 <strong>${roleText}</strong> 角色。
                  </p>

                  <!-- Invite Button -->
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${data.inviteUrl}" style="display: inline-block; background-color: #1a1a1a; color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: 500;">
                      接受邀请
                    </a>
                  </div>

                  <p style="margin: 0 0 10px 0; color: #666; font-size: 14px; line-height: 1.6;">
                    或者复制以下链接到浏览器：
                  </p>
                  <p style="margin: 0 0 30px 0; color: #666; font-size: 13px; word-break: break-all; background-color: #f8f9fa; padding: 12px; border-radius: 6px;">
                    ${data.inviteUrl}
                  </p>

                  <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 16px; border-radius: 0 8px 8px 0;">
                    <p style="margin: 0; color: #856404; font-size: 14px;">
                      <strong>注意：</strong>此邀请链接将在 7 天后过期。如果您不认识邀请人，请忽略此邮件。
                    </p>
                  </div>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding: 30px 40px; background-color: #f8f9fa; border-radius: 0 0 12px 12px;">
                  <p style="margin: 0 0 10px 0; color: #999; font-size: 12px; text-align: center;">
                    这是一封自动发送的邮件，请勿直接回复。
                  </p>
                  <p style="margin: 0; color: #999; font-size: 12px; text-align: center;">
                    © 2024 ArchMind AI. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `

  const text = `
ArchMind - 工作区邀请

${data.inviterName} 邀请您加入工作区 ${data.workspaceName}，担任${roleText}角色。

点击以下链接接受邀请：
${data.inviteUrl}

注意：此邀请链接将在 7 天后过期。如果您不认识邀请人，请忽略此邮件。

© 2024 ArchMind AI. All rights reserved.
  `

  return sendEmail({
    to: data.email,
    subject: `ArchMind - ${data.inviterName} 邀请您加入工作区 ${data.workspaceName}`,
    html,
    text
  })
}
