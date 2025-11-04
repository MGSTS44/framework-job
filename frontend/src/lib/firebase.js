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

// ============= 认证函数 =============

/**
 * 注册新用户
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
    await setDoc(doc(db, 'users', user.uid), {
      uid: user.uid,
      email: email,
      username: username,
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp(),
    })

    return {
      uid: user.uid,
      email: user.email,
      username: username,
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

// ============= Framework CRUD 函数 =============

/**
 * 创建新的 Framework
 *
 * @param {Object} frameworkData - Framework 数据
 * @returns {Promise<string>} Framework ID
 */
export const createFramework = async frameworkData => {
  try {
    const user = auth.currentUser
    if (!user) throw new Error('用户未登录')

    const frameworkRef = await addDoc(collection(db, 'frameworks'), {
      ...frameworkData,
      creatorId: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

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

// ============= 导出默认对象 =============

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
}
