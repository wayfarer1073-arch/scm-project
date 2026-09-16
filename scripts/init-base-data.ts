/** 창고 A/B/C 기본 데이터 및 기본 설정값을 준비한다. 여러 번 실행해도 안전(idempotent)하다. */
import { prisma } from '../src/lib/prisma';

async function main() {
  const warehouses = [
    { code: 'A', name: '창고 A', sortOrder: 1 },
    { code: 'B', name: '창고 B', sortOrder: 2 },
    { code: 'C', name: '창고 C', sortOrder: 3 },
  ];

  for (const w of warehouses) {
    await prisma.warehouse.upsert({
      where: { code: w.code },
      update: {},
      create: w,
    });
  }

  await prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });

  console.log('창고 A/B/C 및 기본 설정을 준비했습니다.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
