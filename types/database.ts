// Tipos hand-written que espelham supabase/migrations/*.sql.
// Se o schema mudar, atualize este arquivo (ou gere via `supabase gen types typescript`).

import type {
  ContractDetailType,
  ContractStatus,
  ContractType,
  ReadjustmentIndex,
  RenewalType,
  Role,
} from './domain';
import type { ExtractedHighlights } from '@/lib/pdf-extract';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          role: Role;
          created_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          role?: Role;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
        Relationships: [];
      };
      contracts: {
        Row: {
          id: string;
          title: string;
          counterparty: string;
          contract_type: ContractType;
          contract_detail_type: ContractDetailType | null;
          status: ContractStatus;
          start_date: string;
          end_date: string | null;
          renewal_type: RenewalType;
          renewal_notice_days: number;
          total_amount_cents: number;
          counterparty_cnpj: string | null;
          readjustment_index: ReadjustmentIndex | null;
          readjustment_period_months: number | null;
          has_distrato: boolean;
          distrato_file_path: string | null;
          representative_name: string | null;
          contact_email: string | null;
          contact_phone: string | null;
          internal_code: string | null;
          department: string | null;
          internal_manager_id: string | null;
          signature_date: string | null;
          termination_reason: string | null;
          jurisdiction_forum: string | null;
          confidentiality_period_months: number | null;
          approved_by: string | null;
          alert_emails: string | null;
          file_path: string | null;
          notes: string | null;
          extracted_highlights: ExtractedHighlights | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          counterparty: string;
          contract_type?: ContractType;
          contract_detail_type?: ContractDetailType | null;
          status?: ContractStatus;
          start_date: string;
          end_date?: string | null;
          renewal_type?: RenewalType;
          renewal_notice_days?: number;
          total_amount_cents: number;
          counterparty_cnpj?: string | null;
          readjustment_index?: ReadjustmentIndex | null;
          readjustment_period_months?: number | null;
          has_distrato?: boolean;
          distrato_file_path?: string | null;
          representative_name?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          internal_code?: string | null;
          department?: string | null;
          internal_manager_id?: string | null;
          signature_date?: string | null;
          termination_reason?: string | null;
          jurisdiction_forum?: string | null;
          confidentiality_period_months?: number | null;
          approved_by?: string | null;
          alert_emails?: string | null;
          file_path?: string | null;
          notes?: string | null;
          extracted_highlights?: ExtractedHighlights | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['contracts']['Insert']>;
        Relationships: [];
      };
      contract_amendments: {
        Row: {
          id: string;
          contract_id: string;
          description: string;
          amendment_date: string;
          file_path: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          contract_id: string;
          description: string;
          amendment_date: string;
          file_path?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['contract_amendments']['Insert']>;
        Relationships: [];
      };
      contract_status_history: {
        Row: {
          id: string;
          contract_id: string;
          old_status: ContractStatus | null;
          new_status: ContractStatus;
          changed_by: string | null;
          changed_at: string;
        };
        Insert: {
          id?: string;
          contract_id: string;
          old_status?: ContractStatus | null;
          new_status: ContractStatus;
          changed_by?: string | null;
          changed_at?: string;
        };
        Update: Partial<Database['public']['Tables']['contract_status_history']['Insert']>;
        Relationships: [];
      };
    };
    Views: {
      contracts_expiring: {
        Row: Database['public']['Tables']['contracts']['Row'] & {
          days_until_expiration: number;
        };
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
  };
}
