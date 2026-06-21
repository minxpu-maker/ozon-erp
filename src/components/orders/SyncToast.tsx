'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { RefreshCw, BadgeCheck, TrendingUp, ArrowRightLeft, Store, Clock4, CircleX, X } from 'lucide-react'

interface SyncToastProps {
  status: 'syncing' | 'success' | 'error'
  newOrders: number
  statusUpdates: number
  shopCount: number
  syncTime: string
  errorMessage?: string
  onRetry?: () => void
  onClose: () => void
}

export function SyncToast({
  status,
  newOrders,
  statusUpdates,
  shopCount,
  syncTime,
  errorMessage = '连接超时，请重试',
  onRetry,
  onClose
}: SyncToastProps) {
  const [isExiting, setIsExiting] = useState(false)
  const [isEntered, setIsEntered] = useState(false)
  const [displayNumbers, setDisplayNumbers] = useState({
    newOrders: 0,
    statusUpdates: 0,
    shopCount: 0
  })
  const [countdown, setCountdown] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number>(0)
  const animationRef = useRef<number | null>(null)

  // 数字滚动动画
  const animateNumbers = useCallback((targetValues: typeof displayNumbers, duration: number = 300) => {
    const startValues = { ...displayNumbers }
    startTimeRef.current = performance.now()

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTimeRef.current
      const progress = Math.min(elapsed / duration, 1)
      const easeOut = 1 - Math.pow(1 - progress, 3)

      setDisplayNumbers({
        newOrders: Math.round(startValues.newOrders + (targetValues.newOrders - startValues.newOrders) * easeOut),
        statusUpdates: Math.round(startValues.statusUpdates + (targetValues.statusUpdates - startValues.statusUpdates) * easeOut),
        shopCount: Math.round(startValues.shopCount + (targetValues.shopCount - startValues.shopCount) * easeOut)
      })

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate)
      }
    }

    animationRef.current = requestAnimationFrame(animate)
  }, [displayNumbers])

  // 入场动画完成后开始数字滚动
  useEffect(() => {
    if (isEntered && status === 'success') {
      const timeout = setTimeout(() => {
        animateNumbers({ newOrders, statusUpdates, shopCount })
      }, 250)
      return () => clearTimeout(timeout)
    }
  }, [isEntered, status, newOrders, statusUpdates, shopCount, animateNumbers])

  // 自动消失计时
  useEffect(() => {
    if (!isEntered || isPaused || isExiting) return

    const duration = status === 'error' ? 5 : 3
    setCountdown(duration)

    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          handleExiting()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isEntered, isPaused, isExiting, status])

  // 清理动画
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [])

  const handleExiting = useCallback(() => {
    setIsExiting(true)
    setTimeout(() => onClose(), 200)
  }, [onClose])

  const handleClose = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    handleExiting()
  }, [handleExiting])

  const handleRetry = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    handleExiting()
    onRetry?.()
  }, [onRetry, handleExiting])

  // 容器样式
  const containerClass = `
    fixed top-4 left-1/2 -translate-x-1/2 z-40
    max-w-2xl w-[calc(100%-2rem)]
    rounded-xl backdrop-blur-xl bg-white/95
    shadow-[0_8px_32px_rgba(0,0,0,0.08),0_2px_8px_rgba(0,0,0,0.04)]
    border border-white/60
    transition-all duration-200 ease-out
    overflow-hidden
    ${isExiting 
      ? (status === 'error' ? 'animate-slideRight' : 'animate-slideUp') 
      : 'animate-slideDown'
    }
    ${!isExiting && isEntered ? 'hover:shadow-[0_12px_40px_rgba(0,0,0,0.1)] hover:-translate-y-px' : ''}
  `

  // 左色条样式
  const leftBarClass = status === 'error'
    ? 'w-1 rounded-l-xl bg-gradient-to-b from-red-400 to-red-600'
    : status === 'success'
      ? 'w-1 rounded-l-xl bg-gradient-to-b from-blue-400 to-blue-600 animate-pulse-glow'
      : 'w-1 rounded-l-xl bg-gradient-to-b from-blue-400 to-blue-600 animate-pulse'

  // 状态图标
  const StatusIcon = status === 'syncing' 
    ? RefreshCw 
    : status === 'success' 
      ? BadgeCheck 
      : CircleX

  const iconClass = status === 'syncing'
    ? 'w-5 h-5 text-blue-500 animate-spin'
    : status === 'success'
      ? 'w-5 h-5 text-blue-500 animate-iconPop'
      : 'w-5 h-5 text-red-500'

  return (
    <div
      className={containerClass}
      role="status"
      aria-live="polite"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onAnimationEnd={() => {
        if (!isExiting) setIsEntered(true)
      }}
    >
      {/* 左色条 */}
      <div className={leftBarClass} />

      <div className="flex items-center py-2.5 pl-4 pr-3 gap-3">
        {/* 同步中态 */}
        {status === 'syncing' && (
          <div className="flex items-center gap-3 flex-1">
            <StatusIcon className={iconClass} />
            <span className="text-sm font-medium text-gray-700">正在同步…</span>
            
            {/* 不确定进度条 */}
            <div className="h-1 w-48 rounded-full overflow-hidden bg-blue-100">
              <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-blue-400 to-blue-600 animate-indeterminate" />
            </div>
          </div>
        )}

        {/* 同步完成态 */}
        {status === 'success' && (
          <>
            <div className="flex items-center gap-3 flex-1">
              <StatusIcon className={iconClass} />
              <span className="text-sm font-medium text-gray-700">同步完成</span>

              {/* 新订单 */}
              {newOrders > 0 && (
                <div className="flex items-center gap-1.5 animate-slideDown" style={{ animationDelay: '0.3s' }}>
                  <TrendingUp className="w-4 h-4 text-blue-500" />
                  <span className="text-lg font-bold text-blue-600 font-mono tabular-nums animate-number-pulse">
                    {displayNumbers.newOrders}
                  </span>
                  <span className="text-xs text-gray-400">笔新订单</span>
                </div>
              )}

              {/* 状态更新 */}
              {statusUpdates > 0 && (
                <div className="flex items-center gap-1.5 animate-slideDown" style={{ animationDelay: newOrders > 0 ? '0.36s' : '0.3s' }}>
                  <ArrowRightLeft className="w-4 h-4 text-gray-400" />
                  <span className="text-lg font-semibold text-gray-600 font-mono tabular-nums">
                    {displayNumbers.statusUpdates}
                  </span>
                  <span className="text-xs text-gray-400">单状态变更</span>
                </div>
              )}

              {/* 店铺 */}
              <div className="flex items-center gap-1.5 animate-slideDown" style={{ animationDelay: '0.42s' }}>
                <Store className="w-4 h-4 text-gray-400" />
                <span className="text-lg font-medium text-gray-600 font-mono tabular-nums">
                  {displayNumbers.shopCount}
                </span>
                <span className="text-xs text-gray-400">店铺已同步</span>
              </div>
            </div>

            {/* 同步时间 */}
            <div className="flex items-center gap-1 text-gray-300">
              <Clock4 className="w-3.5 h-3.5" />
              <span className="text-xs text-gray-400">{syncTime}</span>
            </div>

            {/* 关闭按钮 */}
            <button
              onClick={handleClose}
              aria-label="关闭通知"
              className="p-1 hover:bg-gray-100 rounded transition-colors duration-150"
            >
              <X className="w-3.5 h-3.5 text-gray-300 hover:text-gray-500" />
            </button>
          </>
        )}

        {/* 同步失败态 */}
        {status === 'error' && (
          <>
            <div className="flex items-center gap-2 flex-1">
              <StatusIcon className={iconClass} />
              <span className="text-sm font-medium text-red-600">同步失败</span>
              <span className="text-xs text-red-400">{errorMessage}</span>
            </div>

            {/* 重试按钮 */}
            <button
              onClick={handleRetry}
              aria-label="重试同步"
              className="text-sm text-red-500 hover:text-red-700 underline ml-4"
            >
              重试
            </button>

            {/* 关闭按钮 */}
            <button
              onClick={handleClose}
              aria-label="关闭通知"
              className="p-1 hover:bg-gray-100 rounded transition-colors duration-150"
            >
              <X className="w-3.5 h-3.5 text-gray-300 hover:text-gray-500" />
            </button>
          </>
        )}
      </div>

      {/* 同步中态底部扫描线 */}
      {status === 'syncing' && (
        <div className="h-0.5 w-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-transparent via-blue-400 to-transparent animate-shimmer-line" />
        </div>
      )}

      {/* 进度指示器（倒计时） */}
      {status !== 'syncing' && isEntered && !isExiting && (
        <div 
          className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-1000 ease-linear"
          style={{ 
            width: `${(countdown / (status === 'error' ? 5 : 3)) * 100}%`,
            opacity: isPaused ? 0.3 : 1
          }}
        />
      )}
    </div>
  )
}

// 演示组件
export function SyncToastDemo() {
  const [showSuccess, setShowSuccess] = useState(false)
  const [showError, setShowError] = useState(false)
  const [showSyncing, setShowSyncing] = useState(false)

  return (
    <div className="p-8 space-y-4">
      <h2 className="text-lg font-semibold mb-4">SyncToast 组件演示</h2>
      
      <div className="flex gap-4">
        <button
          onClick={() => {
            setShowSyncing(true)
            setTimeout(() => setShowSyncing(false), 3000)
          }}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          同步中
        </button>
        
        <button
          onClick={() => setShowSuccess(true)}
          className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
        >
          成功 (2新单)
        </button>
        
        <button
          onClick={() => setShowError(true)}
          className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
        >
          失败
        </button>
      </div>

      {showSyncing && (
        <SyncToast
          status="syncing"
          newOrders={0}
          statusUpdates={0}
          shopCount={1}
          syncTime=""
          onClose={() => setShowSyncing(false)}
        />
      )}

      {showSuccess && (
        <SyncToast
          status="success"
          newOrders={2}
          statusUpdates={5}
          shopCount={1}
          syncTime="刚刚"
          onClose={() => setShowSuccess(false)}
        />
      )}

      {showError && (
        <SyncToast
          status="error"
          newOrders={0}
          statusUpdates={0}
          shopCount={0}
          syncTime=""
          errorMessage="店铺连接超时，请检查网络"
          onRetry={() => {
            setShowError(false)
            console.log('重试同步')
          }}
          onClose={() => setShowError(false)}
        />
      )}
    </div>
  )
}
