/**
 * MockAppTemplates — 应用构建 Mock 模板
 * 为 App Builder D 栏面板提供 HTML/CSS/JS 代码快照
 */

export interface AppTemplate {
  name: string;
  description: string;
  skeleton: { html: string; css: string; js: string };
  building: { html: string; css: string; js: string };
  final: { html: string; css: string; js: string };
}

const BASE_CSS = `
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0a0f; color: #e2e8f0; min-height: 100vh; padding: 20px; }
.card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; backdrop-filter: blur(20px); padding: 20px; }
.btn { background: #007AFF; color: #fff; border: none; border-radius: 10px; padding: 10px 20px; font-size: 14px; cursor: pointer; transition: all 0.2s; }
.btn:hover { background: #0063d1; transform: scale(0.98); }
input { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 10px; padding: 10px 14px; color: #e2e8f0; font-size: 14px; outline: none; width: 100%; }
input:focus { border-color: #007AFF; }
`;

const WEATHER_SKELETON = {
  html: `<div class="card" style="max-width:380px;margin:0 auto"><div class="skeleton-bar" style="width:60%;height:20px;background:rgba(255,255,255,0.06);border-radius:8px;margin-bottom:16px"></div><div class="skeleton-bar" style="width:100%;height:140px;background:rgba(255,255,255,0.04);border-radius:12px;margin-bottom:16px"></div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px"><div class="skeleton-bar" style="height:80px;background:rgba(255,255,255,0.04);border-radius:8px"></div><div class="skeleton-bar" style="height:80px;background:rgba(255,255,255,0.04);border-radius:8px"></div><div class="skeleton-bar" style="height:80px;background:rgba(255,255,255,0.04);border-radius:8px"></div></div></div>`,
  css: BASE_CSS + `.skeleton-bar { animation: pulse 1.5s ease-in-out infinite; } @keyframes pulse { 0%,100%{opacity:0.4}50%{opacity:0.8} }`,
  js: '',
};

const WEATHER_BUILDING = {
  html: `<div class="card" style="max-width:380px;margin:0 auto">
  <h2 style="font-size:18px;margin-bottom:12px">天气查询</h2>
  <div style="display:flex;gap:8px;margin-bottom:16px"><input placeholder="输入城市名称..." id="city-input"><button class="btn" id="search-btn" disabled>查询</button></div>
  <div class="card" style="text-align:center;padding:24px;opacity:0.5"><div style="font-size:48px;margin-bottom:8px">--</div><div style="font-size:14px;color:#94a3b8">构建中...</div></div>
</div>`,
  css: BASE_CSS,
  js: '',
};

const WEATHER_FINAL = {
  html: `<div class="weather-app card" style="max-width:380px;margin:0 auto">
  <h2 style="font-size:18px;margin-bottom:12px">天气查询</h2>
  <div style="display:flex;gap:8px;margin-bottom:16px"><input placeholder="输入城市名称..." id="city-input" value="北京"><button class="btn" id="search-btn">查询</button></div>
  <div class="current card" style="text-align:center;padding:24px;margin-bottom:12px">
    <div id="city" style="font-size:14px;color:#94a3b8;margin-bottom:4px">北京</div>
    <div id="icon" style="font-size:48px;margin-bottom:4px">&#9728;&#65039;</div>
    <div id="temp" style="font-size:36px;font-weight:700">23°C</div>
    <div id="desc" style="font-size:14px;color:#94a3b8;margin-top:4px">晴朗 · 湿度 45%</div>
  </div>
  <div id="forecast" style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px"></div>
</div>`,
  css: BASE_CSS + `
.weather-app .current { background: linear-gradient(135deg, rgba(0,122,255,0.15), rgba(0,122,255,0.05)); border-color: rgba(0,122,255,0.2); }
.forecast-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 8px 4px; text-align: center; }
.forecast-card .day { font-size: 10px; color: #94a3b8; }
.forecast-card .ficon { font-size: 18px; margin: 4px 0; }
.forecast-card .ftemp { font-size: 12px; font-weight: 600; }`,
  js: `
var cities = {
  '北京': { icon: '\\u2600\\uFE0F', temp: 23, desc: '晴朗 · 湿度 45%' },
  '上海': { icon: '\\u26C5', temp: 19, desc: '多云 · 湿度 68%' },
  '深圳': { icon: '\\u26C8\\uFE0F', temp: 28, desc: '雷阵雨 · 湿度 82%' },
  '成都': { icon: '\\uD83C\\uDF27\\uFE0F', temp: 16, desc: '小雨 · 湿度 75%' },
  '杭州': { icon: '\\u2601\\uFE0F', temp: 20, desc: '阴天 · 湿度 60%' },
};
var forecast = [['周一','\\u2600\\uFE0F','25°'],['周二','\\u26C5','22°'],['周三','\\uD83C\\uDF27\\uFE0F','18°'],['周四','\\u2601\\uFE0F','20°'],['周五','\\u2600\\uFE0F','24°']];
var fg = document.getElementById('forecast');
forecast.forEach(function(f) { fg.innerHTML += '<div class="forecast-card"><div class="day">'+f[0]+'</div><div class="ficon">'+f[1]+'</div><div class="ftemp">'+f[2]+'</div></div>'; });
document.getElementById('search-btn').onclick = function() {
  var c = document.getElementById('city-input').value.trim();
  var d = cities[c];
  if (d) { document.getElementById('city').textContent = c; document.getElementById('icon').innerHTML = d.icon; document.getElementById('temp').textContent = d.temp + '°C'; document.getElementById('desc').textContent = d.desc; }
  else { document.getElementById('city').textContent = c; document.getElementById('icon').innerHTML = '\\u2753'; document.getElementById('temp').textContent = '--'; document.getElementById('desc').textContent = '未找到该城市'; }
};`,
};

const TODO_SKELETON = {
  html: `<div class="card" style="max-width:380px;margin:0 auto"><div class="skeleton-bar" style="width:50%;height:20px;background:rgba(255,255,255,0.06);border-radius:8px;margin-bottom:16px"></div><div class="skeleton-bar" style="width:100%;height:40px;background:rgba(255,255,255,0.04);border-radius:8px;margin-bottom:8px"></div><div class="skeleton-bar" style="width:100%;height:40px;background:rgba(255,255,255,0.04);border-radius:8px;margin-bottom:8px"></div><div class="skeleton-bar" style="width:100%;height:40px;background:rgba(255,255,255,0.04);border-radius:8px"></div></div>`,
  css: BASE_CSS + `.skeleton-bar { animation: pulse 1.5s ease-in-out infinite; } @keyframes pulse { 0%,100%{opacity:0.4}50%{opacity:0.8} }`,
  js: '',
};

const TODO_BUILDING = {
  html: `<div class="card" style="max-width:380px;margin:0 auto"><h2 style="font-size:18px;margin-bottom:12px">待办清单</h2><div style="display:flex;gap:8px;margin-bottom:16px"><input placeholder="添加任务..." disabled><button class="btn" disabled>添加</button></div><div style="color:#64748b;text-align:center;padding:20px;font-size:13px">构建中...</div></div>`,
  css: BASE_CSS,
  js: '',
};

const TODO_FINAL = {
  html: `<div class="card" style="max-width:380px;margin:0 auto">
  <h2 style="font-size:18px;margin-bottom:12px">待办清单</h2>
  <div style="display:flex;gap:8px;margin-bottom:16px"><input placeholder="添加新任务..." id="todo-input"><button class="btn" id="add-btn">添加</button></div>
  <ul id="todo-list" style="list-style:none"></ul>
  <div id="stats" style="font-size:11px;color:#64748b;margin-top:12px;text-align:center"></div>
</div>`,
  css: BASE_CSS + `
.todo-item { display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,0.06);margin-bottom:6px;transition:all 0.2s; }
.todo-item:hover { background:rgba(255,255,255,0.03); }
.todo-item.done span { text-decoration:line-through;color:#64748b; }
.todo-item input[type=checkbox] { accent-color:#007AFF;width:16px;height:16px; }
.todo-item .del { margin-left:auto;background:none;border:none;color:#ef4444;cursor:pointer;font-size:16px;opacity:0;transition:opacity 0.2s; }
.todo-item:hover .del { opacity:1; }`,
  js: `
var todos = [{text:'完成产品演示准备',done:true},{text:'Review PR #42',done:false},{text:'更新 API 文档',done:false}];
function render() {
  var list = document.getElementById('todo-list');
  list.innerHTML = '';
  todos.forEach(function(t, i) {
    var li = document.createElement('li');
    li.className = 'todo-item' + (t.done ? ' done' : '');
    li.innerHTML = '<input type="checkbox"' + (t.done ? ' checked' : '') + '><span>' + t.text + '</span><button class="del">\\u00D7</button>';
    li.querySelector('input').onchange = function() { todos[i].done = !todos[i].done; render(); };
    li.querySelector('.del').onclick = function() { todos.splice(i, 1); render(); };
    list.appendChild(li);
  });
  var done = todos.filter(function(t){return t.done}).length;
  document.getElementById('stats').textContent = done + '/' + todos.length + ' 已完成';
}
render();
document.getElementById('add-btn').onclick = function() {
  var v = document.getElementById('todo-input').value.trim();
  if (v) { todos.push({text:v,done:false}); document.getElementById('todo-input').value=''; render(); }
};
document.getElementById('todo-input').onkeydown = function(e) { if (e.key==='Enter') document.getElementById('add-btn').click(); };`,
};

const CALC_SKELETON = {
  html: `<div class="card" style="max-width:300px;margin:0 auto"><div class="skeleton-bar" style="width:100%;height:60px;background:rgba(255,255,255,0.06);border-radius:12px;margin-bottom:12px"></div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px">${Array(16).fill('<div class="skeleton-bar" style="height:44px;background:rgba(255,255,255,0.04);border-radius:8px"></div>').join('')}</div></div>`,
  css: BASE_CSS + `.skeleton-bar { animation: pulse 1.5s ease-in-out infinite; } @keyframes pulse { 0%,100%{opacity:0.4}50%{opacity:0.8} }`,
  js: '',
};

const CALC_BUILDING = {
  html: `<div class="card" style="max-width:300px;margin:0 auto"><h2 style="font-size:18px;margin-bottom:12px">计算器</h2><div style="background:rgba(255,255,255,0.06);border-radius:12px;padding:16px;text-align:right;font-size:24px;color:#64748b;margin-bottom:12px">0</div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px">${['C','±','%','÷','7','8','9','×','4','5','6','−','1','2','3','+'].map(b=>`<button class="btn" disabled style="opacity:0.4;padding:12px">${b}</button>`).join('')}</div></div>`,
  css: BASE_CSS,
  js: '',
};

const CALC_FINAL = {
  html: `<div class="card" style="max-width:300px;margin:0 auto">
  <h2 style="font-size:18px;margin-bottom:12px">计算器</h2>
  <div id="display" style="background:rgba(255,255,255,0.06);border-radius:12px;padding:16px;text-align:right;font-size:28px;font-weight:600;margin-bottom:12px;min-height:60px;display:flex;align-items:center;justify-content:flex-end">0</div>
  <div id="buttons" style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px"></div>
</div>`,
  css: BASE_CSS + `
.calc-btn { border:none;border-radius:10px;padding:14px;font-size:16px;font-weight:500;cursor:pointer;transition:all 0.15s; }
.calc-btn:active { transform:scale(0.95); }
.calc-num { background:rgba(255,255,255,0.06);color:#e2e8f0; }
.calc-num:hover { background:rgba(255,255,255,0.1); }
.calc-op { background:rgba(0,122,255,0.15);color:#007AFF; }
.calc-op:hover { background:rgba(0,122,255,0.25); }
.calc-fn { background:rgba(255,255,255,0.03);color:#94a3b8; }
.calc-fn:hover { background:rgba(255,255,255,0.08); }
.calc-eq { background:#007AFF;color:#fff; }
.calc-eq:hover { background:#0063d1; }`,
  js: `
var display = document.getElementById('display');
var btns = document.getElementById('buttons');
var rows = [['C','fn'],['±','fn'],['%','fn'],['÷','op'],['7','num'],['8','num'],['9','num'],['×','op'],['4','num'],['5','num'],['6','num'],['−','op'],['1','num'],['2','num'],['3','num'],['+','op'],['0','num'],['.','num'],['⌫','fn'],['=','eq']];
var current='0', prev=null, op=null, reset=false;
rows.forEach(function(r){
  var b=document.createElement('button');
  b.className='calc-btn calc-'+r[1];
  b.textContent=r[0];
  b.onclick=function(){handleBtn(r[0])};
  btns.appendChild(b);
});
function handleBtn(v){
  if(v==='C'){current='0';prev=null;op=null;reset=false;}
  else if(v==='±'){current=String(-parseFloat(current));}
  else if(v==='%'){current=String(parseFloat(current)/100);}
  else if(v==='⌫'){current=current.length>1?current.slice(0,-1):'0';}
  else if('÷×−+'.indexOf(v)>=0){prev=parseFloat(current);op=v;reset=true;}
  else if(v==='='){if(prev!==null&&op){var c=parseFloat(current);var r=op==='+'?prev+c:op==='−'?prev-c:op==='×'?prev*c:op==='÷'&&c!==0?prev/c:0;current=String(Math.round(r*1e10)/1e10);prev=null;op=null;reset=true;}}
  else{if(reset){current=v;reset=false;}else{current=current==='0'&&v!=='.'?v:current+v;}}
  display.textContent=current;
}`,
};

export const APP_TEMPLATES: Record<string, AppTemplate> = {
  '天气': {
    name: '天气查询',
    description: '实时天气查询应用，支持多城市搜索',
    skeleton: WEATHER_SKELETON,
    building: WEATHER_BUILDING,
    final: WEATHER_FINAL,
  },
  '计算器': {
    name: '计算器',
    description: '支持四则运算的科学计算器',
    skeleton: CALC_SKELETON,
    building: CALC_BUILDING,
    final: CALC_FINAL,
  },
  '待办': {
    name: '待办清单',
    description: '任务管理待办清单应用',
    skeleton: TODO_SKELETON,
    building: TODO_BUILDING,
    final: TODO_FINAL,
  },
};

export const DEFAULT_TEMPLATE_KEY = '天气';

export function matchAppTemplate(text: string): string {
  for (const key of Object.keys(APP_TEMPLATES)) {
    if (text.includes(key)) return key;
  }
  return DEFAULT_TEMPLATE_KEY;
}
