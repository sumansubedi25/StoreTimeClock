const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
function compile(file,imports){
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const module={exports:{}};
 new Function('require','module','exports',code)(imports,module,module.exports);
 return module.exports;
}
const greeting=compile('lib/greeting.ts',require);
test('greeting changes at Central Time boundaries, including winter and summer',()=>{
 for(const [date,offset] of [['2026-07-01',5],['2026-01-01',6]]){
  for(const [hour,expected] of [[4,'Good night'],[5,'Good morning'],[11,'Good morning'],[12,'Good afternoon'],[16,'Good afternoon'],[17,'Good evening'],[21,'Good evening'],[22,'Good night']]){
   const time=new Date(`${date}T00:00:00Z`);time.setUTCHours(hour+offset);
   assert.equal(greeting.greetingForTime(time),expected);
  }
 }
 assert.equal(greeting.accountGreetingName(' Sj Smith ','other@example.com'),'Sj');
 assert.equal(greeting.accountGreetingName(null,'sj.store@example.com'),'Sj');
 assert.equal(greeting.accountGreetingName(null,null),'');
});
const tools=['EmployeeAccess','ManagerTools','Payroll','BackupPanel','TabletAccess','StoreSettings'];
function renderPage(page,kiosk=false){
 let calls=0;
 const state={setup:true,store:{id:'branch',name:'Test store',geofenceEnabled:false,location:null},employees:[]};
 const Clock=compile('app/clock.tsx',id=>{
  if(id==='react')return {...React,useState:init=>[++calls===1?state:typeof init==='function'?init():init,()=>{}],useEffect:()=>{}};
  if(id==='react/jsx-runtime')return require(id);
  if(id==='./store-context')return {useStoreApi:()=>()=>{throw Error('Unexpected API call during render');}};
  if(id.includes('geofence'))return {};
  if(id==='lucide-react')return new Proxy({},{get:()=>()=>null});
  if(id.startsWith('@/components/ui/'))return new Proxy({},{get:(_,name)=>({children,...props})=>React.createElement(name==='Button'?'button':'div',{},children)});
  const name=id.split('/').pop().split('-').map(p=>p[0].toUpperCase()+p.slice(1)).join('');
  return {__esModule:true,default:()=>React.createElement('div',{'data-tool':name})};
 }).default;
 return renderToStaticMarkup(Clock({page,kiosk,storeId:'branch'}));
}
for(const [page,expected] of Object.entries({overview:[],employees:['EmployeeAccess','ManagerTools'],shifts:['ManagerTools'],reports:['Payroll'],backups:['BackupPanel'],settings:['StoreSettings','TabletAccess']})){
 test(`${page} shows only its own manager tools and uses real page links`,()=>{
  const html=renderPage(page);
  for(const tool of tools)assert.equal(html.includes(`data-tool="${tool}"`),expected.includes(tool),tool);
  assert.match(html,/href="\/manager\/employees\?store=branch"/);
  assert.doesNotMatch(html,/href="#/);
 });
}
test('tablet deep links never render manager tools',()=>{
 const html=renderPage('employees',true);
 for(const tool of tools)assert.ok(!html.includes(`data-tool="${tool}"`));
 assert.ok(!html.includes('Manager navigation'));
});
