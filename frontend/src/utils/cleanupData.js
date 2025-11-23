/**
 * Data Cleanup Script
 * 
 * This script cleans up old data in Firestore:
 * 1. Removes 'expertId' field from all frameworks
 * 2. Fixes 'tenantId: legacy' to null (will be assigned when user creates tenant)
 * 
 * HOW TO USE:
 * 1. Copy this file to: frontend/src/utils/cleanupData.js
 * 2. Import it in a component (e.g., TenantSettings.jsx)
 * 3. Add a button to trigger: <button onClick={() => cleanupData()}>Run Cleanup</button>
 * 4. Click the button ONCE
 * 5. Remove the button after cleanup is done
 */

import { collection, getDocs, updateDoc, doc, deleteField } from 'firebase/firestore'
import { db } from '../lib/firebase'

export async function cleanupData() {
  console.log('🚀 Starting data cleanup...')
  
  try {
    // ========================================
    // Step 1: Clean up Frameworks collection
    // ========================================
    console.log('📂 Fetching all frameworks...')
    const frameworksSnapshot = await getDocs(collection(db, 'frameworks'))
    
    console.log(`Found ${frameworksSnapshot.size} frameworks to process`)
    
    let updatedCount = 0
    let errorCount = 0
    
    for (const frameworkDoc of frameworksSnapshot.docs) {
      const data = frameworkDoc.data()
      const updates = {}
      
      // 1. Remove expertId field (we only need creatorId)
      if ('expertId' in data) {
        updates.expertId = deleteField()
        console.log(`  ➡️  Removing expertId from framework: ${frameworkDoc.id}`)
      }
      
      // 2. Fix tenantId: "legacy" → null
      if (data.tenantId === 'legacy') {
        updates.tenantId = null
        console.log(`  ➡️  Fixing tenantId (legacy → null) for framework: ${frameworkDoc.id}`)
      }
      
      // 3. Ensure framework has required fields
      if (!data.publishedToOrganization) {
        updates.publishedToOrganization = false
        console.log(`  ➡️  Adding publishedToOrganization field to framework: ${frameworkDoc.id}`)
      }
      
      // Apply updates if there are any
      if (Object.keys(updates).length > 0) {
        try {
          await updateDoc(doc(db, 'frameworks', frameworkDoc.id), updates)
          updatedCount++
          console.log(`  ✅ Updated framework: ${frameworkDoc.id}`)
        } catch (err) {
          console.error(`  ❌ Error updating framework ${frameworkDoc.id}:`, err)
          errorCount++
        }
      }
    }
    
    console.log('\n📊 Cleanup Summary:')
    console.log(`  - Total frameworks: ${frameworksSnapshot.size}`)
    console.log(`  - Updated: ${updatedCount}`)
    console.log(`  - Errors: ${errorCount}`)
    console.log(`  - Unchanged: ${frameworksSnapshot.size - updatedCount - errorCount}`)
    
    console.log('\n✅ Data cleanup completed successfully!')
    
    return {
      success: true,
      total: frameworksSnapshot.size,
      updated: updatedCount,
      errors: errorCount
    }
    
  } catch (error) {
    console.error('❌ Fatal error during cleanup:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Verify cleanup results
 */
export async function verifyCleanup() {
  console.log('🔍 Verifying cleanup...')
  
  const frameworksSnapshot = await getDocs(collection(db, 'frameworks'))
  
  let hasExpertId = 0
  let hasLegacyTenant = 0
  let missingPublishedToOrg = 0
  
  frameworksSnapshot.forEach(doc => {
    const data = doc.data()
    
    if ('expertId' in data) {
      hasExpertId++
      console.log(`⚠️  Framework ${doc.id} still has expertId`)
    }
    
    if (data.tenantId === 'legacy') {
      hasLegacyTenant++
      console.log(`⚠️  Framework ${doc.id} still has tenantId: "legacy"`)
    }
    
    if (!('publishedToOrganization' in data)) {
      missingPublishedToOrg++
      console.log(`⚠️  Framework ${doc.id} missing publishedToOrganization`)
    }
  })
  
  console.log('\n📊 Verification Results:')
  console.log(`  - Total frameworks: ${frameworksSnapshot.size}`)
  console.log(`  - Still have expertId: ${hasExpertId}`)
  console.log(`  - Still have legacy tenantId: ${hasLegacyTenant}`)
  console.log(`  - Missing publishedToOrganization: ${missingPublishedToOrg}`)
  
  if (hasExpertId === 0 && hasLegacyTenant === 0 && missingPublishedToOrg === 0) {
    console.log('✅ All data is clean!')
  } else {
    console.log('⚠️  Some issues remain, you may need to run cleanup again')
  }
  
  return {
    total: frameworksSnapshot.size,
    hasExpertId,
    hasLegacyTenant,
    missingPublishedToOrg
  }
}