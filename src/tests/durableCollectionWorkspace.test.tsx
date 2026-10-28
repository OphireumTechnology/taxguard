import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {it,expect,vi} from 'vitest';
const state=vi.hoisted(()=>({actor:{id:'owner',tenantId:'t',clientId:'c',role:'client',status:'active'} as any,auth:'AUTHENTICATED',token:'synthetic'}));
vi.mock('../context/AppContext',()=>({useApp:()=>({currentUser:state.actor,authLifecycleState:state.auth})}));
vi.mock('../services/api',()=>({getStoredToken:()=>state.token,api:{clientDashboard:{}}}));
import {DurableClientCollectionWorkspace} from '../components/collection/DurableClientCollectionWorkspace';
it('refuses staff, suspended, foreign-client and interrupted sessions before mounting vault actions',()=>{
 const original={...state.actor};
 for(const patch of [{role:'admin'},{status:'suspended'},{clientId:'foreign'},{tenantId:''}]){state.actor={...original,...patch};const html=renderToStaticMarkup(<DurableClientCollectionWorkspace clientId="c" taxYear={2025}/>);expect(html).toContain('active client session');expect(html).not.toContain('Secure document upload');}
 state.actor=original;state.auth='INITIALIZING';expect(renderToStaticMarkup(<DurableClientCollectionWorkspace clientId="c" taxYear={2025}/>)).toContain('active client session');state.auth='AUTHENTICATED';
});
it('renders a scoped loading/selection state without demonstrating completed facts or tax authority',()=>{
 const html=renderToStaticMarkup(<DurableClientCollectionWorkspace clientId="c" taxYear={2025}/>);
 expect(html).toContain('Select an engagement');expect(html).toContain('client-reported facts');expect(html).toContain('Secure document upload');expect(html).not.toContain('ready for Stage 03');
});
