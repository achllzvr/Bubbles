import type { Transition, Variants } from 'framer-motion'

export const easeOut = [0.22, 1, 0.36, 1] as const
export const easePress = [0.23, 1, 0.32, 1] as const

export const springSoft: Transition = {
  type: 'spring',
  stiffness: 250,
  damping: 22,
}

export const springBouncy: Transition = {
  type: 'spring',
  stiffness: 420,
  damping: 18,
}

export const pressTransition: Transition = {
  type: 'tween',
  duration: 0.1,
  ease: easePress,
}

export const enterTransition: Transition = {
  type: 'tween',
  duration: 0.55,
  ease: easeOut,
}

export const fadeTransition: Transition = {
  type: 'tween',
  duration: 0.2,
  ease: easeOut,
}

/** Shared hover/tap press for chunky controls. */
export const pressHover = { y: -2 }
export const pressTap = { y: 5 }

export const enterUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: enterTransition,
  },
  exit: {
    opacity: 0,
    y: 10,
    transition: fadeTransition,
  },
}

export const fade: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: fadeTransition },
  exit: { opacity: 0, transition: fadeTransition },
}

export const slideUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: enterTransition,
  },
  exit: {
    opacity: 0,
    y: 16,
    transition: fadeTransition,
  },
}

export function stagger(delayChildren = 0.05, staggerChildren = 0.05): Variants {
  return {
    hidden: {},
    visible: {
      transition: { delayChildren, staggerChildren },
    },
  }
}

export const messageEnter: Variants = {
  hidden: { opacity: 0, y: 12, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 380, damping: 24 },
  },
}
