export const GROUPS_PAGE_SIZE = 10;
export const WA_STATUS_REFETCH_INTERVAL_MS = 5_000;
export const LOGS_REFETCH_INTERVAL_MS = 10_000;

export const GROUPS_UI_TEXT = {
  syncSuccess: "Groups synced",
  syncFallbackError: "Sync failed — is WhatsApp connected?",
  syncing: "Syncing…",
  syncButton: "Sync from WhatsApp",
  searchPlaceholder: "Search groups by name or JID...",
  loading: "Loading groups…",
  empty: "No groups yet — connect WhatsApp and sync groups.",
  emptyFiltered: "No groups match your search.",
  prev: "Prev",
  next: "Next",
  totalLabel: "Total groups"
} as const;

export const CONNECT_WHATSAPP_UI_TEXT = {
  connectedToast: "WhatsApp connected",
  loggedOutToast: "Logged out",
  disconnectedToast: "Disconnected",
  disconnectConfirm: "Disconnect WhatsApp? Stored credentials will be wiped.",
  waitingForScan: "Waiting for scan…",
  startQrSession: "Start QR session"
} as const;

export const RETRY_CENTER_UI_TEXT = {
  sentSuccess: "Message sent!",
  clearedSuccess: "Logs cleared from view",
  clearFailed: "Could not clear logs right now. Please try again.",
  clearing: "Clearing...",
  clearFromView: "Clear from view",
  loading: "Loading retry items…",
  empty: "No pending or failed messages right now.",
  sending: "Sending...",
  sendNow: "Send now"
} as const;

export const LOGS_UI_TEXT = {
  refresh: "↻ Refresh",
  loading: "Loading logs…",
  empty: "No logs yet.",
  openRetryCenter: "Open retry center"
} as const;

export const AUTH_UI_TEXT = {
  loginFailed: "Login failed",
  registrationFailed: "Registration failed",
  signingIn: "Signing in…",
  signIn: "Sign in",
  creatingWorkspace: "Creating…",
  createWorkspace: "Create workspace"
} as const;

export const SCHEDULE_FORM_UI_TEXT = {
  maxImagesError: "You can attach up to 5 images total",
  imagesOnlyError: "Only image files are allowed",
  saveSuccess: "Saved",
  saveFailed: "Save failed"
} as const;

export const SCHEDULES_LIST_UI_TEXT = {
  deleteSuccess: "Deleted",
  loading: "Loading schedules…",
  empty: "No schedules yet. Create your first one!",
  newSchedule: "+ New schedule",
  pause: "Pause",
  resume: "Resume",
  edit: "Edit",
  delete: "Delete",
  deleteConfirm: "Delete this schedule?"
} as const;
