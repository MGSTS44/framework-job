/**
 * Update Existing Frameworks with TenantId
 * 
 * This script updates all frameworks created by the current user
 * that have null tenantId, and assigns them to the user's current tenant.
 * 
 * HOW TO USE:
 * 1. Add this as a temporary button in YourFrameworks.jsx or TenantSettings.jsx
 * 2. Click the button ONCE
 * 3. Remove the button after update is complete
 */

import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore'
import { db } from '../lib/firebase'

export async function updateFrameworksWithTenantId(userId, tenantId) {
  console.log(`🚀 Starting to update frameworks for user ${userId} with tenantId ${tenantId}...`)
  
  try {
    // Query all frameworks created by this user with null tenantId
    const q = query(
      collection(db, 'frameworks'),
      where('creatorId', '==', userId),
      where('tenantId', '==', null)
    )
    
    const querySnapshot = await getDocs(q)
    
    console.log(`Found ${querySnapshot.size} frameworks to update`)
    
    if (querySnapshot.size === 0) {
      console.log('✅ No frameworks need updating')
      return {
        success: true,
        updated: 0,
        total: 0
      }
    }
    
    let updated = 0
    let errors = 0
    
    // Update each framework
    for (const frameworkDoc of querySnapshot.docs) {
      try {
        await updateDoc(doc(db, 'frameworks', frameworkDoc.id), {
          tenantId: tenantId
        })
        
        console.log(`  ✅ Updated framework: ${frameworkDoc.id}`)
        updated++
      } catch (err) {
        console.error(`  ❌ Error updating framework ${frameworkDoc.id}:`, err)
        errors++
      }
    }
    
    console.log('\n📊 Update Summary:')
    console.log(`  - Total frameworks: ${querySnapshot.size}`)
    console.log(`  - Updated: ${updated}`)
    console.log(`  - Errors: ${errors}`)
    console.log('\n✅ Update completed!')
    
    return {
      success: true,
      total: querySnapshot.size,
      updated: updated,
      errors: errors
    }
    
  } catch (error) {
    console.error('❌ Error updating frameworks:', error)
    return {
      success: false,
      error: error.message
    }
  }
}