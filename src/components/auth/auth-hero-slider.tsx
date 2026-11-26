"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Check, Lock } from "lucide-react";

import symbol from "@/components/brand/assets/sollelio-events-symbol-mono-white.svg";
import { cn } from "@/lib/utils";

const SLIDE_MS = 6000;

/* ------------------------------------------------------------------ */
/* Small building blocks                                               */
/* ------------------------------------------------------------------ */

/** Fades + lifts its content in when `on`. Delay staggers the cards. */
function Reveal({
  on,
  delay = 0,
  className,
  children,
}: {
  on: boolean;
  delay?: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "transition-[opacity,transform] duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[opacity,transform] motion-reduce:transition-none",
        on ? "translate-y-0 scale-100 opacity-100" : "translate-y-6 scale-[0.97] opacity-0",
        className,
      )}
      style={{ transitionDelay: on ? `${delay}ms` : "0ms" }}
    >
      {children}
    </div>
  );
}

function Card({
  tone = "front",
  className,
  children,
}: {
  tone?: "front" | "back";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-[22px] p-4 text-[13px] leading-snug text-neutral-950 shadow-[0_24px_48px_-16px_rgba(0,0,0,0.75)] ring-[6px] ring-white/[0.07]",
        tone === "front" ? "bg-white" : "bg-neutral-200",
        className,
      )}
    >
      {children}
    </div>
  );
}

function Row({
  divider,
  className,
  children,
}: {
  divider?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 py-2.5",
        divider && "border-t border-neutral-300/80",
        className,
      )}
    >
      {children}
    </div>
  );
}

function Muted({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("text-xs text-neutral-500", className)}>{children}</span>;
}

function Pill({
  children,
  tone = "dark",
}: {
  children: React.ReactNode;
  tone?: "dark" | "outline";
}) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
        tone === "dark"
          ? "bg-neutral-950 text-white"
          : "border border-neutral-400 text-neutral-600",
      )}
    >
      {children}
    </span>
  );
}

function Avatar({ children, light }: { children: React.ReactNode; light?: boolean }) {
  return (
    <span
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-full text-[11px] font-semibold",
        light ? "bg-neutral-400/70 text-neutral-900" : "bg-neutral-950 text-white",
      )}
    >
      {children}
    </span>
  );
}

function Btn({ children, outline }: { children: React.ReactNode; outline?: boolean }) {
  return (
    <div
      className={cn(
        "grid h-10 place-items-center rounded-xl text-[13px] font-semibold",
        outline
          ? "border border-neutral-300 bg-white text-neutral-950"
          : "bg-neutral-950 text-white",
      )}
    >
      {children}
    </div>
  );
}

function Tick() {
  return (
    <span className="grid size-5 shrink-0 place-items-center rounded-full bg-neutral-950 text-white">
      <Check className="size-3" strokeWidth={3} />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Slides (real cards, real text)                                      */
/* ------------------------------------------------------------------ */

type Slide = {
  title: string;
  body: string;
  stage: (on: boolean) => React.ReactNode;
};

const SLIDES: Slide[] = [
  {
    title: "Every inquiry, captured exactly as sent",
    body: "Requests from your public form or your team land in one place, with the customer's own words preserved.",
    stage: (on) => (
      <>
        <Reveal on={on} delay={100} className="w-[88%] self-end">
          <Card tone="back" className="px-4 pb-12 pt-3">
            <div className="flex items-center justify-between pb-1.5">
              <span className="text-sm font-semibold">Inquiries</span>
              <Pill>3 new</Pill>
            </div>
            <Row divider>
              <div className="flex items-center gap-3">
                <Avatar>AK</Avatar>
                <div>
                  <div className="font-semibold">Amira Khan</div>
                  <Muted>Public form</Muted>
                </div>
              </div>
              <Muted>2 min</Muted>
            </Row>
            <Row divider>
              <div className="flex items-center gap-3">
                <Avatar light>RC</Avatar>
                <div>
                  <div className="font-semibold">Rosewood Corp</div>
                  <Muted>WhatsApp</Muted>
                </div>
              </div>
              <Muted>1 h</Muted>
            </Row>
          </Card>
        </Reveal>
        <Reveal on={on} delay={260} className="relative z-10 -mt-9 w-[88%]">
          <Card>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Original message</span>
              <Muted>Kept as sent</Muted>
            </div>
            <div className="mt-3 rounded-2xl bg-neutral-100 p-3 text-[13px]">
              Hi! Can you cater a wedding for 120 guests on 14 March? Halal menu
              please, and a small stage setup.
            </div>
            <Row divider className="mt-3">
              <div className="flex items-center gap-3">
                <Avatar>AK</Avatar>
                <div>
                  <div className="font-semibold">Matched to Amira Khan</div>
                  <Muted>2 past events</Muted>
                </div>
              </div>
            </Row>
            <Btn>Create prospective event</Btn>
          </Card>
        </Reveal>
      </>
    ),
  },
  {
    title: "Quotes that are never silently rewritten",
    body: "Build from services and packages, publish a version, and every change becomes a new one.",
    stage: (on) => (
      <>
        <Reveal on={on} delay={100} className="w-[92%]">
          <Card>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Quote for Amira Khan</span>
              <Pill>v2 · Published</Pill>
            </div>
            <Row divider className="mt-2">
              <span>Wedding catering × 120</span>
              <span className="font-semibold">$4,800</span>
            </Row>
            <Row divider>
              <span>Stage decoration package</span>
              <span className="font-semibold">$1,200</span>
            </Row>
            <Row divider>
              <span>Early booking discount</span>
              <span className="font-semibold">−$300</span>
            </Row>
            <Row divider>
              <span className="font-semibold">Total</span>
              <span className="text-lg font-bold">$5,700</span>
            </Row>
            <div className="flex items-center justify-between pt-1">
              <Muted>Expires 12 Dec</Muted>
              <Muted className="flex items-center gap-1">
                <Lock className="size-3" /> Locked
              </Muted>
            </div>
          </Card>
        </Reveal>
        <Reveal on={on} delay={260} className="relative -mt-2 w-[80%] self-end">
          <Card tone="back" className="pt-6">
            <div className="font-semibold">Versions</div>
            <Row divider className="mt-1">
              <span>v1</span>
              <Muted>Replaced by v2</Muted>
            </Row>
            <Row divider>
              <span className="font-semibold">v2</span>
              <Pill>Accepted</Pill>
            </Row>
            <Row divider>
              <span>v3</span>
              <Pill tone="outline">Draft</Pill>
            </Row>
            <Muted>Changes create a new version.</Muted>
          </Card>
        </Reveal>
      </>
    ),
  },
  {
    title: "A branded page your clients just open",
    body: "Your logo and colours, on any phone. Clients accept after a quick check, or ask for changes instead.",
    stage: (on) => (
      <>
        <Reveal on={on} delay={100} className="relative z-10 w-[70%]">
          <Card className="overflow-hidden p-0">
            <div className="flex items-center gap-3 bg-neutral-950 px-4 py-3 text-white">
              <span className="grid size-8 place-items-center rounded-full bg-white text-xs font-bold text-neutral-950">
                R
              </span>
              <div>
                <div className="text-xs font-semibold">Rosewood Catering</div>
                <div className="text-[11px] text-neutral-400">Your quote is ready</div>
              </div>
            </div>
            <div className="p-4">
              <Muted>Wedding · 14 March</Muted>
              <div className="mb-2 text-2xl font-bold">$5,700</div>
              <Row>
                <span>Catering × 120</span>
                <span className="font-semibold">$4,800</span>
              </Row>
              <Row divider>
                <span>Stage decoration</span>
                <span className="font-semibold">$1,200</span>
              </Row>
              <Row divider>
                <span>Discount</span>
                <span className="font-semibold">−$300</span>
              </Row>
              <Muted className="my-2 block">Valid until 12 December</Muted>
              <div className="grid gap-2">
                <Btn>Accept quote</Btn>
                <Btn outline>Ask for changes</Btn>
              </div>
              <Muted className="mt-2 block text-center">No account or password needed</Muted>
            </div>
          </Card>
        </Reveal>
        <Reveal on={on} delay={280} className="-mt-24 w-[62%] self-end">
          <Card tone="back" className="relative z-20">
            <div className="font-semibold">Quick identity check</div>
            <Muted className="mb-3 mt-0.5 block">Enter the code we sent you.</Muted>
            <div className="flex gap-1.5">
              {["4", "8", "1", ""].map((d, i) => (
                <span
                  key={i}
                  className="grid h-8 flex-1 place-items-center rounded-lg bg-white text-sm font-bold"
                >
                  {d}
                </span>
              ))}
            </div>
          </Card>
        </Reveal>
      </>
    ),
  },
  {
    title: "Partial payments, with the balance worked out",
    body: "Record what was agreed and what was received. Corrections never erase the past.",
    stage: (on) => (
      <>
        <Reveal on={on} delay={100} className="w-[92%]">
          <Card>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Payments</span>
              <Muted>Amira Khan · 14 March</Muted>
            </div>
            <div className="mt-3">
              <Muted>Remaining balance</Muted>
              <div className="text-2xl font-bold">$2,850</div>
              <Muted>of $5,700 agreed</Muted>
            </div>
            <Row divider className="mt-3">
              <div>
                <div className="font-semibold">Deposit</div>
                <Muted>2 Nov · Bank transfer</Muted>
              </div>
              <span className="font-semibold">+$2,000</span>
            </Row>
            <Row divider>
              <div>
                <div className="font-semibold">Second payment</div>
                <Muted>18 Nov · Cash</Muted>
              </div>
              <span className="font-semibold">+$850</span>
            </Row>
          </Card>
        </Reveal>
        <Reveal on={on} delay={260} className="relative -mt-2 w-[86%] self-end">
          <Card tone="back" className="pt-6">
            <div className="flex items-center justify-between">
              <span className="font-semibold">Correction</span>
              <Pill tone="outline">History kept</Pill>
            </div>
            <Row divider className="mt-2">
              <Muted className="line-through">Cash · $800</Muted>
              <span className="font-semibold">Cash · $850</span>
            </Row>
            <Muted className="block">
              Edited by Sara, 19 Nov. The original entry stays on record.
            </Muted>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-300">
              <div className="h-full w-1/2 rounded-full bg-neutral-950" />
            </div>
            <div className="mt-1.5 flex justify-between">
              <Muted>Received $2,850</Muted>
              <Muted>50%</Muted>
            </div>
          </Card>
        </Reveal>
      </>
    ),
  },
  {
    title: "Accepted isn't confirmed. You decide when.",
    body: "Set your own conditions. When they're met, confirm the event with one deliberate action.",
    stage: (on) => (
      <>
        <Reveal on={on} delay={100} className="relative z-10 w-[90%]">
          <Card>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Wedding · Amira Khan</span>
              <Muted>14 March</Muted>
            </div>
            <Muted className="mt-0.5 block">Your conditions for “confirmed”</Muted>
            <div className="my-3 grid gap-2.5 border-t border-neutral-300/80 pt-3">
              {["Quote v2 accepted", "Minimum payment received", "Contract signed"].map((c) => (
                <div key={c} className="flex items-center gap-2.5">
                  <Tick />
                  <span>{c}</span>
                </div>
              ))}
            </div>
            <Btn>Confirm event</Btn>
            <Muted className="mt-2 block text-center">Sollelio never confirms on its own.</Muted>
          </Card>
        </Reveal>
        <Reveal on={on} delay={280} className="-mt-6 w-[84%] self-end">
          <Card tone="back" className="pt-9">
            <div className="font-semibold">Home · Next actions</div>
            <Row divider className="mt-1">
              <span>New inquiries</span>
              <Pill>4</Pill>
            </Row>
            <Row divider>
              <span>Change requests</span>
              <Pill>2</Pill>
            </Row>
            <Row divider>
              <span className="font-semibold">Ready to confirm</span>
              <Pill>1</Pill>
            </Row>
          </Card>
        </Reveal>
      </>
    ),
  },
];

/* ------------------------------------------------------------------ */
/* Slider                                                              */
/* ------------------------------------------------------------------ */

export function AuthHeroSlider() {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const remaining = useRef(SLIDE_MS);
  const startedAt = useRef(0);

  // Reset the countdown whenever the slide changes (auto or by click).
  useEffect(() => {
    remaining.current = SLIDE_MS;
  }, [current]);

  // Auto-advance. Hovering pauses and resumes with the time that was left.
  useEffect(() => {
    if (paused) return;
    startedAt.current = performance.now();
    const t = setTimeout(
      () => setCurrent((n) => (n + 1) % SLIDES.length),
      remaining.current,
    );
    return () => {
      clearTimeout(t);
      remaining.current -= performance.now() - startedAt.current;
    };
  }, [current, paused]);

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Sollelio Events highlights"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="relative flex h-full min-h-[560px] flex-col overflow-hidden rounded-[28px] border border-white/25 bg-black"
    >
      {/* Keyframes live here so the progress bar never depends on globals.css */}
      <style>{`@keyframes hero-progress{from{transform:scaleX(0)}to{transform:scaleX(1)}}`}</style>

      {/* Subtle grid + top glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 80% 45% at 50% 0%, rgba(255,255,255,0.10), transparent 70%), linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)",
          backgroundSize: "100% 100%, 56px 56px, 56px 56px",
          maskImage: "linear-gradient(to bottom, black 35%, transparent 80%)",
          WebkitMaskImage: "linear-gradient(to bottom, black 35%, transparent 80%)",
        }}
      />

      {/* Slides live in their own area, so the progress bars never overlap them */}
      <div className="relative min-h-0 flex-1">
      {SLIDES.map((s, n) => {
        const on = n === current;
        return (
          <div
            key={s.title}
            aria-hidden={!on}
            className={cn(
              "absolute inset-0 flex flex-col items-center px-8 pb-3 pt-8 transition-opacity duration-700 ease-out motion-reduce:transition-none",
              on ? "opacity-100" : "pointer-events-none opacity-0",
            )}
          >
            <div className="flex min-h-0 w-full max-w-[340px] flex-1 flex-col justify-center overflow-hidden">
              <div className="flex origin-center flex-col [@media(max-height:820px)]:scale-[0.86] [@media(max-height:720px)]:scale-[0.72]">
                {s.stage(on)}
              </div>
            </div>

            <Reveal
              on={on}
              delay={420}
              className="flex w-full max-w-[400px] flex-col items-center pt-8 text-center"
            >
              <span className="grid size-12 place-items-center rounded-2xl border border-white/20 bg-black shadow-[0_0_30px_rgba(255,255,255,0.12)]">
                <Image src={symbol} alt="" width={22} height={22} unoptimized />
              </span>
              <h2 className="mt-5 text-[26px] font-medium leading-[1.15] text-white xl:text-[28px]">
                {s.title}
              </h2>
              <p className="mt-3 max-w-[340px] text-sm leading-relaxed text-white/55">
                {s.body}
              </p>
            </Reveal>
          </div>
        );
      })}
      </div>

      {/* Progress bars: GPU-friendly scaleX, advance when the fill finishes */}
      <div className="relative z-10 flex shrink-0 gap-2 px-10 pb-6 pt-3">
        {SLIDES.map((s, n) => (
          <button
            key={s.title}
            type="button"
            onClick={() => setCurrent(n)}
            aria-label={`Show slide ${n + 1}: ${s.title}`}
            aria-current={n === current}
            className="h-1 flex-1 overflow-hidden rounded-full bg-white/20 transition-all duration-300 hover:h-1.5 hover:bg-white/30"
          >
            <span
              key={n === current ? `run-${current}` : `idle-${n}-${n < current}`}
              className="block h-full origin-left rounded-full bg-white"
              style={
                n === current
                  ? {
                      animation: `hero-progress ${SLIDE_MS}ms linear forwards`,
                      animationPlayState: paused ? "paused" : "running",
                    }
                  : { transform: `scaleX(${n < current ? 1 : 0})` }
              }
            />
          </button>
        ))}
      </div>
    </section>
  );
}