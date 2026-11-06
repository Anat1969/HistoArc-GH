import { createElement, useEffect } from 'react';
import { AppIcon } from './Marks';

const LINKS = [
  { path: '/', label: 'השאלה' },
  { path: '/lab', label: 'מעבדה' },
  { path: '/alts', label: 'חלופות' },
  { path: '/out', label: 'תוצרים' },
  { path: '/people', label: 'אדריכלים' },
  { path: '/atlas', label: 'פרלל' },
  { path: '/test', label: 'מבחן הקוד' },
  { path: '/method', label: 'שיטה' },
];

const CHAT = 'https://claude.ai/code/session_01UBnSCKX7pDdeC7Gtwu6oZm';

export function TopBar({ path }: { path: string }) {
  useEffect(() => {
    document.title = (LINKS.find((l) => l.path === path)?.label ? LINKS.find((l) => l.path === path)!.label + ' · ' : '') + 'קוד העיר';
  }, [path]);
  return (
    <header className="bar">
      <a className="brand" href="#/" aria-label="קוד העיר, לדף הבית">
        <AppIcon />
        <span>קוד העיר</span>
      </a>
      <nav className="nav" aria-label="ניווט">
        {LINKS.map((l) => (
          <a key={l.path} href={'#' + l.path} aria-current={path === l.path ? 'page' : undefined}>
            {l.label}
          </a>
        ))}
      </nav>
      {createElement('ai-menu', { chat: CHAT })}
    </header>
  );
}
