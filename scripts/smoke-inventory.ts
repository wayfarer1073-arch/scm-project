import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import * as XLSX from 'xlsx';
import { prisma } from '../src/lib/prisma';
import { createFixture, cleanupFixture, requireTestDatabase } from '../tests/db-fixtures';

async function main() {
  requireTestDatabase();
  const base = new URL(process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:3107');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)) throw new Error('Local app only');
  const fixture = await createFixture();
  const cookies = new Map<string, string>();
  async function request(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    if (cookies.size) headers.set('Cookie', [...cookies].map(([k, v]) => `${k}=${v}`).join('; '));
    const response = await fetch(new URL(path, base), { ...init, headers, redirect: 'manual' });
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(';')[0];
      const split = pair.indexOf('=');
      cookies.set(pair.slice(0, split), pair.slice(split + 1));
    }
    return response;
  }
  try {
    assert.equal((await request('/api/inbound')).status, 401);
    await prisma.user.update({ where: { id: fixture.user.id }, data: { passwordHash: await bcrypt.hash('local-smoke-password', 10) } });
    const { csrfToken } = await (await request('/api/auth/csrf')).json();
    await request('/api/auth/callback/credentials', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ csrfToken, email: fixture.user.email, password: 'local-smoke-password', callbackUrl: base.href }),
    });
    assert.equal((await (await request('/api/auth/session')).json()).user.id, fixture.user.id);
    async function upload(date: string, stock: number) {
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['상품코드', '상품명', '정상재고', '원가'], ['smoke', '검증 상품', stock, 10]]), '재고');
      const form = new FormData();
      form.set('warehouseId', fixture.warehouse.id);
      form.set('snapshotDate', date);
      form.set('file', new Blob([XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })]), 'test.xlsx');
      const response = await request('/api/upload', { method: 'POST', body: form });
      assert.equal(response.status, 200);
      return response.json();
    }
    assert.equal((await upload('2026-09-10', 100)).status, 'SUCCESS');
    const sku = await prisma.sku.findFirstOrThrow({ where: { warehouseId: fixture.warehouse.id } });
    const inbound = await request('/api/inbound', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ warehouseId: fixture.warehouse.id, skuId: sku.id, date: '2026-09-11', quantity: 50 }),
    });
    assert.equal(inbound.status, 201);
    assert.equal((await upload('2026-09-12', 120)).status, 'SUCCESS');
    assert.equal((await upload('2026-09-12', 120)).status, 'DUPLICATE');
    const detailResponse = await request(`/api/sku/${sku.id}?asOf=2026-09-12`);
    assert.equal(detailResponse.status, 200);
    const detail = await detailResponse.json();
    assert.equal(detail.analysis.window7.totalDepletion, 30);
    assert.equal((await request('/?date=2026-09-12')).status, 200);
    const report = await request('/api/export/full-report?asOf=2026-09-12');
    assert.equal(report.status, 200);
    const wb = XLSX.read(await report.arrayBuffer(), { type: 'array' });
    assert.ok(wb.SheetNames.includes('Inventory'));
    console.log('PASS: unauthenticated access, login, Excel upload, inbound, duplicate upload, SKU calculation, dashboard, XLSX export');
  } finally { await cleanupFixture(fixture); }
}
main().finally(() => prisma.$disconnect()).catch(error => { console.error(error); process.exitCode = 1; });
