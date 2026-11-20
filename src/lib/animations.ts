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
      staggerChildren: 0.04,
      delayChildren: 0.02,
    },
  },
};

/**
 * 🌟 全站統一子元素動畫 (Item)
 * 用於列表中的每一項，實現「由下往上淡入」的高級感
 */
export const itemVariants: Variants = {
  hidden: { y: 12, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      type: 'spring',
      stiffness: 180,
      damping: 20,
    },
  },
};

/**
 * 🌟 頁面標題/區塊淡入動畫
 */
export const fadeInUp: Variants = {
  hidden: { y: 10, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      duration: 0.28,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

/**
 * 🌟 頁面切換主動畫 (Page Transition)
 */
export const pageVariants: Variants = {
  initial: { opacity: 0, y: 6 },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.18,
      ease: [0.22, 1, 0.36, 1],
    },
  },
  exit: {
    opacity: 0,
    y: -4,
    transition: {
      duration: 0.12,
    },
  },
};
