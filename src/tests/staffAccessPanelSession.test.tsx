import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, expect, it, vi } from 'vitest';
import type { User } from '../types';
const h=vi.hoisted(()=>({states:[] as any[],refs:[] as any[],si:0,ri:0,token:'session-a',directory:{} as any,create:vi.fn(),status:vi.fn()}));
vi.mock('react',async importOriginal=>{const actual=await importOriginal<any>();return {...actual,useState:(initial:any)=>{const i=h.si++;if(!(i in h.states))h.states[i]=initial;return [h.states[i],(v:any)=>h.states[i]=typeof v==='function'?v(h.states[i]):v];},useRef:(initial:any)=>{const i=h.ri++;return h.refs[i]??(h.refs[i]={current:initial});},useEffect:()=>{ /* Deliberately render before passive effects. */ }};});
vi.mock('../hooks/useStaffAccessDirectory',()=>({staffSessionKey:(u:any,a:string,t:string)=>JSON.stringify([u?.id,u?.tenantId,u?.clientId,u?.role,u?.status,a,t]),useStaffAccessDirectory:()=>h.directory}));
vi.mock('../services/api',()=>({getStoredToken:()=>h.token,api:{staffAccess:{createInvitation:h.create,changeMemberStatus:h.status}}}));
vi.mock('../components/admin/StaffMfaRecoveryPanel',()=>({StaffMfaRecoveryPanel:()=>null}));
import { StaffAccessManagementPanel } from '../components/admin/StaffAccessManagementPanel';
const user={id:'admin-a',tenantId:'tenant-a',role:'admin',status:'active'} as User;
const key=()=>JSON.stringify([user.id,user.tenantId,user.clientId,user.role,user.status,'AUTHENTICATED',h.token]);
const row={uid:'staff-a',name:'Old Staff',email:'old-row@example.invalid',role:'accountant',status:'active',createdAt:'2026-01-01T00:00:00Z',actions:{approve:false,suspend:true,deactivate:false,reactivate:false}};
function render(){h.si=h.ri=0;return StaffAccessManagementPanel({user,authStatus:'AUTHENTICATED'});}
function find(tree:any,predicate:(node:any)=>boolean):any {if(!tree||typeof tree!=='object')return; if(predicate(tree))return tree;for(const child of React.Children.toArray(tree.props?.children)){const match=find(child,predicate);if(match)return match;}}
const settle=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
beforeEach(()=>{h.states=[];h.refs=[];h.token='session-a';h.create.mockReset();h.status.mockReset();h.directory={allowed:true,sessionKey:key(),kind:'members',query:{limit:25},status:'ready',items:[row],nextCursor:null,refresh:vi.fn()};});
it('hides old invitation fields, confirmation target, and reason synchronously before session-change effects',()=>{
 let tree=render();find(tree,n=>n.type==='input'&&n.props.type==='email').props.onChange({target:{value:'old-form@example.invalid'}});
 tree=render();const nameInputs:any[]=[];function collect(node:any){if(!node||typeof node!=='object')return;if(node.type==='input'&&node.props.maxLength===100)nameInputs.push(node);React.Children.forEach(node.props?.children,collect);}collect(tree);nameInputs[0].props.onChange({target:{value:'OldGiven'}});
 tree=render();find(tree,n=>n.props?.['aria-label']==='suspend old-row@example.invalid').props.onClick({currentTarget:{isConnected:false}});
 tree=render();find(tree,n=>n.type==='textarea'&&n.props.required).props.onChange({target:{value:'Old private reason'}});
 tree=render();const oldConfirm=find(tree,n=>n.type==='form'&&n.props.role==='region').props.onSubmit;
 expect(renderToStaticMarkup(tree)).toContain('Old private reason');
 h.token='session-b';h.directory={...h.directory,sessionKey:key(),items:[],status:'empty'};
 const fresh=render();const html=renderToStaticMarkup(fresh);for(const secret of ['old-form@example.invalid','OldGiven','old-row@example.invalid','Old private reason'])expect(html).not.toContain(secret);expect(find(fresh,n=>n.props?.id==='staff-action-title')).toBeUndefined();
 oldConfirm({preventDefault(){}});expect(h.status).not.toHaveBeenCalled();
});
it('hides issued one-time token immediately on session change before effects',async()=>{
 h.create.mockResolvedValue({id:'synthetic-invite',token:'a'.repeat(64),expiresAt:new Date(Date.now()+60000).toISOString(),delivery:'administrator_handoff'});
 render();h.states[0]={key:key(),value:{email:'staff@example.invalid',legalFirstName:'Synthetic',legalLastName:'Staff',role:'accountant'}};
 let tree=render();find(tree,n=>n.type==='form'&&!n.props.role).props.onSubmit({preventDefault(){}});await settle();tree=render();expect(renderToStaticMarkup(tree)).toContain('a'.repeat(64));
 h.token='session-b';h.directory={...h.directory,sessionKey:key(),items:[],status:'empty'};expect(renderToStaticMarkup(render())).not.toContain('a'.repeat(64));
});
