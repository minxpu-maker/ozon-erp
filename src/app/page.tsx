import { redirect } from 'next/navigation';

export default function Home() {
  // 重定向到登录页面
  redirect('/login');
}
