/**
 * 품절 인식(soldOutDetectedDate)은 원래 createSnapshot() 업로드 트랜잭션 안에서, 새 스냅샷이 그
 * 창고의 "최신"일 때만 실시간으로 계산된다(직전까지 활성이던 SKU가 이번 업로드 목록에 없으면
 * 그 시점을 품절 인식일로 기록). 그런데 seed-mock.ts처럼 createSnapshot()을 거치지 않고 스냅샷을
 * 직접 만들거나, 이 기능이 배포되기 전에 이미 쌓여 있던 과거 스냅샷들은 이 실시간 계산을 한 번도
 * 거치지 못했다 — 그래서 실제로는 이력 중간에 사라진 SKU라도 soldOutDetectedDate가 비어 있거나
 * (혹은 가장 최근에야 계산되어) 과거 시점 조회에서 품절로 잡히지 않는다.
 *
 * 이 스크립트는 각 창고의 ACTIVE 스냅샷을 날짜순으로 다시 훑으며, createSnapshot()이 실시간으로
 * 했을 계산을 그대로 재현한다: 이전 스냅샷에는 있었는데 이번 스냅샷에 없는 SKU는 "이번 스냅샷
 * 날짜에 품절 인식됨"으로 기록하고, 이번 스냅샷에 있는 SKU는 다시 활성으로 되돌린다(재입고).
 * 전체 이력을 끝까지 재생하고 나면 최종 상태가 지금까지 정상적으로 업로드돼왔을 때와 동일해진다.
 *
 * 실행: npx tsx scripts/backfill-sold-out-detection.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const warehouses = await prisma.warehouse.findMany({ select: { id: true, code: true, name: true } });
  let totalMarkedSoldOut = 0;

  for (const warehouse of warehouses) {
    const snapshots = await prisma.inventorySnapshot.findMany({
      where: { warehouseId: warehouse.id, status: 'ACTIVE' },
      orderBy: { snapshotDate: 'asc' },
      select: { id: true, snapshotDate: true },
    });
    if (snapshots.length === 0) continue;

    let previousSkuIds = new Set<string>();
    let markedSoldOut = 0;

    for (const snapshot of snapshots) {
      const items = await prisma.inventoryItem.findMany({ where: { snapshotId: snapshot.id }, select: { skuId: true } });
      const currentSkuIds = new Set(items.map((i) => i.skuId));

      const missingSkuIds = [...previousSkuIds].filter((id) => !currentSkuIds.has(id));
      if (missingSkuIds.length > 0) {
        await prisma.sku.updateMany({
          where: { id: { in: missingSkuIds } },
          data: { isActive: false, soldOutDetectedDate: snapshot.snapshotDate },
        });
        markedSoldOut += missingSkuIds.length;
      }
      if (currentSkuIds.size > 0) {
        await prisma.sku.updateMany({
          where: { id: { in: [...currentSkuIds] } },
          data: { isActive: true, soldOutDetectedDate: null },
        });
      }

      previousSkuIds = currentSkuIds;
    }

    console.log(`창고 ${warehouse.code}(${warehouse.name}): 스냅샷 ${snapshots.length}개 재생, 품절 인식 이벤트 ${markedSoldOut}건`);
    totalMarkedSoldOut += markedSoldOut;
  }

  const stillSoldOut = await prisma.sku.count({ where: { soldOutDetectedDate: { not: null } } });
  console.log(`완료. 전체 품절 인식 이벤트 ${totalMarkedSoldOut}건(재입고로 상쇄된 것 포함), 현재 soldOutDetectedDate가 남아있는 SKU ${stillSoldOut}개.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
