import { ResearchType } from "@/types";

export const LEGACY_NON_THESIS: ResearchType = "Non-Thesis";
export const NOT_APPLICABLE: ResearchType = "Not Applicable";

export function isNotApplicableResearchType(
  researchType?: string | null
): boolean {
  return researchType === NOT_APPLICABLE || researchType === LEGACY_NON_THESIS;
}

export function getResearchTypeLabel(researchType?: string | null): string {
  if (!researchType) return "N/A";
  return isNotApplicableResearchType(researchType)
    ? NOT_APPLICABLE
    : researchType;
}

export function normalizeResearchType(
  researchType: ResearchType | string
): ResearchType {
  return isNotApplicableResearchType(researchType)
    ? NOT_APPLICABLE
    : (researchType as ResearchType);
}

export function matchesResearchTypeFilter(
  submissionResearchType: string | undefined,
  filterResearchType: string | undefined
): boolean {
  if (!filterResearchType || filterResearchType === "all") return true;

  if (isNotApplicableResearchType(filterResearchType)) {
    return isNotApplicableResearchType(submissionResearchType);
  }

  return submissionResearchType === filterResearchType;
}
