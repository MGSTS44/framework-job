/**
 * API Client - 支持多域名架构
 */
import { auth } from './firebase'

/**
 * 动态获取 API Base URL
 */
function getApiBaseUrl() {
  const hostname = window.location.hostname
  
  // 生产环境 - 使用相对路径
  if (hostname === 'expert.valorie.ai' || hostname.endsWith('.valorie.ai')) {
    return ''
  }
  
  // 开发环境
  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
}

const API_BASE_URL = getApiBaseUrl()

/**
 * 获取当前租户 ID
 */
function getCurrentTenantId() {
  const hostname = window.location.hostname
  
  // 从子域名提取
  const tenantMatch = hostname.match(/^([a-z0-9\-]+)\.valorie\.ai$/)
  if (tenantMatch) return tenantMatch[1]
  
  // 从 URL 路径提取（本地开发）
  const pathMatch = window.location.pathname.match(/^\/([a-z0-9\-]+)\//)
  if (pathMatch) return pathMatch[1]
  
  return null
}

/**
 * API 错误类
 */
class APIError extends Error {
  constructor(message, status, data) {
    super(message)
    this.name = 'APIError'
    this.status = status
    this.data = data
  }
}

/**
 * 获取认证 token
 */
function getAuthToken() {
  return localStorage.getItem('access_token')
}

/**
 * 获取 Firebase 用户 ID
 */
function getFirebaseUserId() {
  const user = auth.currentUser
  return user ? user.uid : null
}

/**
 * 通用 API 请求
 */
async function apiRequest(url, options = {}) {
  try {
    const token = getAuthToken()
    const tenantId = getCurrentTenantId()

    const headers = { ...options.headers }
    if (token) headers['Authorization'] = `Bearer ${token}`
    if (tenantId) headers['X-Tenant-ID'] = tenantId

    const response = await fetch(`${API_BASE_URL}${url}`, { ...options, headers })
    const data = await response.json()

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('access_token')
        localStorage.removeItem('user')
        const hostname = window.location.hostname
        if (hostname.endsWith('.valorie.ai') && hostname !== 'expert.valorie.ai') {
          window.location.href = 'https://expert.valorie.ai/login'
        } else {
          window.location.href = '/login'
        }
      }
      throw new APIError(data.detail || data.error || 'Request failed', response.status, data)
    }

    return data
  } catch (error) {
    if (error instanceof APIError) throw error
    throw new APIError(error.message || 'Network error occurred', 0, null)
  }
}

/**
 * 从文本生成框架
 */
export async function generateFrameworkFromText(text, useGlobalLLM = true, model = 'gpt-4o') {
  const userId = getFirebaseUserId()
  const tenantId = getCurrentTenantId()

  const response = await apiRequest('/api/frameworks/generate-from-text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, use_global_llm: useGlobalLLM, model, user_id: userId, tenant_id: tenantId }),
  })

  if (!response.success) {
    throw new APIError(response.error || 'Framework generation failed', 500, response)
  }
  return response
}

/**
 * 从文件生成框架
 */
export async function generateFrameworkFromFile(file, useGlobalLLM = true, model = 'gpt-4o') {
  const formData = new FormData()
  formData.append('file', file)

  const userId = getFirebaseUserId()
  const tenantId = getCurrentTenantId()
  if (userId) formData.append('user_id', userId)
  if (tenantId) formData.append('tenant_id', tenantId)

  const token = getAuthToken()

  const response = await fetch(
    `${API_BASE_URL}/api/frameworks/generate-from-file?use_global_llm=${useGlobalLLM}&model=${model}`,
    {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
        ...(tenantId && { 'X-Tenant-ID': tenantId }),
      },
      body: formData,
    }
  )

  const data = await response.json()
  if (!response.ok) {
    throw new APIError(data.detail || data.error || 'Framework generation failed', response.status, data)
  }
  if (!data.success) {
    throw new APIError(data.error || 'Framework generation failed', 500, data)
  }
  return data
}

/**
 * 从多个文件生成框架
 */
export async function generateFrameworkFromFiles(files, useGlobalLLM = true, model = 'gpt-4o') {
  const formData = new FormData()
  files.forEach(file => formData.append('files', file))

  const userId = getFirebaseUserId()
  const tenantId = getCurrentTenantId()
  if (userId) formData.append('user_id', userId)
  if (tenantId) formData.append('tenant_id', tenantId)

  const token = getAuthToken()

  const response = await fetch(
    `${API_BASE_URL}/api/frameworks/generate-from-files?use_global_llm=${useGlobalLLM}&model=${model}`,
    {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
        ...(tenantId && { 'X-Tenant-ID': tenantId }),
      },
      body: formData,
    }
  )

  const data = await response.json()
  if (!response.ok) {
    throw new APIError(data.detail || data.error || 'Framework generation failed', response.status, data)
  }
  if (!data.success) {
    throw new APIError(data.error || 'Framework generation failed', 500, data)
  }
  return data
}

/**
 * 获取用户的所有 frameworks
 */
export async function getMyFrameworks() {
  const userId = getFirebaseUserId()
  const tenantId = getCurrentTenantId()
  if (!userId) return []
  
  let url = `/api/frameworks/my-frameworks?user_id=${userId}`
  if (tenantId) url += `&tenant_id=${tenantId}`
  
  return await apiRequest(url)
}

/**
 * 按 family 分组获取 frameworks
 */
export async function getMyFrameworksByFamily() {
  const userId = getFirebaseUserId()
  const tenantId = getCurrentTenantId()
  if (!userId) return {}
  
  let url = `/api/frameworks/my-frameworks/by-family?user_id=${userId}`
  if (tenantId) url += `&tenant_id=${tenantId}`
  
  return await apiRequest(url)
}

/**
 * 获取单个 framework
 */
export async function getFrameworkById(frameworkId) {
  return await apiRequest(`/api/frameworks/${frameworkId}`)
}

/**
 * 更新 framework
 */
export async function updateFramework(frameworkId, frameworkData) {
  return await apiRequest(`/api/frameworks/${frameworkId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(frameworkData),
  })
}

/**
 * 删除 framework
 */
export async function deleteFramework(frameworkId) {
  return await apiRequest(`/api/frameworks/${frameworkId}`, { method: 'DELETE' })
}

/**
 * 保存框架
 */
export async function saveFramework(frameworkId, frameworkData) {
  return await updateFramework(frameworkId, frameworkData)
}

/**
 * 获取框架详情
 */
export async function getFramework(frameworkId) {
  return await getFrameworkById(frameworkId)
}

/**
 * 健康检查
 */
export async function checkHealth() {
  return apiRequest('/api/frameworks/health')
}

/**
 * 检查后端状态
 */
export async function checkBackendStatus() {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, { method: 'GET', timeout: 3000 })
    return response.ok
  } catch {
    return false
  }
}

/**
 * API 端点配置
 */
export const API_ENDPOINTS = {
  EXPORT_MARKDOWN: `${API_BASE_URL}/api/frameworks/export-markdown`,
  EXPORT_DOCX: `${API_BASE_URL}/api/frameworks/export-docx`,
  REGENERATE: `${API_BASE_URL}/api/frameworks/regenerate`,
  AI_MERGE: `${API_BASE_URL}/api/frameworks/ai-merge`,
  AI_FILL: `${API_BASE_URL}/api/frameworks/ai-fill`,
}

export default API_ENDPOINTS
export { APIError, getApiBaseUrl, getCurrentTenantId }