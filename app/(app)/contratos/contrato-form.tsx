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
  DEPARTMENT_LABELS,
  READJUSTMENT_INDEX_LABELS,
  type ContractDetailType,
  type ContractType,
  type Department,
  type ReadjustmentIndex,
} from '@/types/domain';
import { createContract, updateContract } from './actions';

const CONTRACT_TYPE_ENTRIES = Object.entries(CONTRACT_TYPE_LABELS) as [ContractType, string][];
const READJUSTMENT_INDEX_ENTRIES = Object.entries(READJUSTMENT_INDEX_LABELS) as [ReadjustmentIndex, string][];
const DEPARTMENT_ENTRIES = Object.entries(DEPARTMENT_LABELS) as [Department, string][];

export interface ManagerOption {
  id: string;
  full_name: string;
}

export interface ContractDefaults {
  id: string;
  title: string;
  contract_type: ContractType;
  contract_detail_type: string | null;
  start_date: string;
  end_date: string | null;
  renewal_notice_days: number;
  total_amount_cents: number | null;
  is_variable_value: boolean;
  counterparty_cnpj: string | null;
  readjustment_index: ReadjustmentIndex | null;
  readjustment_period_months: number | null;
  has_distrato: boolean;
  representative_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  contact_phone_2: string | null;
  is_whatsapp: boolean;
  internal_code: string | null;
  department: string | null;
  internal_manager_id: string | null;
  termination_reason: string | null;
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
  name,
  label,
  checked,
  onChange,
}: {
  id: string;
  name?: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label htmlFor={id} className="flex items-center gap-2 text-sm">
      <input
        id={id}
        name={name}
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
}

export function ContratoForm({ mode, contract, managers, triggerLabel, triggerVariant }: ContratoFormProps) {
  const [open, setOpen] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractionNote, setExtractionNote] = useState<string | null>(null);
  const [indeterminateTerm, setIndeterminateTerm] = useState(mode === 'edit' && !contract?.end_date);
  const [hasDistrato, setHasDistrato] = useState(contract?.has_distrato ?? false);
  const [isVariableValue, setIsVariableValue] = useState(contract?.is_variable_value ?? false);
  const [isWhatsapp, setIsWhatsapp] = useState(contract?.is_whatsapp ?? false);
  const titleRef = useRef<HTMLInputElement>(null);
  const startDateRef = useRef<HTMLInputElement>(null);
  const endDateRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const cnpjRef = useRef<HTMLInputElement>(null);
  const contractTypeRef = useRef<HTMLSelectElement>(null);
  const contractDetailTypeRef = useRef<HTMLInputElement>(null);
  const readjustmentIndexRef = useRef<HTMLSelectElement>(null);
  const readjustmentPeriodRef = useRef<HTMLInputElement>(null);
  const action = mode === 'edit' ? updateContract : createContract;
  const title = mode === 'edit' ? 'Editar contrato' : 'Novo contrato';

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
      const { suggestions } = data;
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
      if (suggestions.amountCents != null && amountRef.current && !amountRef.current.value && !isVariableValue) {
        amountRef.current.value = centsToAmountText(suggestions.amountCents);
      }
      if (suggestions.counterpartyCnpj && cnpjRef.current && !cnpjRef.current.value) {
        cnpjRef.current.value = suggestions.counterpartyCnpj;
      }
      if (suggestions.readjustmentPeriodMonths != null && readjustmentPeriodRef.current && !readjustmentPeriodRef.current.value) {
        readjustmentPeriodRef.current.value = String(suggestions.readjustmentPeriodMonths);
      }
      // Categoria/detalhamento/índice de reajuste só são pré-preenchidos ao criar um contrato
      // novo, para nunca sobrescrever uma escolha já salva ao editar.
      if (mode === 'create') {
        if (suggestions.contractType && contractTypeRef.current) {
          contractTypeRef.current.value = suggestions.contractType;
        }
        if (suggestions.contractDetailType && contractDetailTypeRef.current && !contractDetailTypeRef.current.value) {
          contractDetailTypeRef.current.value = CONTRACT_DETAIL_TYPE_LABELS[suggestions.contractDetailType];
        }
        if (suggestions.readjustmentIndex && readjustmentIndexRef.current) {
          readjustmentIndexRef.current.value = suggestions.readjustmentIndex;
        }
      }
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

  function handleVariableValueChange(checked: boolean) {
    setIsVariableValue(checked);
    if (checked && amountRef.current) {
      amountRef.current.value = '';
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

          <div>
            <Label htmlFor={`file-${mode}`}>Arquivo do contrato (PDF)</Label>
            <Input id={`file-${mode}`} name="file" type="file" accept="application/pdf" onChange={handleFileChange} />
            <p className="mt-1 text-xs text-muted-foreground">
              PDF, até 10MB. Ao selecionar o arquivo, tentamos ler início/fim da vigência, valor,
              CNPJ e nome da contraparte, categoria e reajuste para pré-preencher os campos abaixo.
              {mode === 'edit' && contract?.file_path ? ' Envie um novo arquivo para substituir o atual.' : ''}
            </p>
            {extracting && <p className="mt-1 text-xs text-muted-foreground">Lendo o PDF…</p>}
            {!extracting && extractionNote && (
              <p className="mt-1 text-xs text-muted-foreground">{extractionNote}</p>
            )}
          </div>

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
              <Select
                id={`department-${mode}`}
                name="department"
                defaultValue={contract?.department ?? ''}
              >
                <option value="">Não especificado</option>
                {DEPARTMENT_ENTRIES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor={`internalManagerId-${mode}`}>Gestor do contrato</Label>
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
              <p className="mt-1 text-xs text-muted-foreground">
                Lista gerenciada em Configurações → Gestores.
              </p>
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
              <Input
                ref={contractDetailTypeRef}
                id={`contractDetailType-${mode}`}
                name="contractDetailType"
                type="text"
                placeholder="Ex.: Manutenção, Licença de uso..."
                defaultValue={
                  (contract?.contract_detail_type &&
                    CONTRACT_DETAIL_TYPE_LABELS[contract.contract_detail_type as ContractDetailType]) ??
                  contract?.contract_detail_type ??
                  ''
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor={`representativeName-${mode}`}>Contato</Label>
              <Input
                id={`representativeName-${mode}`}
                name="representativeName"
                type="text"
                placeholder="Nome da pessoa de contato"
                defaultValue={contract?.representative_name ?? ''}
              />
            </div>
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
          </div>

          <div className="grid grid-cols-2 gap-4">
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
            <div>
              <Label htmlFor={`contactPhone2-${mode}`}>Telefone de contato (2)</Label>
              <Input
                id={`contactPhone2-${mode}`}
                name="contactPhone2"
                type="text"
                placeholder="(00) 00000-0000"
                defaultValue={contract?.contact_phone_2 ?? ''}
              />
            </div>
          </div>

          <CheckboxField
            id={`isWhatsapp-${mode}`}
            name="isWhatsapp"
            label="Um dos telefones acima é WhatsApp"
            checked={isWhatsapp}
            onChange={setIsWhatsapp}
          />

          <div>
            <Label htmlFor={`alertEmails-${mode}`}>E-mails para alerta de vencimento/reajuste</Label>
            <Input
              id={`alertEmails-${mode}`}
              name="alertEmails"
              type="text"
              placeholder="fulano@msbbrasil.com, ciclana@msbbrasil.com"
              defaultValue={contract?.alert_emails ?? ''}
            />
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">
            O envio automático por e-mail acontece uma vez por dia, quando o contrato entra no
            prazo de aviso prévio (vencimento) ou se aproxima da data de reajuste.
          </p>

          <div className="grid grid-cols-2 gap-4">
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
          </div>

          <div className="grid grid-cols-2 gap-4">
            <CheckboxField
              id={`indeterminateTerm-${mode}`}
              label="Vigência indeterminada"
              checked={indeterminateTerm}
              onChange={handleIndeterminateTermChange}
            />
            <div>
              <Label htmlFor={`renewalNoticeDays-${mode}`}>Aviso prévio (dias)</Label>
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
                disabled={isVariableValue}
              />
            </div>
            <div className="flex items-end pb-2">
              <CheckboxField
                id={`isVariableValue-${mode}`}
                name="isVariableValue"
                label="Valor variável (sem total previsto)"
                checked={isVariableValue}
                onChange={handleVariableValueChange}
              />
            </div>
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

          <div className="border-t border-border pt-4">
            <CheckboxField
              id={`hasDistrato-${mode}`}
              name="hasDistrato"
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
