export type ConversationState =
  | "idle"
  | "listening"
  | "transcribing"
  | "generating"
  | "speaking"
  | "interrupted"
  | "recovering"
  | "error";

export type Role = "user" | "assistant" | "system";

export type ChatMessage = {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
  /** Response epoch that produced this message (assistant only) */
  epoch?: number;
  cancelled?: boolean;
};

export type TurnMetrics = {
  turnId: string;
  epoch: number;
  tStart: number;
  tFirstTranscription?: number;
  tFirstToken?: number;
  tFirstAudio?: number;
  tEnd?: number;
  tCancelRequested?: number;
  tCancelCompleted?: number;
  cancelled: boolean;
};

export type IdentityProfile = {
  displayName: string;
  /** Always true for synthetic personas */
  synthetic: true;
  likenessAuthorized: boolean;
  voiceCloneAuthorized: boolean;
  disclaimer: string;
};

export type CapabilityFlags = {
  demoMode: boolean;
  llmConfigured: boolean;
  sttAvailable: boolean;
  ttsAvailable: boolean;
  lipSyncAvailable: boolean;
  sessionLogging: boolean;
};

export type DialogueChunk = {
  type: "token" | "done" | "error";
  text?: string;
  error?: string;
  epoch: number;
};
