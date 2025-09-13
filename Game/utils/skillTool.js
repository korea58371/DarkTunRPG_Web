#!/usr/bin/env node
/*
  Skill data utility for Prototype RPG
  - Add/Edit/Delete skills in Game/src/data/skills.js
  - List unused skills by scanning Game/src/data/units.js
  - Optionally attach a skill to units

  Usage:
    node Game/utils/skillTool.js
*/

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const ROOT = path.resolve(__dirname, '..');
const SKILLS_FILE = path.join(ROOT, 'src', 'data', 'skills.js');
const UNITS_FILE = path.join(ROOT, 'src', 'data', 'units.js');

function readFile(file){ return fs.readFileSync(file, 'utf8'); }
function writeFile(file, text){ fs.writeFileSync(file, text, 'utf8'); }

function extractExportObject(source, exportName){
  const key = `export const ${exportName} = {`;
  const start = source.indexOf(key);
  if(start < 0) throw new Error(`Cannot find export ${exportName}`);
  const head = start + key.length;
  let i = head, depth = 1;
  while(i < source.length && depth > 0){
    const ch = source[i++];
    if(ch === '{') depth++;
    else if(ch === '}') depth--;
  }
  const end = i - 1; // position of matching '}'
  const body = source.slice(head, end);
  return { start, head, end, body, key }; 
}

function safeEvalObjectLiteral(text){
  // Rough but practical evaluator for a JS object literal
  // Wrap in parentheses to be a valid expression
  // eslint-disable-next-line no-new-func
  return Function(`"use strict"; return (${text});`)();
}

function stringifySkills(skills){
  // Keep stable order by key
  const ids = Object.keys(skills);
  ids.sort();
  const lines = ids.map(id => {
    const sk = skills[id] || {};
    const kv = [];
    const push = (k, v)=>{ if(v===undefined) return; kv.push(`${k}:${v}`); };
    const q = (s)=> `'${String(s)}'`;
    push('id', q(sk.id||id));
    push('name', q(sk.name||id));
    if(sk.range) push('range', q(sk.range));
    if(sk.type) push('type', q(sk.type));
    if(sk.hits!=null) push('hits', String(sk.hits));
    if(sk.acc!=null) push('acc', String(sk.acc));
    if(sk.accAdd!=null) push('accAdd', String(sk.accAdd));
    if(sk.coeff!=null) push('coeff', String(sk.coeff));
    if(sk.cost && sk.cost.mp!=null) push('cost', `{mp:${sk.cost.mp}}`);
    if(sk.shout) push('shout', q(sk.shout));
    if(sk.damageType) push('damageType', q(sk.damageType));
    if(sk.duration!=null) push('duration', String(sk.duration));
    if(sk.dotPct!=null) push('dotPct', String(sk.dotPct));
    if(sk.amount!=null) push('amount', String(sk.amount));
    if(sk.move){
      const m = sk.move; const parts=[];
      if(m.who) parts.push(`who:${q(m.who)}`);
      if(m.dir) parts.push(`dir:${q(m.dir)}`);
      if(m.tiles!=null) parts.push(`tiles:${m.tiles}`);
      if(m.required!=null) parts.push(`required:${m.required?'true':'false'}`);
      if(Array.isArray(m.allowedDirs)) parts.push(`allowedDirs:[${m.allowedDirs.map(q).join(',')}]`);
      push('move', `{${parts.join(', ')}}`);
    }
    if(sk.bleed){
      const b = sk.bleed; push('bleed', `{ chance:${b.chance??0.5}, duration:${b.duration??3}, coeff:${b.coeff??0.3} }`);
    }
    if(sk.upgrades && Array.isArray(sk.upgrades)){
      const up = sk.upgrades.map(u=>`{ id:${q(u.id)}, name:${q(u.name)}, desc:${q(u.desc||'')}, type:${q(u.type||'once')} }`).join(', ');
      push('upgrades', `[${up}]`);
    }
    return `  ${q(id)}: { ${kv.join(', ')} }`;
  });
  return `export const SKILLS = {\n${lines.join(',\n')}\n};\n`;
}

function parseSkills(){
  const src = readFile(SKILLS_FILE);
  const obj = extractExportObject(src, 'SKILLS');
  const data = safeEvalObjectLiteral(`{${obj.body}}`);
  return { src, obj, data };
}

function parseUnits(){
  const src = readFile(UNITS_FILE);
  const obj = extractExportObject(src, 'UNITS');
  const data = safeEvalObjectLiteral(`{${obj.body}}`);
  return { src, obj, data };
}

function saveSkills(parsed, newData){
  const text = stringifySkills(newData);
  const before = parsed.src.slice(0, parsed.obj.start);
  // Keep SKILL_CFG and other exports above as-is; replace only SKILLS export block
  const afterStart = parsed.src.indexOf('\n', parsed.obj.end+1);
  const tail = afterStart>0 ? parsed.src.slice(afterStart) : '\n';
  writeFile(SKILLS_FILE, before + text + tail);
}

function rl(){
  return readline.createInterface({ input: process.stdin, output: process.stdout });
}
function ask(q){ return new Promise(res=> rl().question(q, a=>{ rl().close(); res(a); })); }

async function main(){
  console.log('[SkillTool] 시작');
  const parsed = parseSkills();
  const unitsParsed = parseUnits();
  let skills = parsed.data;
  const used = new Set();
  Object.values(unitsParsed.data||{}).forEach(u=> (u.skills||[]).forEach(id=> used.add(id)));

  console.log('\n메뉴');
  console.log('1) 새 스킬 추가');
  console.log('2) 기존 스킬 수정');
  console.log('3) 스킬 삭제');
  console.log('4) 미사용 스킬 목록 출력');
  console.log('5) 스킬을 유닛에 부여');
  console.log('0) 종료');
  const choice = (await ask('선택: ')).trim();

  if(choice==='1'){
    const id = (await ask('스킬 ID (예: SK-99): ')).trim();
    const name = (await ask('스킬 이름: ')).trim();
    const range = (await ask('사거리(melee/ranged/ally/move): ')).trim();
    const type = (await ask('타입(strike/multi/row/line/poison/heal/regen/shield/move): ')).trim();
    const hits = Number((await ask('타수(기본 1): ')).trim()||'1');
    const acc = Number((await ask('명중(0~1, 기본 1): ')).trim()||'1');
    const accAdd = Number((await ask('추가명중(0~1, 기본 0): ')).trim()||'0');
    const coeff = Number((await ask('계수(기본 1): ')).trim()||'1');
    const mp = Number((await ask('MP 소모(기본 0): ')).trim()||'0');
    const damageType = (await ask('피해속성(slash/pierce/magic/blunt, 없으면 공백): ')).trim();
    skills[id] = { id, name, range, type, hits, acc, accAdd, coeff, cost:{ mp }, damageType: damageType||undefined };
    saveSkills(parsed, skills); console.log('추가 완료:', id); return;
  }
  if(choice==='2'){
    const id = (await ask('수정할 스킬 ID: ')).trim();
    if(!skills[id]){ console.error('해당 스킬 없음'); return; }
    const field = (await ask('수정할 필드명(name/range/type/hits/acc/accAdd/coeff/cost.mp/damageType): ')).trim();
    const val = (await ask('새 값: ')).trim();
    if(field==='cost.mp'){ skills[id].cost = skills[id].cost||{}; skills[id].cost.mp = Number(val); }
    else if(['hits','acc','accAdd','coeff'].includes(field)){ skills[id][field] = Number(val); }
    else { skills[id][field] = val; }
    saveSkills(parsed, skills); console.log('수정 완료:', id); return;
  }
  if(choice==='3'){
    const id = (await ask('삭제할 스킬 ID: ')).trim();
    if(!skills[id]){ console.error('해당 스킬 없음'); return; }
    delete skills[id];
    saveSkills(parsed, skills); console.log('삭제 완료:', id); return;
  }
  if(choice==='4'){
    const all = Object.keys(skills);
    const unused = all.filter(id=> !used.has(id));
    console.log('미사용 스킬:', unused.length? unused.join(', ') : '(없음)');
    return;
  }
  if(choice==='5'){
    const unitId = (await ask('부여할 유닛 ID(예: C-001): ')).trim();
    const skillId = (await ask('스킬 ID: ')).trim();
    const units = unitsParsed.data;
    if(!units[unitId]){ console.error('유닛 없음'); return; }
    if(!skills[skillId]){ console.error('스킬 없음'); return; }
    units[unitId].skills = Array.from(new Set([...(units[unitId].skills||[]), skillId]));
    // Write back units.js (simple stringify similar to skills)
    const ids = Object.keys(units);
    ids.sort();
    const lines = ids.map(uid=>{
      const u = units[uid];
      const q = s=> `'${String(s)}'`;
      const kv = [];
      kv.push(`id:${q(u.id||uid)}`);
      if(u.name) kv.push(`name:${q(u.name)}`);
      if(u.type) kv.push(`type:${q(u.type)}`);
      if(u.row!=null) kv.push(`row:${u.row}`);
      if(u.col!=null) kv.push(`col:${u.col}`);
      if(Array.isArray(u.skills)) kv.push(`skills:[${u.skills.map(q).join(', ')}]`);
      if(u.passives) kv.push(`passives:[${(u.passives||[]).map(q).join(', ')}]`);
      // Basic stats (optional)
      ['hp','hpMax','mp','mpMax','atk','def','spd','crit','block','dodge'].forEach(k=>{ if(u[k]!=null) kv.push(`${k}:${u[k]}`); });
      return `  ${q(uid)}: { ${kv.join(', ')} }`;
    });
    const unitsText = `export const UNITS = {\n${lines.join(',\n')}\n};\n`;
    const src = unitsParsed.src;
    const before = src.slice(0, unitsParsed.obj.start);
    const afterStart = src.indexOf('\n', unitsParsed.obj.end+1);
    const tail = afterStart>0 ? src.slice(afterStart) : '\n';
    writeFile(UNITS_FILE, before + unitsText + tail);
    console.log('부여 완료:', unitId, '<=', skillId);
    return;
  }
  console.log('종료');
}

main().catch(e=>{ console.error('[SkillTool] 오류', e); process.exit(1); });


