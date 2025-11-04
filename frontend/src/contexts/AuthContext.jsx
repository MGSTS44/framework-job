/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect } from 'react'
import {
  registerUser,
  loginUser,
  logoutUser,
  onAuthChange,
} from '../lib/firebase'

const AuthContext = createContext()

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // 监听认证状态变化
  useEffect(() => {
    const unsubscribe = onAuthChange(firebaseUser => {
      if (firebaseUser) {
        // 用户已登录
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          username:
            firebaseUser.displayName || firebaseUser.email.split('@')[0],
        })
      } else {
        // 用户未登录
        setUser(null)
      }
      setLoading(false)
    })

    // 清理函数
    return () => unsubscribe()
  }, [])

  /**
   * 注册新用户
   */
  const signup = async (email, password, username) => {
    try {
      const userData = await registerUser(email, password, username)
      setUser(userData)
      return { success: true }
    } catch (error) {
      console.error('注册失败:', error)

      // 处理 Firebase 错误
      let errorMessage = '注册失败，请重试'

      if (error.code === 'auth/email-already-in-use') {
        errorMessage = '该邮箱已被注册'
      } else if (error.code === 'auth/weak-password') {
        errorMessage = '密码强度不够（至少 6 位）'
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = '邮箱格式不正确'
      }

      return { success: false, error: errorMessage }
    }
  }

  /**
   * 用户登录
   */
  const login = async (email, password) => {
    try {
      const userData = await loginUser(email, password)
      setUser(userData)
      return { success: true }
    } catch (error) {
      console.error('登录失败:', error)

      // 处理 Firebase 错误
      let errorMessage = 'Login failed, please check your account and password'

      if (
        error.code === 'auth/user-not-found' ||
        error.code === 'auth/wrong-password'
      ) {
        errorMessage = 'wrong email or password'
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'invalid email'
      } else if (error.code === 'auth/user-disabled') {
        errorMessage = 'account got banned'
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'please try later'
      }

      return { success: false, error: errorMessage }
    }
  }

  /**
   * 用户登出
   */
  const logout = async () => {
    try {
      await logoutUser()
      setUser(null)
      return { success: true }
    } catch (error) {
      console.error('登出失败:', error)
      return { success: false, error: '登出失败，请重试' }
    }
  }

  const value = {
    user,
    loading,
    signup,
    login,
    logout,
    isAuthenticated: !!user,
  }

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  )
}

export default AuthContext
