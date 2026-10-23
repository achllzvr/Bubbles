import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { motion, type HTMLMotionProps } from 'framer-motion'
import { pressHover, pressTap, pressTransition } from './motionPresets'

export type ChunkyButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'danger'
  | 'success'

export type ChunkyButtonSize = 'sm' | 'md' | 'lg'

type NativeButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'onAnimationStart' | 'onDrag' | 'onDragEnd' | 'onDragStart' | 'style'
>

export interface ChunkyButtonProps extends NativeButtonProps {
  variant?: ChunkyButtonVariant
  size?: ChunkyButtonSize
  children: ReactNode
  className?: string
  layout?: HTMLMotionProps<'button'>['layout']
}

const sizeClass: Record<ChunkyButtonSize, string> = {
  sm: 'min-h-9 px-3.5 py-1.5 text-[11px]',
  md: 'min-h-11 px-5 py-2.5 text-sm',
  lg: 'min-h-12 px-8 py-3 text-sm',
}

const variantClass: Record<ChunkyButtonVariant, string> = {
  primary:
    'border-2 border-accent-dark bg-accent text-on-accent [box-shadow:var(--shadow-btn-primary)]',
  secondary:
    'border-2 border-ink-stroke bg-surface-2 text-ink [box-shadow:var(--shadow-soft)]',
  ghost:
    'border-2 border-ink-stroke bg-surface text-ink-dim [box-shadow:var(--shadow-soft)] hover:text-ink',
  danger:
    'border-2 border-danger-dark bg-danger text-on-accent [box-shadow:var(--shadow-btn-danger)]',
  success:
    'border-2 border-success-dark bg-success text-on-accent [box-shadow:var(--shadow-btn-success)]',
}

const hoverShadow: Record<ChunkyButtonVariant, string> = {
  primary: 'var(--shadow-btn-primary-hover)',
  secondary: 'var(--shadow-lift)',
  ghost: 'var(--shadow-lift)',
  danger: 'var(--shadow-btn-danger-hover)',
  success: 'var(--shadow-btn-success-hover)',
}

const tapShadow: Record<ChunkyButtonVariant, string> = {
  primary: 'var(--shadow-btn-primary-press)',
  secondary: 'var(--shadow-press)',
  ghost: 'var(--shadow-press)',
  danger: 'var(--shadow-btn-danger-press)',
  success: 'var(--shadow-btn-success-press)',
}

export const ChunkyButton = forwardRef<HTMLButtonElement, ChunkyButtonProps>(
  function ChunkyButton(
    {
      variant = 'primary',
      size = 'md',
      children,
      className = '',
      disabled,
      type = 'button',
      layout,
      ...rest
    },
    ref,
  ) {
    return (
      <motion.button
        ref={ref}
        type={type}
        disabled={disabled}
        layout={layout}
        whileHover={
          disabled
            ? undefined
            : { ...pressHover, boxShadow: hoverShadow[variant] }
        }
        whileTap={
          disabled ? undefined : { ...pressTap, boxShadow: tapShadow[variant] }
        }
        transition={pressTransition}
        className={[
          'inline-flex items-center justify-center gap-2 rounded-full font-extrabold tracking-[0.08em] uppercase',
          'transition-[opacity,filter] duration-100',
          'disabled:pointer-events-none disabled:opacity-40',
          sizeClass[size],
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
  },
)
