/**
 * Enterprise Premium Animation Presets
 * Consistência visual inspirada em Linear e Apple.
 */
import { Transition } from "framer-motion";

export const ENTERPRISE_TRANSITION: Transition = {
  type: "spring",
  stiffness: 260,
  damping: 30,
};

export const ENTERPRISE_EASE = [0.23, 1, 0.32, 1] as const;

export const PAGE_TRANSITION = {
  initial: { opacity: 0, y: 8, filter: "blur(4px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  exit: { opacity: 0, y: -8, filter: "blur(4px)" },
  transition: { duration: 0.4, ease: ENTERPRISE_EASE } as Transition,
};

export const STAGGER_CHILDREN = {
  animate: {
    transition: {
      staggerChildren: 0.05,
    } as Transition,
  },
};

export const FADE_IN_UP = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: ENTERPRISE_EASE } as Transition,
};
