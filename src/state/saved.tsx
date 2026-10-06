import { createContext, use, useState, type PropsWithChildren } from 'react';

type SavedContextValue = {
  saved: ReadonlySet<string>;
  isSaved: (id: string) => boolean;
  toggle: (id: string) => void;
};

const SavedContext = createContext<SavedContextValue | null>(null);

export function SavedProvider({ children }: PropsWithChildren) {
  const [saved, setSaved] = useState<ReadonlySet<string>>(
    () => new Set(['jdm-night-garage', 'midnight-meet', 'trackday-pinar'])
  );

  const toggle = (id: string) =>
    setSaved((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <SavedContext value={{ saved, isSaved: (id) => saved.has(id), toggle }}>{children}</SavedContext>
  );
}

export function useSaved() {
  const ctx = use(SavedContext);
  if (!ctx) throw new Error('useSaved must be used inside <SavedProvider>');
  return ctx;
}
