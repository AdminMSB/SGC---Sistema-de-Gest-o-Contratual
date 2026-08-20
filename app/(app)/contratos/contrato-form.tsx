'use client';

import { useState } from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  CONTRACT_TYPE_LABELS,
  PAYMENT_FREQUENCY_LABELS,
  RENEWAL_TYPE_LABELS,
  type ContractType,
  type PaymentFrequency,
  type RenewalType,
} from '@/types/domain';
import { createContract, updateContract } from './actions';

const CONTRACT_TYPE_ENTRIES = Object.entries(CONTRACT_TYPE_LABELS) as [ContractType, string][];
const RENEWAL_TYPE_ENTRIES = Object.entries(RENEWAL_TYPE_LABELS) as [RenewalType, string][];
const PAYMENT_FREQUENCY_ENTRIES = Object.entries(PAYMENT_FREQUENCY_LABELS) as [PaymentFrequency, string][];

export interface ContractDefaults {
  id: string;
  title: string;
  counterparty: string;
  contract_type: ContractType;
  start_date: string;
  end_date: string | null;
  renewal_type: RenewalType;
  renewal_notice_days: number;
  payment_frequency: PaymentFrequency;
  amount_cents: number;
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

export function ContratoForm({ mode, contract, triggerLabel, triggerVariant }: ContratoFormProps) {
  const [open, setOpen] = useState(false);
  const action = mode === 'edit' ? updateContract : createContract;
  const title = mode === 'edit' ? 'Editar contrato' : 'Novo contrato';

  return (
    <>
      <Button type="button" variant={triggerVariant ?? 'primary'} onClick={() => setOpen(true)}>
        {triggerLabel ?? (mode === 'edit' ? 'Editar contrato' : 'Novo contrato')}
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} title={title} className="max-w-2xl">
        <form action={action} onSubmit={() => setOpen(false)} className="flex flex-col gap-4">
          {mode === 'edit' && contract ? <input type="hidden" name="id" value={contract.id} /> : null}

          <div>
            <Label htmlFor={`title-${mode}`}>Nome/objeto do contrato</Label>
            <Input
              id={`title-${mode}`}
              name="title"
              type="text"
              placeholder="Ex.: Locação da sede, Licença de software..."
              defaultValue={contract?.title ?? ''}
              required
            />
          </div>

          <div>
            <Label htmlFor={`counterparty-${mode}`}>Contraparte</Label>
            <Input
              id={`counterparty-${mode}`}
              name="counterparty"
              type="text"
              placeholder="Fornecedor, locador ou cliente"
              defaultValue={contract?.counterparty ?? ''}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor={`contractType-${mode}`}>Tipo</Label>
              <Select id={`contractType-${mode}`} name="contractType" defaultValue={contract?.contract_type ?? 'outro'} required>
                {CONTRACT_TYPE_ENTRIES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor={`startDate-${mode}`}>Início da vigência</Label>
              <Input
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
                id={`endDate-${mode}`}
                name="endDate"
                type="date"
                defaultValue={contract?.end_date?.slice(0, 10) ?? ''}
              />
              <p className="mt-1 text-xs text-muted-foreground">Deixe em branco para prazo indeterminado.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor={`renewalType-${mode}`}>Renovação</Label>
              <Select id={`renewalType-${mode}`} name="renewalType" defaultValue={contract?.renewal_type ?? 'nenhuma'} required>
                {RENEWAL_TYPE_ENTRIES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
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

          <div>
            <Label htmlFor={`amount-${mode}`}>Valor da parcela</Label>
            <Input
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

          <div>
            <Label htmlFor={`notes-${mode}`}>Observações</Label>
            <Textarea id={`notes-${mode}`} name="notes" defaultValue={contract?.notes ?? ''} rows={3} />
          </div>

          <div>
            <Label htmlFor={`file-${mode}`}>Arquivo do contrato (PDF)</Label>
            <Input id={`file-${mode}`} name="file" type="file" accept="application/pdf" />
            <p className="mt-1 text-xs text-muted-foreground">
              PDF, até 10MB.
              {mode === 'edit' && contract?.file_path ? ' Envie um novo arquivo para substituir o atual.' : ''}
            </p>
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
