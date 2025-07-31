
---

# ✅ STUDENT CLEARANCE SYSTEM – MVP (ZIP Upload Version)

---

## 🎯 GOAL

Allow undergraduate and graduate students to submit their clearance details and a `.zip` file containing all required research documents. Admin can log in, view submissions, download the zip, and update statuses.

---

## 🧱 CORE FEATURES

---

### 1. ✅ STUDENT SUBMISSION PAGE

#### 📄 Fields

**🔷 Common Fields (Both Levels):**

* Name
* Email
* Student ID
* Adviser
* Course
* Research Title
* Research Type: `"Thesis" | "Capstone" | "Dissertation"`

**🟦 Undergraduate Only:**

* Group Members (array of objects with `name` and `studentID`)

**📎 Document Uploads (Individual Files):**

* **Approval Sheet** - `.pdf` format (Max 10MB)
* **Full Paper** - `.docx` format (Max 10MB)
  * Ethics clearance should be included in the appendix
* **Long Abstract** - `.docx` format (Max 10MB)  
* **Journal Format** - `.docx` format (Max 10MB)

#### ✅ Validation

* Required fields must be filled
* Each document must be:
  * Correct format (PDF/DOCX)
  * Max 10MB per file

#### 🔁 On Submit

* Generate document ID: `SPUP_Clearance_2025_XXXXXX`
* Store student data in Firestore under `submissions`
* Create ZIP file containing all documents with standardized names:
  * `approval_sheet.pdf`
  * `full_paper.docx` 
  * `long_abstract.docx`
  * `journal_format.docx`
* Upload ZIP file to Firebase Storage: `/submissions/SPUP_Clearance_2025_XXXXXX.zip`
* Save ZIP download URL as `zipFile` in Firestore

---

### 2. ✅ ADMIN PANEL

#### 🔐 Admin Login

* Firebase Auth (Email/Password)
* Only allow email: `cprint@spup.edu.ph`
* Protected route for `/admin`

#### 📊 Dashboard

* View all submissions in a table
* Filter by:

  * Level (`undergrad`, `grad`)
  * Status (`Submitted`, `Cleared`)
  * Course
* Search by:

  * Name
  * Student ID
  * Research Title

#### 🔍 View Submission

* Full form data
* Button to download ZIP file containing all documents
* Status update:

  * From `Submitted` → `Cleared`

---

## 🗃️ FIREBASE STRUCTURE

### 🔸 Firestore: Collection `submissions`

```ts
{
  id: string; // SPUP_Clearance_2025_XYZ123
  level: "undergrad" | "grad";
  name: string;
  email: string;
  studentId: string;
  adviser: string;
  course: string;
  researchTitle: string;
  researchType: "Thesis" | "Capstone" | "Dissertation";
  groupMembers?: {
    name: string;
    studentID: string;
  }[];
  zipFile: string; // URL of ZIP file containing all documents
  status: "Submitted" | "Cleared";
  submittedAt: Timestamp;
}
```

---

### 🔸 Firebase Storage Structure

```
/submissions/SPUP_Clearance_2025_XYZ123.zip
```

---

## 🧩 UI COMPONENTS (ShadCN + Tailwind)

| Component            | Description                              |
| -------------------- | ---------------------------------------- |
| `StudentForm.tsx`    | Dynamic form for student submission      |
| `DocumentUpload.tsx` | Individual file inputs with validation   |
| `AdminTable.tsx`     | Dashboard view for admins                |
| `SubmissionCard.tsx` | Individual submission detail panel       |
| `LoginForm.tsx`      | Admin login screen                       |
| `StatusBadge.tsx`    | Displays status ("Submitted", "Cleared") |
| `AdminLayout.tsx`    | Sidebar + Header for admin area          |
| `Navigation.tsx`     | Reusable header with SPUP logo & navigation |
| `TrackingForm.tsx`   | Public submission ID tracking form      |
| `SubmissionStatus.tsx` | Public submission status display       |

---

## 🛠 TECH STACK

| Layer        | Tool                             |
| ------------ | -------------------------------- |
| Frontend     | Next.js (App Router), TypeScript |
| Styling      | Tailwind CSS + ShadCN UI         |
| Auth         | Firebase Auth                    |
| Database     | Firebase Firestore               |
| File Storage | Firebase Storage                 |
| Hosting      | Firebase Hosting or Vercel       |

---

## 📅 MVP TIMELINE

| Week | Task                                               | Status |
| ---- | -------------------------------------------------- | ------ |
| 1    | ✅ Project setup, Firebase config, ShadCN styling     | Done |
| 2    | ✅ Build Student Form + ZIP upload + Firestore        | Done |
| 3    | ✅ Build Admin Login + Dashboard + View Submission    | Done |
| 4    | ⚠️ Final polish, test validations, deploy to Firebase | In Progress |

## 🛠️ **SETUP INSTRUCTIONS**

### **Creating an Admin User**

The system requires an admin user with email: `cprint@spup.edu.ph`

**Method 1: Firebase Console**
1. Go to Firebase Console → Authentication → Users
2. Click "Add user"
3. Email: `cprint@spup.edu.ph`
4. Password: (create secure password)

**Method 2: Using Browser Console**
1. Open browser DevTools (F12)
2. In console, run:
```javascript
// Import the function first (if not already imported)
import { createAdminUser } from '/src/utils/createAdmin.ts';
createAdminUser('your_secure_password').then(() => console.log('Admin created!'));
```

### **Firebase Setup Required**
1. Create Firebase project
2. Enable Authentication (Email/Password)
3. Set up environment variables in `.env.local`
4. Create admin user account

## ✅ COMPLETED TASKS

- ✅ Firebase configuration with Auth, Firestore, and Storage
- ✅ TypeScript interfaces and types 
- ✅ Utility functions (file validation, document ID generation, className merging)
- ✅ StatusBadge component
- ✅ DocumentUpload component with drag & drop functionality for individual files
- ✅ StudentForm component with dynamic fields based on level
- ✅ LoginForm component for admin authentication
- ✅ AdminLayout component with header and logout
- ✅ AdminTable component with filtering and search
- ✅ SubmissionCard component for detailed view and status updates
- ✅ Firebase service functions for all CRUD operations
- ✅ Updated main page with student submission flow
- ✅ Individual document inputs that auto-generate ZIP file
- ✅ Course field uses text input for abbreviations (students type their own)
- ✅ Ethics clearance note included in Full Paper description
- ✅ Updated admin page with complete dashboard functionality
- ✅ Organized project structure with proper folder hierarchy
- ✅ Public submission tracking feature at `/track` route
- ✅ Custom brand color implementation (#036635) throughout the system
- ✅ Fully responsive design optimized for mobile, tablet, and desktop screens
- ✅ Reusable Navigation component with SPUP logo integration
- ✅ Clean student UX with hidden admin login (accessible via direct URL)
- ✅ Fixed logo deployment issues with optimized static export configuration
- ✅ Integrated admin welcome banner into Navigation component for better organization
- ✅ Export & Archive system for cost optimization
  - Individual document downloads with custom naming format: (StudentName)SPUP_Clearance_2025_ABC123.zip
  - Bulk export functionality with master ZIP file creation
  - Firebase Storage cleanup to reduce costs while preserving metadata
  - Export manifest generation for record keeping
  - Admin export panel with selection interface
  - Fully optimized Firestore queries to avoid ALL index requirements (simple equality filters with client-side sorting)

## 📁 PROJECT STRUCTURE

```
src/
├── app/                    # Next.js app router
│   ├── admin/page.tsx     # Admin dashboard
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Student submission page
├── components/            # All UI components
│   ├── admin/            # Admin-specific components
│   │   ├── AdminLayout.tsx
│   │   ├── AdminTable.tsx
│   │   ├── LoginForm.tsx
│   │   └── SubmissionCard.tsx
│   ├── forms/            # Form components
│   │   ├── StudentForm.tsx
│   │   └── DocumentUpload.tsx
│   └── ui/               # Reusable UI components
│       └── StatusBadge.tsx
├── lib/                  # Configuration
│   └── firebase.ts       # Firebase setup
├── services/             # Business logic
│   └── firebase.ts       # Firebase service functions
├── types/                # TypeScript definitions
│   └── index.ts
└── utils/                # Utility functions
    ├── cn.ts             # Tailwind className utility
    ├── documentId.ts     # Document ID generation
    └── createAdmin.ts    # Admin user creation utility
├── public/               # Static assets
    └── SPUP-final-logo.png # University logo for navigation
```

---

## 🔐 FIREBASE RULES (Pseudocode)

```js
match /submissions/{id} {
  allow read, write: if request.auth != null &&
    (request.auth.token.email == "cprint@spup.edu.ph");
}
match /{allPaths=**} {
  allow read, write: if false; // lock everything else
}
```

---

## ✅ ADDITIONAL FEATURES

* ✅ Public submission tracking (with submission ID)
* Email notifications on status update
* Admin-level roles (chair, dean, adviser)
* CSV Export
* Check `.zip` contents server-side (Node.js Function)

### 🔍 Public Submission Tracking

Students can now track their submission status using their ID:

* **Route:** `/track`
* **Input:** Submission ID validation (`SPUP_Clearance_YYYY_ABC123`)
* **Display:** Status, submission details, next steps
* **Access:** Public (no login required)
* **Features:**
  * ID format validation
  * Real-time status display
  * Visual status indicators
  * Next steps guidance
  * Navigation to submit new requests

### 📦 Export & Archive System

Cost optimization feature for managing Firebase Storage:

* **Purpose:** Export cleared submission files and delete from storage to save costs
* **Functionality:**
  * ✅ Bulk export of cleared submissions as ZIP files
  * ✅ Individual submission download with custom naming: `(StudentName)SPUP_Clearance_YYYY_ABC123.zip`
  * ✅ Master ZIP creation: `SPUP_Clearance_Export_YYYY-MM-DD_X_submissions.zip`
  * ✅ Firebase Storage integration using SDK (CORS-free)
  * ✅ Metadata retention in Firestore with `isExported` and `exportedAt` fields
  * ✅ Automatic file deletion from storage after export
  * ✅ **Visual indicators in admin table for exported submissions**

### 🎨 Visual Export Indicators

✅ **Added visual flags for exported submissions:**

* **Desktop Table:** Green "Archived" badge with download icon next to status
* **Mobile Cards:** Stacked layout with status and archive indicator
* **Tooltip:** Shows export date on hover
* **Styling:** Green background (`bg-green-100 text-green-800`) for clear distinction
* **Icon:** Download arrow icon to represent archived/exported status

### 🔧 CORS Issue Resolution

✅ **Fixed Firebase Storage CORS blocking with native browser downloads:**

**Problem:** Firebase Storage was blocking programmatic `fetch()` requests due to CORS policy, even with signed URLs.

**Final Solution:** **Streamlined automatic individual downloads** with smart browser handling:
* ✅ **Individual Downloads:** Each submission downloads separately with proper student names
* ✅ **Student Name Format:** `(StudentName)SPUP_Clearance_YYYY_ABC123.zip`
* ✅ **CORS Bypass:** Uses native browser download mechanism with signed Firebase URLs
* ✅ **Smart Automation:** Automatic downloads with intelligent delays to prevent browser blocking
* ✅ **User Confirmation:** Preview all files before download with user consent
* ✅ **Progress Tracking:** Real-time progress display with current file being downloaded
* ✅ **Staggered Timing:** 1s delay after first download, 2s between subsequent downloads
* ✅ **Professional UX:** Single click initiates all downloads with clear feedback

**Technical Implementation:**
```typescript
// Streamlined bulk download with automatic intervals
export async function bulkExportSubmissions(submissions, options, onProgress) {
  // 1. Prepare all signed URLs first
  const downloadData = [];
  for (const submission of submissions) {
    const downloadURL = await getDownloadURL(fileRef);
    const fileName = `(${sanitizedName})${submission.id}.zip`;
    downloadData.push({ fileName, downloadURL });
  }

  // 2. Show preview and get user confirmation
  const userConfirm = confirm(`Ready to download ${downloadData.length} files:\n\n• ${fileList}`);
  
  // 3. Auto-download with smart delays
  for (let i = 0; i < downloadData.length; i++) {
    const link = document.createElement('a');
    link.href = downloadURL;
    link.download = fileName;
    link.click();
    
    onProgress(i + 1, total, fileName); // Update UI progress
    await delay(i === 0 ? 1000 : 2000); // Smart staggering
  }
}
```

**Final Resolution:** Firebase Storage CORS is fundamentally incompatible with programmatic client-side downloads. The optimal solution is intelligent individual downloads with browser-native mechanisms, proper delays, and excellent UX.

---
