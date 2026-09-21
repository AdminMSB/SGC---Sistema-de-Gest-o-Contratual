'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ContractStatusBadge } from '@/components/status-badge';
import { ConfirmSubmitForm } from '@/components/confirm-submit-form';
import { formatCurrencyCents, formatDate } from '@/lib/format';
import { computeDisplayStatus } from '@/lib/contract-status';
import {
  CONTRACT_DETAIL_TYPE_LABELS,
  CONTRACT_DISPLAY_STATUS_LABELS,
  CONTRACT_TYPE_LABELS,
  type ContractDetailType,
  type ContractDisplayStatus,
  type ContractStatus,
  type ContractType,
} from '@/types/domain';
import { deleteContract } from './actions';

export interface ContractListItem {
  id: string;
  title: string;
  contract_type: ContractType;
  contract_detail_type: string | null;
  status: ContractStatus;
  end_date: string | null;
  total_amount_cents: number | null;
  is_variable_value: boolean;
}

const STATUS_ENTRIES = Object.entries(CONTRACT_DISPLAY_STATUS_LABELS) as [ContractDisplayStatus, string][];
const TYPE_ENTRIES = Object.entries(CONTRACT_TYPE_LABELS) as [ContractType, string][];

export function ContratosTable({ rows, isAdmin }: { rows: ContractListItem[]; isAdmin: boolean }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ContractDisplayStatus | ''>('ativo');
  const [type, setType] = useState<ContractType | ''>('');

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (status && computeDisplayStatus(row.status, row.end_date) !== status) return false;
      if (type && row.contract_type !== type) return false;
      if (!query) return true;
      return row.title.toLowerCase().includes(query);
    });
  }, [rows, search, status, type]);

  return (
    <>
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="contratos-filtro-busca">Buscar</Label>
          <Input
            id="contratos-filtro-busca"
            type="search"
            placeholder="Nome do contrato..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="contratos-filtro-status">Status</Label>
          <Select
            id="contratos-filtro-status"
            value={status}
            onChange={(event) => setStatus(event.target.value as ContractDisplayStatus | '')}
          >
            <option value="">Todos</option>
            {STATUS_ENTRIES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="contratos-filtro-tipo">Tipo</Label>
          <Select
            id="contratos-filtro-tipo"
            value={type}
            onChange={(event) => setType(event.target.value as ContractType | '')}
          >
            <option value="">Todos</option>
            {TYPE_ENTRIES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Contrato</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead>Detalhamento</TableHead>
            <TableHead>Fim da vigência</TableHead>
            <TableHead>Valor</TableHead>
            <TableHead>Status</TableHead>
            {isAdmin && <TableHead className="text-right">Ações</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredRows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <Link href={`/contratos/${row.id}`} className="font-medium hover:underline">
                  {row.title}
                </Link>
              </TableCell>
              <TableCell>{CONTRACT_TYPE_LABELS[row.contract_type]}</TableCell>
              <TableCell>
                {row.contract_detail_type
                  ? CONTRACT_DETAIL_TYPE_LABELS[row.contract_detail_type as ContractDetailType] ??
                    row.contract_detail_type
                  : '—'}
              </TableCell>
              <TableCell>{row.end_date ? formatDate(row.end_date) : 'Indeterminado'}</TableCell>
              <TableCell>{row.is_variable_value ? 'Variável' : formatCurrencyCents(row.total_amount_cents ?? 0)}</TableCell>
              <TableCell>
                <ContractStatusBadge status={computeDisplayStatus(row.status, row.end_date)} />
              </TableCell>
              {isAdmin && (
                <TableCell className="text-right">
                  <ConfirmSubmitForm
                    action={deleteContract}
                    confirmMessage={`Excluir o contrato "${row.title}" e todo o histórico associado? Esta ação não pode ser desfeita.`}
                    buttonLabel="Excluir"
                    buttonSize="sm"
                  >
                    <input type="hidden" name="id" value={row.id} />
                  </ConfirmSubmitForm>
                </TableCell>
              )}
            </TableRow>
          ))}
          {filteredRows.length === 0 && (
            <TableRow>
              <TableCell colSpan={isAdmin ? 7 : 6} className="text-center text-muted-foreground">
                {rows.length === 0 ? 'Nenhum contrato cadastrado ainda.' : 'Nenhum contrato encontrado para esse filtro.'}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </>
  );
}
