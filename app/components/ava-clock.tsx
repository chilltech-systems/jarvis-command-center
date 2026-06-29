"use client";

import { useEffect, useState } from "react";
import { formatCentralDate, formatCentralTime, getCentralGreeting } from "@/lib/ava/time";

function getClockState() {
  const now = new Date();

  return {
    greeting: `${getCentralGreeting(now)}, Cody`,
    date: formatCentralDate(now),
    time: formatCentralTime(now),
  };
}

export function AvaClock() {
  const [clock, setClock] = useState(getClockState);

  useEffect(() => {
    const tick = () => setClock(getClockState());
    tick();
    const interval = window.setInterval(tick, 30_000);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="hero-side">
      <div className="greeting">{clock.greeting}</div>
      <div className="badge">{clock.date} · {clock.time} CT</div>
    </div>
  );
}
