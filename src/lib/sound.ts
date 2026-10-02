"use client";

let audioCtx: AudioContext | null = null;

/**
 * Must be called from a user gesture (iOS/Safari autoplay policy) before
 * playChime() can sound. The kitchen screen hooks it to the first tap.
 */
export function unlockAudio() {
  if (typeof window === "undefined") return;
  if (!audioCtx) {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    audioCtx = new AC();
  }
  if (audioCtx.state === "suspended") void audioCtx.resume();
}

/** Short two-note chime for new kitchen tickets. */
export function playChime() {
  if (!audioCtx) return;
  const ctx = audioCtx;
  const t = ctx.currentTime;
  [880, 1174.7].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const start = t + i * 0.18;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.25, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.5);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.55);
  });
}

export function vibrate(pattern: number[] = [120, 80, 120]) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(pattern);
  }
}

export async function requestNotifyPermission(): Promise<boolean> {
  if (typeof Notification === "undefined") return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

export function notify(title: string, body: string) {
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    new Notification(title, { body });
  }
}
