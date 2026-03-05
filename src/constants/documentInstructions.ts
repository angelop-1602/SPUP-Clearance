import { Level } from "@/types";

export type InstructionApplicability = "all" | "undergrad" | "grad";

export interface DocumentInstruction {
  id: string;
  title: string;
  description: string;
  appliesTo: InstructionApplicability;
  optional?: boolean;
  itOnly?: boolean;
  conditional?: string;
}

export const DOCUMENT_INSTRUCTIONS: DocumentInstruction[] = [
  {
    id: "complete-manuscript",
    title:
      "Complete Thesis or Dissertation from preliminaries to appendices, including scanned Certificate of Approval or SPUP REC Ethics Clearance",
    description: "Preferred format: MS Word file.",
    appliesTo: "all",
  },
  {
    id: "long-abstract",
    title:
      "Long Abstract (for master's thesis or doctoral dissertation only)",
    description: "Preferred format: PDF file.",
    appliesTo: "grad",
    conditional: "Masters and doctoral submissions only",
  },
  {
    id: "undergrad-abstract",
    title: "Abstract",
    description: "Preferred format: PDF file.",
    appliesTo: "undergrad",
  },
  {
    id: "approval-sheet",
    title:
      "Scanned Approval Sheet with complete signatures and the final grade",
    description: "Preferred format: PDF or JPEG file.",
    appliesTo: "all",
  },
  {
    id: "developed-system",
    title: "Developed System/Website/Application/Software",
    description: "Submit system deliverables when applicable.",
    appliesTo: "all",
    itOnly: true,
  },
  {
    id: "journal-format",
    title: "Journal Format",
    description: "Preferred format: Word file.",
    appliesTo: "all",
    optional: true,
    conditional: "Submit if applicable and available",
  },
  {
    id: "photo-2x2",
    title: "2x2 high-definition picture",
    description:
      "Submit only if no graduation picture is available; if graduation picture is available, this is not needed.",
    appliesTo: "all",
    optional: true,
    conditional: "Only if graduation picture is unavailable",
  },
];

export function getDocumentInstructionsForLevel(
  level: Level
): DocumentInstruction[] {
  return DOCUMENT_INSTRUCTIONS.filter(
    (instruction) =>
      instruction.appliesTo === "all" || instruction.appliesTo === level
  );
}
