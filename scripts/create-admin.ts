/**
 * 최초 관리자 계정 생성 스크립트.
 * 사용법: npm run db:create-admin -- --email admin@company.com --password secret123 --name 관리자
 */
import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma';

function getArg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

async function main() {
  const email = (getArg('email') ?? 'admin@company.com').trim().toLowerCase();
  const password = getArg('password') ?? 'admin1234';
  const name = getArg('name') ?? '관리자';

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, name, role: 'ADMIN' },
    create: { email, passwordHash, name, role: 'ADMIN' },
  });

  console.log(`관리자 계정이 준비되었습니다: ${user.email} (role=${user.role})`);
  if (!getArg('password')) {
    console.log(`임시 비밀번호: ${password}  (반드시 로그인 후 변경하세요)`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
