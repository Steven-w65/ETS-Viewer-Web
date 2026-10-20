import { createContext, useContext, type ReactNode } from 'react';
const Visibility = createContext({ active: true, present: true });
export const useMediaVisible = () => useContext(Visibility);
export function MediaVisibility({
  active,
  children,
  retain = false,
}: {
  active: boolean;
  children: ReactNode;
  retain?: boolean;
}) {
  const parent = useMediaVisible();
  return (
    <Visibility.Provider
      value={{
        active: parent.active && active,
        present: parent.present && (active || retain || !parent.active),
      }}
    >
      {children}
    </Visibility.Provider>
  );
}
