/**
 * 数据迁移脚本
 * 
 * 文件位置: frontend/src/migrate-data.js
 * 
 * 用途：为现有用户和框架添加新字段
 */

import { db } from './lib/firebase'
import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'

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
 * 迁移现有用户数据
 * 为所有用户添加 roles 和 expertProfile 字段
 */
export async function migrateUsers() {
  console.log('🔄 开始迁移用户数据...')
  
  try {
    const usersSnapshot = await getDocs(collection(db, 'users'))
    let updatedCount = 0
    let skippedCount = 0
    const errors = []

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data()
      
      // 检查是否已经有 roles 字段
      if (userData.roles && Array.isArray(userData.roles)) {
        console.log(`⏭️  跳过用户 ${userDoc.id}（已有 roles 字段）`)
        skippedCount++
        continue
      }

      try {
        // 更新用户文档
        const updates = {
          roles: ['client', 'expert'],  // 假设所有现有用户都是专家
          expertProfile: {
            tenantId: null,
            displayName: userData.username || userData.displayName || 'Expert',
            isApproved: true,
            createdAt: serverTimestamp(),
          }
        }

        await updateDoc(doc(db, 'users', userDoc.id), updates)
        console.log(`✅ 更新用户 ${userDoc.id}`)
        updatedCount++
      } catch (error) {
        console.error(`❌ 更新用户 ${userDoc.id} 失败:`, error)
        errors.push({ id: userDoc.id, error: error.message })
      }
    }

    console.log(`\n📊 用户迁移完成:`)
    console.log(`   - 更新: ${updatedCount} 个用户`)
    console.log(`   - 跳过: ${skippedCount} 个用户`)
    if (errors.length > 0) {
      console.log(`   - 错误: ${errors.length} 个`)
      console.log('错误详情:', errors)
    }
    
    return { 
      success: true, 
      updated: updatedCount, 
      skipped: skippedCount,
      errors: errors 
    }
  } catch (error) {
    console.error('❌ 用户迁移失败:', error)
    throw error
  }
}

/**
 * 迁移现有框架数据
 * 为所有框架添加 tenantId 和 expertId 字段
 * 
 * @param {string} defaultTenantId - 默认租户 ID（例如：'legacy'）
 */
export async function migrateFrameworks(defaultTenantId = 'legacy') {
  console.log('🔄 开始迁移框架数据...')
  
  try {
    const frameworksSnapshot = await getDocs(collection(db, 'frameworks'))
    let updatedCount = 0
    let skippedCount = 0
    const errors = []

    for (const frameworkDoc of frameworksSnapshot.docs) {
      const frameworkData = frameworkDoc.data()
      
      // 检查是否已经有 tenantId 和 expertId
      if (frameworkData.tenantId && frameworkData.expertId) {
        console.log(`⏭️  跳过框架 ${frameworkDoc.id}（已有新字段）`)
        skippedCount++
        continue
      }

      try {
        // 更新框架文档
        const updates = {
          tenantId: defaultTenantId,                // 使用默认租户 ID
          expertId: frameworkData.creatorId,       // expertId = creatorId
        }

        // 如果没有 isPublic 字段，默认设为 false
        if (frameworkData.isPublic === undefined) {
          updates.isPublic = false
        }

        await updateDoc(doc(db, 'frameworks', frameworkDoc.id), updates)
        console.log(`✅ 更新框架 ${frameworkDoc.id}`)
        updatedCount++
      } catch (error) {
        console.error(`❌ 更新框架 ${frameworkDoc.id} 失败:`, error)
        errors.push({ id: frameworkDoc.id, error: error.message })
      }
    }

    console.log(`\n📊 框架迁移完成:`)
    console.log(`   - 更新: ${updatedCount} 个框架`)
    console.log(`   - 跳过: ${skippedCount} 个框架`)
    if (errors.length > 0) {
      console.log(`   - 错误: ${errors.length} 个`)
      console.log('错误详情:', errors)
    }
    
    return { 
      success: true, 
      updated: updatedCount, 
      skipped: skippedCount,
      errors: errors 
    }
  } catch (error) {
    console.error('❌ 框架迁移失败:', error)
    throw error
  }
}

/**
 * 为特定用户创建默认租户
 * 
 * @param {string} userId - 用户 ID
 * @param {string} tenantId - 租户 ID（例如：'ai-readiness'）
 * @param {string} displayName - 租户显示名称
 */
export async function createDefaultTenant(userId, tenantId, displayName) {
  console.log(`🏢 为用户 ${userId} 创建默认租户...`)
  
  try {
    const embedKey = `embed_${generateSecureKey()}`

    const tenantDoc = {
      id: tenantId,
      expertId: userId,
      subdomain: `${tenantId}.valorie.ai`,
      displayName: displayName,
      embedKey: embedKey,
      allowedOrigins: ['https://valorie.ai'],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      isActive: true,
    }

    await setDoc(doc(db, 'tenants', tenantId), tenantDoc)
    console.log(`✅ 租户创建成功: ${tenantId}`)
    console.log(`   Embed Key: ${embedKey}`)
    
    return { success: true, tenantId, embedKey }
  } catch (error) {
    console.error('❌ 创建租户失败:', error)
    throw error
  }
}

/**
 * 完整迁移流程
 * 按顺序执行所有迁移步骤
 */
export async function runFullMigration() {
  console.log('🚀 开始完整数据迁移...\n')
  
  try {
    // 1. 迁移用户
    console.log('=== 步骤 1/2: 迁移用户 ===')
    const usersResult = await migrateUsers()
    
    // 2. 迁移框架
    console.log('\n=== 步骤 2/2: 迁移框架 ===')
    const frameworksResult = await migrateFrameworks('legacy')
    
    console.log('\n🎉 完整迁移成功！')
    console.log('\n📊 总结:')
    console.log(`   用户: ${usersResult.updated} 个已更新, ${usersResult.skipped} 个已跳过`)
    console.log(`   框架: ${frameworksResult.updated} 个已更新, ${frameworksResult.skipped} 个已跳过`)
    
    if (usersResult.errors.length > 0 || frameworksResult.errors.length > 0) {
      console.log('\n⚠️  有一些错误发生:')
      if (usersResult.errors.length > 0) {
        console.log(`   用户错误: ${usersResult.errors.length} 个`)
      }
      if (frameworksResult.errors.length > 0) {
        console.log(`   框架错误: ${frameworksResult.errors.length} 个`)
      }
    }
    
    console.log('\n⚠️  注意: 所有旧框架现在属于 "legacy" 租户')
    console.log('   你可以稍后手动移动框架到正确的租户下')
    
    return { 
      success: true, 
      users: usersResult, 
      frameworks: frameworksResult 
    }
  } catch (error) {
    console.error('❌ 完整迁移失败:', error)
    throw error
  }
}

/**
 * 检查数据状态
 * 查看有多少数据需要迁移
 */
export async function checkMigrationStatus() {
  console.log('🔍 检查数据迁移状态...\n')
  
  try {
    // 检查用户
    const usersSnapshot = await getDocs(collection(db, 'users'))
    let usersNeedMigration = 0
    let usersAlreadyMigrated = 0
    
    usersSnapshot.docs.forEach(doc => {
      const data = doc.data()
      if (!data.roles || !Array.isArray(data.roles)) {
        usersNeedMigration++
      } else {
        usersAlreadyMigrated++
      }
    })

    // 检查框架
    const frameworksSnapshot = await getDocs(collection(db, 'frameworks'))
    let frameworksNeedMigration = 0
    let frameworksAlreadyMigrated = 0
    
    frameworksSnapshot.docs.forEach(doc => {
      const data = doc.data()
      if (!data.tenantId || !data.expertId) {
        frameworksNeedMigration++
      } else {
        frameworksAlreadyMigrated++
      }
    })

    console.log('📊 迁移状态报告:\n')
    console.log('用户:')
    console.log(`   ✅ 已迁移: ${usersAlreadyMigrated} 个`)
    console.log(`   ⏳ 需迁移: ${usersNeedMigration} 个`)
    console.log('\n框架:')
    console.log(`   ✅ 已迁移: ${frameworksAlreadyMigrated} 个`)
    console.log(`   ⏳ 需迁移: ${frameworksNeedMigration} 个`)
    
    if (usersNeedMigration === 0 && frameworksNeedMigration === 0) {
      console.log('\n🎉 所有数据已迁移完成！')
    } else {
      console.log('\n💡 需要运行迁移工具来更新数据')
    }
    
    return {
      users: { 
        needMigration: usersNeedMigration, 
        migrated: usersAlreadyMigrated,
        total: usersNeedMigration + usersAlreadyMigrated
      },
      frameworks: { 
        needMigration: frameworksNeedMigration, 
        migrated: frameworksAlreadyMigrated,
        total: frameworksNeedMigration + frameworksAlreadyMigrated
      }
    }
  } catch (error) {
    console.error('❌ 检查失败:', error)
    throw error
  }
}

// 导出所有函数
export default {
  migrateUsers,
  migrateFrameworks,
  createDefaultTenant,
  runFullMigration,
  checkMigrationStatus
}