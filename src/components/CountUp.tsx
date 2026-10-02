import React, { useEffect, useRef, useState } from 'react';

interface CountUpProps {
  end: number;
  duration?: number;
  prefix?: string;
  className?: string;
}

export const CountUp: React.FC<CountUpProps> = ({
  end,
  duration = 1200,
  prefix = '฿ ',
  className = '',
}) => {
  const [displayValue, setDisplayValue] = useState(end);
  const displayValueRef = useRef(displayValue);

  // Keep ref in sync with state
  useEffect(() => {
    displayValueRef.current = displayValue;
  }, [displayValue]);

  useEffect(() => {
    const startValue = displayValueRef.current;
    const diff = end - startValue;

    if (diff === 0) return;

    let startTimestamp: number | null = null;
    let animationFrameId: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);

      // Ease Out Quart for smooth deceleration
      const easeOut = 1 - Math.pow(1 - progress, 4);
      const current = Math.round(startValue + diff * easeOut);

      setDisplayValue(current);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step);
      } else {
        setDisplayValue(end);
      }
    };

    animationFrameId = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [end, duration]);

  const formatted = displayValue.toLocaleString('th-TH');

  return (
    <span className={className}>
      {prefix}{formatted}
    </span>
  );
};
