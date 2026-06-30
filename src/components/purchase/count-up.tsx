"use client";

import { useEffect, useRef, useState } from "react";

interface CountUpProps {
  end: number;
  duration?: number; // ms
  className?: string;
}

/**
 * CountUp 数字跳动动画组件
 * - 从 0 跳动到目标值
 * - 支持 prefers-reduced-motion（直接显示最终值）
 * - 使用 requestAnimationFrame 实现平滑动画
 */
export function CountUp({ end, duration = 600, className }: CountUpProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const prevEndRef = useRef(end);

  // 检测用户是否开启减弱动效
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    // 如果 end 值变化，重置动画
    if (prevEndRef.current !== end) {
      prevEndRef.current = end;
      setDisplayValue(0);
      startTimeRef.current = null;
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    }

    // 如果用户开启减弱动效，直接显示最终值
    if (prefersReducedMotion) {
      setDisplayValue(end);
      return;
    }

    // 如果已经是目标值，不需要动画
    if (displayValue === end) return;

    const animate = (currentTime: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = currentTime;
      }

      const elapsed = currentTime - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      // 使用 easeOut 缓动函数让动画更自然
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(easeOut * end);

      setDisplayValue(current);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(end);
        animationRef.current = null;
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [end, duration, prefersReducedMotion]);

  return <span className={className}>{displayValue}</span>;
}