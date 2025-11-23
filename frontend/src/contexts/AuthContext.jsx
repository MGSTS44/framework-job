/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth'
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'

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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDocRef = doc(db, 'users', firebaseUser.uid)
          const userDoc = await getDoc(userDocRef)

          if (userDoc.exists()) {
            const userData = userDoc.data()
            
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              username: userData.username || firebaseUser.displayName || firebaseUser.email.split('@')[0],
              tenantId: userData.tenantId || null,
              joinedOrganization: userData.joinedOrganization || null,  // ✅ 新增
              roles: userData.roles || [],
              expertProfile: userData.expertProfile || null,
              createdAt: userData.createdAt,
              lastLogin: userData.lastLogin,
            })

            await updateDoc(userDocRef, {
              lastLogin: serverTimestamp(),
            })
          } else {
            console.warn('User document not found in Firestore, creating one...')
            
            const newUserData = {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              username: firebaseUser.displayName || firebaseUser.email.split('@')[0],
              tenantId: null,
              joinedOrganization: null,  // ✅ 新增
              roles: [],
              expertProfile: null,
              createdAt: serverTimestamp(),
              lastLogin: serverTimestamp(),
            }

            await setDoc(userDocRef, newUserData)

            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              username: newUserData.username,
              tenantId: null,
              joinedOrganization: null,  // ✅ 新增
              roles: [],
              expertProfile: null,
            })
          }
        } catch (error) {
          console.error('Error fetching user data from Firestore:', error)
          
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            username: firebaseUser.displayName || firebaseUser.email.split('@')[0],
            tenantId: null,
            joinedOrganization: null,  // ✅ 新增
            roles: [],
            expertProfile: null,
          })
        }
      } else {
        setUser(null)
      }
      
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const signup = async (email, password, username) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      const firebaseUser = userCredential.user

      await updateProfile(firebaseUser, {
        displayName: username,
      })

      const userDocRef = doc(db, 'users', firebaseUser.uid)
      const newUserData = {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        username: username,
        tenantId: null,
        joinedOrganization: null,  // ✅ 新增
        roles: [],
        expertProfile: null,
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
      }

      await setDoc(userDocRef, newUserData)

      console.log('✅ User registered successfully:', firebaseUser.uid)

      setUser({
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        username: username,
        tenantId: null,
        joinedOrganization: null,  // ✅ 新增
        roles: [],
        expertProfile: null,
      })

      return { success: true }
    } catch (error) {
      console.error('注册失败:', error)

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

  const login = async (email, password) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      const firebaseUser = userCredential.user

      const userDocRef = doc(db, 'users', firebaseUser.uid)
      const userDoc = await getDoc(userDocRef)

      if (userDoc.exists()) {
        const userData = userDoc.data()

        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          username: userData.username || firebaseUser.displayName || firebaseUser.email.split('@')[0],
          tenantId: userData.tenantId || null,
          joinedOrganization: userData.joinedOrganization || null,  // ✅ 新增
          roles: userData.roles || [],
          expertProfile: userData.expertProfile || null,
        })

        await updateDoc(userDocRef, {
          lastLogin: serverTimestamp(),
        })

        console.log('✅ User logged in successfully:', firebaseUser.uid)
      } else {
        console.warn('User document not found, creating one...')
        
        const newUserData = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          username: firebaseUser.displayName || firebaseUser.email.split('@')[0],
          tenantId: null,
          joinedOrganization: null,  // ✅ 新增
          roles: [],
          expertProfile: null,
          createdAt: serverTimestamp(),
          lastLogin: serverTimestamp(),
        }

        await setDoc(userDocRef, newUserData)

        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          username: newUserData.username,
          tenantId: null,
          joinedOrganization: null,  // ✅ 新增
          roles: [],
          expertProfile: null,
        })
      }

      return { success: true }
    } catch (error) {
      console.error('登录失败:', error)

      let errorMessage = 'Login failed, please check your account and password'

      if (
        error.code === 'auth/user-not-found' ||
        error.code === 'auth/wrong-password' ||
        error.code === 'auth/invalid-credential'
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

  const logout = async () => {
    try {
      await signOut(auth)
      setUser(null)
      console.log('✅ User logged out successfully')
      return { success: true }
    } catch (error) {
      console.error('登出失败:', error)
      return { success: false, error: '登出失败，请重试' }
    }
  }

  const updateUserTenant = async (tenantId, reload = false) => {
    if (!user) {
      throw new Error('No user logged in')
    }

    try {
      const userDocRef = doc(db, 'users', user.uid)
      
      await updateDoc(userDocRef, {
        tenantId: tenantId,
        roles: user.roles.includes('expert') ? user.roles : [...user.roles, 'expert'],
        expertProfile: user.expertProfile || {
          displayName: user.username + ' Expert',
          isApproved: true,
        },
        updatedAt: serverTimestamp(),
      })

      setUser({
        ...user,
        tenantId: tenantId,
        roles: user.roles.includes('expert') ? user.roles : [...user.roles, 'expert'],
        expertProfile: user.expertProfile || {
          displayName: user.username + ' Expert',
          isApproved: true,
        },
      })

      console.log('✅ User tenantId updated:', tenantId)
      
      if (reload) {
        window.location.reload()
      }
    } catch (error) {
      console.error('Error updating user tenantId:', error)
      throw error
    }
  }

  // ✅ 新增：刷新用户数据
  const refreshUser = async () => {
    if (!user) {
      throw new Error('No user logged in')
    }

    try {
      const userDocRef = doc(db, 'users', user.uid)
      const userDoc = await getDoc(userDocRef)

      if (userDoc.exists()) {
        const userData = userDoc.data()
        
        setUser({
          ...user,
          tenantId: userData.tenantId || null,
          joinedOrganization: userData.joinedOrganization || null,
          roles: userData.roles || [],
          expertProfile: userData.expertProfile || null,
        })

        console.log('✅ User data refreshed')
      }
    } catch (error) {
      console.error('Error refreshing user data:', error)
      throw error
    }
  }

  const value = {
    user,
    loading,
    signup,
    login,
    logout,
    updateUserTenant,
    refreshUser,  // ✅ 新增方法
    isAuthenticated: !!user,
  }

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  )
}

export default AuthContext