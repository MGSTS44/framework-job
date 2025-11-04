/**
 * API Client for Framework Generation and User Authentication
 * 前端调用后端的所有接口
 */

import { auth } from './firebase' // ← 添加这行导入

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

/**
 * 通用的 API 请求错误处理
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
 * 获取认证 token（已废弃 - 现在使用 Firebase）
 * 保留这个函数以兼容旧代码
 */
function getAuthToken() {
  return localStorage.getItem('access_token')
}

/**
 * 🔥 新增：获取 Firebase 当前用户 ID
 */
function getFirebaseUserId() {
  const user = auth.currentUser
  return user ? user.uid : null
}

/**
 * 通用的 API 请求函数（自动添加认证 header）
 */
async function apiRequest(url, options = {}) {
  try {
    const token = getAuthToken()

    const headers = {
      ...options.headers,
    }

    // 如果有 token，自动添加 Authorization header
    // （保留兼容性，但现在主要用 Firebase）
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const response = await fetch(`${API_BASE_URL}${url}`, {
      ...options,
      headers,
    })

    const data = await response.json()

    if (!response.ok) {
      // 如果是 401，可能是未登录，跳转到登录页
      if (response.status === 401) {
        localStorage.removeItem('access_token')
        localStorage.removeItem('user')
        window.location.href = '/login'
      }

      throw new APIError(
        data.detail || data.error || 'Request failed',
        response.status,
        data
      )
    }

    return data
  } catch (error) {
    if (error instanceof APIError) {
      throw error
    }

    // 网络错误或其他错误
    throw new APIError(error.message || 'Network error occurred', 0, null)
  }
}

/**
 * 从文本生成框架
 *
 * 调用链路: 文本 → 本地 LLM → Global LLM → 框架 → 保存到数据库
 *
 * @param {string} text - 输入文本
 * @param {boolean} useGlobalLLM - 是否使用 OpenAI (false = 仅使用 mock)
 * @param {string} model - OpenAI 模型名称
 * @returns {Promise<Object>} 生成的框架数据
 */
export async function generateFrameworkFromText(
  text,
  useGlobalLLM = true,
  model = 'gpt-4o'
) {
  // 🔥 获取 Firebase user_id
  const userId = getFirebaseUserId()

  const response = await apiRequest('/api/frameworks/generate-from-text', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      use_global_llm: useGlobalLLM,
      model,
      user_id: userId, // ← 添加 user_id
    }),
  })

  if (!response.success) {
    throw new APIError(
      response.error || 'Framework generation failed',
      500,
      response
    )
  }

  return response
}

/**
 * 从单个文件生成框架
 *
 * 调用链路: 文件 → 本地 LLM → Global LLM → 框架 → 保存到数据库
 *
 * @param {File} file - 上传的文件
 * @param {boolean} useGlobalLLM - 是否使用 OpenAI
 * @param {string} model - OpenAI 模型名称
 * @returns {Promise<Object>} 生成的框架数据
 */
export async function generateFrameworkFromFile(
  file,
  useGlobalLLM = true,
  model = 'gpt-4o'
) {
  const formData = new FormData()
  formData.append('file', file)

  // 🔥 添加 Firebase user_id
  const userId = getFirebaseUserId()
  if (userId) {
    formData.append('user_id', userId)
  }

  const token = getAuthToken()

  const response = await fetch(
    `${API_BASE_URL}/api/frameworks/generate-from-file?use_global_llm=${useGlobalLLM}&model=${model}`,
    {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: formData,
    }
  )

  const data = await response.json()

  if (!response.ok) {
    throw new APIError(
      data.detail || data.error || 'Framework generation failed',
      response.status,
      data
    )
  }

  if (!data.success) {
    throw new APIError(data.error || 'Framework generation failed', 500, data)
  }

  return data
}

/**
 * 从多个文件生成框架
 *
 * 调用链路: 多个文件 → 合并 → 本地 LLM → Global LLM → 框架 → 保存到数据库
 *
 * @param {File[]} files - 上传的文件数组
 * @param {boolean} useGlobalLLM - 是否使用 OpenAI
 * @param {string} model - OpenAI 模型名称
 * @returns {Promise<Object>} 生成的框架数据
 */
export async function generateFrameworkFromFiles(
  files,
  useGlobalLLM = true,
  model = 'gpt-4o'
) {
  const formData = new FormData()
  files.forEach(file => {
    formData.append('files', file)
  })

  // 🔥 添加 Firebase user_id
  const userId = getFirebaseUserId()
  if (userId) {
    formData.append('user_id', userId)
  }

  const token = getAuthToken()

  const response = await fetch(
    `${API_BASE_URL}/api/frameworks/generate-from-files?use_global_llm=${useGlobalLLM}&model=${model}`,
    {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: formData,
    }
  )

  const data = await response.json()

  if (!response.ok) {
    throw new APIError(
      data.detail || data.error || 'Framework generation failed',
      response.status,
      data
    )
  }

  if (!data.success) {
    throw new APIError(data.error || 'Framework generation failed', 500, data)
  }

  return data
}

// ==================== Framework CRUD API ====================

/**
 * 获取当前用户的所有 frameworks（按时间排序）
 */
export async function getMyFrameworks() {
  // 🔥 添加 user_id 参数
  const userId = getFirebaseUserId()
  if (!userId) {
    return [] // 未登录返回空数组
  }
  return await apiRequest(`/api/frameworks/my-frameworks?user_id=${userId}`)
}

/**
 * 获取当前用户的 frameworks（按 family 分组）
 */
export async function getMyFrameworksByFamily() {
  // 🔥 添加 user_id 参数
  const userId = getFirebaseUserId()
  if (!userId) {
    return {} // 未登录返回空对象
  }
  return await apiRequest(
    `/api/frameworks/my-frameworks/by-family?user_id=${userId}`
  )
}

/**
 * 获取单个 framework 的详细信息
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
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(frameworkData),
  })
}

/**
 * 删除 framework
 */
export async function deleteFramework(frameworkId) {
  return await apiRequest(`/api/frameworks/${frameworkId}`, {
    method: 'DELETE',
  })
}

/**
 * 保存框架 (用于 Re-generate 功能)
 *
 * @param {string} frameworkId - 框架 ID
 * @param {Object} frameworkData - 框架数据
 * @returns {Promise<Object>} 保存结果
 */
export async function saveFramework(frameworkId, frameworkData) {
  return await updateFramework(frameworkId, frameworkData)
}

/**
 * 获取框架详情
 *
 * @param {string} frameworkId - 框架 ID
 * @returns {Promise<Object>} 框架数据
 */
export async function getFramework(frameworkId) {
  return await getFrameworkById(frameworkId)
}

/**
 * 健康检查 - 验证后端服务和 LLM 是否可用
 *
 * @returns {Promise<Object>} 服务状态
 */
export async function checkHealth() {
  return apiRequest('/api/frameworks/health')
}

/**
 * 检查后端是否在线
 *
 * @returns {Promise<boolean>} 后端是否可访问
 */
export async function checkBackendStatus() {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      timeout: 3000,
    })
    return response.ok
  } catch {
    return false
  }
}

export { APIError }
