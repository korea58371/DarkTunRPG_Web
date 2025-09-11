import { applyEffects } from '../engine/rules.js';

export function renderEpisodeView(root, state){
  // cleanup any lingering modals that might block clicks
  document.querySelectorAll('.modal-backdrop').forEach(el=>el.remove());
  const id = state.ui.currentEpisode || 'EP-001';
  const ep = state.data.episodes[id];
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
      // 배드엔딩: EP-220 → 종료 후 타이틀 복귀
      if(state.ui.currentEpisode==='EP-220'){
        const backdrop = document.createElement('div'); backdrop.className='modal-backdrop';
        const modal = document.createElement('div'); modal.className='modal';
        modal.innerHTML = `<h3>게임 오버</h3><p>타이틀 화면으로 돌아갑니다.</p><div class="actions"><button class="btn" id="goTitle">확인</button></div>`;
        backdrop.appendChild(modal); document.body.appendChild(backdrop);
        modal.querySelector('#goTitle').onclick=()=>{
          backdrop.remove();
          // 완전 초기화 및 타이틀로
          if(typeof window.resetState==='function'){ window.resetState(); return; }
          document.querySelector('nav button[data-view=title]')?.click();
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


