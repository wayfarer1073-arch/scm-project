import type { StockObservation } from './types';

export interface DatedInbound { date: string; quantity: number }

/** Observations are date-ascending. Each inbound belongs to (previous date, current date]. */
export function attachIntervalInbounds(observations: StockObservation[], entries: DatedInbound[]): StockObservation[] {
  const inbounds = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  let cursor = 0;
  return observations.map((observation, index) => {
    let inboundQuantity = 0;
    while (cursor < inbounds.length && inbounds[cursor].date <= observation.date) {
      if (index > 0 && inbounds[cursor].date > observations[index - 1].date) {
        inboundQuantity += inbounds[cursor].quantity;
      }
      cursor++;
    }
    return { ...observation, inboundQuantity };
  });
}
