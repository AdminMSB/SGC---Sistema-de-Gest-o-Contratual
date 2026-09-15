'use client';

import { useRef, useState } from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  CONTRACT_DETAIL_TYPE_LABELS,
  CONTRACT_TYPE_LABELS,
  READJUSTMENT_INDEX_LABELS,
  type ContractDetailType,
  type ContractType,
  type ReadjustmentIndex,
  type RenewalType,
} from '@/types/domain';
import { createContract, updateContract } from './actions';

const CONTRACT_TYPE_ENTRIES = Object.entries(CONTRACT_TYPE_LABELS) as [ContractType, string][];
const CONTRACT_DETAIL_TYPE_ENTRIES = Object.entries(CONTRACT_DETAIL_TYPE_LABELS) as [
  ContractDetailType,
  string,
][];
const READJUSTMENT_INDEX_ENTRIES = Object.entries(READJUSTMENT_INDEX_LABELS) as [ReadjustmentIndex, string][];

export interface ManagerOption {
  id: string;
  full_name: string;
}

export interface ContractDefaults {
  id: string;
  title: string;
  contract_type: ContractType;
  contract_detail_type: ContractDetailType | null;
  start_date: string;
  end_date: string | null;
  renewal_type: RenewalType;
  renewal_notice_days: number;
  total_amount_cents: number;
  counterparty_cnpj: string | null;
  readjustment_index: ReadjustmentIndex | null;
  readjustment_period_months: number | null;
  has_distrato: boolean;
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
  notes: string | null;
  file_path: string | null;
  distrato_file_path: string | null;
}

interface ContratoFormProps {
  mode: 'create' | 'edit';
  contract?: ContractDefaults;
  managers: ManagerOption[];
  triggerLabel?: string;
  triggerVariant?: ButtonProps['variant'];
}

function centsToAmountText(cents: number | null | undefined): string {
  if (cents == null) return '';
  return (cents / 100).toFixed(2).replace('.', ',');
}

function CheckboxField({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label htmlFor={id} className="flex items-center gap-2 text-sm">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-border text-primary focus:outline-none focus:ring-2 focus:ring-primary"
      />
      {label}
    </label>
  );
}

interface ExtractPdfResponse {
  suggestions: {
    startDate: string | null;
    endDate: string | null;
    amountCents: number | null;
    counterpartyCnpj: string | null;
    counterpartyName: string | null;
    contractType: ContractType | null;
    contractDetailType: ContractDetailType | null;
    readjustmentIndex: ReadjustmentIndex | null;
    readjustmentPeriodMonths: number | null;
  } | null;
  highlights: { clauses: string[] } | null;
}

export function ContratoForm({ mode, contract, managers, triggerLabel, triggerVariant }: ContratoFormProps) {
  const [open, setOpen] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractionNote, setExtractionNote] = useState<string | null>(null);
  const [autoRenewal, setAutoRenewal] = useState(contract?.renewal_type === 'automatica');
  const [indeterminateTerm, setIndeterminateTerm] = useState(mode === 'edit' && !contract?.end_date);
  const [hasDistrato, setHasDistrato] = useState(contract?.has_distrato ?? false);
  const titleRef = useRef<HTMLInputElement>(null);
  const startDateRef = useRef<HTMLInputElement>(null);
  const endDateRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const cnpjRef = useRef<HTMLInputElement>(null);
  const contractTypeRef = useRef<HTMLSelectElement>(null);
  const contractDetailTypeRef = useRef<HTMLSelectElement>(null);
  const readjustmentIndexRef = useRef<HTMLSelectElement>(null);
  const readjustmentPeriodRef = useRef<HTMLInputElement>(null);
  const action = mode === 'edit' ? updateContract : createContract;
  const title = mode === 'edit' ? 'Editar contrato' : 'Novo contrato';
  const renewalTypeFallback = contract?.renewal_type === 'manual' ? 'manual' : 'nenhuma';

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setExtracting(true);
    setExtractionNote(null);
    try {
      const body = new FormData();
      body.append('file', file);
      const response = await fetch('/api/extract-pdf', { method: 'POST', body });
      if (!response.ok) return;

      const data: ExtractPdfResponse = await response.json();
      const { suggestions, highlights } = data;
      if (!suggestions) {
        setExtractionNote('Não encontramos texto legível neste PDF para pré-preencher os campos.');
        return;
      }

      // Por convenção da empresa, o nome do contrato costuma ser o nome da contraparte.
      if (suggestions.counterpartyName && titleRef.current && !titleRef.current.value) {
        titleRef.current.value = suggestions.counterpartyName;
      }
      if (suggestions.startDate && startDateRef.current && !startDateRef.current.value) {
        startDateRef.current.value = suggestions.startDate;
      }
      if (suggestions.endDate && endDateRef.current && !endDateRef.current.value && !indeterminateTerm) {
        endDateRef.current.value = suggestions.endDate;
      }
      if (suggestions.amountCents != null && amountRef.current && !amountRef.current.value) {
        amountRef.current.value = centsToAmountText(suggestions.amountCents);
      }
      if (suggestions.counterpartyCnpj && cnpjRef.current && !cnpjRef.current.value) {
        cnpjRef.current.value = suggestions.counterpartyCnpj;
      }
      if (suggestions.readjustmentPeriodMonths != null && readjustmentPeriodRef.current && !readjustmentPeriodRef.current.value) {
        readjustmentPeriodRef.current.value = String(suggestions.readjustmentPeriodMonths);
      }
      // Categoria/detalhamento/índice de reajuste/renovação automática só são pré-preenchidos ao
      // criar um contrato novo, para nunca sobrescrever uma escolha já salva ao editar.
      if (mode === 'create') {
        if (suggestions.contractType && contractTypeRef.current) {
          contractTypeRef.current.value = suggestions.contractType;
        }
        if (suggestions.contractDetailType && contractDetailTypeRef.current) {
          contractDetailTypeRef.current.value = suggestions.contractDetailType;
        }
        if (suggestions.readjustmentIndex && readjustmentIndexRef.current) {
          readjustmentIndexRef.current.value = suggestions.readjustmentIndex;
        }
        if (highlights?.clauses.includes('Renovação automática')) {
          setAutoRenewal(true);
        }
      }

      const clauses = highlights?.clauses ?? [];
      setExtractionNote(
        clauses.length > 0
          ? `Detectamos no PDF: ${clauses.join(', ')}.`
          : 'Campos pré-preenchidos a partir do PDF — confira antes de salvar.',
      );
    } catch {
      // Extração é só uma conveniência; falha aqui não deve travar o cadastro manual.
    } finally {
      setExtracting(false);
    }
  }

  function handleIndeterminateTermChange(checked: boolean) {
    setIndeterminateTerm(checked);
    if (checked && endDateRef.current) {
      endDateRef.current.value = '';
    }
  }

  return (
    <>
      <Button type="button" variant={triggerVariant ?? 'primary'} onClick={() => setOpen(true)}>
        {triggerLabel ?? (mode === 'edit' ? 'Editar contrato' : 'Novo contrato')}
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} title={title} className="max-w-2xl">
        <form action={action} onSubmit={() => setOpen(false)} className="flex flex-col gap-4">
          {mode === 'edit' && contract ? <input type="hidden" name="id" value={contract.id} /> : null}
          <input type="hidden" name="renewalType" value={autoRenewal ? 'automatica' : renewalTypeFallback} />

          <div>
            <Label htmlFor={`title-${mode}`}>Nome do contrato</Label>
            <Input
              ref={titleRef}
              id={`title-${mode}`}
              name="title"
              type="text"
              placeholder="Ex.: Locação da sede, Licença de software..."
              defaultValue={contract?.title ?? ''}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor={`internalCode-${mode}`}>Número/código interno</Label>
              <Input
                id={`internalCode-${mode}`}
                name="internalCode"
                type="text"
                placeholder="Ex.: CTR-2026-014"
                defaultValue={contract?.internal_code ?? ''}
              />
            </div>
            <div>
              <Label htmlFor={`department-${mode}`}>Departamento/centro de custo</Label>
              <Input
                id={`department-${mode}`}
                name="department"
                type="text"
                placeholder="Ex.: Engenharia"
                defaultValue={contract?.department ?? ''}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor={`internalManagerId-${mode}`}>Gestor interno</Label>
              <Select
                id={`internalManagerId-${mode}`}
                name="internalManagerId"
                defaultValue={contract?.internal_manager_id ?? ''}
              >
                <option value="">Não definido</option>
                {managers.map((manager) => (
                  <option key={manager.id} value={manager.id}>
                    {manager.full_name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor={`counterpartyCnpj-${mode}`}>CNPJ da contraparte</Label>
              <Input
                ref={cnpjRef}
                id={`counterpartyCnpj-${mode}`}
                name="counterpartyCnpj"
                type="text"
                placeholder="00.000.000/0000-00"
                defaultValue={contract?.counterparty_cnpj ?? ''}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor={`contractType-${mode}`}>Categoria</Label>
              <Select
                ref={contractTypeRef}
                id={`contractType-${mode}`}
                name="contractType"
                defaultValue={contract?.contract_type ?? 'servico'}
                required
              >
                {CONTRACT_TYPE_ENTRIES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor={`contractDetailType-${mode}`}>Detalhamento</Label>
              <Select
                ref={contractDetailTypeRef}
                id={`contractDetailType-${mode}`}
                name="contractDetailType"
                defaultValue={contract?.contract_detail_type ?? ''}
              >
                <option value="">Não especificado</option>
                {CONTRACT_DETAIL_TYPE_ENTRIES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor={`representativeName-${mode}`}>Nome do representante</Label>
              <Input
                id={`representativeName-${mode}`}
                name="representativeName"
                type="text"
                placeholder="Quando constar no contrato"
                defaultValue={contract?.representative_name ?? ''}
              />
            </div>
            <div>
              <Label htmlFor={`jurisdictionForum-${mode}`}>Foro de eleição</Label>
              <Input
                id={`jurisdictionForum-${mode}`}
                name="jurisdictionForum"
                type="text"
                placeholder="Ex.: Comarca de São Paulo"
                defaultValue={contract?.jurisdiction_forum ?? ''}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor={`contactEmail-${mode}`}>E-mail de contato</Label>
              <Input
                id={`contactEmail-${mode}`}
                name="contactEmail"
                type="email"
                placeholder="contato@empresa.com"
                defaultValue={contract?.contact_email ?? ''}
              />
            </div>
            <div>
              <Label htmlFor={`contactPhone-${mode}`}>Telefone de contato</Label>
              <Input
                id={`contactPhone-${mode}`}
                name="contactPhone"
                type="text"
                placeholder="(00) 00000-0000"
                defaultValue={contract?.contact_phone ?? ''}
              />
            </div>
          </div>

          <div>
            <Label htmlFor={`alertEmails-${mode}`}>E-mails para alerta de vencimento/renovação</Label>
            <Input
              id={`alertEmails-${mode}`}
              name="alertEmails"
              type="text"
              placeholder="fulano@msbbrasil.com, ciclana@msbbrasil.com"
              defaultValue={contract?.alert_emails ?? ''}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Separe múltiplos e-mails por vírgula. Fica registrado aqui; o envio automático não
              está implementado ainda.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor={`signatureDate-${mode}`}>Data de assinatura</Label>
              <Input
                id={`signatureDate-${mode}`}
                name="signatureDate"
                type="date"
                defaultValue={contract?.signature_date?.slice(0, 10) ?? ''}
              />
            </div>
            <div>
              <Label htmlFor={`startDate-${mode}`}>Início da vigência</Label>
              <Input
                ref={startDateRef}
                id={`startDate-${mode}`}
                name="startDate"
                type="date"
                defaultValue={contract?.start_date?.slice(0, 10) ?? ''}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor={`endDate-${mode}`}>Fim da vigência</Label>
              <Input
                ref={endDateRef}
                id={`endDate-${mode}`}
                name="endDate"
                type="date"
                defaultValue={contract?.end_date?.slice(0, 10) ?? ''}
                disabled={indeterminateTerm}
              />
            </div>
            <div>
              <Label htmlFor={`renewalNoticeDays-${mode}`}>Avisar com quantos dias de antecedência</Label>
              <Input
                id={`renewalNoticeDays-${mode}`}
                name="renewalNoticeDays"
                type="number"
                min={0}
                defaultValue={contract?.renewal_notice_days ?? 30}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <CheckboxField
              id={`indeterminateTerm-${mode}`}
              label="Vigência indeterminada"
              checked={indeterminateTerm}
              onChange={handleIndeterminateTermChange}
            />
            <CheckboxField
              id={`autoRenewal-${mode}`}
              label="Renovação automática"
              checked={autoRenewal}
              onChange={setAutoRenewal}
            />
          </div>

          <div>
            <Label htmlFor={`amount-${mode}`}>Valor total do contrato</Label>
            <Input
              ref={amountRef}
              id={`amount-${mode}`}
              name="amount"
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              defaultValue={centsToAmountText(contract?.total_amount_cents)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor={`readjustmentIndex-${mode}`}>Índice de reajuste</Label>
              <Select
                ref={readjustmentIndexRef}
                id={`readjustmentIndex-${mode}`}
                name="readjustmentIndex"
                defaultValue={contract?.readjustment_index ?? ''}
              >
                <option value="">Nenhum</option>
                {READJUSTMENT_INDEX_ENTRIES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor={`readjustmentPeriodMonths-${mode}`}>Período de reajuste (meses)</Label>
              <Input
                ref={readjustmentPeriodRef}
                id={`readjustmentPeriodMonths-${mode}`}
                name="readjustmentPeriodMonths"
                type="number"
                min={0}
                placeholder="Ex.: 12"
                defaultValue={contract?.readjustment_period_months ?? ''}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor={`confidentialityPeriodMonths-${mode}`}>Sigilo pós-encerramento (meses)</Label>
              <Input
                id={`confidentialityPeriodMonths-${mode}`}
                name="confidentialityPeriodMonths"
                type="number"
                min={0}
                placeholder="Ex.: 24"
                defaultValue={contract?.confidentiality_period_months ?? ''}
              />
            </div>
            <div>
              <Label htmlFor={`approvedBy-${mode}`}>Aprovado por</Label>
              <Input
                id={`approvedBy-${mode}`}
                name="approvedBy"
                type="text"
                placeholder="Nome e cargo/alçada"
                defaultValue={contract?.approved_by ?? ''}
              />
            </div>
          </div>

          <div>
            <Label htmlFor={`terminationReason-${mode}`}>Motivo de encerramento/rescisão</Label>
            <Textarea
              id={`terminationReason-${mode}`}
              name="terminationReason"
              defaultValue={contract?.termination_reason ?? ''}
              rows={2}
              placeholder="Preencha quando o contrato terminar antes do previsto ou não for renovado."
            />
          </div>

          <div>
            <Label htmlFor={`notes-${mode}`}>Observações</Label>
            <Textarea id={`notes-${mode}`} name="notes" defaultValue={contract?.notes ?? ''} rows={3} />
          </div>

          <div>
            <Label htmlFor={`file-${mode}`}>Arquivo do contrato (PDF)</Label>
            <Input id={`file-${mode}`} name="file" type="file" accept="application/pdf" onChange={handleFileChange} />
            <p className="mt-1 text-xs text-muted-foreground">
              PDF, até 10MB. Ao selecionar o arquivo, tentamos ler início/fim da vigência, valor,
              CNPJ e nome da contraparte, categoria e reajuste para pré-preencher os campos acima.
              {mode === 'edit' && contract?.file_path ? ' Envie um novo arquivo para substituir o atual.' : ''}
            </p>
            {extracting && <p className="mt-1 text-xs text-muted-foreground">Lendo o PDF…</p>}
            {!extracting && extractionNote && (
              <p className="mt-1 text-xs text-muted-foreground">{extractionNote}</p>
            )}
          </div>

          <div className="border-t border-border pt-4">
            <CheckboxField
              id={`hasDistrato-${mode}`}
              label="Contrato com distrato"
              checked={hasDistrato}
              onChange={setHasDistrato}
            />
          </div>

          {hasDistrato && (
            <div>
              <Label htmlFor={`distratoFile-${mode}`}>Documento do distrato (PDF)</Label>
              <Input id={`distratoFile-${mode}`} name="distratoFile" type="file" accept="application/pdf" />
              <p className="mt-1 text-xs text-muted-foreground">
                PDF, até 10MB.
                {mode === 'edit' && contract?.distrato_file_path
                  ? ' Envie um novo arquivo para substituir o atual.'
                  : ''}
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">{mode === 'edit' ? 'Salvar alterações' : 'Registrar contrato'}</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
