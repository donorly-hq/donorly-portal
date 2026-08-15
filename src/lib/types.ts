export interface AuthSession {
  token: string;
  userId: string;
  fullName: string;
  platformAdmin: boolean;
  organizationId: string | null;
  organizationName: string | null;
  organizationPrimaryColor: string | null;
  /** Resolved logo URL path (`/api/organizations/{id}/logo`) or external/GCS URL — never base64 */
  organizationLogo: string | null;
  roleCode: string | null;
  permissions: string[];
}

/** One organization a user belongs to — login picker and topbar switcher. */
export interface OrgChoice {
  organizationId: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  primaryColor: string | null;
  roleCode: string | null;
  roleName: string | null;
}

/**
 * Login can complete immediately, require an emailed one-time code, or require
 * picking one of the user's organizations.
 */
export interface LoginResponse extends AuthSession {
  otpRequired?: boolean;
  challengeId?: string | null;
  orgSelectionRequired?: boolean;
  organizations?: OrgChoice[] | null;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  vertical: string;
  status: "trial" | "active" | "suspended" | "cancelled";
  timezone: string;
  logoUrl: string | null;
  hasLogo: boolean;
  primaryColor: string | null;
  createdAt: string;
  ownerId: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
}

/** Platform org list — same shape as Organization (no logo payload). */
/** Envelope returned by paginated list endpoints (when `page` query param is set). */
export interface PageResponse<T> {
  items: T[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
}

export interface DonorImportRow {
  fullName: string;
  email?: string;
  phone?: string;
  city?: string;
  donorType?: string;
}

export interface DonorImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

export interface DuplicateGroup {
  reason: string;
  donors: Donor[];
}

export interface YearEndPaymentLine {
  date: string;
  amount: number;
  method: string | null;
  receiptNumber: string | null;
}

export interface YearEndDonorStatement {
  donorId: string;
  donorName: string;
  email: string | null;
  city: string | null;
  totalGiven: number;
  payments: YearEndPaymentLine[];
}

export interface YearEndStatementResponse {
  year: number;
  statements: YearEndDonorStatement[];
}

export interface QuickPledgeResponse {
  pledgeId: string;
  donorId: string;
  donorName: string;
  amount: number;
  newDonor: boolean;
}

export interface CampaignLiveRecentPledge {
  donorName: string;
  amount: number;
  createdAt: string;
}

export interface CampaignLive {
  campaignId: string;
  name: string;
  goalAmount: number;
  pledged: number;
  collected: number;
  pledgeCount: number;
  recentPledges: CampaignLiveRecentPledge[];
}

/** Anonymized live tally from the public (unauthenticated) endpoint. */
export interface PublicThermometer {
  organizationName: string;
  campaignName: string;
  goalAmount: number;
  pledged: number;
  collected: number;
  pledgeCount: number;
  recentPledges: CampaignLiveRecentPledge[];
}

export interface PublicCheckinInfo {
  eventName: string;
  eventLocation: string | null;
  eventStartsAt: string | null;
  guestName: string;
  partySize: number;
  status: string;
  checkedInAt: string | null;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  actorUserId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  createdAt: string;
}

/** Per-tenant usage snapshot for the platform admin console. */
export interface OrgUsageMetrics {
  organizationId: string;
  activeMembers: number;
  donorCount: number;
  activeCampaigns: number;
  pledgeCount: number;
  totalPledged: number;
  totalCollected: number;
  lastActivityAt: string | null;
}

export interface MeResponse {
  userId: string;
  fullName: string;
  platformAdmin: boolean;
  organizationId: string | null;
  organizationName: string | null;
  organizationPrimaryColor: string | null;
  organizationLogo: string | null;
  roleCode: string | null;
  permissions: string[];
}

export interface OrganizationRequest {
  name: string;
  slug: string;
  vertical: string;
  timezone: string;
  logoUrl?: string;
  logoData?: string;
  primaryColor?: string;
  // owner (only used on create)
  ownerName?: string;
  ownerEmail?: string;
}

export interface OrgMemberSummary {
  userId: string;
  fullName: string;
  email: string;
  roleCode: string | null;
  roleName: string | null;
  status: string;
}

export interface Donor {
  id: string;
  organizationId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  donorType: string;
  status: string;
  lifetimeGiving: number;
  createdAt: string;
  updatedAt: string;
}

export interface Campaign {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  campaignType: string;
  goalAmount: number;
  startDate: string | null;
  endDate: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface Pledge {
  id: string;
  organizationId: string;
  campaignId: string;
  donorId: string;
  amount: number;
  collectedAmount: number;
  frequency: string;
  paymentMethod: string | null;
  status: string;
  source: string | null;
  notes: string | null;
  lastReminderAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FollowUp {
  id: string;
  organizationId: string;
  donorId: string;
  campaignId: string | null;
  assignedToUserId: string | null;
  dueAt: string | null;
  status: string;
  outcome: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrgDashboard {
  totalDonors: number;
  totalCampaigns: number;
  totalPledged: number;
  totalCollected: number;
  remaining: number;
  openFollowUps: number;
  outstandingPledges: number;
  campaigns: {
    id: string;
    name: string;
    status: string;
    goalAmount: number;
    pledged: number;
    collected: number;
    endDate: string | null;
  }[];
  recentPayments: {
    id: string;
    donorName: string;
    amount: number;
    paymentMethod: string | null;
    paymentDate: string;
  }[];
  dueFollowUps: {
    id: string;
    donorId: string;
    donorName: string;
    dueAt: string | null;
    notes: string | null;
  }[];
}

export interface SetupProgressItem {
  key: string;
  title: string;
  description: string;
  complete: boolean;
  ctaLabel: string | null;
  ctaRoute: string | null;
}

export interface SetupProgress {
  percent: number;
  completedCount: number;
  totalCount: number;
  items: SetupProgressItem[];
}

export interface SuggestedReminder {
  pledgeId: string;
  donorId: string;
  donorName: string;
  donorEmail: string;
  campaignName: string;
  amount: number;
  collected: number;
  outstanding: number;
  lastReminderAt: string | null;
  pledgedAt: string;
  emailSubject: string;
  emailBody: string;
}

export interface Suggestion {
  key: string;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  actionLabel: string | null;
  actionRoute: string | null;
}

export interface PlatformOrgOverview {
  id: string;
  name: string;
  slug: string;
  vertical: string;
  status: string;
  primaryColor: string | null;
  hasLogo: boolean;
  setupPercent: number;
  activeMembers: number;
  donorCount: number;
  activeCampaigns: number;
  goalTotal: number;
  pledgedTotal: number;
  collectedTotal: number;
}

export interface CampaignManagerDashboard {
  managedCampaigns: {
    id: string; name: string; campaignType: string; status: string;
    goalAmount: number; pledged: number; collected: number;
    startDate: string | null; endDate: string | null;
  }[];
  totalManagedCampaigns: number;
  myAmbassadors: { userId: string; fullName: string; email: string; memberStatus: string }[];
  totalDonors: number;
  openFollowUps: number;
  pledgeCount: number;
  totalPledged: number;
  totalCollected: number;
  outstanding: number;
}

export interface AmbassadorDashboard {
  assignedDonors: number;
  openFollowUps: number;
  totalFollowUps: number;
  completedFollowUps: number;
  pledgeCount: number;
  totalPledged: number;
  totalCollected: number;
  outstanding: number;
  upcomingEvents: {
    id: string; name: string; location: string | null;
    eventType: string; status: string; startsAt: string | null; endsAt: string | null;
  }[];
  upcomingTownhalls: {
    id: string; personName: string; address: string | null;
    eventDate: string | null; eventTime: string | null; durationMinutes: number | null;
  }[];
  activeCampaigns: {
    id: string; name: string; campaignType: string; status: string;
    goalAmount: number; startDate: string | null; endDate: string | null;
  }[];
}

export interface CampaignDashboard {
  campaignId: string;
  name: string;
  goalAmount: number;
  pledged: number;
  collected: number;
  remaining: number;
  pledgeCount: number;
}

// ---- Phase 2: Team & roles -------------------------------------------

export interface InventoryUnit {
  unitNumber: number;
  assignmentId: string | null;
  holderUserId: string | null;
  holderName: string | null;
  assignedAt: string | null;
  expectedReturnDate: string | null;
  daysHeld: number;
  overdue: boolean;
  notes: string | null;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: string | null;
  quantity: number;
  notes: string | null;
  unitsOut: number;
  unitsOverdue: number;
  units: InventoryUnit[];
}

export interface TeamMember {
  membershipId: string;
  userId: string;
  fullName: string;
  email: string;
  roleCode: string | null;
  roleName: string | null;
  status: string;
  lastLoginAt: string | null;
}

export interface RoleOption {
  code: string;
  name: string;
}

export interface Invitation {
  id: string;
  email: string;
  roleCode: string | null;
  roleName: string | null;
  status: string;
  expiresAt: string;
  createdAt: string;
  inviteToken: string | null;
}

export interface InvitationInfo {
  organizationName: string | null;
  email: string | null;
  roleName: string | null;
  valid: boolean;
  existingUser: boolean;
}

export interface Assignment {
  id: string;
  donorId: string;
  donorName: string | null;
  ambassadorUserId: string;
  ambassadorName: string | null;
  campaignId: string | null;
  status: string;
  createdAt: string;
}

// ---- Phase 4: Events & volunteers ------------------------------------

export interface EventItem {
  id: string;
  organizationId: string;
  campaignId: string | null;
  name: string;
  description: string | null;
  eventType: string;
  location: string | null;
  startsAt: string | null;
  endsAt: string | null;
  capacity: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface EventSummary {
  eventId: string;
  name: string;
  status: string;
  capacity: number | null;
  registrationCount: number;
  checkedInCount: number;
  totalGuests: number;
  shiftCount: number;
  volunteerSlots: number;
  volunteerFilled: number;
}

export interface EventRegistration {
  id: string;
  organizationId: string;
  eventId: string;
  donorId: string | null;
  guestName: string;
  guestEmail: string | null;
  guestPhone: string | null;
  partySize: number;
  status: string;
  checkInCode: string;
  checkedInAt: string | null;
  notes: string | null;
}

export interface VolunteerAssignment {
  id: string;
  shiftId: string;
  userId: string;
  userName: string | null;
  status: string;
  checkedInAt: string | null;
}

export interface VolunteerShift {
  id: string;
  eventId: string;
  title: string;
  description: string | null;
  startsAt: string | null;
  endsAt: string | null;
  slots: number;
  filled: number;
  status: string;
  assignments: VolunteerAssignment[];
}

export interface Townhall {
  id: string;
  organizationId: string;
  personName: string;
  phone: string | null;
  venue: string | null;
  address: string | null;
  eventDate: string | null;
  eventTime: string | null;
  durationMinutes: number | null;
  hostAmbassadorUserId: string | null;
  expectedRsvps: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MyShift {
  assignmentId: string;
  status: string;
  checkedInAt: string | null;
  shiftId: string;
  shiftTitle: string;
  shiftStartsAt: string | null;
  eventId: string;
  eventName: string | null;
  eventLocation: string | null;
}

export interface MessageTemplate {
  id: string;
  organizationId: string;
  name: string;
  channel: "email" | "sms";
  subject: string | null;
  body: string;
  system: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CommunicationMessage {
  id: string;
  channel: string;
  recipient: string;
  donorId: string | null;
  donorName: string | null;
  templateId: string | null;
  templateName: string | null;
  subject: string | null;
  body: string;
  status: string;
  errorMessage: string | null;
  sentAt: string | null;
  createdAt: string;
}

export interface SendResult {
  sent: number;
  skipped: number;
  failed: number;
}

// ---- Phase 6: AI & Insights ------------------------------------------

export interface AiInsight {
  id: string;
  organizationId: string;
  entityType: "donor" | "campaign" | "org";
  entityId: string | null;
  insight: string;
  model: string | null;
  generatedBy: string | null;
  createdAt: string;
}

export interface AiConversation {
  id: string;
  organizationId: string;
  userId: string;
  question: string;
  answer: string | null;
  status: "pending" | "answered" | "failed";
  model: string | null;
  createdAt: string;
}

export interface AiSettings {
  enabled: boolean;
}

// ---- Phase 3: Donor 360 & Finance ------------------------------------

export interface DonorProfile {
  donorId: string;
  occupation: string | null;
  employer: string | null;
  preferredLanguage: string | null;
  preferredChannel: string | null;
  notesPrivate: string | null;
}

export interface DonorTag {
  id: string;
  name: string;
  color: string | null;
}

export interface DonorNote {
  id: string;
  donorId: string;
  noteText: string;
  noteType: string | null;
  visibility: string;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: string;
}

export interface DonorDetail {
  donor: Donor;
  profile: DonorProfile;
  tags: DonorTag[];
  notes: DonorNote[];
  pledges: Pledge[];
  followUps: FollowUp[];
  assignments: Assignment[];
  payments: PaymentRecord[];
  pledgeCards: PledgeCard[];
}

export interface PledgeCard {
  id: string;
  campaignId: string | null;
  campaignName: string | null;
  donorId: string | null;
  donorName: string | null;
  imageUrl: string | null;
  amount: number;
  paymentMethod: string | null;
  notes: string | null;
  verificationStatus: string;
  createdBy: string | null;
  createdAt: string;
}

/** AI-suggested field values read from a pledge card photo (POST /pledge-cards/scan). */
export interface PledgeCardScan {
  donorFullName: string | null;
  donorEmail: string | null;
  donorPhone: string | null;
  donorCity: string | null;
  donorType: string | null;
  amount: number | null;
  paymentMethod: string | null;
  campaignId: string | null;
  campaignName: string | null;
  matchedDonorId: string | null;
  matchedDonorName: string | null;
  notes: string | null;
  extractedJson: string;
}

export interface PaymentRecord {
  id: string;
  pledgeId: string;
  donorId: string;
  donorName: string | null;
  amount: number;
  paymentMethod: string | null;
  paymentDate: string;
  reference: string | null;
  notes: string | null;
  recordedBy: string | null;
  createdAt: string;
  receipt: Receipt | null;
}

export interface Receipt {
  id: string;
  paymentId: string;
  receiptNumber: string;
  issuedTo: string;
  amount: number;
  issuedAt: string;
}

export interface FundraisingReport {
  totalDonors: number;
  activeCampaigns: number;
  totalPledged: number;
  totalCollected: number;
  outstanding: number;
  totalPledges: number;
  fulfilledPledges: number;
  openFollowUps: number;
  paymentsThisMonth: number;
  collectedThisMonth: number;
}
