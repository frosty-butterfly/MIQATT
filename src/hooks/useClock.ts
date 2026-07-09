// hooks/useClock.ts
import { useEffect, useState } from "react";

export function useClock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const timeString = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const dateString = now.toLocaleDateString([], {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return { now, timeString, dateString }; // <-- added now
}