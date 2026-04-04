import type { Variants } from 'framer-motion';

/**
 * 🌟 全站統一容器動畫 (Container)
 * 用於父元素，負責控制子元素的交錯 (Stagger) 進入效果
 */
export const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1, // 子元素間隔 0.1s
      delayChildren: 0.1,    // 容器延遲 0.1s 開始
    },
  },
};

/**
 * 🌟 全站統一子元素動畫 (Item)
 * 用於列表中的每一項，實現「由下往上淡入」的高級感
 */
export const itemVariants: Variants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      type: 'spring',
      stiffness: 100,
      damping: 15,
    },
  },
};

/**
 * 🌟 頁面標題/區塊淡入動畫
 */
export const fadeInUp: Variants = {
  hidden: { y: 15, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

/**
 * 🌟 頁面切換主動畫 (Page Transition)
 */
export const pageVariants: Variants = {
  initial: { opacity: 0, x: 10 },
  animate: { 
    opacity: 1, 
    x: 0,
    transition: {
      duration: 0.5,
      ease: [0.22, 1, 0.36, 1],
      when: "beforeChildren",
    }
  },
  exit: { 
    opacity: 0, 
    x: -10,
    transition: {
      duration: 0.3,
    }
  },
};
