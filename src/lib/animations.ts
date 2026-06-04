/**
 * Enterprise Premium Animation Presets
 * Consistência visual inspirada em Linear e Apple.
 */
import { Transition } from "framer-motion";

// Helper to detect reduced motion preference
const prefersReducedMotion = typeof window !== "undefined" 
  ? window.matchMedia("(prefers-reduced-motion: reduce)").matches 
  : false;

export const ENTERPRISE_TRANSITION: Transition = prefersReducedMotion 
  ? { duration: 0.2, ease: "linear" }
  : {
      type: "spring",
      stiffness: 260,
      damping: 30,
    };

export const ENTERPRISE_EASE = [0.23, 1, 0.32, 1] as const;

export const PAGE_TRANSITION = {
  initial: { opacity: 0, y: prefersReducedMotion ? 0 : 8, filter: prefersReducedMotion ? "none" : "blur(4px)" },
  animate: { opacity: 1, y: 0, filter: "none" },
  exit: { opacity: 0, y: prefersReducedMotion ? 0 : -8, filter: prefersReducedMotion ? "none" : "blur(4px)" },
  transition: { duration: prefersReducedMotion ? 0.3 : 0.4, ease: ENTERPRISE_EASE } as Transition,
};

export const STAGGER_CHILDREN = {
  animate: {
    transition: {
      staggerChildren: prefersReducedMotion ? 0 : 0.05,
    } as Transition,
  },
};

export const FADE_IN_UP = {
  initial: { opacity: 0, y: prefersReducedMotion ? 0 : 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: prefersReducedMotion ? 0.3 : 0.4, ease: ENTERPRISE_EASE } as Transition,
};

