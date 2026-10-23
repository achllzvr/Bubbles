export type MascotMood = 'idle' | 'thinking' | 'working' | 'break' | 'celebrate'

const moodCopy: Record<MascotMood, string> = {
  idle: 'here',
  thinking: 'thinking',
  working: 'with you',
  break: 'resting',
  celebrate: 'pop!',
}

const moodColor: Record<MascotMood, string> = {
  idle: 'var(--bubble-mint)',
  thinking: 'var(--bubble-orchid)',
  working: 'var(--bubble-sky)',
  break: 'var(--bubble-butter)',
  celebrate: 'var(--bubble-peach)',
}

export function Mascot({
  mood = 'idle',
  size = 56,
  showLabel = true,
}: {
  mood?: MascotMood
  size?: number
  showLabel?: boolean
}) {
  const happy = mood === 'celebrate'
  const sleepy = mood === 'break'
  const thinking = mood === 'thinking'
  const working = mood === 'working'
  const closedEyes = happy || sleepy

  return (
    <div
      className={`flex shrink-0 flex-col items-center gap-1.5 ${
        working || thinking ? 'animate-breathe' : 'animate-float-soft'
      }`}
      style={{ width: size }}
      role="img"
      aria-label={`Bubble companion is ${moodCopy[mood]}`}
    >
      <div
        className="bubble-wobble relative border border-white/40"
        style={{
          width: size,
          height: size,
          background: `radial-gradient(circle at 32% 24%, color-mix(in srgb, ${moodColor[mood]} 45%, white), ${moodColor[mood]} 72%)`,
          borderRadius: '48% 52% 50% 50% / 51% 47% 53% 49%',
          boxShadow: `0 ${size * 0.14}px ${size * 0.4}px color-mix(in srgb, ${moodColor[mood]} 32%, transparent)`,
        }}
      >
        <span className="absolute left-[19%] top-[14%] h-[22%] w-[19%] rounded-full bg-white/40 blur-[2px]" />

        {[
          { key: 'left', pos: 'left-[28%]' },
          { key: 'right', pos: 'right-[28%]' },
        ].map(({ key, pos }) => (
          <span
            key={key}
            className={`absolute top-[39%] bg-bubble-ink ${pos}`}
            style={
              closedEyes
                ? {
                    height: Math.max(2, size * 0.035),
                    width: size * 0.15,
                    borderRadius: '999px 999px 0 0',
                  }
                : {
                    height: size * (working ? 0.14 : 0.18),
                    width: size * 0.09,
                    borderRadius: 999,
                  }
            }
          />
        ))}

        <span
          className={`absolute bottom-[24%] left-1/2 -translate-x-1/2 border-bubble-ink ${
            happy
              ? 'h-[17%] w-[30%] rounded-b-full border-b-[3px]'
              : thinking
                ? 'h-[3px] w-[22%] -rotate-6 rounded-full bg-bubble-ink'
                : sleepy
                  ? 'h-[9%] w-[18%] rounded-full border-b-2'
                  : 'h-[12%] w-[25%] rounded-b-full border-b-[3px]'
          }`}
        />

        {(happy || sleepy) && (
          <>
            <span className="absolute bottom-[27%] left-[12%] h-[10%] w-[16%] rounded-full bg-bubble-ui/45" />
            <span className="absolute bottom-[27%] right-[12%] h-[10%] w-[16%] rounded-full bg-bubble-ui/45" />
          </>
        )}

        {thinking && (
          <>
            <span className="absolute -right-[13%] top-[6%] h-[13%] w-[13%] rounded-full bg-accent/50" />
            <span className="absolute -right-[28%] -top-[12%] h-[19%] w-[19%] rounded-full bg-accent/35" />
          </>
        )}

        {sleepy && (
          <span
            className="pixel-blink absolute -right-[18%] -top-[14%] font-bold text-ink-dim"
            style={{ fontSize: Math.max(9, size * 0.2) }}
            aria-hidden
          >
            z
          </span>
        )}

        {happy && (
          <span
            className="animate-sparkle absolute -left-[16%] -top-[10%]"
            style={{ fontSize: Math.max(11, size * 0.24) }}
            aria-hidden
          >
            ✨
          </span>
        )}
      </div>

      {showLabel && <span className="pixel-label text-ink-faint">{moodCopy[mood]}</span>}
    </div>
  )
}
