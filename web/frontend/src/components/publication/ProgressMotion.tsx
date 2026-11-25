import type { ReactNode } from "react";
import { LazyMotion, useInView, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { useRef } from "react";

const features = () => import("motion/react").then(({ domAnimation }) => domAnimation);

export function ResearchMotion({ children }: { children: ReactNode }) {
  return <LazyMotion features={features} strict>{children}</LazyMotion>;
}

export function ProgressConnection({ completed }: { completed: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const visible = useInView(ref, { once: true });
  const reduced = useReducedMotion();
  const scale = reduced || visible ? 1 : 0;
  const transition = { duration: reduced ? 0 : 0.45, ease: "easeOut" as const };
  return <span className="pub-progress-connection" ref={ref} aria-hidden="true">
    {completed && <>
      <m.span className="pub-connection-ink pub-connection-horizontal" initial={false} animate={{ scaleX: scale }} transition={transition} />
      <m.span className="pub-connection-ink pub-connection-vertical" initial={false} animate={{ scaleY: scale }} transition={transition} />
    </>}
  </span>;
}

export function ProgressReveal({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  return <m.div
    initial={reduced ? false : { opacity: 0.78, y: 4 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: reduced ? 0 : 0.25, ease: "easeOut" }}
  >{children}</m.div>;
}
