export interface InboundEntryInput {
  productIdentifier: string;
  quantity: number;
}

export interface InboundProduct {
  productCode: string;
  productName: string;
}

export interface ResolvedInboundEntry {
  productCode: string;
  productName: string;
  quantity: number;
}

export type InboundResolution =
  | { ok: true; entries: ResolvedInboundEntry[] }
  | { ok: false; errors: string[] };

/** 상품코드를 우선하고, 상품명은 정확히 한 SKU와 일치할 때만 허용한다. */
export function resolveInboundEntries(inputs: InboundEntryInput[], products: InboundProduct[]): InboundResolution {
  const errors: string[] = [];
  const quantityByCode = new Map<string, number>();
  const productByCode = new Map(products.map((product) => [product.productCode, product]));

  inputs.forEach((input, index) => {
    const identifier = input.productIdentifier.trim();
    const rowLabel = `입고 특이사항 ${index + 1}행`;
    if (!identifier) {
      errors.push(`${rowLabel}: 상품명 또는 상품코드를 입력하세요.`);
      return;
    }
    if (!Number.isSafeInteger(input.quantity) || input.quantity <= 0 || input.quantity > 2_147_483_647) {
      errors.push(`${rowLabel}: 수량은 1 이상의 정수여야 합니다.`);
      return;
    }

    let product = productByCode.get(identifier);
    if (!product) {
      const nameMatches = products.filter((candidate) => candidate.productName === identifier);
      if (nameMatches.length > 1) {
        errors.push(`${rowLabel}: 상품명 '${identifier}'이 여러 상품코드와 일치합니다. 상품코드를 입력하세요.`);
        return;
      }
      product = nameMatches[0];
    }
    if (!product) {
      errors.push(`${rowLabel}: 업로드 파일에서 '${identifier}' 상품을 찾을 수 없습니다.`);
      return;
    }

    const totalQuantity = (quantityByCode.get(product.productCode) ?? 0) + input.quantity;
    if (!Number.isSafeInteger(totalQuantity) || totalQuantity > 2_147_483_647) {
      errors.push(`${rowLabel}: 같은 상품의 입고 수량 합계가 허용 범위를 초과합니다.`);
      return;
    }
    quantityByCode.set(product.productCode, totalQuantity);
  });

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    entries: [...quantityByCode.entries()].map(([productCode, quantity]) => {
      const product = productByCode.get(productCode)!;
      return { productCode, productName: product.productName, quantity };
    }),
  };
}
