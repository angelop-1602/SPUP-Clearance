
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

* **Approval Sheet** - Any file format (No size limit)
* **Full Paper** - Any file format (No size limit)
  * Ethics clearance should be included in the appendix
* **Long Abstract** - Any file format (No size limit)  
* **Journal Format** - Any file format (No size limit)

#### ✅ Validation

* Required fields must be filled
* Each document must be:
  * Any file format accepted
  * No size limit restrictions

#### 🔁 On Submit

* Generate document ID: `SPUP_Clearance_2025_XXXXXX`
* Store student data in Firestore under `submissions`
* Create ZIP file containing all documents with standardized names:
  * `approval_sheet.{original_extension}`
  * `full_paper.{original_extension}` 
  * `long_abstract.{original_extension}`
  * `journal_format.{original_extension}`
* Upload ZIP file to Firebase Storage: `/submissions/{StudentName}_SPUP_Clearance_2025_XXXXXX.zip`
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
| 5    | ✅ Make Journal Format field not required              | Done |

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
- ✅ Individual download system with automatic storage cleanup
  - Individual document downloads with custom naming format: (StudentName)_SPUP_Clearance_2025_ABC123.zip
  - Automatic storage cleanup after each download to reduce costs
  - Firebase Storage integration for efficient file management
  - Admin table with EllipsisVertical dropdown for individual actions
  - Fully optimized Firestore queries to avoid ALL index requirements (simple equality filters with client-side sorting)
 - ✅ Safe download flow: prevent storage deletion when download fails; only delete after verified file fetch
 - ✅ Exported-file custom link: admins can set and open a custom export link after files are removed
 - ✅ Admins can remove an existing export link from a submission
 - ✅ Unified download logic: both AdminTable and SubmissionCard now use the same download + storage removal flow
 - ✅ Simplified download: removed unnecessary CORS fetch logic, now uses Firebase Storage URL directly
 - ✅ Made Journal Format field not required for student submissions
- ✅ Enhanced download error prevention: Added user confirmation dialog to verify successful download before file deletion from storage
- ✅ Enhanced admin functionality: Added "Mark as Cleared" button, edit submission capability, and replaced JS alerts with ShadCN dialogs
  - Added "Mark as Cleared" action button in admin dropdown menu
  - Created comprehensive edit submission dialog for modifying student details
  - Replaced JavaScript confirm() with professional ShadCN AlertDialog components
  - Added mobile-responsive action buttons with improved layout
- ✅ Fixed download functionality and added safety features
  - Enhanced download compatibility with multiple browser download methods
  - Added 5-second countdown timer to download confirmation dialog
  - Improved error handling and debugging for download issues
  - Added fallback methods (standard click, MouseEvent, window.open) for better browser compatibility
- ✅ Corrected download flow for better user experience
  - Download now happens immediately when clicking the download button
  - Confirmation dialog now only asks about storage deletion (not download initiation)
  - Clear separation: Download first, then confirm storage cleanup
  - Updated dialog text to clearly indicate it's for storage deletion confirmation
  - Maintains 5-second countdown for storage deletion safety
- ✅ Enhanced admin table performance and UX improvements
  - Implemented debounced search (500ms delay) to prevent excessive re-rendering on every keystroke
  - Fixed table responsiveness issues by optimizing state management and client-side filtering
  - Added status tabs (All, Pending, Cleared) with real-time counts for better navigation
  - Implemented pagination (10 items per page) with smart ellipsis for large datasets
  - Added student name truncation with hover tooltips for better space utilization
  - Improved responsive design: changed breakpoint from md to lg for better mobile experience
  - Enhanced table layout to prevent horizontal scrolling on smaller screens
  - Added useDebounce custom hook for reusable debouncing functionality
- ✅ Enhanced form functionality with Non-Thesis research type support
  - Added new "Non-Thesis" research type option to the system
  - Implemented conditional form fields based on research type selection
  - For Non-Thesis submissions: removed research adviser, research title, and group members fields
  - Added optional graduation picture upload specifically for Non-Thesis research type
  - Updated form validation logic to handle conditional required fields
  - Automatically clears research-related fields when switching to Non-Thesis
  - Updated Firebase service to handle graduation picture in ZIP file processing
  - Maintained backward compatibility with existing Thesis, Capstone, and Dissertation types
  - Enhanced TypeScript type safety with proper type assertions for new research type

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

### 📦 Individual Download System

Cost optimization feature for managing Firebase Storage:

* **Purpose:** Download individual submission files and automatically remove from storage to save costs
* **Functionality:**
  * ✅ Individual submission download with custom naming: `(StudentName)_SPUP_Clearance_YYYY_ABC123.zip`
  * ✅ Automatic storage cleanup after successful download
  * ✅ Firebase Storage integration using SDK (CORS-free)
  * ✅ Metadata retention in Firestore with `isExported` and `exportedAt` fields
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

### 🔧 Multi-Download Issue Resolution

✅ **Fixed bulk download problem when selecting all submissions:**

**Problem:** Bulk export was only downloading one file due to filename mismatch
**Root Cause:** Export service was using old filename format (`${submission.id}.zip`) instead of new format (`${studentName}_${submission.id}.zip`)
**Solution:** Updated both `bulkExportSubmissions` and `downloadSubmissionFile` functions to use new filename format
**Result:** Multi-download now works correctly for all selected submissions

**Files Updated:**
- `src/services/exportService.ts` - Simplified to individual download functionality
- `src/components/admin/AdminTable.tsx` - Added EllipsisVertical dropdown with View/Download actions
- `src/app/admin/page.tsx` - Removed Export & Archive button and ExportPanel
- `src/components/admin/ExportPanel.tsx` - **DELETED** (no longer needed)

### 🚀 EllipsisVertical Dropdown Menu System

✅ **Implemented ShadCN dropdown menu with EllipsisVertical icon:**

**New Approach:** Clean dropdown menu (⋮) for each submission with View and Download options
**Benefits:**
- **Professional UI:** Modern dropdown menu design using ShadCN components
- **Space Efficient:** Single icon button instead of multiple action buttons
- **Better UX:** Organized actions in a clean dropdown interface
- **Automatic Cleanup:** Files are removed from storage after download to save costs

**Technical Implementation:**
- **ShadCN Dropdown:** Uses @radix-ui/react-dropdown-menu for accessibility and styling
- **EllipsisVertical Icon:** Clean three-dot menu icon from Lucide React
- **Individual Actions:** View and Download options for each submission
- **Automatic Cleanup:** Files automatically removed from Firebase Storage after successful download

**Actions Available:**
- **View:** Shows submission details and metadata in an alert
- **Download:** Downloads file and automatically removes from storage (disabled for already downloaded files). Now validates file fetch before deletion to prevent data loss on errors. ✅
- **Mark All as Exported:** Bulk operation to clean up all files

**Smart Download Management:**
- **Download Button:** Automatically disabled once file is downloaded
- **Visual Feedback:** Shows "Already Downloaded" for exported submissions
- **Prevents Duplicates:** Users cannot attempt to download already exported files
- **Mobile Support:** Download buttons also disabled in mobile card view

**UI Components Added:**
- `src/components/ui/dropdown-menu.tsx` - ShadCN dropdown menu component
- Updated AdminTable with EllipsisVertical dropdown interface
- Removed Export & Archive button from main admin dashboard

---

## 📋 Tasking (Working List)

- [x] Add "Download as Folder" (auto-extract) support via JSZip + File System Access API
  - Added `downloadSubmissionAsFolder(submission)` in `src/services/exportService.ts`
  - Preserves folder hierarchy by writing files to a user-chosen directory
  - Requires Chromium browsers and Firebase Storage CORS for programmatic fetch
  
- [x] Temporarily hide “Download as Folder” in UI (feature gated)
  - Added `SHOW_FOLDER_DOWNLOAD = false` in `src/components/admin/AdminTable.tsx`
  - Dropdown item and mobile button are conditionally hidden

- [x] Auto-load submitted folder contents in View dialog
  - `SubmissionCard` now fetches and displays ZIP contents on open (no button)
  - Uses `/api/download-submission` proxy + JSZip to list files

- [x] Add individual file download buttons in View dialog
  - Per-file "Download" beside each entry in `SubmissionCard`
  - Generates file from ZIP entry and triggers browser save

- [x] Add delete button for submissions
  - Delete button added to SubmissionCard component
  - Delete button added to AdminTable dropdown menu
  - Deletes submission from Firestore and associated files from Firebase Storage
  - Includes confirmation dialog before deletion

- [x] Add column indicators for attached link and downloaded file
  - Added "File" column with FileDown icon (green if downloaded, gray if available)
  - Added "Link" column with Link2 icon (blue if link attached, dash if not)
  - Indicators also shown in mobile card view

- [x] Replace level, status, and course filters with research type filter
  - Removed level, status, and course filters from AdminTable
  - Added research type filter with options: All, Thesis, Capstone, Dissertation, Non-Thesis
  - Updated FilterOptions interface to only include researchType and searchTerm
  - Updated getAllSubmissions function to filter by research type
  - Status filtering still works via tabs (All, Pending, Cleared)

