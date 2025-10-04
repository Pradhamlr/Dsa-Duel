import React, { useEffect, useState } from "react";

export default function Timer({ startTime, duration }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (!startTime) return null;

  const endTime = startTime + duration * 1000;
  const timeLeft = Math.max(0, endTime - now);

  const mins = Math.floor(timeLeft / 60000);
  const secs = Math.floor((timeLeft % 60000) / 1000);

  const format = (n) => String(n).padStart(2, "0");

  return (
    <div
      className={`font-mono text-sm ${
        timeLeft < 60000 ? "text-red-600" : "text-gray-800"
      }`}
    >
      {format(mins)}:{format(secs)}
    </div>
  );
}
