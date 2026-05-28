export type QueryValue = string | number | boolean | null | undefined;

export interface Company {
  id: number;
  name: string;
  ruc: string;
  industry: string;
  created_at: string;
  updated_at: string;
}

export interface Standard {
  id: number;
  code: string;
  name: string;
  description: string;
  version: string;
  country: string;
  is_active: boolean;
  requirement_count: number;
  created_at: string;
  updated_at: string;
}

export interface StandardRequirement {
  id: number;
  standard: number;
  clause: string;
  title: string;
  requirement_text: string;
  process_area: string;
  criticality: string;
  expected_documents: string[];
  expected_evidence: string[];
  verification_questions: string[];
  requires_real_evidence: boolean;
  required_document_type: string;
  required_evidence_type: string;
  sequence: number;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: number;
  company: number;
  company_name: string;
  standard: number;
  standard_name: string;
  name: string;
  scope: string;
  status: string;
  start_date: string | null;
  target_date: string | null;
  checklist_items_count: number;
  created_at: string;
  updated_at: string;
}

export interface ChecklistItem {
  id: number;
  project: number;
  project_name: string;
  requirement: number;
  requirement_title: string;
  clause: string;
  process_area: string;
  criticality: string;
  title: string;
  description: string;
  status: string;
  progress_percentage: number;
  required_document_type: string;
  required_evidence_type: string;
  requires_real_evidence: boolean;
  assigned_to: number | null;
  due_date: string | null;
  is_not_applicable: boolean;
  not_applicable_justification: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentRecord {
  id: number;
  project: number | null;
  project_name: string;
  is_reference: boolean;
  requirement: number | null;
  requirement_title: string;
  checklist_item: number | null;
  checklist_item_title: string;
  title: string;
  document_type: string;
  file: string;
  file_name: string;
  file_extension: string;
  status: string;
  uploaded_by: number | null;
  uploaded_at: string;
  extracted_text: string;
  extracted_metadata: Record<string, unknown>;
  chunk_count: number;
  processing_error: string;
  created_at: string;
  updated_at: string;
}

export interface RequirementEvaluation {
  id: number;
  document_review: number;
  requirement: number;
  requirement_title: string;
  clause: string;
  process_area: string;
  status: string;
  evidence_found: string;
  gap: string;
  risk_level: string;
  recommendation: string;
  suggested_text: string;
  can_close_requirement: boolean;
  requires_real_evidence: boolean;
  missing_documents_or_evidence: string[];
  created_at: string;
  updated_at: string;
}

export interface Finding {
  id: number;
  project: number;
  document_review: number;
  requirement: number | null;
  requirement_title: string;
  finding_type: string;
  description: string;
  risk_level: string;
  root_cause_suggestion: string;
  recommended_action: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentReview {
  id: number;
  document: number;
  document_title: string;
  project: number;
  project_name: string;
  standard: number;
  standard_name: string;
  review_type: string;
  overall_status: string;
  risk_level: string;
  summary: string;
  prompt_version: string;
  system_prompt_used: string;
  user_prompt_used: string;
  raw_response: Record<string, unknown>;
  retrieved_context: Record<string, unknown>;
  ai_model_used: string;
  created_by: number | null;
  requirement_evaluations: RequirementEvaluation[];
  findings: Finding[];
  created_at: string;
  updated_at: string;
}

export interface ActionPlan {
  id: number;
  project: number;
  project_name: string;
  finding: number | null;
  finding_type: string;
  requirement: number | null;
  requirement_title: string;
  clause: string;
  checklist_item: number | null;
  checklist_item_title: string;
  title: string;
  description: string;
  recommended_action: string;
  risk_level: string;
  status: string;
  owner: number | null;
  due_date: string | null;
  completion_notes: string;
  resolved_at: string | null;
  closed_at: string | null;
  is_auto_generated: boolean;
  created_by: number | null;
  evidence_count: number;
  validated_evidence_count: number;
  activity_count: number;
  latest_activity_on: string | null;
  created_at: string;
  updated_at: string;
}

export interface ImplementationActivity {
  id: number;
  project: number;
  project_name: string;
  action_plan: number | null;
  action_plan_title: string;
  requirement: number | null;
  requirement_title: string;
  clause: string;
  checklist_item: number | null;
  checklist_item_title: string;
  activity_type: string;
  title: string;
  notes: string;
  happened_on: string;
  next_follow_up_on: string | null;
  created_by: number | null;
  created_by_username: string;
  created_at: string;
  updated_at: string;
}

export interface EvidenceRecord {
  id: number;
  project: number;
  project_name: string;
  action_plan: number | null;
  action_plan_title: string;
  finding: number | null;
  requirement: number | null;
  requirement_title: string;
  clause: string;
  checklist_item: number | null;
  checklist_item_title: string;
  document: number | null;
  document_title: string;
  title: string;
  description: string;
  evidence_type: string;
  file: string;
  file_name: string;
  file_extension: string;
  status: string;
  occurred_on: string | null;
  validation_notes: string;
  uploaded_by: number | null;
  validated_by: number | null;
  uploaded_at: string;
  validated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkLogEntry {
  id: number;
  project: number;
  project_name: string;
  action_plan: number | null;
  action_plan_title: string;
  consultant: number;
  consultant_username: string;
  work_date: string;
  activity_type: string;
  title: string;
  summary: string;
  deliverables: string;
  start_time: string | null;
  end_time: string | null;
  logged_hours: string;
  billable_hours: string;
  approved_hours: string;
  status: string;
  review_notes: string;
  approved_by: number | null;
  approved_by_username: string;
  approved_at: string | null;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface AppUser {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_staff: boolean;
  is_active: boolean;
  date_joined: string;
  last_login: string | null;
}

export interface DashboardData {
  companies: Company[];
  projects: Project[];
  standards: Standard[];
  checklistItems: ChecklistItem[];
  documents: DocumentRecord[];
  reviews: DocumentReview[];
  findings: Finding[];
  actionPlans: ActionPlan[];
  evidences: EvidenceRecord[];
  worklogs: WorkLogEntry[];
  errors: string[];
}

export interface ProjectWorkspace {
  project: Project | null;
  standard: Standard | null;
  requirements: StandardRequirement[];
  checklistItems: ChecklistItem[];
  documents: DocumentRecord[];
  reviews: DocumentReview[];
  findings: Finding[];
  actionPlans: ActionPlan[];
  implementationActivities: ImplementationActivity[];
  evidences: EvidenceRecord[];
  worklogs: WorkLogEntry[];
  errors: string[];
}
