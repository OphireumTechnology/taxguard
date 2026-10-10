import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { DashboardApplicationShell } from '../../src/components/layout/DashboardApplicationShell';
import { SyntheticProvider, useApp } from './context';
import type { DashboardWorkspace } from '../../src/components/layout/dashboardAccess';
import './qa.css';
import { FixtureSelect } from './FixtureSelect';
function Fixture() {
  const session = useApp(); const [workspace, setWorkspace] = useState<DashboardWorkspace>('accountant');
  const [module, setModule] = useState('Overview'); const [width, setWidth] = useState('desktop');
  const roles = ['client', 'accountant', 'reviewer', 'bookkeeper', 'practice_manager', 'operations', 'admin'];
  const workspaces: DashboardWorkspace[] = ['client', 'accountant', 'reviewer', 'bookkeeper', 'practice_manager', 'operations', 'admin'];
  return <><aside className="qa-controls" aria-label="Synthetic fixture controls"><strong>SYNTHETIC QA ONLY — no credentials, APIs or taxpayer data</strong>
    <FixtureSelect id="fixture-role" label="Fixture role" value={session.role} options={roles} onChange={session.setRole} />
    <FixtureSelect id="fixture-workspace" label="Requested workspace" value={workspace} options={workspaces} onChange={value => setWorkspace(value as DashboardWorkspace)} />
    <label><input type="checkbox" checked={session.active} onChange={e => session.setActive(e.target.checked)} />Active fixture membership</label>
    <label><input type="checkbox" checked={session.authenticated} onChange={e => session.setAuthenticated(e.target.checked)} />Authenticated fixture</label>
    <FixtureSelect id="fixture-width" label="Fixture width" value={width} options={['desktop', 'tablet', 'mobile']} onChange={setWidth} />
  </aside><div className={`qa-frame qa-${width}`}><DashboardApplicationShell workspace={workspace} title="Synthetic shell acceptance"
    navigation={<>{['Overview', 'Documents', 'Review'].map(name => <button key={name} onClick={() => setModule(name)}>{name}</button>)}</>}
    notifications={<button aria-label="Synthetic notifications">No notifications</button>}>
    <main><h1>{module}</h1><p>Synthetic module content. No provider or authorization evidence is asserted.</p><button>Inspect synthetic record</button><p role="status">Read-only fixture — actions unavailable</p></main>
  </DashboardApplicationShell></div></>;
}
createRoot(document.getElementById('root')!).render(<SyntheticProvider><Fixture /></SyntheticProvider>);
