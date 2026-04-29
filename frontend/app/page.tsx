import { redirect } from 'next/navigation';

export default function Home() {
  // Redirect to login as the main entry point
  redirect('/login');
}

