import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { pressHover, pressTap, pressTransition } from './motionPresets'

type NativeButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'onAnimationStart' | 'onDrag' | 'onDragEnd' | 'onDragStart' | 'style'
>

export type ChunkyIconButtonVariant = 'primary' | 'secondary' | 'ghost'

export interface ChunkyIconButtonProps extends NativeButtonProps {
  children: ReactNode
  variant?: ChunkyIconButtonVariant
  className?: string
  label: string
}

const variantClass: Record<ChunkyIconButtonVariant, string> = {
  primary:
    'border-2 border-accent-dark bg-accent text-on-accent [box-shadow:var(--shadow-btn-primary)]',
  secondary:
    'border-2 border-ink-stroke bg-surface-2 text-ink [box-shadow:var(--shadow-soft)]',
  ghost:
    'border-2 border-ink-stroke bg-surface text-ink-dim [box-shadow:var(--shadow-soft)] hover:text-ink',
}

const hoverShadow: Record<ChunkyIconButtonVariant, string> = {
  primary: 'var(--shadow-btn-primary-hover)',
  secondary: 'var(--shadow-lift)',
  ghost: 'var(--shadow-lift)',
}

const tapShadow: Record<ChunkyIconButtonVariant, string> = {
  primary: 'var(--shadow-btn-primary-press)',
  secondary: 'var(--shadow-press)',
  ghost: 'var(--shadow-press)',
}

export const ChunkyIconButton = forwardRef<
  HTMLButtonElement,
  ChunkyIconButtonProps
>(function ChunkyIconButton(
  {
    children,
    variant = 'secondary',
    className = '',
    label,
    disabled,
    type = 'button',
    ...rest
  },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      type={type}
      disabled={disabled}
      aria-label={label}
      title={label}
      whileHover={
        disabled
          ? undefined
          : { ...pressHover, boxShadow: hoverShadow[variant], scale: 1.04 }
      }
      whileTap={
        disabled
          ? undefined
          : { ...pressTap, boxShadow: tapShadow[variant], scale: 0.94 }
      }
      transition={pressTransition}
      className={[
        'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full',
        'font-extrabold transition-[opacity] duration-100',
        'disabled:pointer-events-none disabled:opacity-40',
        variantClass[variant],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </motion.button>
  )
})
