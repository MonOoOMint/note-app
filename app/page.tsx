import { redirect } from 'next/navigation';

export default function RootPage() {
  // Tạm thời redirect thẳng vào trang todos
  // Sau này có auth thì check auth rồi mới cho vào hoặc đá ra login
  redirect('/todos');
}
