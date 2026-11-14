import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { useGame } from '../game/store'

const TITLE = 'NOCTURNE'

/** Cinematic opening: letterbox bars, a fade from black and a staggered title reveal. */
export default function Intro() {
  const finishIntro = useGame((s) => s.finishIntro)

  useEffect(() => {
    const id = setTimeout(finishIntro, 4600)
    return () => clearTimeout(id)
  }, [finishIntro])

  return (
    <motion.div
      className="pointer-events-auto absolute inset-0 cursor-pointer"
      onClick={finishIntro}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.9 } }}
    >
      {/* fade from black */}
      <motion.div
        className="absolute inset-0 bg-ink"
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 2.4, ease: [0.4, 0, 0.2, 1], delay: 0.3 }}
      />
      {/* letterbox */}
      <motion.div
        className="absolute inset-x-0 top-0 h-[11vh] bg-black"
        initial={{ y: 0 }}
        exit={{ y: '-100%' }}
        transition={{ duration: 0.9 }}
      />
      <motion.div
        className="absolute inset-x-0 bottom-0 h-[11vh] bg-black"
        initial={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ duration: 0.9 }}
      />

      <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
        <motion.div
          className="mb-6 text-[0.62rem] font-medium uppercase tracking-[0.6em] text-mist/70"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 1.2 }}
        >
          A night run experience
        </motion.div>
        <h1 className="font-display text-glow flex text-[clamp(3.2rem,13vw,9.5rem)] leading-none font-normal tracking-[0.12em] text-silver">
          {TITLE.split('').map((ch, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, filter: 'blur(14px)', y: 24 }}
              animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
              transition={{ delay: 1.1 + i * 0.11, duration: 1.3, ease: [0.2, 0.7, 0.2, 1] }}
            >
              {ch}
            </motion.span>
          ))}
        </h1>
        <motion.div
          className="hairline mt-7 w-56"
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ delay: 2.3, duration: 1.4 }}
        />
        <motion.p
          className="font-display mt-5 text-xl italic text-mist/80"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.6, duration: 1.4 }}
        >
          Run into the blue hour
        </motion.p>
      </div>
      <motion.div
        className="absolute bottom-[13vh] inset-x-0 text-center text-[0.6rem] uppercase tracking-[0.5em] text-mist/40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 3.2, duration: 1 }}
      >
        Click to skip
      </motion.div>
    </motion.div>
  )
}
