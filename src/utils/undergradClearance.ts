import { GroupMember, Student } from "@/types";

export type UndergradParticipantKey = "leader" | `member:${number}`;

export interface UndergradParticipant {
  key: UndergradParticipantKey;
  role: "leader" | "member";
  name: string;
  studentId: string;
  isCleared: boolean;
}

export interface UndergradClearanceState {
  leaderCleared: boolean;
  groupMembers: GroupMember[];
  participants: UndergradParticipant[];
  clearedCount: number;
  totalCount: number;
  allCleared: boolean;
  status: Student["status"];
}

type UndergradSubmissionLike = Pick<
  Student,
  "level" | "status" | "name" | "studentId" | "groupMembers" | "leaderCleared"
>;

function toSafeGroupMembers(groupMembers: GroupMember[] | undefined): GroupMember[] {
  return (groupMembers ?? []).map((member) => ({
    name: member?.name ?? "",
    studentID: member?.studentID ?? "",
    isCleared: member?.isCleared,
  }));
}

function getFallbackClearState(status: Student["status"]): boolean {
  return status === "Cleared";
}

function deriveStatusFromParticipants(participants: UndergradParticipant[]): Student["status"] {
  if (participants.length === 0) return "Submitted";
  return participants.every((participant) => participant.isCleared)
    ? "Cleared"
    : "Submitted";
}

function parseMemberIndex(participantKey: UndergradParticipantKey): number | null {
  if (participantKey === "leader") return null;
  const [, indexPart] = participantKey.split(":");
  const parsed = Number.parseInt(indexPart, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function getUndergradClearanceState(
  submission: UndergradSubmissionLike
): UndergradClearanceState {
  const fallbackClearState = getFallbackClearState(submission.status);
  const leaderCleared =
    typeof submission.leaderCleared === "boolean"
      ? submission.leaderCleared
      : fallbackClearState;

  const groupMembers = toSafeGroupMembers(submission.groupMembers).map((member) => ({
    ...member,
    isCleared:
      typeof member.isCleared === "boolean" ? member.isCleared : fallbackClearState,
  }));

  const participants: UndergradParticipant[] = [
    {
      key: "leader",
      role: "leader",
      name: submission.name || "Leader",
      studentId: submission.studentId || "N/A",
      isCleared: leaderCleared,
    },
    ...groupMembers.map((member, index) => ({
      key: `member:${index}` as const,
      role: "member" as const,
      name: member.name || `Member ${index + 1}`,
      studentId: member.studentID || "N/A",
      isCleared: Boolean(member.isCleared),
    })),
  ];

  const status = deriveStatusFromParticipants(participants);
  const clearedCount = participants.filter((participant) => participant.isCleared).length;
  const totalCount = participants.length;

  return {
    leaderCleared,
    groupMembers,
    participants,
    clearedCount,
    totalCount,
    allCleared: status === "Cleared",
    status,
  };
}

export function updateUndergradParticipantState(
  submission: UndergradSubmissionLike,
  participantKey: UndergradParticipantKey,
  isCleared: boolean
): UndergradClearanceState {
  const currentState = getUndergradClearanceState(submission);

  if (participantKey === "leader") {
    return getUndergradClearanceState({
      ...submission,
      leaderCleared: isCleared,
      groupMembers: currentState.groupMembers,
      status: currentState.status,
    });
  }

  const memberIndex = parseMemberIndex(participantKey);
  if (memberIndex === null || memberIndex >= currentState.groupMembers.length) {
    throw new Error("Invalid undergrad participant key.");
  }

  const nextMembers = currentState.groupMembers.map((member, index) =>
    index === memberIndex ? { ...member, isCleared } : member
  );

  return getUndergradClearanceState({
    ...submission,
    leaderCleared: currentState.leaderCleared,
    groupMembers: nextMembers,
    status: currentState.status,
  });
}

export function setUndergradAllParticipantsState(
  submission: UndergradSubmissionLike,
  isCleared: boolean
): UndergradClearanceState {
  const currentState = getUndergradClearanceState(submission);
  const nextMembers = currentState.groupMembers.map((member) => ({
    ...member,
    isCleared,
  }));

  return getUndergradClearanceState({
    ...submission,
    leaderCleared: isCleared,
    groupMembers: nextMembers,
    status: currentState.status,
  });
}
