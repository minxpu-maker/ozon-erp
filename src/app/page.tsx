import { redirect } from 'next/navigation';

export default function Home() {
  // 重定向到仪表盘
  redirect('/dashboard');
}
