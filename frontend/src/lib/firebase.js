import { initializeApp } from 'firebase/app'
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth'
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  enableIndexedDbPersistence, // 离线支持
  onSnapshot,
} from 'firebase/firestore'

// ============= Firebase 配置 =============

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

// ============= 初始化 Firebase =============

const app = initializeApp(firebaseConfig)

// 初始化服务
export const auth = getAuth(app)
export const db = getFirestore(app)

// ============= 启用离线支持 =============

// 启用 Firestore 离线持久化
// 这样用户在离线时也能访问之前加载的数据
enableIndexedDbPersistence(db)
  .then(() => {
    console.log('✅ Firestore 离线支持已启用')
  })
  .catch(err => {
    if (err.code === 'failed-precondition') {
      console.warn('⚠️ 离线支持失败：多个标签页打开')
    } else if (err.code === 'unimplemented') {
      console.warn('⚠️ 离线支持失败：浏览器不支持')
    }
  })

/**
 * 注册新用户（Expert Side）
 * 
 * 在 Expert Side 注册的用户自动获得 expert 角色
 *
 * @param {string} email - 用户邮箱
 * @param {string} password - 密码
 * @param {string} username - 用户名
 * @returns {Promise<Object>} 用户信息
 */
export const registerUser = async (email, password, username) => {
  try {
    // 1. 创建 Firebase Auth 用户
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    )
    const user = userCredential.user

    // 2. 更新用户 displayName
    await updateProfile(user, {
      displayName: username,
    })

    // 3. 在 Firestore 创建用户文档
    // 👇 修改：添加 roles 和 expertProfile
    await setDoc(doc(db, 'users', user.uid), {
      uid: user.uid,
      email: email,
      username: username,
      roles: ['client', 'expert'],        // 👈 同时拥有两个角色
      expertProfile: {                    // 👈 专家信息
        tenantId: null,                   // 稍后创建租户时填充
        displayName: username,
        isApproved: true,
        createdAt: serverTimestamp(),
      },
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp(),
    })

    console.log('✅ Expert user registered:', user.uid)

    return {
      uid: user.uid,
      email: user.email,
      username: username,
      roles: ['client', 'expert'],
    }
  } catch (error) {
    console.error('注册错误:', error)
    throw error
  }
}

/**
 * 用户登录
 *
 * @param {string} email - 用户邮箱
 * @param {string} password - 密码
 * @returns {Promise<Object>} 用户信息
 */
export const loginUser = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    )
    const user = userCredential.user

    // 更新最后登录时间
    await updateDoc(doc(db, 'users', user.uid), {
      lastLogin: serverTimestamp(),
    })

    return {
      uid: user.uid,
      email: user.email,
      username: user.displayName,
    }
  } catch (error) {
    console.error('登录错误:', error)
    throw error
  }
}

/**
 * 用户登出
 */
export const logoutUser = async () => {
  try {
    await firebaseSignOut(auth)
  } catch (error) {
    console.error('登出错误:', error)
    throw error
  }
}

/**
 * 检查邮箱是否已存在
 *
 * @param {string} email - 邮箱
 * @returns {Promise<boolean>} 是否存在
 */
export const checkEmailExists = async email => {
  try {
    const q = query(collection(db, 'users'), where('email', '==', email))
    const querySnapshot = await getDocs(q)
    return !querySnapshot.empty
  } catch (error) {
    console.error('检查邮箱错误:', error)
    return false
  }
}

/**
 * 检查用户名是否已存在
 *
 * @param {string} username - 用户名
 * @returns {Promise<boolean>} 是否存在
 */
export const checkUsernameExists = async username => {
  try {
    const q = query(collection(db, 'users'), where('username', '==', username))
    const querySnapshot = await getDocs(q)
    return !querySnapshot.empty
  } catch (error) {
    console.error('检查用户名错误:', error)
    return false
  }
}

/**
 * 监听认证状态变化
 *
 * @param {Function} callback - 状态变化回调
 * @returns {Function} 取消监听的函数
 */
export const onAuthChange = callback => {
  return onAuthStateChanged(auth, callback)
}

/**
 * 内部工具：从 frameworkData 中提取 artefact_variants 并存入 artefacts 集合
 *
 * @param {string} frameworkId - Framework 文档 ID
 * @param {Object} frameworkData - 保存到 frameworks 的数据（包含 artefact_variants 或 _raw）
 */
const createArtefactsForFramework = async (frameworkId, frameworkData) => {
  try {
    const user = auth.currentUser
    if (!user) throw new Error('用户未登录')

    if (!frameworkData) return

    let variants = null

    // 1. 优先使用顶层 artefact_variants（如果以后你直接传进来）
    if (Array.isArray(frameworkData.artefact_variants)) {
      variants = frameworkData.artefact_variants
    } else if (frameworkData._raw) {
      // 2. 从 _raw 里解析（_raw 现在是 JSON 字符串）
      let raw = null
      if (typeof frameworkData._raw === 'string') {
        try {
          raw = JSON.parse(frameworkData._raw)
        } catch (e) {
          console.warn('解析 frameworkData._raw 失败:', e)
        }
      } else if (typeof frameworkData._raw === 'object') {
        raw = frameworkData._raw
      }

      if (raw) {
        // 2.1 artefact_variants 在顶层
        if (Array.isArray(raw.artefact_variants)) {
          variants = raw.artefact_variants
        }
        // 2.2 artefact_variants 在 framework 下面（llm_global 返回的情况）
        else if (
          raw.framework &&
          Array.isArray(raw.framework.artefact_variants)
        ) {
          variants = raw.framework.artefact_variants
        }
      }
    }

    if (!variants || variants.length === 0) return

    const frameworkTitle =
      (frameworkData.metadata && frameworkData.metadata.title) ||
      frameworkData.title ||
      ''

    const tasks = []

    for (const variant of variants) {
      if (!variant || !variant.name) continue

      tasks.push(
        addDoc(collection(db, 'artefacts'), {
          frameworkId,
          frameworkTitle,
          variantId: variant.id || null,
          name: variant.name,
          summary: variant.summary || '',
          when_to_use: Array.isArray(variant.when_to_use)
            ? variant.when_to_use
            : [],
          sections: Array.isArray(variant.sections) ? variant.sections : [],
          risk_register: Array.isArray(variant.risk_register)
            ? variant.risk_register
            : [],
          creatorId: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      )
    }

    if (tasks.length > 0) {
      await Promise.all(tasks)
    }
  } catch (error) {
    // 不抛出，避免影响 Framework 创建流程
    console.error('创建 Artefact 库记录错误:', error)
  }
}


// ============= Framework CRUD 函数 =============

/**
 * 创建新的 Framework
 * 
 * 修改：自动添加 tenantId 和 expertId
 *
 * @param {Object} frameworkData - Framework 数据
 * @returns {Promise<string>} Framework ID
 */
export const createFramework = async frameworkData => {
  try {
    const user = auth.currentUser
    if (!user) throw new Error('用户未登录')

    // ✅ 添加这3行（你的新代码）
    const userRef = doc(db, 'users', user.uid)
    const userDoc = await getDoc(userRef)
    const userData = userDoc.data()

    // ✅ 添加这1行（你的新代码）
    const organization = userData.joinedOrganization || userData.tenantId

    // ✅ 修改这部分，添加新字段
    const frameworkRef = await addDoc(collection(db, 'frameworks'), {
      ...frameworkData,
      tenantId: userData.tenantId,            // ✅ 新增
      creatorId: user.uid,
      organization: organization,             // ✅ 新增
      publishedToOrganization: false,         // ✅ 新增
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    // ✅ 保留这行（组员的代码）
    await createArtefactsForFramework(frameworkRef.id, frameworkData)

    return frameworkRef.id
  } catch (error) {
    console.error('创建 Framework 错误:', error)
    throw error
  }
}

/**
 * 获取当前用户的所有 Frameworks
 *
 * @returns {Promise<Array>} Frameworks 列表
 */
export const getMyFrameworks = async () => {
  try {
    const user = auth.currentUser
    if (!user) throw new Error('用户未登录')

    const q = query(
      collection(db, 'frameworks'),
      where('creatorId', '==', user.uid),
      orderBy('createdAt', 'desc')
    )

    const querySnapshot = await getDocs(q)
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }))
  } catch (error) {
    console.error('获取 Frameworks 错误:', error)
    throw error
  }
}

/**
 * 获取单个 Framework
 *
 * @param {string} frameworkId - Framework ID
 * @returns {Promise<Object>} Framework 数据
 */
export const getFramework = async frameworkId => {
  try {
    const docRef = doc(db, 'frameworks', frameworkId)
    const docSnap = await getDoc(docRef)

    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() }
    } else {
      throw new Error('Framework 不存在')
    }
  } catch (error) {
    console.error('获取 Framework 错误:', error)
    throw error
  }
}

/**
 * 更新 Framework
 *
 * @param {string} frameworkId - Framework ID
 * @param {Object} updates - 更新的数据
 */
export const updateFramework = async (frameworkId, updates) => {
  try {
    const user = auth.currentUser
    if (!user) throw new Error('用户未登录')

    const frameworkRef = doc(db, 'frameworks', frameworkId)
    await updateDoc(frameworkRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    })
  } catch (error) {
    console.error('更新 Framework 错误:', error)
    throw error
  }
}

/**
 * 删除 Framework
 *
 * @param {string} frameworkId - Framework ID
 */
export const deleteFramework = async frameworkId => {
  try {
    const user = auth.currentUser
    if (!user) throw new Error('用户未登录')

    await deleteDoc(doc(db, 'frameworks', frameworkId))
  } catch (error) {
    console.error('删除 Framework 错误:', error)
    throw error
  }
}

// ============= 实时监听函数 =============

/**
 * 实时监听当前用户的 Frameworks
 *
 * @param {Function} callback - 数据变化回调
 * @returns {Function} 取消监听的函数
 */
export const onFrameworksChange = callback => {
  const user = auth.currentUser
  if (!user) {
    console.warn('用户未登录，无法监听 Frameworks')
    return () => {}
  }

  const q = query(
    collection(db, 'frameworks'),
    where('creatorId', '==', user.uid),
    orderBy('createdAt', 'desc')
  )

  // 返回取消监听的函数
  return onSnapshot(q, querySnapshot => {
    const frameworks = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }))
    callback(frameworks)
  })
}

// ============= Tenant Management Functions =============

/**
 * 生成安全的随机密钥
 */
function generateSecureKey(length = 32) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/**
 * 创建新租户
 * 
 * @param {Object} tenantData - 租户数据
 * @returns {Promise<Object>} { success: true, tenantId, embedKey }
 */
export const createTenant = async tenantData => {
  try {
    const user = auth.currentUser
    if (!user) throw new Error('用户未登录')

    // 生成租户 ID（基于 subdomain）
    // 例如：ai-readiness.valorie.ai → ai-readiness
    const tenantId =
      tenantData.id || tenantData.subdomain.replace('.valorie.ai', '')

    // 生成嵌入密钥
    const embedKey = `embed_${generateSecureKey()}`

    const tenantDoc = {
      id: tenantId,
      ownerId: user.uid, 
      subdomain: tenantData.subdomain || `${tenantId}.valorie.ai`,
      displayName: tenantData.displayName || 'My Expert Studio',
      embedKey: embedKey,
      allowedOrigins: tenantData.allowedOrigins || [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      isActive: true,
    }

    // 写入 Firestore
    await setDoc(doc(db, 'tenants', tenantId), tenantDoc)

    console.log('✅ Tenant created:', tenantId)
    return { success: true, tenantId, embedKey }
  } catch (error) {
    console.error('创建租户错误:', error)
    throw error
  }
}

/**
 * 获取当前用户的租户
 * 
 * @returns {Promise<Object|null>} 租户数据或 null
 */
export const getMyTenant = async () => {
  try {
    const user = auth.currentUser
    if (!user) throw new Error('用户未登录')

    const q = query(collection(db, 'tenants'), where('ownerId', '==', user.uid))

    const querySnapshot = await getDocs(q)

    if (querySnapshot.empty) {
      return null
    }

    return {
      id: querySnapshot.docs[0].id,
      ...querySnapshot.docs[0].data(),
    }
  } catch (error) {
    console.error('获取租户错误:', error)
    throw error
  }
}

/**
 * 更新租户信息
 * 
 * @param {string} tenantId - 租户 ID
 * @param {Object} updates - 更新的字段
 */
export const updateTenant = async (tenantId, updates) => {
  try {
    const user = auth.currentUser
    if (!user) throw new Error('用户未登录')

    const tenantRef = doc(db, 'tenants', tenantId)
    await updateDoc(tenantRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    })

    console.log('✅ Tenant updated:', tenantId)
    return { success: true }
  } catch (error) {
    console.error('更新租户错误:', error)
    throw error
  }
}

/**
 * 重新生成嵌入密钥
 * 
 * @param {string} tenantId - 租户 ID
 * @returns {Promise<Object>} { success: true, embedKey }
 */
export const regenerateEmbedKey = async tenantId => {
  try {
    const user = auth.currentUser
    if (!user) throw new Error('用户未登录')

    const newEmbedKey = `embed_${generateSecureKey()}`

    await updateDoc(doc(db, 'tenants', tenantId), {
      embedKey: newEmbedKey,
      updatedAt: serverTimestamp(),
    })

    console.log('✅ Embed key regenerated:', tenantId)
    return { success: true, embedKey: newEmbedKey }
  } catch (error) {
    console.error('重新生成密钥错误:', error)
    throw error
  }
}

/**
 * 检查用户是否是专家
 * 
 * @returns {Promise<boolean>}
 */
export const checkIsExpert = async () => {
  try {
    const user = auth.currentUser
    if (!user) return false

    const userDoc = await getDoc(doc(db, 'users', user.uid))
    if (!userDoc.exists()) return false

    const userData = userDoc.data()
    return userData.roles && userData.roles.includes('expert')
  } catch (error) {
    console.error('检查专家状态错误:', error)
    return false
  }
}

/**
 * 升级用户为专家
 * 
 * @returns {Promise<Object>} { success: true }
 */
export const upgradeToExpert = async () => {
  try {
    const user = auth.currentUser
    if (!user) throw new Error('用户未登录')

    const userRef = doc(db, 'users', user.uid)
    const userDoc = await getDoc(userRef)

    if (!userDoc.exists()) {
      throw new Error('用户不存在')
    }

    const userData = userDoc.data()

    // 检查是否已经是专家
    if (userData.roles && userData.roles.includes('expert')) {
      return { success: true, message: 'Already an expert' }
    }

    // 添加 expert 角色
    const currentRoles = userData.roles || ['client']
    await updateDoc(userRef, {
      roles: [...currentRoles, 'expert'],
      expertProfile: {
        tenantId: null,
        displayName: userData.username || userData.displayName,
        isApproved: true,
        createdAt: serverTimestamp(),
      },
    })

    console.log('✅ User upgraded to expert:', user.uid)
    return { success: true, message: 'Upgraded to expert' }
  } catch (error) {
    console.error('升级专家错误:', error)
    throw error
  }
}

// ============= 组织成员管理函数 (添加到 firebase.js) =============

/**
 * 生成随机 token
 */
const generateToken = (prefix = 'inv') => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = `${prefix}_`
  for (let i = 0; i < 32; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length))
  }
  return result
}

/**
 * 生成邀请链接
 * 
 * @param {Object} options - 邀请链接选项
 * @param {number} options.maxUses - 最大使用次数（1 = 单次，-1 = 无限次）
 * @param {number} options.expiresInDays - 有效期（天数）
 * @returns {Promise<Object>} { success: true, token, inviteLink }
 */
export const generateInviteLink = async ({ maxUses = 1, expiresInDays = 7, inviteEmail = null }) => {
  try {
    const user = auth.currentUser
    if (!user) throw new Error('用户未登录')

    // 获取当前用户的 tenant
    const tenant = await getMyTenant()
    if (!tenant) throw new Error('No tenant found')

    // 检查用户是否是 owner
    const member = tenant.members?.find(m => m.userId === user.uid)
    if (!member || member.role !== 'owner') {
      throw new Error('Only owners can generate invite links')
    }

    // 生成 token
    const token = generateToken('inv')

    // 计算过期时间
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + expiresInDays)

    // 创建邀请链接对象
    const inviteLink = {
      token: token,
      tenantId: tenant.id,
      createdBy: user.uid,
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
      expiresInDays: expiresInDays,
      isActive: true,
      maxUses: maxUses,  // 1 = 单次，-1 = 无限次
      usedCount: 0,
      usedBy: [],
      inviteEmail: inviteEmail ? inviteEmail.toLowerCase() : null, // ✅ 新增：邀请邮箱
    }

    // 获取当前的 inviteLinks 数组
    const currentInviteLinks = tenant.inviteLinks || []

    // 添加新链接
    const tenantRef = doc(db, 'tenants', tenant.id)
    await updateDoc(tenantRef, {
      inviteLinks: [...currentInviteLinks, inviteLink],
      updatedAt: serverTimestamp(),
    })

    // 生成完整的邀请链接 URL
    const baseUrl = window.location.origin
    const fullInviteLink = `${baseUrl}/invite/${token}`

    console.log('✅ Invite link generated:', token)
    return { 
      success: true, 
      token, 
      inviteLink: fullInviteLink,
      expiresAt: expiresAt.toISOString(),
      maxUses
    }
  } catch (error) {
    console.error('生成邀请链接错误:', error)
    throw error
  }
}

/**
 * 获取邀请链接信息
 * 
 * @param {string} token - 邀请 token
 * @returns {Promise<Object>} 邀请链接信息
 */
export const getInviteLink = async (token) => {
  try {
    // 查询所有 tenants，找到包含这个 token 的 tenant
    const tenantsRef = collection(db, 'tenants')
    const tenantsSnapshot = await getDocs(tenantsRef)

    for (const tenantDoc of tenantsSnapshot.docs) {
      const tenantData = tenantDoc.data()
      const inviteLinks = tenantData.inviteLinks || []
      
      const inviteLink = inviteLinks.find(link => link.token === token)
      
      if (inviteLink) {
        // 检查链接是否有效
        const now = new Date()
        const expiresAt = new Date(inviteLink.expiresAt)
        
        return {
          ...inviteLink,
          tenantId: tenantDoc.id,
          tenantName: tenantData.displayName,
          isExpired: now > expiresAt,
          isMaxUsesReached: inviteLink.maxUses !== -1 && inviteLink.usedCount >= inviteLink.maxUses,
        }
      }
    }

    throw new Error('Invite link not found')
  } catch (error) {
    console.error('获取邀请链接错误:', error)
    throw error
  }
}

/**
* @param {string} token - 邀请 token
 * @returns {Promise<Object>} { success: true, tenantId: string }
 */
export const acceptInvite = async (token) => {
  try {
    const user = auth.currentUser
    if (!user) throw new Error('用户未登录')

    // 获取邀请链接信息
    const inviteInfo = await getInviteLink(token)

    // ✅ 新增：验证邀请邮箱
    if (inviteInfo.inviteEmail) {
      const userEmail = user.email.toLowerCase()
      const inviteEmail = inviteInfo.inviteEmail.toLowerCase()
      
      if (userEmail !== inviteEmail) {
        throw new Error(
          `This invitation is for ${inviteInfo.inviteEmail}. ` +
          `You are logged in as ${user.email}. ` +
          `Please log in with the correct account or contact the organization owner.`
        )
      }
      
      console.log('✅ Email verification passed:', userEmail)
    }

    // 验证邀请链接
    if (!inviteInfo.isActive) {
      throw new Error('This invite link has been revoked')
    }

    if (inviteInfo.isExpired) {
      throw new Error('This invite link has expired')
    }

    if (inviteInfo.isMaxUsesReached) {
      throw new Error('This invite link has reached its maximum number of uses')
    }

    // 检查用户是否已经在这个 tenant 中
    const tenantRef = doc(db, 'tenants', inviteInfo.tenantId)
    const tenantDoc = await getDoc(tenantRef)
    
    if (!tenantDoc.exists()) {
      throw new Error('Organization not found')
    }
    
    const tenantData = tenantDoc.data()

    const existingMember = tenantData.members?.find(m => m.userId === user.uid)
    if (existingMember) {
      throw new Error('You are already a member of this organization')
    }

    // 获取用户信息
    const userRef = doc(db, 'users', user.uid)
    const userDoc = await getDoc(userRef)
    
    if (!userDoc.exists()) {
      throw new Error('User document not found')
    }
    
    const userData = userDoc.data()

    // ✅ 新增：检查用户是否已加入其他组织
    if (userData.joinedOrganization && userData.joinedOrganization !== inviteInfo.tenantId) {
      throw new Error(
        'You are already a member of another organization. Please leave your current organization first.'
      )
    }

    // 添加用户到 tenant members
    const newMember = {
      userId: user.uid,
      email: user.email,
      username: userData.username || user.email.split('@')[0],
      role: 'member',
      joinedAt: new Date().toISOString(),
    }

    const updatedMembers = [...(tenantData.members || []), newMember]

    // 更新邀请链接的使用次数
    const updatedInviteLinks = tenantData.inviteLinks.map(link => {
      if (link.token === token) {
        return {
          ...link,
          usedCount: link.usedCount + 1,
          usedBy: [
            ...(link.usedBy || []),
            { userId: user.uid, usedAt: new Date().toISOString() }
          ],
        }
      }
      return link
    })

    // 更新 tenant document
    await updateDoc(tenantRef, {
      members: updatedMembers,
      inviteLinks: updatedInviteLinks,
      updatedAt: serverTimestamp(),
    })

    // ✅ 修复：不覆盖 tenantId，而是设置 joinedOrganization
    await updateDoc(userRef, {
      joinedOrganization: inviteInfo.tenantId,  // ✅ 新字段
      joinedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    // ✅ 新增：更新用户所有框架的 organization 字段
    const frameworksQuery = query(
      collection(db, 'frameworks'),
      where('creatorId', '==', user.uid),
      where('tenantId', '==', userData.tenantId)
    )
    
    const frameworksSnapshot = await getDocs(frameworksQuery)
    
    const updatePromises = frameworksSnapshot.docs.map(docSnapshot => {
      return updateDoc(doc(db, 'frameworks', docSnapshot.id), {
        organization: inviteInfo.tenantId,  // 更新为新组织
        updatedAt: serverTimestamp(),
      })
    })

    await Promise.all(updatePromises)

    console.log('✅ User joined organization:', inviteInfo.tenantId)
    console.log(`✅ Updated ${frameworksSnapshot.size} frameworks`)
    
    return { 
      success: true, 
      tenantId: inviteInfo.tenantId,
      frameworksUpdated: frameworksSnapshot.size
    }
  } catch (error) {
    console.error('接受邀请错误:', error)
    throw error
  }
}

/**
 * 退出组织 - 新增函数
 * 
 * ✅ 功能：
 * - 从组织成员列表中移除用户
 * - 清除用户的 joinedOrganization 字段
 * - 将用户所有框架的 organization 恢复为自己的 tenantId
 * - 取消所有框架的 publishedToOrganization 状态
 * 
 * @param {string} organizationId - 要退出的组织 ID
 * @returns {Promise<Object>} { success: true }
 */
export const leaveOrganization = async (organizationId) => {
  try {
    const user = auth.currentUser
    if (!user) throw new Error('用户未登录')

    // 获取用户信息
    const userRef = doc(db, 'users', user.uid)
    const userDoc = await getDoc(userRef)
    
    if (!userDoc.exists()) {
      throw new Error('User document not found')
    }
    
    const userData = userDoc.data()

    // 验证用户是否在该组织中
    if (userData.joinedOrganization !== organizationId) {
      throw new Error('You are not a member of this organization')
    }

    // 获取组织信息
    const tenantRef = doc(db, 'tenants', organizationId)
    const tenantDoc = await getDoc(tenantRef)
    
    if (!tenantDoc.exists()) {
      throw new Error('Organization not found')
    }
    
    const tenantData = tenantDoc.data()

    // 从成员列表中移除用户
    const updatedMembers = (tenantData.members || []).filter(
      m => m.userId !== user.uid
    )

    // 更新组织 document
    await updateDoc(tenantRef, {
      members: updatedMembers,
      updatedAt: serverTimestamp(),
    })

    // 清除用户的 joinedOrganization 字段
    await updateDoc(userRef, {
      joinedOrganization: null,
      leftOrganizationAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    // 更新用户所有框架：恢复为自己的 organization，取消发布状态
    const frameworksQuery = query(
      collection(db, 'frameworks'),
      where('creatorId', '==', user.uid),
      where('organization', '==', organizationId)
    )
    
    const frameworksSnapshot = await getDocs(frameworksQuery)
    
    const updatePromises = frameworksSnapshot.docs.map(docSnapshot => {
      return updateDoc(doc(db, 'frameworks', docSnapshot.id), {
        organization: userData.tenantId,  // 恢复为自己的 tenant
        publishedToOrganization: false,   // 取消发布
        updatedAt: serverTimestamp(),
      })
    })

    await Promise.all(updatePromises)

    console.log('✅ User left organization:', organizationId)
    console.log(`✅ Restored ${frameworksSnapshot.size} frameworks`)
    
    return { 
      success: true,
      frameworksRestored: frameworksSnapshot.size
    }
  } catch (error) {
    console.error('退出组织错误:', error)
    throw error
  }
}

/**
 * 发布框架到组织 - 新增函数
 * 
 * @param {string} frameworkId - 框架 ID
 * @returns {Promise<Object>} { success: true }
 */
export const publishFrameworkToOrganization = async (frameworkId) => {
  try {
    const user = auth.currentUser
    if (!user) throw new Error('用户未登录')

    // 获取用户数据
    const userRef = doc(db, 'users', user.uid)
    const userDoc = await getDoc(userRef)
    
    if (!userDoc.exists()) {
      throw new Error('User not found')
    }

    const userData = userDoc.data()

    // 检查用户是否加入了组织
    if (!userData.joinedOrganization) {
      throw new Error('You are not a member of any organization')
    }

    // ✅ 获取组织ID
    const organizationId = userData.joinedOrganization

    // 获取框架
    const frameworkRef = doc(db, 'frameworks', frameworkId)
    const frameworkDoc = await getDoc(frameworkRef)
    
    if (!frameworkDoc.exists()) {
      throw new Error('Framework not found')
    }

    const frameworkData = frameworkDoc.data()

    // 验证框架所有权
    if (frameworkData.creatorId !== user.uid) {
      throw new Error('You can only publish your own frameworks')
    }

    // ✅ 核心修复：添加 organization 字段
    await updateDoc(frameworkRef, {
      organization: organizationId,           // ✅ 新增！
      publishedToOrganization: true,
      publishedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    console.log('✅ Framework published to organization:', frameworkId, 'org:', organizationId)
    
    // ✅ 返回组织ID
    return { 
      success: true, 
      organizationId: organizationId 
    }
  } catch (error) {
    console.error('发布框架错误:', error)
    throw error
  }
}
/**
 * 取消发布框架 - 新增函数
 * 
 * @param {string} frameworkId - 框架 ID
 * @returns {Promise<Object>} { success: true }
 */
export const unpublishFrameworkFromOrganization = async (frameworkId) => {
  try {
    const user = auth.currentUser
    if (!user) throw new Error('用户未登录')

    const frameworkRef = doc(db, 'frameworks', frameworkId)
    const frameworkDoc = await getDoc(frameworkRef)
    
    if (!frameworkDoc.exists()) {
      throw new Error('Framework not found')
    }

    const frameworkData = frameworkDoc.data()

    if (frameworkData.creatorId !== user.uid) {
      throw new Error('You can only unpublish your own frameworks')
    }

    // ✅ 核心修复：清除 organization 字段
    await updateDoc(frameworkRef, {
      organization: null,                     // ✅ 新增！
      publishedToOrganization: false,
      unpublishedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    console.log('✅ Framework unpublished from organization:', frameworkId)
    return { success: true }
  } catch (error) {
    console.error('取消发布框架错误:', error)
    throw error
  }
}

/**
 * 获取组织的所有共享框架 - 新增函数
 * 
 * @param {string} organizationId - 组织 ID
 * @returns {Promise<Array>} 框架列表
 */
export const getOrganizationFrameworks = async (organizationId) => {
  try {
    const user = auth.currentUser
    if (!user) throw new Error('用户未登录')

    // 查询所有发布到该组织的框架
    const q = query(
      collection(db, 'frameworks'),
      where('organization', '==', organizationId),
      where('publishedToOrganization', '==', true),
      orderBy('updatedAt', 'desc')
    )

    const snapshot = await getDocs(q)
    
    const frameworks = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))

    console.log(`✅ Found ${frameworks.length} organization frameworks`)
    return frameworks
  } catch (error) {
    console.error('获取组织框架错误:', error)
    throw error
  }
}

/**
 * 撤销邀请链接
 */
export const revokeInviteLink = async (token) => {
  try {
    const user = auth.currentUser
    if (!user) throw new Error('用户未登录')

    const userRef = doc(db, 'users', user.uid)
    const userDoc = await getDoc(userRef)
    const userData = userDoc.data()
    const tenantId = userData.tenantId

    if (!tenantId) {
      throw new Error('User does not have a tenant')
    }

    const tenantRef = doc(db, 'tenants', tenantId)
    const tenantDoc = await getDoc(tenantRef)
    
    if (!tenantDoc.exists()) {
      throw new Error('Tenant not found')
    }
    
    const tenantData = tenantDoc.data()
    
    const isOwner = tenantData.members?.some(
      m => m.userId === user.uid && m.role === 'owner'
    )
    
    if (!isOwner) {
      throw new Error('Only tenant owner can revoke invite links')
    }

    const updatedInviteLinks = (tenantData.inviteLinks || []).map(link => {
      if (link.token === token) {
        return {
          ...link,
          isActive: false,
          revokedAt: new Date().toISOString(),
          revokedBy: user.uid,
        }
      }
      return link
    })

    await updateDoc(tenantRef, {
      inviteLinks: updatedInviteLinks,
      updatedAt: serverTimestamp(),
    })

    console.log('✅ Invite link revoked:', token)
    return { success: true }
  } catch (error) {
    console.error('Revoke invite link error:', error)
    throw error
  }
}

/**
 * 移除成员
 */
export const removeMember = async (tenantId, userId) => {
  try {
    const user = auth.currentUser
    if (!user) throw new Error('用户未登录')

    const tenantRef = doc(db, 'tenants', tenantId)
    const tenantDoc = await getDoc(tenantRef)
    
    if (!tenantDoc.exists()) {
      throw new Error('Tenant not found')
    }
    
    const tenantData = tenantDoc.data()

    const isOwner = tenantData.members?.some(
      m => m.userId === user.uid && m.role === 'owner'
    )
    
    if (!isOwner) {
      throw new Error('Only tenant owner can remove members')
    }

    const memberToRemove = tenantData.members?.find(m => m.userId === userId)
    if (memberToRemove?.role === 'owner') {
      throw new Error('Cannot remove the tenant owner')
    }

    const updatedMembers = (tenantData.members || []).filter(
      m => m.userId !== userId
    )

    await updateDoc(tenantRef, {
      members: updatedMembers,
      updatedAt: serverTimestamp(),
    })

    const removedUserRef = doc(db, 'users', userId)
    await updateDoc(removedUserRef, {
      joinedOrganization: null,
      leftOrganizationAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    const frameworksQuery = query(
      collection(db, 'frameworks'),
      where('creatorId', '==', userId),
      where('organization', '==', tenantId),
      where('publishedToOrganization', '==', true)
    )
    
    const frameworksSnapshot = await getDocs(frameworksQuery)
    
    const updatePromises = frameworksSnapshot.docs.map(docSnapshot => {
      return updateDoc(doc(db, 'frameworks', docSnapshot.id), {
        publishedToOrganization: false,
        unpublishedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    })

    await Promise.all(updatePromises)

    console.log('✅ Member removed:', userId)
    console.log(`✅ Unpublished ${frameworksSnapshot.size} frameworks`)
    
    return { 
      success: true,
      unpublishedCount: frameworksSnapshot.size
    }
  } catch (error) {
    console.error('Remove member error:', error)
    throw error
  }
}

/**
 * 获取租户成员列表
 */
export const getTenantMembers = async (tenantId) => {
  try {
    const user = auth.currentUser
    if (!user) throw new Error('用户未登录')

    const tenantRef = doc(db, 'tenants', tenantId)
    const tenantDoc = await getDoc(tenantRef)
    
    if (!tenantDoc.exists()) {
      throw new Error('Tenant not found')
    }
    
    const tenantData = tenantDoc.data()
    const members = tenantData.members || []

    const membersWithDetails = await Promise.all(
      members.map(async (member) => {
        try {
          const userRef = doc(db, 'users', member.userId)
          const userDoc = await getDoc(userRef)
          
          if (userDoc.exists()) {
            const userData = userDoc.data()
            return {
              userId: member.userId,
              email: userData.email || member.email,
              username: userData.username || member.username || userData.email?.split('@')[0] || 'Unknown',
              role: member.role || 'member',
              joinedAt: member.joinedAt,
            }
          }
          
          return {
            userId: member.userId,
            email: member.email || 'Unknown',
            username: member.username || member.email?.split('@')[0] || 'Unknown',
            role: member.role || 'member',
            joinedAt: member.joinedAt,
          }
        } catch (error) {
          console.error(`Error fetching member ${member.userId}:`, error)
          return {
            userId: member.userId,
            email: member.email || 'Unknown',
            username: member.username || 'Unknown',
            role: member.role || 'member',
            joinedAt: member.joinedAt,
          }
        }
      })
    )

    console.log(`✅ Fetched ${membersWithDetails.length} members for tenant ${tenantId}`)
    return membersWithDetails
  } catch (error) {
    console.error('Get tenant members error:', error)
    throw error
  }
}

// ============================================
// Admin 白名单功能
// ============================================

// 超级管理员邮箱
const SUPER_ADMIN_EMAIL = 'webmaster@valorie.ai'

/**
 * 检查当前用户是否是超级管理员
 * @returns {boolean}
 */
export const isSuperAdmin = () => {
  const user = auth.currentUser
  return user?.email === SUPER_ADMIN_EMAIL
}

/**
 * 获取所有白名单域名
 * @returns {Promise<Array>} 域名列表
 */
export const getWhitelistDomains = async () => {
  try {
    const user = auth.currentUser
    if (!user || user.email !== SUPER_ADMIN_EMAIL) {
      throw new Error('Unauthorized: Admin access required')
    }

    const configRef = doc(db, 'config', 'whitelist')
    const configDoc = await getDoc(configRef)
    
    if (configDoc.exists()) {
      const data = configDoc.data()
      return data.domains || []
    }
    
    // 如果不存在，创建初始配置
    const initialDomains = ['ad.unsw.edu.au', 'valorie.ai']
    await setDoc(configRef, {
      domains: initialDomains,
      updatedAt: serverTimestamp(),
      updatedBy: user.uid,
    })
    
    return initialDomains
  } catch (error) {
    console.error('获取白名单域名错误:', error)
    throw error
  }
}

/**
 * 添加白名单域名
 * @param {string} domain - 域名（不含@符号）
 * @returns {Promise<Object>}
 */
export const addWhitelistDomain = async (domain) => {
  try {
    const user = auth.currentUser
    if (!user || user.email !== SUPER_ADMIN_EMAIL) {
      throw new Error('Unauthorized: Admin access required')
    }

    // 清理域名（移除@符号和空格）
    const cleanDomain = domain.replace('@', '').trim().toLowerCase()
    
    if (!cleanDomain) {
      throw new Error('Invalid domain')
    }

    const configRef = doc(db, 'config', 'whitelist')
    const configDoc = await getDoc(configRef)
    
    let currentDomains = []
    if (configDoc.exists()) {
      currentDomains = configDoc.data().domains || []
    }
    
    // 检查是否已存在
    if (currentDomains.includes(cleanDomain)) {
      throw new Error('Domain already exists in whitelist')
    }
    
    // 添加新域名
    const updatedDomains = [...currentDomains, cleanDomain]
    
    await setDoc(configRef, {
      domains: updatedDomains,
      updatedAt: serverTimestamp(),
      updatedBy: user.uid,
    })
    
    console.log('✅ Domain added to whitelist:', cleanDomain)
    return { success: true, domain: cleanDomain }
  } catch (error) {
    console.error('添加白名单域名错误:', error)
    throw error
  }
}

/**
 * 移除白名单域名
 * @param {string} domain - 域名
 * @returns {Promise<Object>}
 */
export const removeWhitelistDomain = async (domain) => {
  try {
    const user = auth.currentUser
    if (!user || user.email !== SUPER_ADMIN_EMAIL) {
      throw new Error('Unauthorized: Admin access required')
    }

    const configRef = doc(db, 'config', 'whitelist')
    const configDoc = await getDoc(configRef)
    
    if (!configDoc.exists()) {
      throw new Error('Whitelist configuration not found')
    }
    
    const currentDomains = configDoc.data().domains || []
    const updatedDomains = currentDomains.filter(d => d !== domain)
    
    await setDoc(configRef, {
      domains: updatedDomains,
      updatedAt: serverTimestamp(),
      updatedBy: user.uid,
    })
    
    console.log('✅ Domain removed from whitelist:', domain)
    return { success: true, domain }
  } catch (error) {
    console.error('移除白名单域名错误:', error)
    throw error
  }
}

/**
 * 检查邮箱域名是否在白名单中
 * @param {string} email - 邮箱地址
 * @returns {Promise<boolean>}
 */
export const checkEmailDomainWhitelisted = async (email) => {
  try {
    const domain = email.split('@')[1]?.toLowerCase()
    if (!domain) return false
    
    const configRef = doc(db, 'config', 'whitelist')
    const configDoc = await getDoc(configRef)
    
    if (!configDoc.exists()) {
      // 如果配置不存在，使用默认白名单
      return domain === 'ad.unsw.edu.au'
    }
    
    const whitelistDomains = configDoc.data().domains || []
    return whitelistDomains.includes(domain)
  } catch (error) {
    console.error('检查邮箱域名白名单错误:', error)
    // 发生错误时，为安全起见返回false
    return false
  }
}

/**
 * 获取所有用户（仅管理员）
 * @returns {Promise<Array>}
 */
export const getAllUsers = async () => {
  try {
    const user = auth.currentUser
    if (!user || user.email !== SUPER_ADMIN_EMAIL) {
      throw new Error('Unauthorized: Admin access required')
    }

    const usersQuery = query(
      collection(db, 'users'),
      orderBy('createdAt', 'desc')
    )
    
    const snapshot = await getDocs(usersQuery)
    
    const users = snapshot.docs.map(doc => ({
      uid: doc.id,
      ...doc.data(),
      // 确保isBlocked字段存在
      isBlocked: doc.data().isBlocked || false,
    }))
    
    console.log(`✅ Fetched ${users.length} users`)
    return users
  } catch (error) {
    console.error('获取用户列表错误:', error)
    throw error
  }
}

/**
 * Block用户
 * @param {string} userId - 用户ID
 * @returns {Promise<Object>}
 */
export const blockUser = async (userId) => {
  try {
    const user = auth.currentUser
    if (!user || user.email !== SUPER_ADMIN_EMAIL) {
      throw new Error('Unauthorized: Admin access required')
    }

    const userRef = doc(db, 'users', userId)
    await updateDoc(userRef, {
      isBlocked: true,
      blockedAt: serverTimestamp(),
      blockedBy: user.uid,
    })
    
    console.log('✅ User blocked:', userId)
    return { success: true, userId }
  } catch (error) {
    console.error('Block用户错误:', error)
    throw error
  }
}

/**
 * Unblock用户
 * @param {string} userId - 用户ID
 * @returns {Promise<Object>}
 */
export const unblockUser = async (userId) => {
  try {
    const user = auth.currentUser
    if (!user || user.email !== SUPER_ADMIN_EMAIL) {
      throw new Error('Unauthorized: Admin access required')
    }

    const userRef = doc(db, 'users', userId)
    await updateDoc(userRef, {
      isBlocked: false,
      unblockedAt: serverTimestamp(),
      unblockedBy: user.uid,
    })
    
    console.log('✅ User unblocked:', userId)
    return { success: true, userId }
  } catch (error) {
    console.error('Unblock用户错误:', error)
    throw error
  }
}

/**
 * 检查用户是否被block
 * @param {string} userId - 用户ID
 * @returns {Promise<boolean>}
 */
export const checkUserBlocked = async (userId) => {
  try {
    const userRef = doc(db, 'users', userId)
    const userDoc = await getDoc(userRef)
    
    if (!userDoc.exists()) {
      return false
    }
    
    return userDoc.data().isBlocked || false
  } catch (error) {
    console.error('检查用户block状态错误:', error)
    return false
  }
}

// 导出到 firebase.js 的 default export 中
// 添加以下函数到 export default {...} 中:
/*
  isSuperAdmin,
  getWhitelistDomains,
  addWhitelistDomain,
  removeWhitelistDomain,
  checkEmailDomainWhitelisted,
  getAllUsers,
  blockUser,
  unblockUser,
  checkUserBlocked,
*/

export default {
  auth,
  db,
  registerUser,
  loginUser,
  logoutUser,
  checkEmailExists,
  checkUsernameExists,
  onAuthChange,
  createFramework,
  getMyFrameworks,
  getFramework,
  updateFramework,
  deleteFramework,
  onFrameworksChange,
  createTenant,
  getMyTenant,
  updateTenant,
  regenerateEmbedKey,
  checkIsExpert,
  upgradeToExpert,
  // 🆕 新增成员管理函数
  generateInviteLink,
  getInviteLink,
  acceptInvite,
  revokeInviteLink,
  removeMember,
  getTenantMembers,
  isSuperAdmin,
  getWhitelistDomains,
  addWhitelistDomain,
  removeWhitelistDomain,
  checkEmailDomainWhitelisted,
  getAllUsers,
  blockUser,
  unblockUser,
  checkUserBlocked,
}