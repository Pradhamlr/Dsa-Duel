import React, { useEffect, useState } from 'react';

export default function Timer({ startTime, duration, onEnd }) {
  const [now, setNow] = useState(Date.now());
  const [endedCalled, setEndedCalled] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (!startTime) return null;

  const endTime = startTime + duration * 1000;
  const timeLeft = Math.max(0, endTime - now);

  useEffect(()=>{
    if (timeLeft <= 0 && onEnd && !endedCalled) {
      try { onEnd() } catch (e) { /* swallow */ }
      setEndedCalled(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, onEnd])

  const mins = Math.floor(timeLeft / 60000);
  const secs = Math.floor((timeLeft % 60000) / 1000);

  const format = (n) => String(n).padStart(2, "0");

  const isUrgent = timeLeft < 60000;
  const isCritical = timeLeft < 10000;
  
  return (
    <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg font-mono font-bold transition-all duration-300 ${
      isCritical ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 animate-pulse' :
      isUrgent ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400' :
      'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
    }`}>
      <span className="text-xl tracking-wider">
        {format(mins)}:{format(secs)}
      </span>
    </div>
  );
}
