export type FaceExpression = 'calm' | 'happy' | 'focused' | 'resting'

/**
 * Bubble fills are always pastel-light, so the face uses the fixed bubble ink
 * token rather than the theme text color.
 */
export function BubbleFace({
  expression,
  scale = 1,
  blush = false,
}: {
  expression: FaceExpression
  /** 1 ≈ a 100px bubble. */
  scale?: number
  blush?: boolean
}) {
  const eye = Math.max(4, Math.round(7 * scale))
  const gap = Math.max(8, Math.round(14 * scale))
  const closed = expression === 'happy' || expression === 'resting'
  const mouthWide = expression === 'happy'

  return (
    <span
      className="pointer-events-none flex flex-col items-center"
      style={{ gap: Math.max(2, Math.round(4 * scale)) }}
      aria-hidden
    >
      <span className="flex items-end" style={{ gap }}>
        {[0, 1].map((side) => (
          <span
            key={side}
            className="relative block bg-bubble-ink"
            style={
              closed
                ? {
                    width: eye * 1.5,
                    height: Math.max(2, Math.round(eye * 0.34)),
                    borderRadius: '999px 999px 0 0',
                  }
                : {
                    width: eye,
                    height: expression === 'focused' ? eye * 0.85 : eye * 1.25,
                    borderRadius: 999,
                  }
            }
          />
        ))}
      </span>

      <span className="relative flex items-start" style={{ gap: gap * 1.9 }}>
        {blush && (
          <>
            <span
              className="absolute rounded-full bg-bubble-ui/45"
              style={{
                width: eye * 1.6,
                height: eye * 0.9,
                left: -eye * 2.1,
                top: -eye * 0.2,
              }}
            />
            <span
              className="absolute rounded-full bg-bubble-ui/45"
              style={{
                width: eye * 1.6,
                height: eye * 0.9,
                right: -eye * 2.1,
                top: -eye * 0.2,
              }}
            />
          </>
        )}
        <span
          className="block border-bubble-ink"
          style={{
            width: Math.max(7, Math.round((mouthWide ? 15 : 11) * scale)),
            height: Math.max(3, Math.round((mouthWide ? 7 : 5) * scale)),
            borderBottomWidth: Math.max(2, Math.round(2.5 * scale)),
            borderBottomLeftRadius: 999,
            borderBottomRightRadius: 999,
          }}
        />
      </span>
    </span>
  )
}
