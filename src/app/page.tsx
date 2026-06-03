import { redirect } from 'next/navigation';

export default function Home() {
  // 重定向到原型登录页面
  redirect('/prototype/web/login.html');
}
