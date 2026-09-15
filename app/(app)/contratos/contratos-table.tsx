'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ContractStatusBadge } from '@/components/status-badge';
import { formatCurrencyCents, formatDate } from '@/lib/format';
import {
  CONTRACT_STATUS_LABELS,
  CONTRACT_TYPE_LABELS,
  type ContractStatus,
  type ContractType,
} from '@/types/domain';

export interface ContractListItem {
  id: string;
  title: string;
  contract_type: ContractType;
  status: ContractStatus;
  end_date: string | null;
  total_amount_cents: number;
}

const STATUS_ENTRIES = Object.entries(CONTRACT_STATUS_LABELS) as [ContractStatus, string][];
const TYPE_ENTRIES = Object.entries(CONTRACT_TYPE_LABELS) as [ContractType, string][];

export function ContratosTable({ rows }: { rows: ContractListItem[] }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ContractStatus | ''>('ativo');
  const [type, setType] = useState<ContractType | ''>('');

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (status && row.status !== status) return false;
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
            onChange={(event) => setStatus(event.target.value as ContractStatus | '')}
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
            <TableHead>Fim da vigência</TableHead>
            <TableHead>Valor</TableHead>
            <TableHead>Status</TableHead>
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
              <TableCell>{row.end_date ? formatDate(row.end_date) : 'Indeterminado'}</TableCell>
              <TableCell>{formatCurrencyCents(row.total_amount_cents)}</TableCell>
              <TableCell>
                <ContractStatusBadge status={row.status} />
              </TableCell>
            </TableRow>
          ))}
          {filteredRows.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                {rows.length === 0 ? 'Nenhum contrato cadastrado ainda.' : 'Nenhum contrato encontrado para esse filtro.'}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </>
  );
}
