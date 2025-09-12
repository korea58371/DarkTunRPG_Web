import { applyEffects } from '../engine/rules.js';

export function renderEpisodeView(root, state){
  // cleanup any lingering modals that might block clicks
  document.querySelectorAll('.modal-backdrop').forEach(el=>el.remove());
  const id = state.ui.currentEpisode || 'EP-001';
  const ep = state.data.episodes[id];
  // 루트 동기화: 이 에피소드(id)로 들어오는 루트를 "읽음/이번 회차 진행"으로 마킹
  try{
    const rIn = (state.data.routes||[]).find(rt=> rt.next === id);
    if(rIn){
      state.flags = state.flags || {};
      state.flags.visitedRoutes = state.flags.visitedRoutes || {};
      state.flags.runVisitedRoutes = state.flags.runVisitedRoutes || {};
      if(!state.flags.visitedRoutes[rIn.id]) state.flags.visitedRoutes[rIn.id] = true;
      if(!state.flags.runVisitedRoutes[rIn.id]) state.flags.runVisitedRoutes[rIn.id] = true;
      state.flags.lastRouteId = rIn.id;
      console.debug('[episode-sync-route]', { route:rIn.id, episode:id });
    }
  }catch{}
  const wrap = document.createElement('section');
  wrap.className='panel';
  wrap.innerHTML = `<h2>에피소드: ${id}</h2>`;

  const log = document.createElement('div');
  log.className='panel';
  ep.scene.forEach(line=>{
    const p = document.createElement('p');
    p.innerHTML = `<strong>${line.speaker}</strong>: ${line.text}`;
    log.appendChild(p);
  });

  const choices = document.createElement('div');
  choices.className='row';
  ep.choices.forEach(c=>{
    const btn = document.createElement('button');
    btn.className='btn';
    btn.textContent=c.label;
    btn.onclick=()=>{
      const effects = c.effects||[];
      const join = effects.find(e=>e.type==='party.add');
      applyEffects(state, effects);
      // 일반 엔딩: END-01 엔딩 화면 → 클릭 시 타이틀 복귀(성장 초기화, 루트 방문 정보 유지)
      if(c.next==='END-01'){
        console.debug('[ending-begin]', { ending: 'END01', ep: id, choice: c.label });
        const backdrop = document.createElement('div'); backdrop.className='modal-backdrop';
        const modal = document.createElement('div'); modal.className='modal';
        modal.innerHTML = `<h3>End01: 현실로</h3><p>현실로 귀환했습니다.</p><p style="color:#9aa0a6;">클릭하면 타이틀로 돌아갑니다.</p>`;
        backdrop.appendChild(modal); document.body.appendChild(backdrop);
        backdrop.addEventListener('click', ()=>{
          console.debug('[ending-click]', { ending: 'END01' });
          try{ backdrop.remove(); }catch{}
          // 성장 정보 초기화: 스킬 강화 진행도 초기화
          state.skillProgress = {}; console.debug('[ending-reset-skillProgress]');
          // 루트 방문 정보는 유지(visitedRoutes 보존)
          // 에피소드/전투 상태 클린업
          state.ui.currentEpisode = null; state.ui.battle = null; delete state.ui.battleState; console.debug('[ending-cleanup-ui]');
          // 타이틀로 이동
          if(typeof window.render==='function'){ console.debug('[ending-goto-title:render]'); window.render('title'); }
          else { const btn = document.querySelector('nav button[data-view=title]'); if(btn){ console.debug('[ending-goto-title:nav]'); btn.click(); } }
        }, { once:true });
        return;
      }
      // 배드엔딩: EP-220 → 종료 후 타이틀 복귀
      if(state.ui.currentEpisode==='EP-220'){
        console.debug('[badending-ep220]');
        const backdrop = document.createElement('div'); backdrop.className='modal-backdrop';
        const modal = document.createElement('div'); modal.className='modal';
        modal.innerHTML = `<h3>게임 오버</h3><p>타이틀 화면으로 돌아갑니다.</p><div class="actions"><button class="btn" id="goTitle">확인</button></div>`;
        backdrop.appendChild(modal); document.body.appendChild(backdrop);
        modal.querySelector('#goTitle').onclick=()=>{
          console.debug('[badending-click]');
          backdrop.remove();
          // 완전 초기화 및 타이틀로
          if(typeof window.resetState==='function'){ window.resetState(); return; }
          if(typeof window.render==='function'){ console.debug('[badending-goto-title:render]'); window.render('title'); return; }
          const btn = document.querySelector('nav button[data-view=title]'); if(btn){ console.debug('[badending-goto-title:nav]'); btn.click(); }
        };
        return;
      }
      if(join){
        // show join modal
        const unit = state.data.units[join.unit];
        const name = unit?.name || join.unit;
        const backdrop = document.createElement('div'); backdrop.className='modal-backdrop';
        const modal = document.createElement('div'); modal.className='modal';
        modal.innerHTML = `<h3>동료 합류</h3><p><strong>${name}</strong> 이(가) 파티에 합류했습니다.</p><div class="actions"><button class="btn" id="okJoin">확인</button></div>`;
        backdrop.appendChild(modal); document.body.appendChild(backdrop);
        modal.querySelector('#okJoin').onclick=()=>{
          backdrop.remove();
          if(c.next.startsWith('R-')){
            const route = state.data.routes.find(r=>r.id===c.next);
            if(route){
              if(!state.flags.visitedRoutes) state.flags.visitedRoutes={};
              state.flags.visitedRoutes[route.id]=true;
              state.flags.runVisitedRoutes = state.flags.runVisitedRoutes || {};
              state.flags.runVisitedRoutes[route.id]=true;
              state.flags.lastRouteId = route.id;
              if(route.next?.startsWith('EP-')){ state.ui.currentEpisode=route.next; (window.render? window.render('episode') : document.querySelector('nav button[data-view=episode]')?.click()); return; }
              if(route.next?.startsWith('BT-')){ state.ui.battle=route.next; (window.render? window.render('battle') : document.querySelector('nav button[data-view=battle]')?.click()); return; }
            }
            document.querySelector('nav button[data-view=routes]').click();
          }
          else if(c.next.startsWith('N-')) {/* reserved */}
          else if(c.next.startsWith('EP-')){ state.ui.currentEpisode=c.next; root.dispatchEvent(new CustomEvent('nav',{detail:'episode'})); }
          else if(c.next.startsWith('BT-')){ state.ui.battle=c.next; root.dispatchEvent(new CustomEvent('nav',{detail:'battle'})); }
        };
        return;
      }
      if(c.next.startsWith('R-')){
        const route = state.data.routes.find(r=>r.id===c.next);
        if(route){
          if(!state.flags.visitedRoutes) state.flags.visitedRoutes={};
          state.flags.visitedRoutes[route.id]=true;
          state.flags.runVisitedRoutes = state.flags.runVisitedRoutes || {};
          state.flags.runVisitedRoutes[route.id]=true;
          state.flags.lastRouteId = route.id;
          // EP 완료 플래그(재합류 OR 조건용)
          if(id==='EP-210'){ state.flags['ep.EP-210.done'] = true; }
          if(route.next?.startsWith('EP-')){ state.ui.currentEpisode=route.next; (window.render? window.render('episode') : document.querySelector('nav button[data-view=episode]')?.click()); return; }
          if(route.next?.startsWith('BT-')){ state.ui.battle=route.next; (window.render? window.render('battle') : document.querySelector('nav button[data-view=battle]')?.click()); return; }
        }
        document.querySelector('nav button[data-view=routes]').click();
      }
      else if(c.next.startsWith('N-')) {/* reserved */}
      else if(c.next.startsWith('EP-')){ state.ui.currentEpisode=c.next; root.dispatchEvent(new CustomEvent('nav',{detail:'episode'})); }
      else if(c.next.startsWith('BT-')){ state.ui.battle=c.next; root.dispatchEvent(new CustomEvent('nav',{detail:'battle'})); }
    };
    choices.appendChild(btn);
  });

  wrap.append(log, choices);
  root.innerHTML='';
  root.appendChild(wrap);
}


