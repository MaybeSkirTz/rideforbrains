import { createContext, useContext } from 'react';
export type Data = { settings: any; activities: any[]; environment: string; services: any };
export const Context = createContext<{ data: Data; user: any; refresh: () => Promise<void> }>(
  {} as any,
);
export const useApp = () => useContext(Context);
