-- snapshot_inbounds를 특정 InventorySnapshot 버전이 아니라 (SKU, 날짜) 단위로 독립시킨다.
-- 재고 스냅샷을 재업로드/교체해도 입고 기록이 삭제되지 않고, 사용자가 직접 삭제해야만 없어지도록
-- 하기 위함이다.

-- Step 1: 새 컬럼 추가 (일단 nullable)
ALTER TABLE "snapshot_inbounds" ADD COLUMN "snapshotDate" DATE;

-- Step 2: 기존 행은 지금까지 연결돼 있던 snapshot의 snapshotDate로 채운다
UPDATE "snapshot_inbounds" si
SET "snapshotDate" = s."snapshotDate"
FROM "inventory_snapshots" s
WHERE si."snapshotId" = s.id;

-- Step 3: 새 유니크 키 (skuId, snapshotDate)에서 충돌하는 행(같은 날짜에 스냅샷 버전을 바꿔가며
-- 중복 기록된 경우)은 수량을 합산해 하나로 합친다.
WITH grouped AS (
  SELECT "skuId", "snapshotDate", SUM(quantity) AS total_qty, MAX(id) AS keep_id
  FROM "snapshot_inbounds"
  WHERE "snapshotDate" IS NOT NULL
  GROUP BY "skuId", "snapshotDate"
  HAVING COUNT(*) > 1
)
UPDATE "snapshot_inbounds" si
SET quantity = grouped.total_qty
FROM grouped
WHERE si.id = grouped.keep_id;

DELETE FROM "snapshot_inbounds" si
USING (
  SELECT sib.id
  FROM "snapshot_inbounds" sib
  JOIN (
    SELECT "skuId", "snapshotDate", MAX(id) AS keep_id
    FROM "snapshot_inbounds"
    WHERE "snapshotDate" IS NOT NULL
    GROUP BY "skuId", "snapshotDate"
    HAVING COUNT(*) > 1
  ) g ON g."skuId" = sib."skuId" AND g."snapshotDate" = sib."snapshotDate" AND sib.id <> g.keep_id
) dupes
WHERE si.id = dupes.id;

-- Step 4: 모든 행이 채워졌으니 NOT NULL로 확정
ALTER TABLE "snapshot_inbounds" ALTER COLUMN "snapshotDate" SET NOT NULL;

-- Step 5: 기존 snapshotId 기반 FK/유니크/컬럼 제거
ALTER TABLE "snapshot_inbounds" DROP CONSTRAINT "snapshot_inbounds_snapshotId_fkey";
DROP INDEX "snapshot_inbounds_snapshotId_skuId_key";
ALTER TABLE "snapshot_inbounds" DROP COLUMN "snapshotId";

-- Step 6: 새 유니크 인덱스 — SKU당 날짜 하나
CREATE UNIQUE INDEX "snapshot_inbounds_skuId_snapshotDate_key" ON "snapshot_inbounds"("skuId", "snapshotDate");
