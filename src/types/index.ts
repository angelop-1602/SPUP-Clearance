export interface Student {
  id: string; // SPUP_Clearance_2025_XYZ123
  level: "undergrad" | "grad";
  name: string;
  email: string;
  studentId: string;
  adviser: string;
  course: string;
  graduationMonth: string;
  graduationYear: string;
  researchTitle: string;
  researchType: "Thesis" | "Capstone" | "Dissertation";
  groupMembers?: GroupMember[];
  zipFile: string; // URL of ZIP file containing all documents
  status: "Submitted" | "Cleared";
  submittedAt: Date;
  isExported?: boolean; // Flag to indicate if files have been exported and removed from storage
  exportedAt?: Date; // When the files were exported
  exportLink?: string; // Optional custom link provided after export
}

export interface GroupMember {
  name: string;
  studentID: string;
}

export type Level = 'undergrad' | 'grad';
export type ResearchType = 'Thesis' | 'Capstone' | 'Dissertation';

export interface StudentFormData {
  level: Level;
  name: string;
  email: string;
  studentId: string;
  adviser: string;
  course: string;
  graduationMonth: string;
  graduationYear: string;
  researchTitle: string;
  researchType: ResearchType;
  groupMembers: GroupMember[];
  documents: {
    approvalSheet: File | null;
    fullPaper: File | null;
    longAbstract: File | null;
    journalFormat: File | null;
  };
}

export interface AdminUser {
  email: string;
  uid: string;
}

export interface FilterOptions {
  level?: "undergrad" | "grad" | "all";
  status?: "Submitted" | "Cleared" | "all";
  course?: string;
  searchTerm?: string;
}

export interface RequiredDocument {
  key: 'approvalSheet' | 'fullPaper' | 'longAbstract' | 'journalFormat';
  label: string;
  accept: string;
  description?: string;
}

export const REQUIRED_DOCUMENTS: RequiredDocument[] = [
  {
    key: 'approvalSheet',
    label: 'Approval Sheet',
    accept: '.pdf',
    description: 'PDF format only'
  },
  {
    key: 'fullPaper',
    label: 'Full Paper',
    accept: '.docx',
    description: 'DOCX format only. Ethics clearance should be included in the appendix.'
  },
  {
    key: 'longAbstract',
    label: 'Long Abstract',
    accept: '.docx',
    description: 'DOCX format only'
  },
  {
    key: 'journalFormat',
    label: 'Journal Format',
    accept: '.docx',
    description: 'DOCX format only'
  }
]; 