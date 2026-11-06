import { lazy, Suspense, useEffect } from 'react';
import { useRoute } from './lib/route';
import { TopBar } from './components/TopBar';
import Home from './pages/Home';

const Lab = lazy(() => import('./pages/Lab'));
const Atlas = lazy(() => import('./pages/Atlas'));
const Test = lazy(() => import('./pages/Test'));
const Method = lazy(() => import('./pages/Method'));
const Alts = lazy(() => import('./pages/Alts'));
const Outputs = lazy(() => import('./pages/Outputs'));
const People = lazy(() => import('./pages/People'));

export default function App() {
  const { path, q } = useRoute();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [path]);
  let page;
  switch (path) {
    case '/lab':
      page = <Lab key={[q.get('case'), q.get('code'), q.get('scenario'), q.get('person')].join(':')} q={q} />;
      break;
    case '/atlas':
      page = <Atlas />;
      break;
    case '/test':
      page = <Test />;
      break;
    case '/method':
      page = <Method />;
      break;
    case '/alts':
      page = <Alts />;
      break;
    case '/out':
      page = <Outputs key={q.get('id') ?? ''} q={q} />;
      break;
    case '/people':
      page = <People />;
      break;
    default:
      page = <Home />;
  }
  return (
    <>
      <TopBar path={path} />
      <main>
        <Suspense fallback={<div className="page muted">טוען</div>}>{page}</Suspense>
      </main>
    </>
  );
}
