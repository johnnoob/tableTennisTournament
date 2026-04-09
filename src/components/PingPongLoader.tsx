import { motion } from "framer-motion";

/**
 * PingPongLoader — 桌球對打主題 Loading 動畫
 * 
 * 使用 Framer Motion 實作兩支球拍 + 一顆乒乓球的流暢對打動畫。
 */
const PingPongLoader = () => {
  const duration = 1.2;

  return (
    <div className="flex flex-col items-center justify-center gap-6 select-none">
      {/* ── Stage ── */}
      <div className="relative flex items-center justify-center" style={{ width: 180, height: 90 }}>
        
        {/* Left Paddle */}
        <motion.div
          className="absolute left-0 top-1/2"
          style={{ originY: 1, marginTop: -28 }}
          animate={{
            rotate: [0, -14, 0, 0, 0],
          }}
          transition={{
            duration: duration,
            times: [0, 0.04, 0.08, 0.5, 1],
            ease: "easeInOut",
            repeat: Infinity,
          }}
        >
          {/* Handle */}
          <div className="w-2.5 h-5 bg-amber-700 rounded-b mx-auto" />
          {/* Rubber face */}
          <div className="w-8 h-10 bg-gradient-to-br from-red-500 to-red-700 rounded-t-xl rounded-b-sm border-2 border-red-800/60 shadow-md" />
        </motion.div>

        {/* Right Paddle */}
        <motion.div
          className="absolute right-0 top-1/2"
          style={{ originY: 1, marginTop: -28 }}
          animate={{
            rotate: [0, 0, 0, 14, 0],
          }}
          transition={{
            duration: duration,
            times: [0, 0.46, 0.5, 0.54, 1],
            ease: "easeInOut",
            repeat: Infinity,
          }}
        >
          <div className="w-2.5 h-5 bg-amber-700 rounded-b mx-auto" />
          <div className="w-8 h-10 bg-gradient-to-br from-blue-600 to-blue-800 rounded-t-xl rounded-b-sm border-2 border-blue-900/60 shadow-md" />
        </motion.div>

        {/* Ball Axis Wrapper */}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            className="relative"
            animate={{
              x: [-54, 54, -54],
            }}
            transition={{
              duration: duration,
              ease: "easeInOut",
              repeat: Infinity,
            }}
          >
            <motion.div
              animate={{
                y: [0, -38, 0, -38, 0],
              }}
              transition={{
                duration: duration,
                times: [0, 0.25, 0.5, 0.75, 1],
                ease: "linear", // Linear timing for parabola emulation via times
                repeat: Infinity,
              }}
            >
              <motion.div
                className="w-4 h-4 rounded-full bg-gradient-to-br from-white via-orange-50 to-orange-200 border border-orange-300/70"
                animate={{
                  boxShadow: [
                    "0 0 6px 1px rgba(37,99,235,0.25)",
                    "0 0 14px 4px rgba(37,99,235,0.45)",
                    "0 0 6px 1px rgba(37,99,235,0.25)",
                    "0 0 14px 4px rgba(37,99,235,0.45)",
                    "0 0 6px 1px rgba(37,99,235,0.25)",
                  ]
                }}
                transition={{
                  duration: duration,
                  times: [0, 0.25, 0.5, 0.75, 1],
                  repeat: Infinity,
                }}
              />
            </motion.div>
          </motion.div>
        </div>

        {/* Shadow on the "table" */}
        <motion.div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-1.5 rounded-full bg-slate-400/30"
          animate={{
            scale: [1, 0.5, 1, 0.5, 1],
            opacity: [0.25, 0.10, 0.25, 0.10, 0.25],
          }}
          transition={{
            duration: duration,
            times: [0, 0.25, 0.5, 0.75, 1],
            ease: "easeInOut",
            repeat: Infinity,
          }}
        />

        {/* Table net — dashed center line */}
        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 w-px h-3 border-l border-dashed border-slate-300" />
      </div>

      {/* ── Label ── */}
      <motion.p 
        className="font-display font-bold text-primary-navy/70 tracking-[0.25em] uppercase text-xs"
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
      >
        Loading…
      </motion.p>
    </div>
  );
};

export default PingPongLoader;
