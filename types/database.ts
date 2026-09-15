// Tipos hand-written que espelham supabase/migrations/*.sql.
// Se o schema mudar, atualize este arquivo (ou gere via `supabase gen types typescript`).

import type {
  ContractDetailType,
  ContractStatus,
  ContractType,
  PaymentFrequency,
  PaymentStatus,
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
          payment_frequency: PaymentFrequency;
          amount_cents: number;
          counterparty_cnpj: string | null;
          object_description: string | null;
          readjustment_index: ReadjustmentIndex | null;
          readjustment_period_months: number | null;
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
          payment_frequency?: PaymentFrequency;
          amount_cents: number;
          counterparty_cnpj?: string | null;
          object_description?: string | null;
          readjustment_index?: ReadjustmentIndex | null;
          readjustment_period_months?: number | null;
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
      contract_payments: {
        Row: {
          id: string;
          contract_id: string;
          due_date: string;
          amount_cents: number;
          status: PaymentStatus;
          paid_at: string | null;
          paid_amount_cents: number | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          contract_id: string;
          due_date: string;
          amount_cents: number;
          status?: PaymentStatus;
          paid_at?: string | null;
          paid_amount_cents?: number | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['contract_payments']['Insert']>;
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
