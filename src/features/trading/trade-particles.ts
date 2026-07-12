export type TradeButtonType = 'buy' | 'sell';
export type CoinKind = 'gold' | 'silver';

export type TradeParticle = {
  id: string;
  kind: CoinKind;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  delay: number;
  size: number;
};

const coinCounts: Record<TradeButtonType, Record<CoinKind, number>> = {
  buy: { gold: 8, silver: 6 },
  sell: { gold: 6, silver: 8 },
};

const randomBetween = (minimum: number, maximum: number) => minimum + Math.random() * (maximum - minimum);

export function createTradeParticles(type: TradeButtonType, width: number, height: number, burstId: number): TradeParticle[] {
  const kinds = (Object.entries(coinCounts[type]) as [CoinKind, number][])
    .flatMap(([kind, count]) => Array.from({ length: count }, () => kind))
    .sort(() => Math.random() - 0.5);
  const radiusX = Math.max(width * 0.75, 80);
  const radiusY = Math.max(height * 1.45, 64);

  return kinds.map((kind, index) => {
    const angle = randomBetween(0, Math.PI * 2);
    const distance = randomBetween(0.72, 1.18);
    const x = Math.cos(angle) * radiusX * distance;
    const y = Math.sin(angle) * radiusY * distance;

    return {
      id: `${burstId}-${type}-${kind}-${index}`,
      kind,
      fromX: type === 'buy' ? x : 0,
      fromY: type === 'buy' ? y : 0,
      toX: type === 'buy' ? 0 : x,
      toY: type === 'buy' ? 0 : y,
      delay: randomBetween(0, 0.05),
      size: randomBetween(8, 13),
    };
  });
}
