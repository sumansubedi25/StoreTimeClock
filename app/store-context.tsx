"use client";
import {createContext,useContext,useCallback,type ReactNode} from 'react';
import {apiFetch} from '../lib/firebase-client';
const StoreContext=createContext<string|null>(null);
export function StoreProvider({id,children}:{id:string;children:ReactNode}){return <StoreContext.Provider value={id}>{children}</StoreContext.Provider>;}
export function useStoreApi(){const id=useContext(StoreContext);if(!id)throw Error('Select a store before using the clock.');return useCallback((url:string,options:RequestInit={})=>apiFetch(url,options,id),[id]);}
