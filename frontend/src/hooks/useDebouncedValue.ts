import { useEffect, useState } from 'react';

export function useDebouncedValue<TValue>(latestValue: TValue, waitMilliseconds: number): TValue {
  const [settledValue, setSettledValue] = useState(latestValue);

  useEffect(() => {
    const settleTimer = setTimeout(() => setSettledValue(latestValue), waitMilliseconds);
    return () => clearTimeout(settleTimer);
  }, [latestValue, waitMilliseconds]);

  return settledValue;
}
