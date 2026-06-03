'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Box, DownloadCloud, Sparkles, MapPin, Calculator, X } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [phoneError, setPhoneError] = useState(false);
  const [loading, setLoading] = useState(false);

  // 验证手机号格式
  const isValidPhone = (p: string) => /^1\d{10}$/.test(p);

  // 倒计时效果
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // 获取验证码
  const handleGetCode = async () => {
    if (!isValidPhone(phone)) {
      setPhoneError(true);
      return;
    }
    setPhoneError(false);
    
    // 模拟发送验证码
    setCountdown(60);
    // 实际项目中应该调用API发送验证码
    // await fetch('/api/auth/send-code', { method: 'POST', body: JSON.stringify({ phone }) });
  };

  // 登录
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidPhone(phone) || code.length < 4) return;
    
    setLoading(true);
    
    // 模拟登录成功
    setTimeout(() => {
      setLoading(false);
      // 保存登录状态
      localStorage.setItem('isLoggedIn', 'true');
      localStorage.setItem('userPhone', phone);
      // 跳转到仪表盘
      router.push('/dashboard');
    }, 1000);
    
    // 实际项目中应该调用API验证登录
    // const res = await fetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ phone, code }) });
  };

  const canGetCode = isValidPhone(phone) && countdown === 0;
  const canLogin = isValidPhone(phone) && code.length >= 4;

  return (
    <div className="min-h-screen bg-[#F6F8FB] flex items-center justify-center p-6">
      <div className="w-full max-w-5xl">
        <div className="bg-white rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.08)] overflow-hidden">
          <div className="grid lg:grid-cols-2">
            
            {/* 左侧品牌展示区域 */}
            <div className="bg-gradient-to-br from-[#2F6BFF] to-[#2F6BFF]/80 p-10 lg:p-12 flex flex-col justify-center">
              {/* Logo和名称 */}
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <Box className="w-7 h-7 text-white" />
                </div>
                <span className="text-2xl font-bold text-white">Ozon ERP</span>
              </div>
              
              {/* 品牌标语 */}
              <p className="text-white/90 text-lg mb-10">跨境电商智能供应链管理系统</p>
              
              {/* 系统特性列表 */}
              <div className="space-y-4">
                {[
                  { icon: DownloadCloud, text: '订单自动抓取' },
                  { icon: Sparkles, text: '智能采购匹配' },
                  { icon: MapPin, text: '物流追踪管理' },
                  { icon: Calculator, text: '财务精准核算' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <item.icon className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-white/90 text-sm">{item.text}</span>
                  </div>
                ))}
              </div>
              
              {/* 底部装饰 */}
              <div className="mt-12 pt-8 border-t border-white/20">
                <p className="text-white/60 text-xs">© 2024 Ozon ERP. All rights reserved.</p>
              </div>
            </div>
            
            {/* 右侧登录表单区域 */}
            <div className="p-10 lg:p-12 flex flex-col justify-center">
              <h1 className="text-2xl font-bold text-[#152033] mb-8">欢迎登录</h1>
              
              <form onSubmit={handleLogin} className="space-y-5">
                {/* 手机号输入框 */}
                <div className="space-y-1.5">
                  <label htmlFor="phone-input" className="text-sm font-medium text-[#152033]">手机号</label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-sm text-[#637089] font-medium">+86</span>
                    <input 
                      type="tel" 
                      id="phone-input" 
                      placeholder="请输入手机号" 
                      maxLength={11}
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value.replace(/\D/g, ''));
                        setPhoneError(false);
                      }}
                      className="w-full bg-[#EEF1F6] border-none rounded-lg pl-14 pr-10 py-3 text-sm
                               text-[#152033] placeholder:text-[#637089]/50
                               focus:outline-none focus:ring-2 focus:ring-[#2F6BFF]/30 transition-all"
                    />
                    {phone && (
                      <button 
                        type="button"
                        onClick={() => setPhone('')}
                        className="absolute right-3 text-[#637089]/50 hover:text-[#637089] transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {phoneError && (
                    <p className="text-xs text-[#EF4444]">请输入正确的11位手机号</p>
                  )}
                </div>
                
                {/* 验证码输入框 */}
                <div className="space-y-1.5">
                  <label htmlFor="code-input" className="text-sm font-medium text-[#152033]">验证码</label>
                  <div className="flex gap-3">
                    <input 
                      type="text" 
                      id="code-input" 
                      placeholder="请输入验证码" 
                      maxLength={6}
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                      className="flex-1 bg-[#EEF1F6] border-none rounded-lg px-3 py-3 text-sm
                               text-[#152033] placeholder:text-[#637089]/50
                               focus:outline-none focus:ring-2 focus:ring-[#2F6BFF]/30 transition-all"
                    />
                    <button 
                      type="button"
                      onClick={handleGetCode}
                      disabled={!canGetCode}
                      className={`px-4 py-3 text-sm font-medium rounded-lg transition-all whitespace-nowrap
                        ${canGetCode 
                          ? 'bg-[#E8F0FF] text-[#2F6BFF] hover:bg-[#2F6BFF]/20 cursor-pointer' 
                          : 'bg-[#E6EAF2] text-[#637089] cursor-not-allowed'}`}
                    >
                      {countdown > 0 ? `${countdown}秒后重试` : '获取验证码'}
                    </button>
                  </div>
                </div>
                
                {/* 登录按钮 */}
                <button 
                  type="submit"
                  disabled={!canLogin || loading}
                  className={`w-full py-3 rounded-lg text-sm font-medium transition-all
                    ${canLogin && !loading
                      ? 'bg-[#2F6BFF] text-white hover:opacity-90 active:scale-[0.98]' 
                      : 'bg-[#E6EAF2] text-[#637089] cursor-not-allowed'}`}
                >
                  {loading ? '登录中...' : '登录'}
                </button>
              </form>
              
              {/* 底部提示 */}
              <p className="text-center text-xs text-[#637089] mt-8">
                登录即表示同意
                <a href="#" className="text-[#2F6BFF] hover:underline ml-1">《用户协议》</a>
                和
                <a href="#" className="text-[#2F6BFF] hover:underline ml-1">《隐私政策》</a>
              </p>
            </div>
            
          </div>
        </div>
      </div>
    </div>
  );
}
