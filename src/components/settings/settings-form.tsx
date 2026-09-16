'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import type { RiskThresholdSettings } from '@/domain/inventory/types';

interface SettingsFormProps {
  isAdmin: boolean;
  warehouses: { id: string; code: string; name: string }[];
  settings: RiskThresholdSettings;
  users: { id: string; email: string; name: string; role: 'MEMBER' | 'ADMIN'; createdAt: string }[];
}

export function SettingsForm({ isAdmin, warehouses, settings, users: initialUsers }: SettingsFormProps) {
  const [warehouseNames, setWarehouseNames] = useState(Object.fromEntries(warehouses.map((w) => [w.id, w.name])));
  const [thresholds, setThresholds] = useState(settings);
  const [users, setUsers] = useState(initialUsers);
  const [savingWarehouse, setSavingWarehouse] = useState<string | null>(null);
  const [savingThresholds, setSavingThresholds] = useState(false);

  async function saveWarehouseName(id: string) {
    setSavingWarehouse(id);
    try {
      const res = await fetch(`/api/warehouses/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: warehouseNames[id] }),
      });
      if (!res.ok) throw new Error();
      toast.success('창고명이 저장되었습니다.');
    } catch {
      toast.error('저장에 실패했습니다.');
    } finally {
      setSavingWarehouse(null);
    }
  }

  async function saveThresholds() {
    setSavingThresholds(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(thresholds),
      });
      if (!res.ok) throw new Error();
      toast.success('설정이 저장되었습니다.');
    } catch {
      toast.error('저장에 실패했습니다.');
    } finally {
      setSavingThresholds(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>창고명</CardTitle>
          <CardDescription>각 창고는 서로 다른 품목을 관리하는 독립 Pool입니다. 표시 이름만 변경할 수 있습니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {warehouses.map((w) => (
            <div key={w.id} className="flex items-center gap-2">
              <Label htmlFor={`warehouse-name-${w.id}`} className="w-10 shrink-0 rounded bg-muted px-1.5 py-0.5 text-center text-[11px] font-medium text-muted-foreground">
                {w.code}
              </Label>
              <Input
                id={`warehouse-name-${w.id}`}
                value={warehouseNames[w.id]}
                onChange={(e) => setWarehouseNames((prev) => ({ ...prev, [w.id]: e.target.value }))}
                disabled={!isAdmin}
                className="max-w-xs"
              />
              {isAdmin && (
                <Button size="sm" variant="outline" onClick={() => saveWarehouseName(w.id)} disabled={savingWarehouse === w.id}>
                  저장
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>위험 / 정체 판단 기준</CardTitle>
          <CardDescription>
            SKU별 경고수량·위험수량이 Excel에 있으면 그 값이 우선 적용됩니다. 아래 기준은 Coverage(예상 소진일수) 기반 보조 판단과 정체·과잉재고 판정에 쓰입니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ThresholdField
            label="품절 임박 기준 (Coverage ≤ N일)"
            value={thresholds.stockoutSoonDays}
            onChange={(v) => setThresholds((p) => ({ ...p, stockoutSoonDays: v }))}
            disabled={!isAdmin}
          />
          <ThresholdField
            label="관리 필요 / 정상 경계 (Coverage ≤ N일)"
            value={thresholds.manageMaxDays}
            onChange={(v) => setThresholds((p) => ({ ...p, manageMaxDays: v }))}
            disabled={!isAdmin}
          />
          <ThresholdField
            label="과잉재고 후보 기준 (Coverage ≥ N일)"
            value={thresholds.overstockCoverageDays}
            onChange={(v) => setThresholds((p) => ({ ...p, overstockCoverageDays: v }))}
            disabled={!isAdmin}
          />
          <ThresholdField
            label="장기 정체 기준일 (감소 미관측 ≥ N일)"
            value={thresholds.stagnantDays}
            onChange={(v) => setThresholds((p) => ({ ...p, stagnantDays: v }))}
            disabled={!isAdmin}
          />
        </CardContent>
        {isAdmin && (
          <CardContent className="pt-0">
            <Button onClick={saveThresholds} disabled={savingThresholds}>
              {savingThresholds ? '저장 중...' : '설정 저장'}
            </Button>
          </CardContent>
        )}
      </Card>

      {isAdmin && <UserManagement users={users} onUsersChange={setUsers} />}
    </div>
  );
}

function ThresholdField({ label, value, onChange, disabled }: { label: string; value: number; onChange: (v: number) => void; disabled: boolean }) {
  const id = `threshold-${label.replace(/[^a-zA-Z0-9가-힣]+/g, '-')}`;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="number" min={1} value={value} onChange={(e) => onChange(Number(e.target.value))} disabled={disabled} />
    </div>
  );
}

function UserManagement({
  users,
  onUsersChange,
}: {
  users: { id: string; email: string; name: string; role: 'MEMBER' | 'ADMIN'; createdAt: string }[];
  onUsersChange: (users: { id: string; email: string; name: string; role: 'MEMBER' | 'ADMIN'; createdAt: string }[]) => void;
}) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'MEMBER' | 'ADMIN'>('MEMBER');
  const [submitting, setSubmitting] = useState(false);

  async function addUser() {
    setSubmitting(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, password, role }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error ?? '추가에 실패했습니다.');
        return;
      }
      toast.success('사용자가 추가되었습니다.');
      onUsersChange([...users, body.user]);
      setEmail('');
      setName('');
      setPassword('');
      setRole('MEMBER');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>사용자 관리</CardTitle>
        <CardDescription>member / admin 권한을 가진 계정을 추가할 수 있습니다.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {users.map((u) => (
            <div key={u.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              <div>
                <span className="font-medium">{u.name}</span> <span className="text-muted-foreground">{u.email}</span>
              </div>
              <Badge variant="outline">{u.role === 'ADMIN' ? '관리자' : '멤버'}</Badge>
            </div>
          ))}
        </div>
        <Separator />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="new-user-email">이메일</Label>
            <Input id="new-user-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-user-name">이름</Label>
            <Input id="new-user-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-user-password">임시 비밀번호 (8자 이상)</Label>
            <Input id="new-user-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-user-role">권한</Label>
            <Select value={role} onValueChange={(v) => setRole(v as 'MEMBER' | 'ADMIN')}>
              <SelectTrigger id="new-user-role"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="MEMBER">멤버</SelectItem>
                <SelectItem value="ADMIN">관리자</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={addUser} disabled={submitting || !email || !name || password.length < 8}>
          사용자 추가
        </Button>
      </CardContent>
    </Card>
  );
}
