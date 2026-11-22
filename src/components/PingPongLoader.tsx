import { useEffect, useId, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface PingPongLoaderProps {
  label?: string;
  className?: string;
}

// ── Physics & Table Geometry Constants ──────────────────────────────────────
const VIEW_W = 240;
const CYCLE = 1.3; // seconds for a full rally loop (L -> R -> L)
const T_HALF = CYCLE / 2;
const R = 4;
const TABLE_Y = 92;
const X_L = 26;
const X_R = 214;
const X_B = 167;
const Y_C = 68;
const Y_TB = TABLE_Y - R; // 88, ball center at table impact
const Y_A = 50; // apex before crossing net

const S_SPLIT = (X_B - X_L) / (X_R - X_L); // 0.75
const T_BOUNCE = S_SPLIT * T_HALF;

// Parabolic vertical trajectory with shared gravity across bounce split:
// Segment 1 (contact -> bounce): y = a1*s^2 + b1*s + Y_C, s in [0, 1]
const H = Y_C - Y_A;
const D = Y_TB - Y_C;
const B1 = -2 * (H + Math.sqrt(H * (Y_TB - Y_A)));
const A1 = D - B1;

// Segment 2 (bounce -> contact): consistent gravity scaled by ((1 - S_SPLIT) / S_SPLIT)^2
const A2 = A1 * ((1 - S_SPLIT) / S_SPLIT) ** 2;
const B2 = Y_C - Y_TB - A2;

// ── Paddle Geometry (3/4 perspective, wrist as pivot origin) ────────────────
const BLADE_L = 19;
const THETA_C = 8; // contact tilt in degrees
const BLADE_RX = 6.5;

const CONTACT_CENTER_X = X_L - R - BLADE_RX + 0.8;
const CONTACT_CENTER_Y = Y_C;
const THETA_C_RAD = (THETA_C * Math.PI) / 180;
const PIVOT_X = CONTACT_CENTER_X - BLADE_L * Math.sin(THETA_C_RAD);
const PIVOT_Y = CONTACT_CENTER_Y + BLADE_L * Math.cos(THETA_C_RAD);

const TRAIL_DT = 0.018;
const TRAIL_OPACITIES = [0.32, 0.2, 0.11, 0.05] as const;

// ── Pure Physics & Kinematics Helpers ───────────────────────────────────────
function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

function lerp(a: number, b: number, p: number): number {
  return a + (b - a) * p;
}

function easeOutCubic(p: number): number {
  return 1 - (1 - p) ** 3;
}

function easeInOutSine(p: number): number {
  return -(Math.cos(Math.PI * p) - 1) / 2;
}

function easeInQuad(p: number): number {
  return p * p;
}

function wrapCycle(t: number): number {
  const m = t % CYCLE;
  return m < 0 ? m + CYCLE : m;
}

function ballAt(tRaw: number): { x: number; y: number } {
  const t = wrapCycle(tRaw);
  const leftToRight = t < T_HALF;
  const s = leftToRight ? t / T_HALF : (t - T_HALF) / T_HALF;

  let x: number;
  let y: number;

  if (s < S_SPLIT) {
    const s1 = s / S_SPLIT;
    x = X_L + s1 * (X_B - X_L);
    y = A1 * s1 * s1 + B1 * s1 + Y_C;
  } else {
    const s2 = (s - S_SPLIT) / (1 - S_SPLIT);
    x = X_B + s2 * (X_R - X_B);
    y = A2 * s2 * s2 + B2 * s2 + Y_TB;
  }

  return {
    x: leftToRight ? x : VIEW_W - x,
    y,
  };
}

function swing(uRaw: number): { angle: number; dx: number; dy: number } {
  const u = ((uRaw % 1) + 1) % 1;

  if (u < 0.14) {
    const e = easeOutCubic(u / 0.14);
    return { angle: lerp(THETA_C, 40, e), dx: lerp(2, 1, e), dy: 0 };
  }
  if (u < 0.46) {
    const e = easeInOutSine((u - 0.14) / 0.32);
    return { angle: lerp(40, 0, e), dx: lerp(1, 0, e), dy: 0 };
  }
  if (u < 0.8) {
    const p = (u - 0.46) / 0.34;
    return { angle: 1.5 * Math.sin(2 * Math.PI * p), dx: 0, dy: 0 };
  }
  if (u < 0.93) {
    const e = easeInOutSine((u - 0.8) / 0.13);
    return { angle: lerp(0, -26, e), dx: lerp(0, -3, e), dy: lerp(0, 2, e) };
  }

  const e = easeInQuad((u - 0.93) / 0.07);
  return { angle: lerp(-26, THETA_C, e), dx: lerp(-3, 2, e), dy: lerp(2, 0, e) };
}

function f2(n: number): string {
  return n.toFixed(2);
}

interface FrameState {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  hlX: number;
  hlY: number;
  trails: Array<{ cx: number; cy: number; r: number; opacity: number }>;
  shadowCx: number;
  shadowRx: number;
  shadowRy: number;
  shadowOpacity: number;
  rippleCx: number;
  rippleRx: number;
  rippleRy: number;
  rippleOpacity: number;
  hitCx: number;
  hitCy: number;
  hitR: number;
  hitOpacity: number;
  leftTransform: string;
  rightTransform: string;
}

function computeFrame(elapsedSec: number): FrameState {
  const t = wrapCycle(elapsedSec);
  const tHalf = t % T_HALF;
  const leftToRight = t < T_HALF;
  const { x, y } = ballAt(t);

  // Bounce squash & contact squash
  const kb = Math.max(0, 1 - Math.abs(tHalf - T_BOUNCE) / 0.04);
  const kc = Math.max(0, 1 - Math.min(tHalf, T_HALF - tHalf) / 0.03);

  const rx = R * (1 + 0.25 * kb) * (1 - 0.22 * kc);
  const ry = R * (1 - 0.3 * kb) * (1 + 0.18 * kc);
  const cx = x;
  const cy = y + (R - ry);

  // Ball trails
  const trails = TRAIL_OPACITIES.map((opacity, idx) => {
    const k = idx + 1;
    const pos = ballAt(t - k * TRAIL_DT);
    return {
      cx: pos.x,
      cy: pos.y,
      r: R * (1 - 0.12 * k),
      opacity,
    };
  });

  // Table shadow
  const hAbove = Y_TB - y;
  const shadowRx = clamp(5.5 - 0.07 * hAbove, 2.4, 5.5);
  const shadowRy = shadowRx * 0.32;
  const inTableSpan = x >= 28 && x <= 212;
  const shadowOpacity = inTableSpan ? clamp(0.38 - 0.008 * hAbove, 0.06, 0.38) : 0;

  // Table bounce ripple
  const tauB = tHalf - T_BOUNCE;
  let rippleCx = X_B;
  let rippleRx = 3;
  let rippleRy = 0.84;
  let rippleOpacity = 0;
  if (tauB >= 0 && tauB < 0.3) {
    const prog = tauB / 0.3;
    rippleCx = leftToRight ? X_B : VIEW_W - X_B;
    rippleRx = 3 + 13 * prog;
    rippleRy = rippleRx * 0.28;
    rippleOpacity = 0.5 * (1 - prog);
  }

  // Paddle hit pulse ring
  let hitCx = X_L;
  const hitCy = Y_C;
  let hitR = 4;
  let hitOpacity = 0;
  if (tHalf < 0.22) {
    const prog = tHalf / 0.22;
    hitCx = leftToRight ? X_L : X_R;
    hitR = 4 + 9 * prog;
    hitOpacity = 0.55 * (1 - prog);
  }

  // Paddle kinematics (phase-shifted by half a cycle for right paddle)
  const uL = t / CYCLE;
  const uR = ((t - T_HALF + CYCLE) % CYCLE) / CYCLE;
  const sL = swing(uL);
  const sR = swing(uR);

  return {
    cx,
    cy,
    rx,
    ry,
    hlX: cx - 1.3,
    hlY: cy - 1.4,
    trails,
    shadowCx: x,
    shadowRx,
    shadowRy,
    shadowOpacity,
    rippleCx,
    rippleRx,
    rippleRy,
    rippleOpacity,
    hitCx,
    hitCy,
    hitR,
    hitOpacity,
    leftTransform: `translate(${f2(PIVOT_X + sL.dx)} ${f2(PIVOT_Y + sL.dy)}) rotate(${f2(sL.angle)})`,
    rightTransform: `translate(${f2(PIVOT_X + sR.dx)} ${f2(PIVOT_Y + sR.dy)}) rotate(${f2(sR.angle)})`,
  };
}

// Static fallback pose when prefers-reduced-motion is enabled (ball over net near apex)
const REDUCED_MOTION_FRAME = computeFrame(0.375 * T_HALF);

const PingPongLoader = ({ label = '載入戰情室', className }: PingPongLoaderProps) => {
  const shouldReduceMotion = useReducedMotion();
  const rawId = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const floorShadowId = `pp-floor-${rawId}`;
  const tableGradId = `pp-table-${rawId}`;
  const netPatternId = `pp-net-${rawId}`;
  const ballGradId = `pp-ball-${rawId}`;
  const woodGradId = `pp-wood-${rawId}`;
  const redRubberId = `pp-red-${rawId}`;
  const darkRubberId = `pp-dark-${rawId}`;

  const shadowRef = useRef<SVGEllipseElement>(null);
  const rippleRef = useRef<SVGEllipseElement>(null);
  const hitRingRef = useRef<SVGCircleElement>(null);
  const trailRefs = useRef<Array<SVGCircleElement | null>>([null, null, null, null]);
  const ballRef = useRef<SVGEllipseElement>(null);
  const highlightRef = useRef<SVGCircleElement>(null);
  const leftPaddleRef = useRef<SVGGElement>(null);
  const rightPaddleRef = useRef<SVGGElement>(null);
  const rallyRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (shouldReduceMotion) return;

    let rafId = 0;
    const start = performance.now();
    let lastHalfIdx = -1;

    const applyFrame = (now: number) => {
      const elapsedSec = (now - start) / 1000;
      const frame = computeFrame(elapsedSec);

      if (shadowRef.current) {
        shadowRef.current.setAttribute('cx', f2(frame.shadowCx));
        shadowRef.current.setAttribute('rx', f2(frame.shadowRx));
        shadowRef.current.setAttribute('ry', f2(frame.shadowRy));
        shadowRef.current.setAttribute('opacity', f2(frame.shadowOpacity));
      }

      if (rippleRef.current) {
        rippleRef.current.setAttribute('cx', f2(frame.rippleCx));
        rippleRef.current.setAttribute('rx', f2(frame.rippleRx));
        rippleRef.current.setAttribute('ry', f2(frame.rippleRy));
        rippleRef.current.setAttribute('opacity', f2(frame.rippleOpacity));
      }

      if (hitRingRef.current) {
        hitRingRef.current.setAttribute('cx', f2(frame.hitCx));
        hitRingRef.current.setAttribute('cy', f2(frame.hitCy));
        hitRingRef.current.setAttribute('r', f2(frame.hitR));
        hitRingRef.current.setAttribute('opacity', f2(frame.hitOpacity));
      }

      for (let i = 0; i < 4; i++) {
        const el = trailRefs.current[i];
        const tr = frame.trails[i];
        if (el && tr) {
          el.setAttribute('cx', f2(tr.cx));
          el.setAttribute('cy', f2(tr.cy));
          el.setAttribute('r', f2(tr.r));
          el.setAttribute('opacity', f2(tr.opacity));
        }
      }

      if (ballRef.current) {
        ballRef.current.setAttribute('cx', f2(frame.cx));
        ballRef.current.setAttribute('cy', f2(frame.cy));
        ballRef.current.setAttribute('rx', f2(frame.rx));
        ballRef.current.setAttribute('ry', f2(frame.ry));
      }

      if (highlightRef.current) {
        highlightRef.current.setAttribute('cx', f2(frame.hlX));
        highlightRef.current.setAttribute('cy', f2(frame.hlY));
      }

      if (leftPaddleRef.current) {
        leftPaddleRef.current.setAttribute('transform', frame.leftTransform);
      }

      if (rightPaddleRef.current) {
        rightPaddleRef.current.setAttribute('transform', frame.rightTransform);
      }

      const halfIdx = Math.floor(elapsedSec / T_HALF);
      if (halfIdx !== lastHalfIdx && rallyRef.current) {
        lastHalfIdx = halfIdx;
        rallyRef.current.textContent = `暖身對打 · 第 ${halfIdx + 1} 拍`;
      }

      rafId = requestAnimationFrame(applyFrame);
    };

    rafId = requestAnimationFrame(applyFrame);
    return () => cancelAnimationFrame(rafId);
  }, [shouldReduceMotion]);

  const initialFrame = shouldReduceMotion ? REDUCED_MOTION_FRAME : computeFrame(0);

  return (
    <motion.div
      role="status"
      aria-live="polite"
      aria-label={label}
      initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.12, duration: 0.3 }}
      className={cn('flex flex-col items-center justify-center gap-3 select-none', className)}
    >
      <svg
        viewBox="0 0 240 128"
        className="w-[220px] sm:w-[260px] h-auto overflow-visible"
        aria-hidden="true"
        shapeRendering="geometricPrecision"
      >
        <defs>
          <radialGradient id={floorShadowId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(0,0,0,0.18)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>

          <linearGradient id={tableGradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#1e3a8a" />
          </linearGradient>

          <pattern id={netPatternId} width="2" height="2" patternUnits="userSpaceOnUse">
            <path
              d="M 2 0 L 0 0 0 2"
              fill="none"
              stroke="rgba(255,255,255,0.45)"
              strokeWidth="0.5"
            />
          </pattern>

          <radialGradient id={ballGradId} cx="35%" cy="30%" r="65%">
            <stop offset="0%" stopColor="#fff7ed" />
            <stop offset="55%" stopColor="#fb923c" />
            <stop offset="100%" stopColor="#ea580c" />
          </radialGradient>

          <linearGradient id={woodGradId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#d97706" />
            <stop offset="100%" stopColor="#92400e" />
          </linearGradient>

          <linearGradient id={redRubberId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="100%" stopColor="#b91c1c" />
          </linearGradient>

          <linearGradient id={darkRubberId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#334155" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>
        </defs>

        {/* Floor soft ambient shadow */}
        <ellipse cx="120" cy="118" rx="100" ry="4" fill={`url(#${floorShadowId})`} />

        {/* Table legs */}
        <rect x="46" y="97" width="3" height="19" rx="0.8" className="fill-slate-400 dark:fill-slate-600" />
        <rect x="191" y="97" width="3" height="19" rx="0.8" className="fill-slate-400 dark:fill-slate-600" />

        {/* Table top */}
        <rect x="24" y="92" width="192" height="5" rx="1.5" fill={`url(#${tableGradId})`} />
        <line
          x1="24"
          y1="92.4"
          x2="216"
          y2="92.4"
          stroke="#ffffff"
          strokeOpacity="0.85"
          strokeWidth="0.8"
        />
        <rect x="24.5" y="92" width="1" height="5" fill="#ffffff" fillOpacity="0.85" />
        <rect x="214.5" y="92" width="1" height="5" fill="#ffffff" fillOpacity="0.85" />

        {/* Net mesh, post, and white tape */}
        <rect x="117.5" y="77" width="5" height="15" fill={`url(#${netPatternId})`} />
        <rect x="119" y="76" width="2" height="16" className="fill-slate-300" />
        <rect x="117" y="76" width="6" height="1.6" rx="0.4" fill="#ffffff" />

        {/* Dynamic ball shadow on table */}
        <ellipse
          ref={shadowRef}
          cx={f2(initialFrame.shadowCx)}
          cy="92.6"
          rx={f2(initialFrame.shadowRx)}
          ry={f2(initialFrame.shadowRy)}
          opacity={f2(initialFrame.shadowOpacity)}
          className="fill-slate-900 dark:fill-black"
        />

        {/* Table bounce impact ripple */}
        <ellipse
          ref={rippleRef}
          cx={f2(initialFrame.rippleCx)}
          cy="92"
          rx={f2(initialFrame.rippleRx)}
          ry={f2(initialFrame.rippleRy)}
          opacity={f2(initialFrame.rippleOpacity)}
          fill="none"
          stroke="#ffffff"
          strokeWidth="0.8"
        />

        {/* Paddle contact pulse ring */}
        <circle
          ref={hitRingRef}
          cx={f2(initialFrame.hitCx)}
          cy={f2(initialFrame.hitCy)}
          r={f2(initialFrame.hitR)}
          opacity={f2(initialFrame.hitOpacity)}
          fill="none"
          stroke="#60a5fa"
          strokeWidth="1.2"
        />

        {/* Motion trails (oldest to newest) */}
        {[3, 2, 1, 0].map((idx) => {
          const tr = initialFrame.trails[idx];
          return (
            <circle
              key={idx}
              ref={(el) => {
                trailRefs.current[idx] = el;
              }}
              cx={f2(tr.cx)}
              cy={f2(tr.cy)}
              r={f2(tr.r)}
              opacity={f2(tr.opacity)}
              fill="#fb923c"
            />
          );
        })}

        {/* Ping-pong ball body & specular highlight */}
        <ellipse
          ref={ballRef}
          cx={f2(initialFrame.cx)}
          cy={f2(initialFrame.cy)}
          rx={f2(initialFrame.rx)}
          ry={f2(initialFrame.ry)}
          fill={`url(#${ballGradId})`}
        />
        <circle
          ref={highlightRef}
          cx={f2(initialFrame.hlX)}
          cy={f2(initialFrame.hlY)}
          r="1.2"
          fill="#ffffff"
          opacity="0.85"
        />

        {/* Left paddle (red rubber) — rendered after ball for realistic contact overlap */}
        <g ref={leftPaddleRef} transform={initialFrame.leftTransform}>
          <rect x="-1.8" y="-9" width="3.6" height="10" rx="1.6" fill={`url(#${woodGradId})`} />
          <ellipse
            cx="0"
            cy="-19"
            rx={BLADE_RX}
            ry="10"
            fill={`url(#${redRubberId})`}
            stroke="#92400e"
            strokeWidth="1"
          />
          <ellipse cx="-2.2" cy="-22.5" rx="1.8" ry="3.2" fill="#ffffff" opacity="0.22" />
        </g>

        {/* Right paddle (dark rubber, mirrored horizontally around x=120) */}
        <g transform="translate(240 0) scale(-1 1)">
          <g ref={rightPaddleRef} transform={initialFrame.rightTransform}>
            <rect x="-1.8" y="-9" width="3.6" height="10" rx="1.6" fill={`url(#${woodGradId})`} />
            <ellipse
              cx="0"
              cy="-19"
              rx={BLADE_RX}
              ry="10"
              fill={`url(#${darkRubberId})`}
              stroke="#92400e"
              strokeWidth="1"
            />
            <ellipse cx="-2.2" cy="-22.5" rx="1.8" ry="3.2" fill="#ffffff" opacity="0.22" />
          </g>
        </g>
      </svg>

      {/* Text Label & Live Rally Counter */}
      <div className="flex flex-col items-center gap-1 text-center">
        <p className="font-display font-black text-sm text-foreground tracking-wide inline-flex items-center gap-0.5">
          <span>{label}</span>
          <span className="inline-flex items-center gap-0.5 ml-1" aria-hidden="true">
            <span className="size-1 rounded-full bg-current animate-pulse" style={{ animationDelay: '0ms' }} />
            <span className="size-1 rounded-full bg-current animate-pulse" style={{ animationDelay: '150ms' }} />
            <span className="size-1 rounded-full bg-current animate-pulse" style={{ animationDelay: '300ms' }} />
          </span>
        </p>
        <p className="text-[11px] font-bold text-muted-foreground tabular-nums">
          <span ref={rallyRef}>暖身對打 · 第 1 拍</span>
        </p>
      </div>
    </motion.div>
  );
};

export default PingPongLoader;
