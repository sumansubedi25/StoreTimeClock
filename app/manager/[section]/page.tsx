import {notFound} from 'next/navigation';
import FirebaseLogin from '../../firebase-login';

const sections = ['overview','employees','shifts','reports','backups','settings'];
export default async function ManagerPage({params,searchParams}:{params:Promise<{section:string}>;searchParams:Promise<{store?:string|string[]}>}) {
  const {section}=await params;
  if(!sections.includes(section))notFound();
  const {store}=await searchParams;
  return <FirebaseLogin key={section} managerPage={section} requestedStoreId={typeof store==='string'?store:''}/>;
}
