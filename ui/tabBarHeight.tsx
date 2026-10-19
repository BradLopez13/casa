import { createContext, useContext, useState, type ReactNode } from 'react';

type Measured = { height: number | undefined; report: (height: number) => void };

const TabBarHeightContext = createContext<Measured>({ height: undefined, report: () => undefined });

/**
 * Holds the bottom bar's height as it was laid out, so whatever floats above it (the notice) sits
 * on the real bar and not on an estimate: enlarged text can make the bar taller than computed.
 */
export function TabBarHeightProvider({ children }: { children: ReactNode }) {
  const [height, setHeight] = useState<number | undefined>(undefined);
  return (
    <TabBarHeightContext.Provider value={{ height, report: setHeight }}>
      {children}
    </TabBarHeightContext.Provider>
  );
}

/** The bar's measured height with the safe area, or `undefined` before its first layout. */
export function useMeasuredTabBarHeight(): number | undefined {
  return useContext(TabBarHeightContext).height;
}

/** What the bar calls from its `onLayout`. */
export function useReportTabBarHeight(): (height: number) => void {
  return useContext(TabBarHeightContext).report;
}
