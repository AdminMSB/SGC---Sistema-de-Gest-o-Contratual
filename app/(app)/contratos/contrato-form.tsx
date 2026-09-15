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
  PAYMENT_FREQUENCY_LABELS,
  READJUSTMENT_INDEX_LABELS,
  type ContractDetailType,
  type ContractType,
  type PaymentFrequency,
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
const PAYMENT_FREQUENCY_ENTRIES = Object.entries(PAYMENT_FREQUENCY_LABELS) as [PaymentFrequency, string][];

export interface ContractDefaults {
  id: string;
  title: string;
  counterparty: string;
  contract_type: ContractType;
  contract_detail_type: ContractDetailType | null;
  start_date: string;
  end_date: string | null;
  renewal_type: RenewalType;
  renewal_notice_days: number;
  payment_frequency: PaymentFrequency;
  amount_cents: number;
  counterparty_cnpj: string | null;
  readjustment_index: ReadjustmentIndex | null;
  readjustment_period_months: number | null;
  notes: string | null;
  file_path: string | null;
}

interface ContratoFormProps {
  mode: 'create' | 'edit';
  contract?: ContractDefaults;
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

export function ContratoForm({ mode, contract, triggerLabel, triggerVariant }: ContratoFormProps) {
  const [open, setOpen] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractionNote, setExtractionNote] = useState<string | null>(null);
  const [autoRenewal, setAutoRenewal] = useState(contract?.renewal_type === 'automatica');
  const [indeterminateTerm, setIndeterminateTerm] = useState(mode === 'edit' && !contract?.end_date);
  const titleRef = useRef<HTMLInputElement>(null);
  const counterpartyRef = useRef<HTMLInputElement>(null);
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

      if (suggestions.counterpartyName && counterpartyRef.current && !counterpartyRef.current.value) {
        counterpartyRef.current.value = suggestions.counterpartyName;
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
              <Label htmlFor={`counterparty-${mode}`}>Contraparte</Label>
              <Input
                ref={counterpartyRef}
                id={`counterparty-${mode}`}
                name="counterparty"
                type="text"
                placeholder="Fornecedor, locador ou cliente"
                defaultValue={contract?.counterparty ?? ''}
                required
              />
            </div>
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
          </div>

          <div className="grid grid-cols-2 gap-4">
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
            <CheckboxField
              id={`autoRenewal-${mode}`}
              label="Renovação automática"
              checked={autoRenewal}
              onChange={setAutoRenewal}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
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
            <div>
              <Label htmlFor={`paymentFrequency-${mode}`}>Frequência de pagamento</Label>
              <Select
                id={`paymentFrequency-${mode}`}
                name="paymentFrequency"
                defaultValue={contract?.payment_frequency ?? 'mensal'}
                required
              >
                {PAYMENT_FREQUENCY_ENTRIES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor={`amount-${mode}`}>Valor da parcela</Label>
            <Input
              ref={amountRef}
              id={`amount-${mode}`}
              name="amount"
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              defaultValue={centsToAmountText(contract?.amount_cents)}
              required
            />
            {mode === 'create' && (
              <p className="mt-1 text-xs text-muted-foreground">
                O cronograma de pagamentos é gerado automaticamente a partir da vigência e da frequência
                (pagamento único ou sem data de término gera só uma parcela / nenhuma parcela automática).
              </p>
            )}
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
