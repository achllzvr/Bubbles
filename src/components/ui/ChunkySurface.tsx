import { forwardRef, type HTMLAttributes, type ReactNode } from 'react'
import { motion, type HTMLMotionProps } from 'framer-motion'
import { pressHover, pressTap, pressTransition } from './motionPresets'

type DivProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  'onAnimationStart' | 'onDrag' | 'onDragEnd' | 'onDragStart' | 'style'
>

export interface ChunkySurfaceProps extends DivProps {
  children?: ReactNode
  className?: string
  interactive?: boolean
  asButton?: boolean
  onClick?: HTMLMotionProps<'div'>['onClick']
}

export const ChunkySurface = forwardRef<HTMLDivElement, ChunkySurfaceProps>(
  function ChunkySurface(
    {
      children,
      className = '',
      interactive = false,
      asButton = false,
      onClick,
      ...rest
    },
    ref,
  ) {
    const classes = [
      'playful-card',
      interactive || asButton ? 'cursor-pointer' : '',
      className,
    ]
      .filter(Boolean)
      .join(' ')

    if (interactive || asButton) {
      return (
        <motion.div
          ref={ref}
          role={asButton ? 'button' : undefined}
          tabIndex={asButton ? 0 : undefined}
          onClick={onClick}
          onKeyDown={
            asButton
              ? (event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onClick?.(event as never)
                  }
                }
              : undefined
          }
          whileHover={{
            ...pressHover,
            boxShadow: 'var(--shadow-lift)',
          }}
          whileTap={{
            ...pressTap,
            boxShadow: 'var(--shadow-press)',
          }}
          transition={pressTransition}
          className={classes}
          {...rest}
        >
          {children}
        </motion.div>
      )
    }

    return (
      <div ref={ref} className={classes} onClick={onClick} {...rest}>
        {children}
      </div>
    )
  },
)
