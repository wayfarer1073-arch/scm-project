-- 원가가 비어 있는 스냅샷은 동일 SKU의 직전 원가를 이어받을 수 있도록
-- "실제 입력 여부"와 선택적인 원가합을 별도로 보존한다.
ALTER TABLE "inventory_items"
ADD COLUMN "unitCostProvided" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "totalCost" DECIMAL(24,2);

-- 기존 데이터는 원가 0을 누락값으로 취급한다. 0원이 실제 원가였던 과거 행은 구분할 수 없지만,
-- 재고 데이터에서 0원은 통상 누락값이므로 이전의 유효 원가를 이어받는 편이 분석에 안전하다.
UPDATE "inventory_items"
SET "unitCostProvided" = false
WHERE "unitCost" = 0;
