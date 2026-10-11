'use client';
import {useEffect,useState} from 'react';
import {greetingForTime,accountGreetingName} from '../lib/greeting';
export default function UserGreeting({name,email}:{name?:string|null;email?:string|null}) {
 const [greeting,setGreeting]=useState('Welcome');
 useEffect(()=>{
  const update=()=>setGreeting(greetingForTime(new Date()));
  update();const timer=setInterval(update,30000);
  document.addEventListener('visibilitychange',update);
  return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',update);};
 },[]);
 const display=accountGreetingName(name,email);
 return <p className="user-greeting">Hi{display?` ${display}`:''}, <span>{greeting.toLowerCase()}!</span></p>;
}
