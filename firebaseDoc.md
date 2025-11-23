# Framework Library - Quick Access Guide for Client Team

## What You Get

Access to our **Framework Library** - a collection of professionally curated frameworks that updates in real-time.

---

## Quick Start (5 minutes)

### Step 1: Install Firebase
```bash
npm install firebase
```

### Step 2: Add Configuration

Create `firebase.js`:

```javascript
import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth, signInAnonymously } from 'firebase/auth'

// Firebase Configuration (public, safe to use)
const firebaseConfig = {
  apiKey: "AIzaSyDBL0sVYsWKsH3xGJGzMhuqeQNjVbXltKM",
  authDomain: "framework-builder-55896.firebaseapp.com",
  projectId: "framework-builder-55896",
  storageBucket: "framework-builder-55896.firebasestorage.app",
  messagingSenderId: "584534412223",
  appId: "1:584534412223:web:ff7f90dd6fa8b06045ef0a"
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
export const auth = getAuth(app)

// Anonymous authentication (required for Firebase security)
// This happens automatically in the background - your users won't notice
signInAnonymously(auth).catch(console.error)
```

**Important Note on Authentication:**
- **Required:** Firebase requires user authentication for security
- **User Experience:** Completely seamless - users don't need to register or log in
- **Anonymous Login:** Automatically creates a temporary anonymous user ID
- **No UI Needed:** Works silently in the background
- **Alternative:** If you already have Firebase authentication, use your existing auth instead

### Step 3: Access Frameworks

```javascript
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from './firebase'

// Real-time listener for all published frameworks
const unsubscribe = onSnapshot(
  query(collection(db, 'frameworks'), where('isPublic', '==', true)),
  (snapshot) => {
    const frameworks = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))
    console.log('Frameworks:', frameworks)
    // Use frameworks in your app
  }
)
```

---

## User Authentication (Important!)

### Why Authentication is Required

Firebase requires all users to be authenticated for security. **However, this doesn't mean your users need to create accounts or see a login screen.**

### We Recommended An Anonymous Authentication

**What it does:**
- Automatically creates a temporary anonymous user in the background
- Completely invisible to your end users
- No registration, no login screens, no passwords

**User experience:**
```
User opens your app → Instantly sees frameworks
(Authentication happens silently in the background)
```

**Implementation (already included in Step 2):**
```javascript
signInAnonymously(auth).catch(console.error)
```

That's it! Three words of code, zero user friction.

### Alternative Options

**If you already have Firebase Authentication:**
```javascript
// Use your existing login system
await signInWithEmailAndPassword(auth, email, password)
// or
await signInWithPopup(auth, new GoogleAuthProvider())
```

**If you want to track individual users:**
- Use your existing authentication system
- Integrate social login (Google, GitHub, etc.)
- Create custom user accounts

### FAQ

**Q: Do my users need to create accounts?**  
A: No! Use anonymous authentication, for now it's completely invisible to users.

**Q: Do I need to build a login page?**  
A: No! Anonymous authentication requires no UI.

**Q: Can I skip authentication entirely?**  
A: Not with the current security rules. But, if you need, we can also cahnge

**Q: What if I already have user authentication?**  
A: Perfect! Just use your existing Firebase auth instead of anonymous login.

---

## Data Structure

Each framework contains:

```javascript
{
  // Basic Info
  id: "framework-id",
  title: "Framework Title",
  version: "1.0",
  
  // Categorization
  category: "Technology",  // Technology | Healthcare | Research | Financial | Other
  family: "Technology",
  tags: ["agile", "software", "development"],
  
  // Publishing Info
  isPublic: true,
  publishedAt: Timestamp,
  createdAt: Timestamp,
  updatedAt: Timestamp,
  
  // Content
  confidence: 85,
  pov: "Point of view description...",
  artefacts: { ... },
  
  // Metadata
  creatorId: "user-id"
}
```

---

## Access Control

### What You Can Do:
- Read all published frameworks (`isPublic: true`)
- Real-time updates when frameworks change
- Filter by category, tags, confidence
- Export framework data

### What You Cannot Do:
- Create new frameworks
- Modify existing frameworks
- Access unpublished frameworks
- Delete frameworks

---

## Common Use Cases

### 1. Get All Frameworks
```javascript
import { collection, query, where, getDocs } from 'firebase/firestore'

const frameworks = await getDocs(
  query(collection(db, 'frameworks'), where('isPublic', '==', true))
)
```

### 2. Filter by Category
```javascript
const techFrameworks = await getDocs(
  query(
    collection(db, 'frameworks'),
    where('isPublic', '==', true),
    where('category', '==', 'Technology')
  )
)
```

### 3. Real-time Updates (Recommended)
```javascript
const unsubscribe = onSnapshot(
  query(collection(db, 'frameworks'), where('isPublic', '==', true)),
  (snapshot) => {
    // Automatically updates when frameworks change
    const frameworks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
  }
)
```

### 4. Search (Client-side)
```javascript
const searchResults = frameworks.filter(f =>
  f.title.toLowerCase().includes(query.toLowerCase()) ||
  f.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
)
```

---

### Quick Test
Verify your access:
```javascript
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from './firebase'

const testAccess = async () => {
  const snapshot = await getDocs(
    query(collection(db, 'frameworks'), where('isPublic', '==', true))
  )
  console.log(`Access verified! Found ${snapshot.docs.length} frameworks`)
}
```

---

## Current Status

- **Published Frameworks:** 3 active frameworks, we will publish more in future, but currently we still testing the library function
- **Categories:** Technology, Healthcare, Research
- **Last Updated:** October 28, 2025
