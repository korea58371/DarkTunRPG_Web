export async function renderBattleView(root, state, skipLoading = false){
  const btid = state.ui.battle || Object.keys(state.data.battles||{})[0] || 'BT-100';
  const bt = state.data.battles[btid];
  
  // 전투 중 리렌더링이 아닌 경우에만 로딩 화면 표시
  if(!skipLoading && (!state.ui.battleState || state.ui.battleState.id !== (bt.id||btid))) {
    // 로딩 화면 표시
    const loadingScreen = createLoadingScreen();
    root.innerHTML = '';
    root.appendChild(loadingScreen);
    
    // 전투 리소스 사전 로딩
    try {
      await preloadBattleResources(state, bt, btid);
    } catch(e) {
      console.warn('[battle-preload-error]', e);
    }
    
    // 로딩 완료 후 페이드 아웃
    await fadeOutLoading(loadingScreen);
  }
  
  const frame = document.createElement('div');
  frame.className='battle-frame';
  frame.innerHTML = `
    <div class="battle-top">
      <div class="turn-queue" id="turnQueue"></div>
      <div><strong>전투: ${btid}</strong></div>
      <div class="chip">Seed ${state.data.battles[btid].seed}</div>
    </div>
    <div class="battle-center">
      <div class="lane" id="allyLane"></div>
      <div class="lane" id="enemyLane"></div>
    </div>
    <div class="battle-bottom">
      <div class="actor-info" id="actorInfo"></div>
      <div class="action-cards" id="actionCards"></div>
    </div>
  `;

  // 전투 배경 이미지 적용(battles.js 의 bg 필드)
  (function applyBattleBackground(){
    try{
      const center = frame.querySelector('.battle-center');
      const raw = bt?.bg || 'BG_001.png';
      const path = (typeof raw==='string')
        ? (raw.includes('/') ? raw : `assets/bg/${raw}`)
        : (raw?.path || 'assets/bg/BG_001.png');
      center.style.backgroundImage = `url('${path}')`;
      center.style.backgroundSize = 'cover';
      center.style.backgroundPosition = 'center';
      center.style.backgroundRepeat = 'no-repeat';
      center.style.position = 'relative';
      center.style.overflow = 'hidden';
      // 전투 영역 세로 공간 확보(1920x1080 기준, 상단/하단 UI 제외)
      center.style.minHeight = '680px';
      center.style.display = 'grid';
      center.style.gridTemplateColumns = '1fr 1fr';
      center.style.alignItems = 'stretch';
      center.style.justifyItems = 'stretch';
      
      // 배경에 따른 조명 효과 적용 (새 전투이거나 조명이 설정되지 않은 경우만)
      const isNewBattle = !state.ui.battleState || state.ui.battleState.id !== (bt.id||btid);
      const hasLighting = state.ui.battleState?.lightingApplied;
      
      if (isNewBattle || !hasLighting) {
        setTimeout(() => {
          applyLightingEffect(path);
          // 전투 상태에 조명 적용 완료 표시
          if (state.ui.battleState) {
            state.ui.battleState.lightingApplied = true;
          }
        }, 100); // 렌더링 완료 후 적용
      }
    }catch{}
  })();

  // 초기 전투 상태 준비 (파티 변경 시 재생성)
  // 기존: party/positions 스냅샷 비교로 중간에 캐시를 삭제했음 → 전투 중 사망 처리로 party가 바뀌면 적이 부활하는 문제 유발
  // 수정: battle id가 바뀔 때만 새로 생성
  if(!state.ui.battleState || state.ui.battleState.id !== (bt.id||btid)){
    state.ui.battleState = window.BATTLE.createBattleState(state, bt);
  }
  const B = state.ui.battleState;
  console?.log?.('[battle] mount', { btid, allies: B.allyOrder, enemies: B.enemyOrder, queue: B.queue });

  // 루트 동기화: 이 전투(B.id)로 들어오는 루트가 있다면 "읽음/이번 회차 진행"으로 즉시 마킹
  try{
    const rIn = (state.data.routes||[]).find(rt=> rt.next === (B.id||btid));
    if(rIn){
      state.flags = state.flags || {};
      state.flags.visitedRoutes = state.flags.visitedRoutes || {};
      state.flags.runVisitedRoutes = state.flags.runVisitedRoutes || {};
      if(!state.flags.visitedRoutes[rIn.id]) state.flags.visitedRoutes[rIn.id] = true;
      if(!state.flags.runVisitedRoutes[rIn.id]) state.flags.runVisitedRoutes[rIn.id] = true;
      state.flags.lastRouteId = rIn.id;
      console.debug('[battle-sync-route]', { route:rIn.id, battle:B.id });
    }
  }catch{}

  // 적이 이미 모두 사망(또는 없음) 상태라면 즉시 클리어 처리
  try{
    if(window.BATTLE.isBattleFinished(B)){
      console.debug('[finish] auto at mount');
      return showResult(B.winner==='ally');
    }
  }catch(e){ console.debug('[finish-check-error] at mount', e); }

  if(!B.queue || B.queue.length===0){
    const msg = document.createElement('div');
    msg.className='frame';
    msg.innerHTML = `<div style="padding:16px;color:#cbd5e1;">전투 대기열이 비어 있습니다. 파티/적 데이터 구성을 확인하세요.</div>`;
    root.innerHTML=''; root.appendChild(msg); return;
  }

  // 3-row per side (rear, mid, front), each row has 3 slots
  // Ally turn: preselect remembered target if alive
  const turnId = B.turnUnit;
  if(B.allyOrder.includes(turnId)){
    const remembered = B.lastTarget?.[turnId];
    if(remembered && B.enemyOrder.includes(remembered) && (B.units[remembered]?.hp>0)){
      B.target = remembered;
    }
  }
  const renderRows = (laneEl, ids, side)=>{
    laneEl.innerHTML = '';
    laneEl.classList.add(side);
    const title = document.createElement('div'); title.className='title'; title.textContent = side==='ally' ? '아군' : '적군';
    laneEl.appendChild(title);
    const rows = document.createElement('div'); rows.className='rows';
    // 보드 전체를 약간 아래쪽으로 이동시켜 하단에 몰리게 함
    try{ rows.style.top = '300px'; }catch{}
    // 세로 간격(행 간 y 간격) 최소화(겹침 허용)
    try{ rows.style.rowGap = '0px'; }catch{}
    // 원근감: row가 높을수록 세로 공간을 더 크게 배분
    try{
      const rowHeights = [0.8, 1.15, 1.3]; // 1열 < 2열 < 3열
      rows.style.gridTemplateRows = rowHeights.map(v=> `${v}fr`).join(' ');
    }catch{}
    // 시각만 대칭: transform 사용하지 않음 (이동/타겟 로직 영향 방지)

    // UI index mapping: 추가 반전 없이 col 그대로 사용
    const uiIndexFromCol=(sideName, col)=>{
      const c = Math.max(0, Math.min(2, col||0));
      return c;
    };

    // 3x3 고정 그리드를 유지하기 위해 각 row별 3칸 배열을 만든다.
    function toLine(rowNum){
      const line = [null,null,null];
      ids.forEach(id=>{
        if(!id) return; const u=B.units[id]; if(!u) return;
        if((u.row||2)!==rowNum) return; const idx = uiIndexFromCol(side, (u.col ?? 0));
        console.log(`[toLine] ${side} ${id}: u.col=${u.col} → idx=${idx}`);
        line[idx] = id;
      });
      return line;
    }
    const orderRows = [1,2,3];
    orderRows.forEach(rowNum=>{
      const wrap = document.createElement('div'); wrap.className='row-wrap';
      try{ wrap.style.position='relative'; wrap.style.zIndex = String(10 + (rowNum||1)); wrap.style.pointerEvents='auto'; }catch{}
      try{ wrap.style.pointerEvents = 'auto'; }catch{}
      try{ wrap.style.display = 'grid'; }catch{}
      // 행 박스를 내용 너비로 축소하고, 행 자체를 좌/우로 정렬 + row별 오프셋
      try{ 
        wrap.style.width='fit-content'; 
        
        // row별 원근감 오프셋 계산
        const baseOffset = 0;
        const rowOffset = (rowNum - 1) * 40; // row가 높을수록 40px씩 더 밀림
        
        if(side === 'ally') {
          wrap.style.justifySelf = 'end';
          wrap.style.marginRight = `${baseOffset + rowOffset}px`;
          wrap.style.marginLeft = '0px';
        } else {
          wrap.style.justifySelf = 'start';
          wrap.style.marginLeft = `${baseOffset + rowOffset}px`;
          wrap.style.marginRight = '0px';
        }
      }catch{}
      // 원근감: row가 높을수록 같은 열 간격을 넓게(최소 겹침 허용을 위해 기본 gap은 좁게)
      try{
        const baseGap=20, addPerRow=24;
        wrap.style.columnGap = `${baseGap + (rowNum-1)*addPerRow}px`;
        // 열을 내용 너비로 만들고 gap이 실제 간격으로 작동하게 함
        wrap.style.gridTemplateColumns = 'repeat(3, max-content)';
        // wrap.style.justifyContent 는 사용하지 않음 (행 박스 자체를 이동)
      }catch{}
      const line = toLine(rowNum); // [col0, col1, col2]
      const colOrder = (side==='ally') ? [2,1,0] : [0,1,2];
      colOrder.forEach((colIndex)=>{
        const id = line[colIndex];
        const slot = document.createElement('div'); slot.className='slot';
        try{ slot.style.pointerEvents='auto'; }catch{}
        try{ slot.style.overflow = 'visible'; }catch{}
        // 열 위치를 명시적으로 고정(아군은 2,1,0이 오른→중→왼 순서가 되도록)
        try{
          const gridCol = (side==='ally') ? (3 - colIndex) : (colIndex + 1);
          slot.style.gridColumnStart = String(gridCol);
          // 대칭을 위해 per-col 마진은 제거 (간격은 columnGap으로만 처리)
          slot.style.marginLeft = '0px';
          slot.style.marginRight = '0px';
        }catch{}
        if(id){
          const u = B.units[id];
          const el = document.createElement('div'); el.className='unit-slot'; if(u.large) el.classList.add('large'); el.dataset.unitId = id;
          try{ el.style.pointerEvents='auto'; }catch{}
          if(B.turnUnit===id) el.classList.add('is-turn');
          if(B.target===id) el.classList.add('is-target');
          // buff icons
          const buffsHtml = (()=>{
            const buf=[];
            if(u._regen && u._regen.remain>0){ buf.push(`<div class=\"slot-buff regen\" title=\"지속 회복\"><span>✚</span><span class=\"turns\">${u._regen.remain}</span></div>`); }
            if(u._poison && u._poison.remain>0){ buf.push(`<div class=\"slot-buff poison\" title=\"중독\"><span>☠</span><span class=\"turns\">${u._poison.remain}</span></div>`); }
            if(u._bleed && u._bleed.remain>0){ buf.push(`<div class=\"slot-buff bleed\" title=\"출혈\"><span>🩸</span><span class=\"turns\">${u._bleed.remain}</span></div>`); }
            if(u._burn && u._burn.remain>0){ buf.push(`<div class=\"slot-buff burn\" title=\"화상\"><span>🔥</span><span class=\"turns\">${u._burn.remain}</span></div>`); }
            return buf.join('');
          })();
          el.innerHTML = `<div class=\"inner\"><div class=\"portrait\"><div class=\"portrait-mood\"></div><div class=\"portrait-light\"></div></div><div class=\"hpbar\"><span style=\"width:${Math.max(0,(u.hp/u.hpMax)*100)}%\"></span><i class=\"pred\" style=\"width:0%\"></i></div><div class=\"shieldbar\" style=\"display:${(u.shield||0)>0?'block':'none'};\"><span style=\"width:${Math.max(0, Math.min(100, ((u.shield||0)/(u.hpMax||1))*100))}%\"></span></div><div class=\"name-label\">${u.name}</div></div><div class=\"slot-buffs\">${buffsHtml}</div><div class=\"hitbox\" style=\"position:absolute; inset:0; z-index:10;\"></div>`;
          // 초상 이미지: 리소스 적용 + 초기 스케일 고정(상태 전환에도 동일 비율 유지)
          try{ 
            const urls = getPortraitUrls(id, 'default'); 
            const p = el.querySelector('.portrait'); 
            const moodEl = el.querySelector('.portrait-mood');
            p.style.transformOrigin='center bottom'; 
            p.style.transform='translate(-50%, 0) scale(1)'; 
            safeSetBackgroundImage(p, urls.base, urls.base);
            
            // portrait-mood에도 같은 이미지 설정
            if (moodEl) {
              safeSetBackgroundImage(moodEl, urls.base, urls.base);
            }
            
            // 현재 배경에 맞는 조명 효과 적용 (새 유닛이므로 강제 적용)
            const currentBg = frame.querySelector('.battle-center')?.style.backgroundImage;
            if(currentBg) {
              const bgPath = currentBg.replace(/url\(['"]?|['"]?\)/g, '');
              
              // 1. 전투 데이터에서 lighting 필드 확인 (우선순위 1)
              let preset = null;
              if (bt && bt.lighting) {
                const presetKey = bt.lighting.preset || 'DEFAULT';
                preset = LIGHTING_PRESETS[presetKey] || LIGHTING_PRESETS.DEFAULT;
              } else {
                // 2. 배경 파일명으로 자동 조명 적용 (우선순위 2)
                const bgFileName = bgPath.split('/').pop() || bgPath;
                const presetKey = BG_TO_PRESET[bgFileName] || 'DEFAULT';
                preset = LIGHTING_PRESETS[presetKey] || LIGHTING_PRESETS.DEFAULT;
              }
              
              // CSS 클래스가 자동으로 적용되므로 JavaScript에서 filter 설정 불필요
              // 새 유닛은 트랜지션 없이 즉시 적용
            }
          }catch{}
          // Light 오버레이 이미지 설정 (존재하는 경우에만 표시)
          try{ 
            const urls = getPortraitUrls(id, 'default'); 
            const lightEl = el.querySelector('.portrait-light'); 
            if(lightEl && urls.light){ 
              // Light 이미지 존재 여부 확인 후 표시
              checkLightImageExists(urls.light, (exists) => {
                if(exists) {
                  lightEl.style.display = 'block';
                  safeSetBackgroundImage(lightEl, urls.light, '');
                } else {
                  lightEl.style.display = 'none';
                }
              });
            } else if(lightEl) {
              lightEl.style.display = 'none'; // light 이미지가 없으면 숨김
            }
          }catch{}
          // 원근감: row가 높을수록 슬롯 사이즈 증가 (아군/적군 동일)
          try{
            const inner = el.querySelector('.inner');
            const baseScale = 2.5; // 기본 크기 2.5배
            const rowScale = Math.pow(1.2, Math.max(0, (rowNum||1) - 1)); // row가 커질수록 1.2배씩 증가
            const unitScale = Number(B.units[id]?.spriteScale || 1);
            const imgScale = unitScale;  // 유닛별 보정
            inner.style.transformOrigin = 'bottom center';
            inner.style.transform = `scale(${Math.round(baseScale*rowScale*imgScale*100)/100})`;
            console.log(`[scale-debug] ${side} ${id} row${rowNum}: baseScale=${baseScale} × rowScale=${rowScale} × imgScale=${imgScale} = ${Math.round(baseScale*rowScale*imgScale*100)/100}`);
          }catch{}
          el.onmouseenter=(e)=>{ window.UI_TIP?.showTooltip(`${u.name}\nHP ${u.hp}/${u.hpMax} · MP ${(u.mp||0)} · SPD ${u.spd}\nATK ${u.atk} · DEF ${u.def}`, e.clientX, e.clientY); };
          el.onmousemove=(e)=>{ window.UI_TIP?.positionTip(e.clientX, e.clientY); };
          el.onmouseleave=()=> window.UI_TIP?.hideTooltip();
          // 클릭은 enableSelect()에서 hitbox에만 바인딩한다.
          slot.appendChild(el);
          // 클릭 핸들러는 enableSelect()에서 일괄 바인딩
        } else {
          // 투명한 빈 슬롯을 추가하여 레이아웃 고정
          const ghost = document.createElement('div'); ghost.className='unit-slot ghost';
          ghost.style.opacity='0';
          slot.appendChild(ghost);
        }
        wrap.appendChild(slot);
      });
      rows.appendChild(wrap);
    });
    laneEl.appendChild(rows);
    // 캡처 단계에서 레인 클릭 로그(전역 디버그)
    try{
      laneEl.addEventListener('click', (e)=>{
        const t=e.target; const rect=t?.getBoundingClientRect?.()||{};
        console.log('[lane-click-capture]', { side, tag:t?.tagName, cls:t?.className, x:e.clientX, y:e.clientY, tRect:{x:rect.left,y:rect.top,w:rect.width,h:rect.height} });
      }, true);
      laneEl.addEventListener('click', (e)=>{
        const t=e.target; const rect=t?.getBoundingClientRect?.()||{};
        console.log('[lane-click-bubble]', { side, tag:t?.tagName, cls:t?.className, x:e.clientX, y:e.clientY, tRect:{x:rect.left,y:rect.top,w:rect.width,h:rect.height} });
      }, false);
    }catch{}
  };

  const allyLane = frame.querySelector('#allyLane'); allyLane.className='lane ally';
  const enemyLane = frame.querySelector('#enemyLane'); enemyLane.className='lane enemy';
  // 배경 노출을 위해 레인 배경 투명화 + 레인이 전체 높이를 사용하도록 함
  try{ 
    allyLane.style.background = 'transparent'; 
    enemyLane.style.background = 'transparent'; 
    allyLane.style.height = '100%';
    enemyLane.style.height = '100%';
  }catch{}
  renderRows(allyLane, B.allyOrder, 'ally');
  renderRows(enemyLane, B.enemyOrder, 'enemy');
  // redraw remembered target highlight if valid
  if(B.target){
    const lane = B.enemyOrder.includes(B.target) ? enemyLane : allyLane;
    const el = lane.querySelector(`.unit-slot[data-unit-id="${B.target}"]`);
    if(el) el.classList.add('is-target');
  }
  enableSelect(enemyLane, 'enemy');
  // 아군 타겟팅 스킬 지원을 위해 아군 레인도 선택 가능하게
  enableSelect(allyLane, 'ally');
  // 초기 AOE 하이라이트
  // selectedSkill는 아래에서 정의되므로 이후 호출에서도 갱신됨
  // 초기 렌더 시 턴 하이라이트 보정
  setTimeout(()=> setTurnHighlight(), 0);

  // 턴 큐 + 턴 시작 시점 처리(지속힐 등)
  const tq = frame.querySelector('#turnQueue'); tq.innerHTML='';
  B.queue.slice(0,10).forEach(id=>{ const chip=document.createElement('span'); chip.className='chip'; chip.textContent=B.units[id]?.name||id; tq.appendChild(chip); });
  // 조작 가능한 시점(렌더 직후)에만 턴 시작 효과를 적용
  if(B.turnUnit && B.turnStartProcessedFor !== B.turnUnit){
    window.BATTLE.applyTurnStartEffects(B);
    animateFromLog();
    B.turnStartProcessedFor = B.turnUnit;
  }

  // 하단 HUD: 현재 턴 유닛 정보
  const actor = B.units[B.turnUnit];
  const info = frame.querySelector('#actorInfo');
  info.innerHTML = `
    <div class="portrait" style="width:72px; height:72px; border-radius:10px;"></div>
    <div class="col bars">
      <div class="row" style="align-items:center; gap:8px;"><strong>${actor.name}</strong></div>
      <div class="bar"><span class="hp" style="width:${Math.max(0,(actor.hp/actor.hpMax)*100)}%"></span></div>
      <div class="bar"><span class="mp" style="width:${Math.max(0,((actor.mp||0)/(actor.mpMax||Math.max(1,actor.mp||10)))*100)}%"></span></div>
      <div class="bar" style="display:${(actor.shield||0)>0?'block':'none'};"><span class="shield" style="width:${Math.max(0, Math.min(100, ((actor.shield||0)/(actor.hpMax||1))*100))}%"></span></div>
      <div class="buffs">${Array.from({length:6}).map(()=>'<div class="buff-slot"></div>').join('')}</div>
    </div>
  `;

  // 행동 패널(탭 + 카드)
  const bottom = frame.querySelector('.battle-bottom');
  const tabs = document.createElement('div'); tabs.className='action-tabs';
  const tabNames = ['전체','공격','지원'];
  let activeTab = '전체';
  tabNames.forEach(name=>{
    const t = document.createElement('button'); t.className='tab'+(name===activeTab?' active':''); t.textContent=name; t.onclick=()=>{ activeTab=name; document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active')); t.classList.add('active'); renderCards(); };
    tabs.appendChild(t);
  });
  // 카드 패널 컨테이너
  const cardsPanel = document.createElement('div'); cardsPanel.className='cards-panel';
  const cardsEl = frame.querySelector('#actionCards');
  // 선택 상태 기본값(복원 로직 제거)
  let selectedSkill = null;
  let selectedTarget = B.target || null;
  // 이동 후보 오버레이 정리 함수 핸들
  let cleanupMoveOverlay = null;
  // 스킬 레벨업 대기 제어
  B.awaitingUpgrade = B.awaitingUpgrade || false;
  B._awaitUpgradeResolve = B._awaitUpgradeResolve || null;

  function debugFinish(tag){
    try{
      const eAlive = (B.enemyOrder||[]).filter(id=>id && (B.units[id]?.hp>0)).length;
      const aAlive = (B.allyOrder||[]).filter(id=>id && (B.units[id]?.hp>0)).length;
      console.debug('[battle-finish-check]', tag, { eAlive, aAlive, winner:B.winner, awaiting:B.awaitingUpgrade });
    }catch(e){ console.debug('[battle-finish-check-error]', tag, e); }
  }

  function hasUpgrade(skillId, upId){
    try{ const baseId=(B.turnUnit||'').split('@')[0]; return (state.skillProgress?.[baseId]?.[skillId]?.taken||[]).includes(upId); }catch{return false;}
  }

  // 업그레이드 적용된 실사용 스킬 미리보기(뷰 전용)
  function getEffectiveSkill(base){
    try{
      if(!base) return base;
      const actorIdLocal = B.turnUnit;
      const baseId = (actorIdLocal||'').split('@')[0];
      const sp = state.skillProgress?.[baseId]?.[base.id];
      if(!sp || !sp.taken || !sp.taken.length) return base;
      const upDefs = (state.data?.skills?.[base.id]?.upgrades)||[];
      const copy = JSON.parse(JSON.stringify(base));
      const applyEffect = (obj, eff)=>{
        const segs = String(eff.path||'').split('.').filter(Boolean);
        let cur = obj; for(let i=0;i<segs.length-1;i++){ const k=segs[i]; if(!(k in cur)) cur[k]={}; cur=cur[k]; }
        const last = segs[segs.length-1]; const op = eff.op||'set'; const val = eff.value;
        if(op==='set') cur[last] = val;
        else if(op==='add') cur[last] = (cur[last]||0) + Number(val||0);
        else if(op==='mul') cur[last] = (cur[last]||0) * Number(val||1);
      };
      const countById = sp.taken.reduce((m,id)=>{ m[id]=(m[id]||0)+1; return m; },{});
      upDefs.forEach(up=>{ const n=countById[up.id]||0; for(let i=0;i<n;i++){ (up.effects||[]).forEach(e=> applyEffect(copy, e)); }});
      return copy;
    }catch{ return base; }
  }

  function getSlotByIdOrBase(targetId){
    // 우선 ID 패턴으로 lane 결정 (order 변경 후에도 안정적)
    let lane = null;
    if((targetId || '').includes('@E')) lane = enemyLane;
    else if((targetId || '').includes('@A')) lane = allyLane;
    let el = lane ? lane.querySelector(`.unit-slot[data-unit-id="${targetId}"]`) : null;
    if(el) return { lane, el };
    // 실패 시 로그 (디버그)
    console.warn('[slot-lookup-fail]', { targetId, lane: lane?.className });
    // 베이스ID로 보정 검색
    const base = (targetId||'').split('@')[0];
    // 1) 최근 지정한 대상 매핑이 있으면 우선 사용
    try{
      if(B._lastTargetByBase && B._lastTargetByBase[base]){
        const prefId = B._lastTargetByBase[base];
        const prefLane = (prefId.includes('@E')) ? enemyLane : ((prefId.includes('@A')) ? allyLane : null);
        const prefEl = prefLane?.querySelector(`.unit-slot[data-unit-id="${prefId}"]`);
        if(prefEl) return { lane: prefLane, el: prefEl };
      }
    }catch{}
    // 2) DOM 상 존재하는 동일 베이스 중 첫 번째
    const all = Array.from(document.querySelectorAll('.unit-slot'));
    const found = all.find(n => (n.dataset?.unitId||'').startsWith(base+'@'));
    if(found){
      const inEnemy = found.dataset.unitId.includes('@E');
      return { lane: inEnemy? enemyLane : allyLane, el: found };
    }
    return { lane:null, el:null };
  }

  // 초상 이미지 조회: 우선 unit 데이터의 sprite 필드를 사용
  const FALLBACK_SPRITE = { base: 'assets/mon/mon_001.png' };

  function getPortraitUrls(unitId, mode = 'default'){
    try{
      const baseId = String(unitId||'').split('@')[0];
      const unitDef = state.data?.units?.[baseId];
      if(unitDef && unitDef.sprite){ 
        const sprite = { ...unitDef.sprite };
        // 현재 모드에 맞는 light 이미지 경로 생성
        if(sprite.base) {
          const basePath = sprite.base;
          if(mode === 'hit' && sprite.hit) {
            // hit 상태일 때는 hit 이미지에서 _hit_light 경로 생성
            const hitPath = sprite.hit;
            const lightPath = hitPath.replace('.png', '_light.png');
            sprite.light = lightPath;
          } else if(mode === 'attack' && sprite.attack) {
            // attack 상태일 때는 attack 이미지에서 _attack_light 경로 생성
            const attackPath = sprite.attack;
            const lightPath = attackPath.replace('.png', '_light.png');
            sprite.light = lightPath;
          } else {
            // default 상태일 때는 base 이미지에서 _light 경로 생성
            const lightPath = basePath.replace('.png', '_light.png');
            sprite.light = lightPath;
          }
        }
        return sprite; 
      }
      const u = B.units[unitId];
      if(u && u.sprite){ 
        const sprite = { ...u.sprite };
        // 현재 모드에 맞는 light 이미지 경로 생성
        if(sprite.base) {
          const basePath = sprite.base;
          if(mode === 'hit' && sprite.hit) {
            const hitPath = sprite.hit;
            const lightPath = hitPath.replace('.png', '_light.png');
            sprite.light = lightPath;
          } else if(mode === 'attack' && sprite.attack) {
            const attackPath = sprite.attack;
            const lightPath = attackPath.replace('.png', '_light.png');
            sprite.light = lightPath;
          } else {
            const lightPath = basePath.replace('.png', '_light.png');
            sprite.light = lightPath;
          }
        }
        return sprite; 
      }
      return FALLBACK_SPRITE;
    }catch{ return FALLBACK_SPRITE; }
  }

  function safeSetBackgroundImage(el, url, fallback){
    try{
      if(!el) return;
      const img = new Image();
      img.onload = ()=>{ try{ el.style.backgroundImage = `url('${url}')`; }catch{} };
      img.onerror = ()=>{ try{ el.style.backgroundImage = `url('${fallback}')`; }catch{} };
      img.src = url;
    }catch{}
  }

  // Light 이미지 존재 여부를 확인하는 함수
  function checkLightImageExists(url, callback){
    try{
      const img = new Image();
      img.onload = () => callback(true);
      img.onerror = () => callback(false);
      img.src = url;
    }catch{
      callback(false);
    }
  }

  function applyPortraitState(unitId, mode){
    try{
      if(!unitId) return;
      const { el } = getSlotByIdOrBase(unitId);
      const p = el?.querySelector('.portrait'); if(!p) return;
      const urls = getPortraitUrls(unitId, mode);
      const src = (mode==='attack')? (urls.attack||urls.base) : (mode==='hit')? (urls.hit||urls.base) : (urls.base);
      try{
        const prev = (p.style.backgroundImage||'').replace(/^url\("?|"?\)$/g,'');
        console.log('[sprite]', { unitId, mode, prev, next: src, lane: (B.enemyOrder.includes(unitId)? 'enemy':'ally') });
        p.dataset.spriteMode = mode||'default';
      }catch{}
      safeSetBackgroundImage(p, src, urls.base);
      
      // portrait-mood에도 같은 이미지 설정 (조명 효과용)
      const moodEl = el?.querySelector('.portrait-mood');
      if (moodEl) {
        safeSetBackgroundImage(moodEl, src, urls.base);
      }
      
      if(mode === 'attack' && urls.attack) {
        p.style.transform = 'translate(-50%, 0) scale(1.1)';
        setTimeout(() => { p.style.transform = 'translate(-50%, 0) scale(1)'; }, 200);
      } else if(mode === 'hit' && urls.hit) {
        // 피격 애니메이션: 살짝 작아졌다가 원래 크기로 (더 부드럽게)
        p.style.transform = 'translate(-50%, 0) scale(1.0)';
        setTimeout(() => { 
          p.style.transform = 'translate(-50%, 0) scale(1.02)';
          setTimeout(() => { p.style.transform = 'translate(-50%, 0) scale(1)'; }, 100);
        }, 150);
      } else {
        p.style.transform = 'translate(-50%, 0) scale(1)';
      }
      
      // Light 오버레이 표시 (모든 상태에서, 이미지 존재 시에만)
      const lightEl = el?.querySelector('.portrait-light');
      if(lightEl && urls.light) {
        checkLightImageExists(urls.light, (exists) => {
          if(exists) {
            lightEl.style.display = 'block';
            safeSetBackgroundImage(lightEl, urls.light, '');
          } else {
            lightEl.style.display = 'none';
          }
        });
      }
    }catch{}
  }

  // Light 오버레이 제어 함수들 (base 상태에서만 토글)
  function toggleLightOverlay(unitId){
    try{
      if(!unitId) return;
      const { el } = getSlotByIdOrBase(unitId);
      if(el) {
        const lightEl = el.querySelector('.portrait-light');
        const portrait = el.querySelector('.portrait');
        if(lightEl && portrait) {
          // 현재 스프라이트 상태 확인 (base 상태일 때만 토글)
          const currentMode = portrait.dataset.spriteMode || 'default';
          if(currentMode === 'default' || !currentMode) {
            lightEl.style.display = lightEl.style.display === 'none' ? 'block' : 'none';
          }
        }
      }
    }catch{}
  }

  function refreshCardStates(){
    const cards = cardsEl.querySelectorAll('.action-card');
    cards.forEach(card=>{
      const id = card.dataset.skillId; if(!id) return;
      const baseSk = state.data.skills[id];
      const sk = getEffectiveSkill(baseSk);
      const mpOk = (actor.mp||0) >= (sk.cost?.mp||0);
      
      // 비활성화 조건 개선: MP 부족이거나 선택 가능한 타겟이 아예 없는 경우에만
      let shouldDisable = false;
      
      // 1. MP 부족
      if(!mpOk) {
        shouldDisable = true;
      }
      // 2. 선택 가능한 타겟이 아예 없는 경우
      else if(!hasAnyValidTarget(sk)) {
        shouldDisable = true;
      }
      
      card.classList.toggle('disabled', shouldDisable);
      card.classList.toggle('mp-insufficient', !mpOk);
    });
  }
  
  function hasAnyValidTarget(sk){
    if(!sk) return false;
    
    // 타겟이 필요 없는 스킬들
    if(sk.type==='move' || sk.type==='shield') return true;
    
    // 아군 대상 스킬
    if(sk.range==='ally'){
      return B.allyOrder.some(id => id && (B.units[id]?.hp > 0));
    }
    
    // 적군 대상 스킬
    if(sk.range==='ranged'){
      return B.enemyOrder.some(id => id && (B.units[id]?.hp > 0));
    }
    
    // 근접 스킬 (최전열만 타격 가능)
    if(sk.range==='melee'){
      const aliveEnemies = B.enemyOrder.filter(id => id && (B.units[id]?.hp > 0));
      if(!aliveEnemies.length) return false;
      const minCol = Math.min(...aliveEnemies.map(id => B.units[id]?.col ?? 999));
      return aliveEnemies.some(id => (B.units[id]?.col ?? 999) === minCol);
    }
    
    // 기본적으로 살아있는 적이 있으면 타겟 가능
    return B.enemyOrder.some(id => id && (B.units[id]?.hp > 0));
  }
  
  function getInvalidTargetMessage(sk, targetId){
    if(!sk || !targetId) return null;
    
    const target = B.units[targetId];
    if(!target) return "대상을 찾을 수 없습니다.";
    
    // 죽은 대상
    if(target.hp <= 0) return "죽은 대상은 선택할 수 없습니다.";
    
    // 이동 스킬의 경우
    if(sk.type === 'move') {
      // 이동 가능 위치 검증 로직은 복잡하므로 일반적인 메시지
      return "이동 가능한 위치가 아닙니다.";
    }
    
    // 아군 대상 스킬인데 적을 선택한 경우
    if(sk.range === 'ally' && B.enemyOrder.includes(targetId)) {
      return "아군만 선택할 수 있습니다.";
    }
    
    // 적군 대상 스킬인데 아군을 선택한 경우
    if((sk.range === 'ranged' || sk.range === 'melee') && B.allyOrder.includes(targetId)) {
      return "적군만 선택할 수 있습니다.";
    }
    
    // 근접 스킬인데 최전열이 아닌 적을 선택한 경우
    if(sk.range === 'melee' && B.enemyOrder.includes(targetId)) {
      const aliveEnemies = B.enemyOrder.filter(id => id && (B.units[id]?.hp > 0));
      if(aliveEnemies.length > 0) {
        const minCol = Math.min(...aliveEnemies.map(id => B.units[id]?.col ?? 999));
        const targetCol = target.col ?? 999;
        if(targetCol !== minCol) {
          return "가장 앞열만 공격할 수 있습니다.";
        }
      }
    }
    
    return null;
  }

  function isTargetValid(sk, targetId){
    if(!sk) return false;
    // 이동/자기강화(검막) 류는 타겟 불필요
    if(sk.type==='move' || sk.type==='shield') return true;
    if(sk.range==='ally'){
      return !!targetId && B.allyOrder.includes(targetId) && (B.units[targetId]?.hp>0);
    }
    if(sk.range==='ranged'){
      return !!targetId && B.enemyOrder.includes(targetId) && (B.units[targetId]?.hp>0);
    }
    if(sk.range==='melee'){
      // 근접: 모든 적 중 col이 가장 낮은 열만 타격 가능. 그 열이라면 누구나 타겟 가능
      if(!targetId || !B.enemyOrder.includes(targetId) || !(B.units[targetId]?.hp>0)) return false;
      const alive = B.enemyOrder.filter(id=> id && (B.units[id]?.hp>0));
      if(!alive.length) return false;
      const minCol = Math.min(...alive.map(id=> B.units[id]?.col ?? 999));
      const tCol = B.units[targetId]?.col;
      return tCol===minCol;
    }
    // fallback to previous rank-based
    if(!targetId) return false;
    const isEnemyTarget = B.enemyOrder.includes(targetId);
    const targetRow = B.units[targetId]?.row || 1;
    const to = sk.to || [1,2];
    return isEnemyTarget && to.includes(targetRow);
  }

  function canExecute(sk, targetId){
    if(!sk) return false;
    if(B.turnUnit !== actor.id) return false;
    // MP check
    if((actor.mp||0) < (sk.cost?.mp||0)) return false;
    // 배우 선이동이 필수인 스킬(공격/효과 동반): 이동 불가하면 사용 불가
    if(sk.move && sk.move.who==='actor' && (sk.move.required!==false)){
      const pv = window.BATTLE.previewMove(state, B, B.turnUnit, sk.move);
      if(pv.steps<=0) return false;
    }
    // 대상 이동이 필수인 스킬: 단일 타겟일 때 미리 이동 가능성 확인
    if(sk.move && sk.move.who==='target' && (sk.move.required!==false)){
      // 대상 강제이동은 사전 이동 가능성 검사를 하지 않는다(막혀도 스킬 사용 가능)
      if(sk.type!=='row' && sk.type!=='line'){
        if(!targetId) return false;
      }
    }
    // 순수 이동/자기강화(검막) 스킬은 타겟 불필요
    if(sk.type==='move' || sk.type==='shield') return true;
    if(sk.type==='heal'){
      return !!targetId && B.allyOrder.includes(targetId) && (B.units[targetId]?.hp>0);
    }
    if(sk.type==='row'){
      // fixed row (to length 1) → no target needed; else need valid target to infer row
      if(Array.isArray(sk.to) && sk.to.length===1) return true;
      return !!targetId && isTargetValid(sk, targetId);
    }
    if(sk.type==='line'){
      // needs a target to infer column
      return !!targetId && isTargetValid(sk, targetId);
    }
    // single-target default
    return !!targetId && isTargetValid(sk, targetId);
  }

  function updateAOEHighlight(){
    // clear
    document.querySelectorAll('.unit-slot.is-aoe').forEach(el=>el.classList.remove('is-aoe'));
    if(!selectedSkill) return;
    if(selectedSkill.range==='ally') return; // no enemy AOE highlight for ally skills
    const es = getEffectiveSkill(selectedSkill);
    // 잘못된 대상 선택 시(예: 근접 제한 위반) 하이라이트를 출력하지 않음
    const fallbackTid = selectedTarget || B.target;
    if(!canExecute(es, fallbackTid)) return;
    if(es.type==='row'){
      let targetRow = null;
      if(Array.isArray(es.to) && es.to.length===1){ targetRow = es.to[0]; }
      else if(fallbackTid){ targetRow = B.units[fallbackTid]?.row || null; }
      if(!targetRow) return;
      B.enemyOrder.forEach(id=>{ if(!id) return; const u=B.units[id]; if(!u) return; if(u.row===targetRow){ const el = enemyLane.querySelector(`.unit-slot[data-unit-id="${id}"]`); if(el) el.classList.add('is-aoe'); } });
    } else if(es.type==='line' && fallbackTid){
      const col = B.units[fallbackTid]?.col;
      B.enemyOrder.forEach(id=>{ if(!id) return; const u=B.units[id]; if(!u) return; if(u.col===col){ const el = enemyLane.querySelector(`.unit-slot[data-unit-id="${id}"]`); if(el) el.classList.add('is-aoe'); } });
    } else if(es.type==='cross' && selectedTarget){
      const r = B.units[selectedTarget]?.row; const c = B.units[selectedTarget]?.col;
      B.enemyOrder.forEach(id=>{ if(!id) return; const u=B.units[id]; if(!u) return; if(u.row===r || u.col===c){ const el = enemyLane.querySelector(`.unit-slot[data-unit-id="${id}"]`); if(el) el.classList.add('is-aoe'); } });
    } else if(es.type==='strike' || es.type==='multi' || es.type==='poison'){
      if(!selectedTarget) return; const el = enemyLane.querySelector(`.unit-slot[data-unit-id="${selectedTarget}"]`); if(el) el.classList.add('is-aoe');
    }
  }

  // 타겟 힌트: 최종 명중률 배지 + 예상 HP 감소 오버레이
  function updateTargetHints(){
    // 기존 배지/오버레이 제거
    document.querySelectorAll('.unit-slot .hit-badge').forEach(n=>n.remove());
    document.querySelectorAll('.unit-slot .hpbar .pred').forEach(p=>{ p.style.width='0%'; p.style.left='0%'; });
    if(!selectedSkill) return;
    const es = getEffectiveSkill(selectedSkill);
    const actor = B.units[B.turnUnit]; if(!actor) return;
    if(!canExecute(selectedSkill, selectedTarget || B.target)) return;

    // 대상 집합 구하기: 단일/라인/로우
    let targetIds = [];
    const fallbackTid = selectedTarget || B.target;
    // 근접/라인 등 제한을 다시 한 번 검증하여 잘못된 하이라이트 방지
    if(!canExecute(es, fallbackTid)) return;
    if(es.range==='ally'){
      // only ally target; show hint on selected ally target only
      if(fallbackTid && B.allyOrder.includes(fallbackTid)) targetIds = [fallbackTid];
      else return;
    }
    if(es.type==='row'){
      let targetRow = null;
      if(Array.isArray(es.to) && es.to.length===1){ targetRow = es.to[0]; }
      else if(fallbackTid){ targetRow = B.units[fallbackTid]?.row || null; }
      if(targetRow){ targetIds = B.enemyOrder.filter(id=>id && (B.units[id]?.hp>0) && (B.units[id]?.row===targetRow)); }
    } else if(es.type==='line'){
      if(!fallbackTid) return; const col = B.units[fallbackTid]?.col;
      // 근접 무기 등 전열 제한이 있는 경우, 가장 앞열의 해당 col만 유효하게 취급
      const alive = B.enemyOrder.filter(id=> id && (B.units[id]?.hp>0));
      const minCol = alive.length? Math.min(...alive.map(id=> B.units[id]?.col ?? 999)) : null;
      targetIds = B.enemyOrder.filter(id=>{
        if(!id) return false; const u=B.units[id]; if(!u || !(u.hp>0)) return false;
        if(u.col!==col) return false;
        // 만약 선택 대상 col이 최전열이 아니라면, 하이라이트를 막아 시각 버그 방지
        if(minCol!=null && col!==minCol) return false;
        return true;
      });
    } else {
      if(!fallbackTid) return; targetIds = [fallbackTid];
    }
    if(!targetIds.length) return;

    // 각 대상에 대해 배지/예상 피해 세그먼트 표시
    const rawAcc = Math.max(0, Math.min(1, (es.acc||1)));
    const addAcc = Math.max(0, es.accAdd||0);
    const hits = Math.max(1, es.hits||1);
    const lane = (es.range==='ally') ? allyLane : enemyLane; // 대상 레인
    targetIds.forEach(tid=>{
      const target = B.units[tid]; if(!target) return;
      let addDodge = 0;
      // 패시브 보정(대상측 회피): passives.js 규칙을 사용해 per-target으로 계산
      try{
        const passives = state.data?.passives || {};
        const source = B.units[B.turnUnit];
        const effects = [];
        const collect=(ids, applyTo)=>{ (ids||[]).forEach(pid=>{ const p=passives[pid]; if(!p) return; (p.effects||[]).forEach(e=> effects.push({p,e,applyTo})); }); };
        collect(Array.isArray(source.passives)?source.passives:[], 'outgoing');
        collect(Array.isArray(target.passives)?target.passives:[], 'incoming');
        const matching = effects.filter(x=>{
          if(x.e.applyTo && x.e.applyTo!=='incoming') return false;
          const w=x.e.when||{}; if(w.damageType && es.damageType!==w.damageType) return false; return x.e.hook==='modifyDodge';
        }).sort((a,b)=> (a.e.priority||999)-(b.e.priority||999));
        const groupBest={};
        matching.forEach(x=>{ const g=x.p.group||x.e.group||x.p.id; const val=x.e?.add?.dodge||0; if(!(g in groupBest) || (x.e.priority||0)<(groupBest[g].prio||0)){ groupBest[g]={val, prio:(x.e.priority||0)}; } });
        Object.values(groupBest).forEach(v=> addDodge+=v.val);
      }catch(e){ /* fail-soft */ }
      const dodgeBase = Math.max(0, Math.min(1, (target.dodge||0)));
      const dodgeFinal = Math.max(0, Math.min(1, dodgeBase + addDodge));
      const accFinal = (addAcc>0) ? Math.max(0, Math.min(1, rawAcc + addAcc - dodgeFinal)) : (rawAcc * (1 - dodgeFinal));
      const finalHit = es.type==='heal' ? 100 : Math.round(accFinal * 100);
      // 피해 가감 패시브가 있는 경우 예상 피해에도 반영
      let expectedDamageMul = 1;
      try{
        const passives = state.data?.passives || {};
        const source = B.units[B.turnUnit];
        const effects = [];
        const collect=(ids, applyTo)=>{ (ids||[]).forEach(pid=>{ const p=passives[pid]; if(!p) return; (p.effects||[]).forEach(e=> effects.push({p,e,applyTo})); }); };
        collect(Array.isArray(source.passives)?source.passives:[], 'outgoing');
        collect(Array.isArray(target.passives)?target.passives:[], 'incoming');
        const dmgList = effects.filter(x=> x.e.hook==='modifyDamage' && (!x.e.applyTo || x.e.applyTo==='outgoing' || x.e.applyTo==='incoming')).filter(x=>{ const w=x.e.when||{}; if(w.damageType && es.damageType!==w.damageType) return false; return true; }).sort((a,b)=> (a.e.priority||999)-(b.e.priority||999));
        const groupBest={};
        dmgList.forEach(x=>{ const g=x.p.group||x.e.group||x.p.id; const mul=(x.e?.mul?.damage)||1; if(!(g in groupBest) || (x.e.priority||0)<(groupBest[g].prio||0)){ groupBest[g]={mul, prio:(x.e.priority||0)}; } });
        Object.values(groupBest).forEach(v=>{ expectedDamageMul *= (v.mul||1); });
      }catch(e){ /* noop */ }
      let base = (es.type==='heal')
        ? Math.max(1, Math.round((actor.mag||0) * (es.coeff||1)))
        : Math.max(1, Math.round(((actor.atk||1) * (es.coeff||1)) - (target.def||0)));
      const critP = Math.max(0, Math.min(1, actor.crit||0));
      const blockP = Math.max(0, Math.min(1, target.block||0));
      const expectedPerHit = Math.max(1, Math.round(base * (1 + critP*0.5) * (1 - blockP*0.8) * expectedDamageMul));
      let hpNowPct = Math.max(0, Math.min(100, ((target.hp)/(target.hpMax||1))*100));
      let hpAfterPct = hpNowPct;
      if(selectedSkill.type==='heal'){
        const heal = expectedPerHit * hits;
        const hpAfter = Math.min(target.hpMax||target.hp, target.hp + heal);
        hpAfterPct = Math.max(0, Math.min(100, (hpAfter/(target.hpMax||1))*100));
      } else {
        const expected = expectedPerHit * hits;
        const shieldUse = Math.min(target.shield||0, expected);
        const hpDamage = Math.max(0, expected - shieldUse);
        hpAfterPct = Math.max(0, Math.min(100, ((Math.max(0, target.hp - hpDamage))/(target.hpMax||1))*100));
      }
      const slotEl = lane.querySelector(`.unit-slot[data-unit-id="${tid}"]`);
      if(!slotEl) return;
      const badge = document.createElement('div'); badge.className='hit-badge'; if(finalHit<=50) badge.classList.add('low-hit'); badge.textContent = `${finalHit}%`;
      slotEl.appendChild(badge);
      const pred = slotEl.querySelector('.hpbar .pred');
      if(pred){
        if(es.type==='heal'){
          // heal: 증가 구간을 흰색으로
          pred.style.left = `${hpNowPct}%`;
          pred.style.width = `${Math.max(0, hpAfterPct - hpNowPct)}%`;
        } else {
          pred.style.left = `${hpAfterPct}%`;
          pred.style.width = `${Math.max(0, hpNowPct - hpAfterPct)}%`;
        }
      }
    });
  }

  function renderCards(){
    cardsEl.innerHTML='';
    // no decide button; execution is triggered by clicking the selected card again
    const list = actor.skills?.length? actor.skills : ['SK-01'];
    // 정렬: 사용 가능 먼저, MP 부족/타겟 불가 뒤로
    const enriched = list.map((skId, idx)=>{
      const baseSk = state.data.skills[skId]; if(!baseSk) return null; const es = getEffectiveSkill(baseSk); const usable = canExecute(es, selectedTarget || B.target); const mpOk = (actor.mp||0) >= (es.cost?.mp||0); return { sk: baseSk, es, usable, mpOk, idx };
    }).filter(Boolean).sort((a,b)=> a.idx - b.idx); // 항상 원래 스킬 순서 유지
    enriched.forEach(({sk, es, mpOk})=>{
      const card = document.createElement('div'); card.className='action-card'+(selectedSkill?.id===sk.id?' selected':'');
      if(!mpOk) card.classList.add('mp-insufficient');
      card.dataset.skillId = sk.id;
      const targetText = (es.type||sk.type)==='row' ? (Array.isArray(es.to)&&es.to.length===1? `전열 전체` : `선택 라인 전체`) : ((es.range||sk.range)==='melee'? '근접: 최전열(가장 낮은 col)만' : ((es.range||sk.range)==='ranged'? '원거리: 전체 선택 가능' : ((es.to||sk.to)? ((es.to||sk.to).includes(1)? '전열' : '후열') : '대상: 전/후열')));
      // es 준비: 이미 계산됨
      const accBasePct = Math.round((((es.acc!=null? es.acc : sk.acc)||1) * 100));
      const accAddPct = Math.round((Math.max(0, ((es.accAdd!=null? es.accAdd : sk.accAdd)||0)) * 100));
      // 스킬 진행도: 유닛별 진행도에서 조회
      const baseId = (B.turnUnit||'').split('@')[0];
      const sp = (state.skillProgress?.[baseId]?.[sk.id]) || { level:1, xp:0, nextXp: (state.data.skills?.SKILL_CFG?.baseNext||20) };
      // 선택된 강화 요약(스택 개수 포함)
      const taken = (sp.taken||[]);
      const upDefs = state.data.skills?.[sk.id]?.upgrades||[];
      const countById = taken.reduce((m,id)=>{ m[id]=(m[id]||0)+1; return m; },{});
      const takenNames = Object.keys(countById).map(id=>{
        const def = upDefs.find(u=>u.id===id); const n = countById[id];
        if(!def) return null; return `${def.name}${n>1?` x${n}`:''}`;
      }).filter(Boolean);
      const upLine = takenNames.length? `강화: ${takenNames.join(', ')}` : '';
      // Max 판단: once 업그레이드 전부 획득했고 stack 업그레이드가 없으면 Max
      const upAll = state.data.skills?.[sk.id]?.upgrades||[];
      const hasStack = upAll.some(u=>u.type==='stack');
      const allOnceIds = upAll.filter(u=>u.type==='once').map(u=>u.id);
      const onceDone = allOnceIds.length>0 ? allOnceIds.every(id=> (sp.taken||[]).includes(id)) : false;
      const isMax = (!hasStack) && (onceDone || upAll.length===0);
      const lvLine = isMax ? `Lv.Max` : `Lv.${sp.level} (${sp.xp}/${sp.nextXp})`;

      // 2행: 공격 속성(범위/사거리/속성)
      const isRowByUpgrade = (!!countById['SK01_ROW']) || sk.type==='row';
      const rowName = (r)=> r===1? '전열' : r===2? '중열' : '후열';
      const areaText = (function(){
        if(sk.type==='line') return '세로열';
        if(isRowByUpgrade){
          if(Array.isArray(sk.to) && sk.to.length===1) return `가로열(${rowName(sk.to[0])})`;
          return '가로열';
        }
        if(sk.type==='move') return '이동 전용';
        if(sk.range==='ally' || sk.type==='heal') return '단일';
        return '단일';
      })();
      const rangeText = (es.range||sk.range)==='melee'? '근접' : (es.range||sk.range)==='ranged'? '원거리' : '아군';
      const dmgTypeText = ((es.type||sk.type)==='move' || (es.type||sk.type)==='shield') ? '' : ((es.damageType||sk.damageType)==='slash'? '참격' : (es.damageType||sk.damageType)==='pierce'? '관통' : (es.damageType||sk.damageType)==='magic'? '마법' : (es.damageType||sk.damageType)==='blunt'? '타격' : ((es.type||sk.type)==='heal'?'지원':''));

      // 3행: 명중률(보정 0%면 숨김)
      const accLine = `명중: ${accBasePct}%` + (accAddPct>0? ` (+${accAddPct}%)` : '');

      // 4행: 대미지(타수 2회 이상만 표기)
      let coeffEff = ((es.coeff!=null? es.coeff : sk.coeff)||1);
      const dmgStack = countById['SK01_DMG30']||0;
      if(dmgStack>0){ coeffEff = Math.round((coeffEff * Math.pow(1.3, dmgStack))*100)/100; }
      const hits = Math.max(1, ((es.hits!=null? es.hits : sk.hits)||1));
      const dmgPercent = `${Math.round(coeffEff*100)}%` + (hits>=2? ` x ${hits}` : '');
      const dmgLine = ((es.type||sk.type)==='heal') ? `치유: ${Math.round((((es.coeff!=null? es.coeff : sk.coeff)||1)*100))}%` : (((es.type||sk.type)==='move' || (es.type||sk.type)==='shield') ? `` : `대미지: ${dmgPercent}`);

      // 5행: 추가 옵션(버프/디버프 등)
      const extraLine = (()=>{
        const parts = [];
        if(es.bleed){ parts.push(`출혈 ${Math.round((es.bleed.chance||0.5)*100)}% · ${es.bleed.duration||3}턴`); }
        if((es.type||sk.type)==='poison' || sk.id==='SK-22'){ parts.push(`중독 ${((state.data.skills['SK-22']?.duration)||3)}턴`); }
        return parts.join(' · ');
      })();

      // 카드 마크업: 상단(이름+레벨/경험치, 우측 MP), 속성, 명중, 대미지, 추가옵션
      const titleLine = `<div class="title"><strong>${es.name||sk.name||sk.id}</strong> <span class="lv">${lvLine}</span></div>`;
      const attrPills = [areaText, rangeText].concat(dmgTypeText? [(dmgTypeText==='지원'? '지원' : (dmgTypeText+'대미지'))] : []);
      const attrLine = `<div class="attr">${attrPills.map(t=>`<span class=\"pill\">${t}</span>`).join('')}</div>`;
      const hitLine = `<div class="hit">${accLine}</div>`;
      const dmgLineHtml = `<div class="dmg">${dmgLine}</div>`;
      const extraHtml = extraLine? `<div class="extra">${extraLine}</div>` : '';
      card.innerHTML = `${titleLine}${attrLine}${hitLine}${(dmgLine?dmgLineHtml:'')}${extraHtml}<div class="cost">MP ${sk.cost?.mp||0}</div>`;
      card.onclick=async (ev)=>{
        // if already selected and executable → use skill immediately
        if(B.turnUnit !== actor.id) return;
        const already = selectedSkill?.id === sk.id;
        // 스킬 전환 시 기존 이동 오버레이 정리
        if(cleanupMoveOverlay){ try{ cleanupMoveOverlay(); }catch{} cleanupMoveOverlay=null; }
        selectedSkill = es;
        document.querySelectorAll('.action-card.selected').forEach(x=>x.classList.remove('selected'));
        card.classList.add('selected');
        refreshCardStates();
        updateAOEHighlight();
        updateTargetHints();
        // 이동형(능동) 스킬: 이동 목적지 선택 UI 진입
        if((es.type||sk.type)==='move'){
          enterMoveTargeting();
          return;
        }
        if(already && canExecute(selectedSkill, selectedTarget || B.target)){
          // 안전장치: 현재 하이라이트 대상이 있다면 그것을 엔진으로 전달
          const tgt = selectedTarget || B.target;
          if(tgt){
            B.target = tgt;
            try{ const base=(tgt||'').split('@')[0]; B._lastTargetByBase = B._lastTargetByBase || {}; B._lastTargetByBase[base]=tgt; }catch{}
          }
          await executeSelectedSkill();
        } else {
          // 선택 직후 즉시 힌트 툴팁 노출
          const x = ev?.clientX ?? (card.getBoundingClientRect().left + 12);
          const y = ev?.clientY ?? (card.getBoundingClientRect().top + 12);
          window.UI_TIP?.showTooltip('한번 더 클릭 시 스킬 사용', x, y);
        }
      };
      // Hover hint when selected
      card.onmouseenter=(e)=>{
        // 선택된 카드 힌트
        if(selectedSkill?.id === sk.id){ window.UI_TIP?.showTooltip(sk.type==='move' ? '하이라이트된 칸을 클릭해 이동' : '한번 더 클릭 시 스킬 사용', e.clientX, e.clientY); return; }
        // 사용 불가 사유
        const ok= selectedTarget? isTargetValid(sk, selectedTarget || B.target) : true; if(!ok){ const reason=`[${targetText} 유닛만 선택 가능합니다]`; window.UI_TIP?.showTooltip(reason, e.clientX, e.clientY); return; }
        // 디버프 상세 툴팁
        const tipParts=[];
        if(sk.type!=='move' && sk.bleed){
          const amt = Math.max(1, Math.round((actor.atk||0) * (sk.bleed.coeff||0.3)));
          tipParts.push(`출혈: 매 턴 시작 시 ${amt}의 고정피해 (${sk.bleed.duration||3}턴)`);
        }
        if(sk.type!=='move' && (sk.type==='poison' || sk.id==='SK-22')){
          const amt = Math.max(1, Math.round((selectedTarget? (B.units[selectedTarget]?.hpMax||0) : 0) * (state.data.skills['SK-22']?.dotPct||0.10)));
          tipParts.push(`중독: 매 턴 시작 시 ${amt}의 고정피해 (${(state.data.skills['SK-22']?.duration)||3}턴)`);
        }
        if(sk.type==='move'){
          tipParts.push('이동 전용 스킬: 피해 없음');
        }
        if(tipParts.length){ window.UI_TIP?.showTooltip(tipParts.join('\n'), e.clientX, e.clientY); }
      };
      card.onmousemove=(e)=>{ window.UI_TIP?.positionTip(e.clientX, e.clientY); };
      card.onmouseleave=()=> window.UI_TIP?.hideTooltip();
      cardsEl.appendChild(card);
    });
    refreshCardStates();
    updateAOEHighlight();
  }
  if(B.allyOrder.includes(B.turnUnit)){
  renderCards();
  } else {
    // 적 턴에는 카드 영역을 비운다
    cardsEl.innerHTML='';
    tabs.innerHTML='';
  }

  // 슬롯 클릭 시 타겟 선택 유지/검증
  function enableSelect(laneEl, side){
    laneEl.querySelectorAll('.unit-slot').forEach((el)=>{
      const id = el.dataset.unitId;
      // 부모 클릭은 제거하고, hitbox에만 바인딩
      el.onclick = null;
      const hit = el.querySelector('.hitbox');
      if(hit){ try{ hit.style.pointerEvents='auto'; hit.style.zIndex='9999'; }catch{} }
      const onSelect = async (ev)=>{
        if(!id) return;
        if(B.turnUnit !== actor.id) return;
        ev.stopPropagation();
        // 슬롯 클릭 시 남아있는 이동 오버레이 정리
        if(cleanupMoveOverlay){ try{ cleanupMoveOverlay(); }catch{} cleanupMoveOverlay=null; }
        const already = (B.target===id);
        try{
          const rect = el.getBoundingClientRect();
          console.log('[click-hitbox]', {
            id,
            side,
            row: B.units[id]?.row,
            col: B.units[id]?.col,
            client: { x: ev.clientX, y: ev.clientY },
            rect: { x: rect.left, y: rect.top, w: rect.width, h: rect.height }
          });
        }catch{}
        
        // 스킬이 선택된 상태에서 잘못된 타겟을 선택한 경우 툴팁 표시
        if(selectedSkill && !isTargetValid(selectedSkill, id)) {
          const errorMessage = getInvalidTargetMessage(selectedSkill, id);
          if(errorMessage) {
            const rect = el.getBoundingClientRect();
            const x = ev?.clientX ?? (rect.left + rect.width/2);
            const y = ev?.clientY ?? (rect.top + 8);
            window.UI_TIP?.showTooltip(errorMessage, x, y);
            return; // 잘못된 타겟이면 선택하지 않고 종료
          }
        }
        
        B.target=id; selectedTarget=id;
        try{ const base=(id||'').split('@')[0]; B._lastTargetByBase = B._lastTargetByBase || {}; B._lastTargetByBase[base]=id; }catch{}
        document.querySelectorAll('.unit-slot.is-target').forEach(x=>x.classList.remove('is-target'));
        el.classList.add('is-target');
        refreshCardStates();
        updateAOEHighlight();
        updateTargetHints();
        if(already && selectedSkill && canExecute(selectedSkill, id)){
          // 안전장치: 실행 직전에 현재 하이라이트된 대상을 B.target에 반영
          B.target = id; selectedTarget = id;
          try{ const base=(id||'').split('@')[0]; B._lastTargetByBase = B._lastTargetByBase || {}; B._lastTargetByBase[base]=id; }catch{}
          await executeSelectedSkill();
        } else if(selectedSkill){
          const rect = el.getBoundingClientRect();
          const x = ev?.clientX ?? (rect.left + rect.width/2);
          const y = ev?.clientY ?? (rect.top + 8);
          window.UI_TIP?.showTooltip('한번 더 클릭 시 스킬 사용', x, y);
        }
      };
      // 바인딩: 버블 단계(click) + 추가 진단(pointerdown)
      if(hit){
        hit.addEventListener('pointerdown', (e)=>{
          try{ const r=el.getBoundingClientRect(); console.log('[hitbox-pointerdown]', { id, side, x:e.clientX, y:e.clientY, rect:{x:r.left,y:r.top,w:r.width,h:r.height} }); }catch{}
        }, { capture:false });
        hit.addEventListener('click', onSelect, { capture:false });
      } else {
        el.addEventListener('pointerdown', (e)=>{
          try{ const r=el.getBoundingClientRect(); console.log('[slot-pointerdown]', { id, side, x:e.clientX, y:e.clientY, rect:{x:r.left,y:r.top,w:r.width,h:r.height} }); }catch{}
        }, { capture:false });
        el.addEventListener('click', onSelect, { capture:false });
      }
      // 스프라이트가 클릭을 가로채지 않도록 포인터 이벤트 제거
      try{ const p = el.querySelector('.portrait'); if(p) p.style.pointerEvents='none'; }catch{}
      el.onmouseenter=(e)=>{
        if(id && selectedSkill && B.target===id){
          window.UI_TIP?.showTooltip('한번 더 클릭 시 스킬 사용', e.clientX, e.clientY);
        }
      };
      el.onmousemove=(e)=>{ window.UI_TIP?.positionTip(e.clientX, e.clientY); };
      el.onmouseleave=()=> window.UI_TIP?.hideTooltip();
    });
  }

  // 능동 이동 스킬 목적지 선택 모드 (완전 재설계)
  function enterMoveTargeting(){
    const sk = selectedSkill; if(!sk || sk.type!=='move') return;
    if(cleanupMoveOverlay){ try{ cleanupMoveOverlay(); }catch{} cleanupMoveOverlay=null; }
    
    const actorId = B.turnUnit; const actorU = B.units[actorId];
    if(!actorU) return;
    
    // 현재 위치에서 8방향으로 이동 가능한 위치 계산
    const currentRow = actorU.row || 1;
    const currentCol = actorU.col || 0;
    const directions = [
      {dr: -1, dc: -1, name: 'upLeft'},    {dr: -1, dc: 0, name: 'up'},      {dr: -1, dc: 1, name: 'upRight'},
      {dr: 0,  dc: -1, name: 'left'},                                        {dr: 0,  dc: 1, name: 'right'},
      {dr: 1,  dc: -1, name: 'downLeft'},  {dr: 1,  dc: 0, name: 'down'},    {dr: 1,  dc: 1, name: 'downRight'}
    ];
    
    const candidates = [];
    directions.forEach(dir => {
      const newRow = currentRow + dir.dr;
      const newCol = currentCol + dir.dc;
      // 경계 체크
      if(newRow < 1 || newRow > 3 || newCol < 0 || newCol > 2) return;
      // 점유 체크 (같은 진영 내에서)
      const occupied = B.allyOrder.some(id => {
        if(!id || id === actorId) return false;
        const u = B.units[id];
        return u && u.hp > 0 && u.row === newRow && u.col === newCol;
      });
      if(!occupied) {
        candidates.push({ row: newRow, col: newCol, direction: dir.name });
      }
    });
    
    if(!candidates.length) {
      window.UI_TIP?.showTooltip('이동 가능한 칸이 없습니다', (cardsEl.getBoundingClientRect().left+24), (cardsEl.getBoundingClientRect().top-8));
      return;
    }
    
    // 각 이동 후보 위치에 해당하는 실제 슬롯(또는 빈 공간)을 찾아서 오버레이 생성
    const overlays = [];
    candidates.forEach(cand => {
      // 해당 좌표에 실제 슬롯이 있는지 확인
      let targetSlot = null;
      
      // 1) 해당 위치에 다른 아군이 있는지 확인
      const existingUnit = B.allyOrder.find(id => {
        if(!id || id === actorId) return false;
        const u = B.units[id];
        return u && u.row === cand.row && u.col === cand.col;
      });
      
      if(existingUnit) {
        // 기존 유닛이 있으면 그 슬롯 사용
        targetSlot = allyLane.querySelector(`.unit-slot[data-unit-id="${existingUnit}"]`);
      } else {
        // 빈 공간이면 해당 row/col에 해당하는 위치를 계산
        // 아군 렌더링 구조: row-wrap[rowIndex] > slot[colOrder에 따른 순서]
        const rowIndex = cand.row - 1; // 1,2,3 → 0,1,2
        const rowWrap = allyLane.querySelectorAll('.row-wrap')[rowIndex];
        if(rowWrap) {
          // 아군은 열 순서가 2,1,0이므로 col을 이 순서로 매핑
          const colOrder = [2,1,0];
          const slotIndex = colOrder.indexOf(cand.col);
          if(slotIndex >= 0) {
            const slot = rowWrap.children[slotIndex];
            if(slot) {
              targetSlot = slot.querySelector('.unit-slot') || slot;
            }
          }
        }
      }
      
      if(!targetSlot) {
        console.warn(`[move-overlay] Cannot find target slot for (${cand.row},${cand.col})`);
        return;
      }
      
      // 실제 슬롯 위치를 기준으로 오버레이 생성
      const targetRect = targetSlot.getBoundingClientRect();
      const overlay = document.createElement('div');
      overlay.className = 'move-candidate-overlay';
      overlay.style.position = 'absolute';
      overlay.style.pointerEvents = 'auto';
      overlay.style.cursor = 'pointer';
      overlay.style.border = '3px dashed #4a90e2';
      overlay.style.borderRadius = '12px';
      overlay.style.background = 'rgba(74, 144, 226, 0.25)';
      overlay.style.zIndex = '1000';
      overlay.dataset.row = String(cand.row);
      overlay.dataset.col = String(cand.col);
      
      // 실제 슬롯과 정확히 동일한 위치와 크기
      overlay.style.left = targetRect.left + 'px';
      overlay.style.top = targetRect.top + 'px';
      overlay.style.width = targetRect.width + 'px';
      overlay.style.height = targetRect.height + 'px';
      
      // 클릭 핸들러
      overlay.addEventListener('click', (e) => {
        e.stopPropagation();
        const row = Number(e.currentTarget.dataset.row);
        const col = Number(e.currentTarget.dataset.col);
        window.UI_TIP?.hideTooltip();
        
        const temp = { ...sk, move: { who:'actor', tiles:1, required:true, __dest: { row, col } } };
        B.target = B.turnUnit;
        executeSelectedSkill(temp);
        cleanup();
      });
      
      document.body.appendChild(overlay);
      overlays.push(overlay);
      console.log(`[move-overlay] (${cand.row},${cand.col}) positioned at ${overlay.style.left},${overlay.style.top} (${targetRect.width}x${targetRect.height})`);
    });
    
    window.UI_TIP?.showTooltip(`이동 가능한 위치: ${candidates.length}개`, (cardsEl.getBoundingClientRect().left+24), (cardsEl.getBoundingClientRect().top-8));
    
    function cleanup(){
      overlays.forEach(el => { try{ el.remove(); }catch{} });
      window.UI_TIP?.hideTooltip();
    }
    cleanupMoveOverlay = cleanup;
  }

  // 현재 턴 하이라이트를 최신 턴 유닛으로 재지정
  function setTurnHighlight(){
    document.querySelectorAll('.unit-slot.is-turn').forEach(el=>el.classList.remove('is-turn'));
    const lane = (B.enemyOrder.includes(B.turnUnit) ? enemyLane : allyLane);
    const el = lane?.querySelector(`.unit-slot[data-unit-id="${B.turnUnit}"]`);
    if(el) el.classList.add('is-turn');
  }

  // 전투 로그 연출(다단히트 순차 표시)
  function animateFromLog(){
    const events = B.log || [];
    if(!events.length) return 0;
    // 애니메이션 세대 토큰: 재호출 시 이전 예약 콜백 무시
    B._animGen = (B._animGen||0) + 1;
    const animGen = B._animGen;
    const step = 500; // 0.5s 간격(단일 다단히트용)
    let seqDelay = 0; // 누적 지연(다단히트에만 적용)
    const needsDelay = events.some(ev=> ev.isMulti === true);
    let lastWasHit = false;
    let maxEnd = 0; // 전체 스케줄 종료 시각(ms)

    console.debug('[anim] queue', events.length, 'items', { animGen, turnUnit: B.turnUnit });
    events.forEach((ev, idx)=>{
      // 시작 시각 계산
      let startAt = 0;
      if((ev.type==='hit' || ev.type==='miss') && ev.isMulti){ startAt = seqDelay; seqDelay += step; lastWasHit = (ev.type==='hit'); }
      else if(ev.type==='dead'){ startAt = Math.max(800, seqDelay); lastWasHit = false; } // 딜레이 단축
      else { startAt = 0; lastWasHit = (ev.type==='hit'); }

      const scheduleAt = startAt;

      // 각 이벤트의 표시/유지 시간(대략)
      let duration = 300; // 기본
      if(ev.type==='hit' || ev.type==='miss' || ev.type==='skillLevelUp') duration = 300; // 텍스트 유지 시간
      if(ev.type==='shield') duration = 300;
      if(ev.type==='dead') duration = 800; // CSS fade-out 800ms와 일치

      maxEnd = Math.max(maxEnd, scheduleAt + duration);

      setTimeout(()=>{
        // stale callback guard: if a new animation generation started, cancel this tick
        if(animGen !== B._animGen){ console.warn('[anim-skip-stale]', { idx, type:ev.type, animGen, current:B._animGen }); return; }
        console.debug?.('[anim]', idx, ev.type, { to: ev.to, from: ev.from, dmg: ev.dmg, crit: ev.crit, blocked: ev.blocked, isMulti: ev.isMulti, when: scheduleAt });
        if(ev.type==='move'){
          const unitId = ev.unit; const u = B.units[unitId]; if(!u) return;
          const lane = (B.enemyOrder.includes(unitId)? enemyLane : allyLane);
          const slotEl = lane.querySelector(`.unit-slot[data-unit-id="${unitId}"]`);
          console.debug?.('[move-anim]', { unitId, from: ev.from, to: ev.to, slotFound: !!slotEl });
          if(slotEl){
            slotEl.classList.add('moving');
            setTimeout(()=>{
              slotEl.classList.remove('moving');
              // 전체 리렌더 대신 라인만 갱신하여 현재 frame/closure 유지
              console.debug?.('[move-anim] refresh lanes after move');
              renderRows(allyLane, B.allyOrder, 'ally');
              renderRows(enemyLane, B.enemyOrder, 'enemy');
              setTurnHighlight();
            }, 240);
          } else { console.warn('[anim-move] slot not found', { unitId, lane: lane?.className }); }
        } else if(ev.type==='skillLevelUp'){
          // 전투 중 즉시 레벨업: 선택 모달 표시(간단 UI)
          const uId = ev.unit; const sId = ev.skillId; const u = B.units[uId];
          B.awaitingUpgrade = true;
          const modal = document.createElement('div'); modal.className='modal-backdrop';
          const box = document.createElement('div'); box.className='modal';
          box.innerHTML = `<h3>스킬 레벨업</h3><p>${u?.name||uId}의 ${state.data.skills[sId]?.name||sId} Lv.${(state.skillProgress?.[uId.split('@')[0]]?.[sId]?.level)||''}</p><div class="actions" id="upList"></div>`;
          modal.appendChild(box); frame.appendChild(modal);
          const list = box.querySelector('#upList');
          // 실제 업그레이드 풀에서 3개 랜덤 추출
          const baseId = uId.split('@')[0];
          state.skillProgress = state.skillProgress || {}; state.skillProgress[baseId] = state.skillProgress[baseId] || {}; state.skillProgress[baseId][sId] = state.skillProgress[baseId][sId] || { level:1, xp:0, nextXp: (state.data.skills?.SKILL_CFG?.baseNext||20), taken:[] };
          const progress = state.skillProgress[baseId][sId];
          const pool = (state.data.skills?.[sId]?.upgrades||[]).filter(up=> up && (up.type!=='once' || !(progress.taken||[]).includes(up.id)));
          const rng = (state.rng && typeof state.rng.int === 'function') ? state.rng : { 
            int:(n)=> Math.floor(Math.random()*n),
            next:()=> Math.random(),
            seed: Date.now() 
          };
          const picks = [];
          for(let i=0;i<Math.min(3, pool.length);i++){ const idx = rng.int(pool.length); picks.push(pool.splice(idx,1)[0]); }
          if(!picks.length){
            // 선택할 업그레이드가 없으면 모달만 닫고 즉시 이어서 진행
            try{ modal.remove(); }catch{}
            B.awaitingUpgrade=false; if(typeof B._awaitUpgradeResolve==='function'){ const fn=B._awaitUpgradeResolve; B._awaitUpgradeResolve=null; fn(); }
            return;
          }
          picks.forEach(up=>{
            const b=document.createElement('button'); b.className='btn'; b.innerHTML = `<strong>${up.name}</strong><br><span style="font-size:12px; color:#9aa0a6;">${up.desc||''}</span>`;
            b.onclick=()=>{
              // 진행도에 반영
              state.skillProgress = state.skillProgress || {}; state.skillProgress[baseId] = state.skillProgress[baseId] || {}; state.skillProgress[baseId][sId] = state.skillProgress[baseId][sId] || { level:1, xp:0, nextXp: (state.data.skills?.SKILL_CFG?.baseNext||20), taken:[] };
              const sp = state.skillProgress[baseId][sId];
              sp.taken = sp.taken || [];
              sp.taken.push(up.id);
              modal.remove();
              B.awaitingUpgrade=false; if(typeof B._awaitUpgradeResolve==='function'){ const fn=B._awaitUpgradeResolve; B._awaitUpgradeResolve=null; fn(); }
              // 전체 리렌더는 하지 않고, 이후 외부 흐름이 계속 진행되며 필요 시 갱신됨
            };
            list.appendChild(b);
          });
        } else if(ev.type==='hit'){
          const toId = ev.to; const fromId = ev.from;
          const { lane:targetLane, el:slotEl } = getSlotByIdOrBase(toId);
          if(slotEl){
            // 비네팅(타격 대상 강조)
            slotEl.classList.add('is-aoe'); setTimeout(()=>slotEl.classList.remove('is-aoe'), 260);
            slotEl.classList.add('impact'); setTimeout(()=>slotEl.classList.remove('impact'), 200);
            const bar = slotEl.querySelector('.hpbar > span'); if(bar && typeof ev.hp==='number'){ bar.style.width = `${Math.max(0,(ev.hp/(B.units[toId].hpMax||1))*100)}%`; } else { const u=B.units[toId]; if(bar){ bar.style.width = `${Math.max(0,(u.hp/u.hpMax)*100)}%`; } }
            const sbar = slotEl.querySelector('.shieldbar > span'); if(sbar){ const sv = (typeof ev.shield==='number')? ev.shield : (B.units[toId].shield||0); sbar.style.width = `${Math.max(0, Math.min(100, (sv/(B.units[toId].hpMax||1))*100))}%`; const barWrap = sbar.parentElement; if(barWrap){ barWrap.style.display = (sv>0)? 'block' : 'none'; } }
            // 피격 스프라이트(고정 비율 유지) - 유지시간 2배 연장
            try{ 
              applyPortraitState(toId, 'hit'); 
              
              // 사망 판정인 경우 피격 스프라이트 유지, 아닌 경우만 기본으로 복귀
              const willDie = (typeof ev.hp === 'number' && ev.hp <= 0);
              if(!willDie) {
                setTimeout(()=> applyPortraitState(toId, 'default'), 480); // 240ms -> 480ms (2배)
              }
            }catch{}
            const dmg = document.createElement('div'); let cls='dmg-float'; let text=`-${ev.dmg}`; 
            if(ev.crit){ cls+=' dmg-crit'; text=`💥 ${ev.dmg}`; } 
            else if(ev.blocked){ cls+=' dmg-block'; text=`🛡️ ${ev.dmg}`; }
            dmg.className=cls; dmg.textContent=text; dmg.style.left='50%'; dmg.style.top='0'; slotEl.appendChild(dmg); setTimeout(()=>dmg.remove(), 1400);
            // lethal 시 즉시 사망 대사 출력
            if(typeof ev.hp==='number' && ev.hp<=0){
              const baseId = (toId||'').split('@')[0];
              const base = state.data.units?.[baseId] || {};
              const line = base.deathLine;
              if(line){ const sp=document.createElement('div'); sp.className='speech'; sp.textContent=line; slotEl.appendChild(sp); setTimeout(()=>{ if(sp.parentElement) sp.remove(); }, 1600); }
            }
          } else { console.warn('[anim-hit] slot not found', { toId, lane: B.enemyOrder.includes(toId)? 'enemy':'ally' }); }
          // 슬롯/레인 이동 애니메이션 제거(스프라이트만 이동)
        } else if(ev.type==='dead'){
          const toId = ev.to;
          const wasEnemy = toId.includes('@E');
          const lane = wasEnemy ? enemyLane : allyLane;
          const slotEl = lane.querySelector(`.unit-slot[data-unit-id="${toId}"]`);
          console.debug?.('[death]', { toId, wasEnemy, lane: lane?.className, slotEl: !!slotEl, when: scheduleAt });
          
          // 주인공 사망 체크 (아군이고 C-001인 경우)
          if(!wasEnemy && toId && toId.startsWith('C-001@')) {
            console.log('[PROTAGONIST-DEATH] 주인공 사망 감지 - 전투 완전 중단', { toId });
            
            // 전투를 즉시 패배로 설정하고 모든 진행 중단
            B.winner = 'enemy';
            B.protagonistDead = true;
            B.gameOverTriggered = true; // 모든 후속 처리 차단
            B.animating = false; // 애니메이션 중단
            
            // 진행 중인 모든 턴 처리 중단
            clearInterval(window._battleTurnInterval);
            
            // 사망 연출 후 패배 처리
            setTimeout(() => {
              console.log('[PROTAGONIST-DEATH] 패배 결과 표시');
              showResult(false); // 패배로 처리
            }, 1200); // 사망 연출 시간 확보
            return; // 일반 사망 연출은 건너뛰고 패배 처리로
          }
          
          if(slotEl){
            // 사망 연출 빠르게 시작
            console.debug?.('[death-start]', toId, 'death begins');
            slotEl.classList.add('fade-out');
            const fx = document.createElement('div'); fx.className='death-fx'; fx.textContent='💀'; fx.style.left='50%'; fx.style.top='0'; slotEl.appendChild(fx);
            setTimeout(()=>{ 
              console.debug?.('[death-end]', toId, 'removed');
              if(fx.parentElement) fx.remove(); 
              // 즉시 DOM 제거 대신 고스트로 전환하여 레이아웃 유지
              try{
                slotEl.classList.remove('fade-out');
                slotEl.classList.add('ghost');
                slotEl.innerHTML = '';
                slotEl.style.opacity = '0';
                try{ delete slotEl.dataset.unitId; }catch{}
              }catch{}
            }, 800);
          } else {
            console.warn?.('[death-fail]', toId, 'slot not found in', lane?.className, 'wasEnemy:', wasEnemy);
          }
        } else if(ev.type==='miss'){
          const toId = ev.to; const targetLane = B.enemyOrder.includes(toId) ? enemyLane : allyLane; const slotEl = targetLane.querySelector(`.unit-slot[data-unit-id="${toId}"]`);
          if(slotEl){ const miss = document.createElement('div'); miss.className='miss-float'; miss.textContent='MISS'; miss.style.left='50%'; miss.style.top='0'; slotEl.appendChild(miss); setTimeout(()=>miss.remove(), 800); }
          const fromId = ev.from; const fromLane = B.enemyOrder.includes(fromId) ? enemyLane : allyLane; const fromEl = fromLane.querySelector(`.unit-slot[data-unit-id="${fromId}"]`);
          if(fromEl){ const cls = B.enemyOrder.includes(fromId)? 'lunge-enemy' : 'lunge-ally'; fromEl.classList.add(cls); setTimeout(()=>fromEl.classList.remove(cls), 220); }
        } else if(ev.type==='shield'){
          const toId = ev.to; const lane = B.enemyOrder.includes(toId) ? enemyLane : allyLane; const slotEl = lane.querySelector(`.unit-slot[data-unit-id="${toId}"]`);
          if(slotEl){ const sv = (typeof ev.shield==='number')? ev.shield : (B.units[toId].shield||0); const sbar = slotEl.querySelector('.shieldbar > span'); if(sbar){ sbar.style.width = `${Math.max(0, Math.min(100, (sv/(B.units[toId].hpMax||1))*100))}%`; const barWrap = sbar.parentElement; if(barWrap){ barWrap.style.display = (sv>0)? 'block' : 'none'; } } const fx = document.createElement('div'); fx.className='miss-float'; fx.textContent = `+SHIELD ${ev.amount||0}`; fx.style.left='50%'; fx.style.top='0'; slotEl.appendChild(fx); setTimeout(()=>fx.remove(), 900); }
        } else if(ev.type==='heal'){
          const toId = ev.to; const lane = B.enemyOrder.includes(toId) ? enemyLane : allyLane; const slotEl = lane.querySelector(`.unit-slot[data-unit-id="${toId}"]`);
          if(slotEl){
            const bar = slotEl.querySelector('.hpbar > span'); if(bar && typeof ev.hp==='number'){ bar.style.width = `${Math.max(0,(ev.hp/(B.units[toId].hpMax||1))*100)}%`; }
            const fx = document.createElement('div'); fx.className='heal-float'; fx.textContent = `+${ev.amount||0}`; fx.style.left='50%'; fx.style.top='0'; slotEl.appendChild(fx); setTimeout(()=>fx.remove(), 900);
          }
        } else if(ev.type==='poison'){
          // 적용 시점: 디버프 부여 알림 + 즉시 아이콘/남은 턴 갱신
          const toId = ev.to; const lane = B.enemyOrder.includes(toId) ? enemyLane : allyLane; const slotEl = lane.querySelector(`.unit-slot[data-unit-id="${toId}"]`);
          if(slotEl){
            const fx = document.createElement('div'); fx.className='miss-float'; fx.textContent = `POISON`; fx.style.left='50%'; fx.style.top='0'; slotEl.appendChild(fx); setTimeout(()=>fx.remove(), 800);
            // 아이콘이 없다면 추가, 있다면 남은 턴 갱신
            let icon = slotEl.querySelector('.slot-buffs .poison');
            if(!icon){
              const bufWrap = slotEl.querySelector('.slot-buffs');
              if(bufWrap){ bufWrap.insertAdjacentHTML('beforeend', `<div class="slot-buff poison" title="중독"><span>☠</span><span class="turns">${ev.duration||3}</span></div>`); }
            } else {
              const t = icon.querySelector('.turns'); if(t){ t.textContent = `${ev.duration||3}`; }
            }
          }
        } else if(ev.type==='poisonTick'){
          const toId = ev.to; const lane = B.enemyOrder.includes(toId) ? enemyLane : allyLane; const slotEl = lane.querySelector(`.unit-slot[data-unit-id="${toId}"]`);
          if(slotEl){
            const bar = slotEl.querySelector('.hpbar > span'); if(bar && typeof ev.hp==='number'){ bar.style.width = `${Math.max(0,(ev.hp/(B.units[toId].hpMax||1))*100)}%`; }
            const fx = document.createElement('div'); fx.className='poison-float'; fx.textContent = `-${ev.amount||0}`; fx.style.left='50%'; fx.style.top='0'; slotEl.appendChild(fx); setTimeout(()=>fx.remove(), 900);
            // 남은 턴 수 갱신(0이 되면 제거)
            let icon = slotEl.querySelector('.slot-buffs .poison');
            if(icon){ const t = icon.querySelector('.turns'); if(t){ const next = Math.max(0, Number(t.textContent||'1') - 1); t.textContent = `${next}`; if(next<=0) icon.remove(); } }
          }
        } else if(ev.type==='bleed'){
          // 출혈 부여 알림 + 아이콘 추가/갱신
          const toId = ev.to; const lane = B.enemyOrder.includes(toId) ? enemyLane : allyLane; const slotEl = lane.querySelector(`.unit-slot[data-unit-id="${toId}"]`);
          if(slotEl){
            const fx = document.createElement('div'); fx.className='miss-float'; fx.textContent = `BLEED`; fx.style.left='50%'; fx.style.top='0'; slotEl.appendChild(fx); setTimeout(()=>fx.remove(), 800);
            let icon = slotEl.querySelector('.slot-buffs .bleed');
            if(!icon){
              const bufWrap = slotEl.querySelector('.slot-buffs');
              if(bufWrap){ bufWrap.insertAdjacentHTML('beforeend', `<div class="slot-buff bleed" title="출혈"><span>🩸</span><span class="turns">${ev.duration||3}</span></div>`); }
            } else { const t = icon.querySelector('.turns'); if(t){ t.textContent = `${ev.duration||3}`; } }
          }
        } else if(ev.type==='bleedTick'){
          const toId = ev.to; const lane = B.enemyOrder.includes(toId) ? enemyLane : allyLane; const slotEl = lane.querySelector(`.unit-slot[data-unit-id="${toId}"]`);
          if(slotEl){
            const bar = slotEl.querySelector('.hpbar > span'); if(bar && typeof ev.hp==='number'){ bar.style.width = `${Math.max(0,(ev.hp/(B.units[toId].hpMax||1))*100)}%`; }
            const fx = document.createElement('div'); fx.className='bleed-float'; fx.textContent = `-${ev.amount||0}`; fx.style.left='50%'; fx.style.top='0'; slotEl.appendChild(fx); setTimeout(()=>fx.remove(), 900);
            let icon = slotEl.querySelector('.slot-buffs .bleed');
            if(icon){ const t = icon.querySelector('.turns'); if(t){ const next = Math.max(0, Number(t.textContent||'1') - 1); t.textContent = `${next}`; if(next<=0) icon.remove(); } }
          }
        }      }, scheduleAt);
    });
    B.log.length = 0;
    // end marker
    setTimeout(()=>{ if(animGen===B._animGen) console.debug('[anim-done]', { animGen, maxEnd }); }, Math.max(1, maxEnd+1));
    return maxEnd;
  }

  // 탭을 카드 컨테이너 앞에 삽입
  cardsPanel.appendChild(tabs);
  cardsPanel.appendChild(cardsEl);
  bottom.appendChild(cardsPanel);

  // mount to DOM
  root.innerHTML = '';
  root.appendChild(frame);

  // Responsive fit (1920x1080 base)
  function resize(){
    try{
      const baseW=1920, baseH=1080;
      const vw = (window.visualViewport && window.visualViewport.width) || window.innerWidth || document.documentElement.clientWidth || baseW;
      const vh = (window.visualViewport && window.visualViewport.height) || window.innerHeight || document.documentElement.clientHeight || baseH;
      const scale = Math.min(vw/baseW, vh/baseH);
      frame.style.transformOrigin='0 0';
      frame.style.width=baseW+'px'; frame.style.height=baseH+'px';
      frame.style.transform=`scale(${Math.max(0.5, scale)})`;
      const px=Math.max(0, Math.floor((vw - baseW*scale)/2));
      const py=Math.max(0, Math.floor((vh - baseH*scale)/2));
      frame.style.position='absolute'; frame.style.left=px+'px'; frame.style.top=py+'px';
    }catch{}
  }
  resize();
  window.addEventListener('resize', resize, { passive:true });
  window.addEventListener('orientationchange', ()=> setTimeout(resize, 50));

  // cheat panel (dev only) - appear outside game screen
  const oldCheat = document.getElementById('cheat-panel');
  if(oldCheat) oldCheat.remove();
  const cheat = document.createElement('div');
  cheat.id='cheat-panel';
  cheat.style.position='fixed'; cheat.style.right='12px'; cheat.style.bottom='12px';
  cheat.style.display='flex'; cheat.style.gap='8px'; cheat.style.zIndex='2000';
  const btnWin=document.createElement('button'); btnWin.className='btn'; btnWin.textContent='승리';
  const btnLose=document.createElement('button'); btnLose.className='btn'; btnLose.textContent='패배';
  const btnLight=document.createElement('button'); btnLight.className='btn'; btnLight.textContent='Light';
  const btnLighting=document.createElement('button'); btnLighting.className='btn'; btnLighting.textContent='조명';
  btnWin.onclick=()=>{ showResult(true); };
  btnLose.onclick=()=>{ showResult(false); };
  btnLight.onclick=()=>{ 
    // 모든 유닛의 light 오버레이 토글
    const allUnits = [...(B.allyOrder || []), ...(B.enemyOrder || [])];
    allUnits.forEach(unitId => {
      if(unitId) toggleLightOverlay(unitId);
    });
  };
  btnLighting.onclick=()=>{ 
    // 조명 효과만 순환 테스트 (배경은 변경하지 않음)
    const presets = Object.keys(LIGHTING_PRESETS).filter(k => k !== 'default');
    const currentBg = frame.querySelector('.battle-center')?.style.backgroundImage;
    const currentBgName = currentBg ? currentBg.split('/').pop().replace(/['"]/g, '') : 'BG_001.png';
    const currentIndex = presets.indexOf(currentBgName);
    const nextIndex = (currentIndex + 1) % presets.length;
    const nextBg = presets[nextIndex];
    
    // 조명 효과만 강제 적용 (배경은 그대로)
    applyLightingEffect(`assets/bg/${nextBg}`, true);
  };
  cheat.appendChild(btnWin); cheat.appendChild(btnLose); cheat.appendChild(btnLight); cheat.appendChild(btnLighting);
  document.body.appendChild(cheat);

  // 배경별 조명 설정 (색조 변경 없이 톤만 조절)
  // 조명 프리셋 정의 (CSS 클래스 기반)
  const LIGHTING_PRESETS = {
    'NIGHT': {
      name: '밤',
      description: '어둡고 푸른빛이 도는 밤 분위기'
    },
    'FOREST': {
      name: '숲속',
      description: '녹색빛이 도는 숲속 분위기'
    },
    'DAYLIGHT': {
      name: '대낮',
      description: '밝고 따뜻한 대낮 분위기'
    },
    'DEFAULT': {
      name: '기본',
      description: '기본 조명'
    }
  };

  // 배경별 자동 매핑 (하위 호환성)
  const BG_TO_PRESET = {
    'BG_001.png': 'NIGHT',
    'BG_002.png': 'FOREST', 
    'BG_003.png': 'DAYLIGHT'
  };

  // 배경에 따른 조명 효과 적용 함수
  function applyLightingEffect(bgPath, force = false) {
    try {
      // 1. 전투 데이터에서 lighting 필드 확인 (우선순위 1)
      let preset = null;
      if (bt && bt.lighting) {
        // 프리셋 enum으로 변환
        const presetKey = bt.lighting.preset || 'DEFAULT';
        preset = LIGHTING_PRESETS[presetKey] || LIGHTING_PRESETS.DEFAULT;
        console.log('[lighting]', { source: 'battle-data', preset: presetKey, lighting: preset.name, force });
      } else {
        // 2. 배경 파일명으로 자동 조명 적용 (우선순위 2)
        const bgFileName = bgPath.split('/').pop() || bgPath;
        const presetKey = BG_TO_PRESET[bgFileName] || 'DEFAULT';
        preset = LIGHTING_PRESETS[presetKey] || LIGHTING_PRESETS.DEFAULT;
        console.log('[lighting]', { source: 'auto-preset', bgFileName, preset: presetKey, lighting: preset.name, force });
      }
      
      // 이미 같은 조명이 적용되어 있고 강제 적용이 아닌 경우 스킵
      if (!force && state.ui.battleState?.lightingApplied) {
        return preset;
      }
      
      // portrait-mood와 portrait-light에 조명 효과 적용
      const allMoodPortraits = document.querySelectorAll('.unit-slot .portrait-mood');
      const allLightPortraits = document.querySelectorAll('.unit-slot .portrait-light');
      
      // 기존 조명 클래스 제거
      document.body.classList.remove('lighting-night', 'lighting-forest', 'lighting-daylight', 'lighting-default');
      
      // 새로운 조명 클래스 추가
      const lightingClass = `lighting-${preset.name.toLowerCase()}`;
      document.body.classList.add(lightingClass);
      
      allMoodPortraits.forEach(moodPortrait => {
        // portrait-mood에 기본 이미지 설정 (아직 설정되지 않은 경우)
        const parentPortrait = moodPortrait.parentElement;
        if (parentPortrait && !moodPortrait.style.backgroundImage) {
          const baseImage = parentPortrait.style.backgroundImage;
          if (baseImage) {
            moodPortrait.style.backgroundImage = baseImage;
          }
        }
        
        // CSS 클래스가 자동으로 적용되므로 JavaScript에서 filter 설정 불필요
        if (force) {
          // 강제 적용 시에만 트랜지션 적용
          moodPortrait.style.transition = 'filter 0.5s ease-in-out';
        }
      });
      
      // portrait-light에 조명 효과 + 밝기 처리 적용
      allLightPortraits.forEach(lightPortrait => {
        // portrait-light에 기본 이미지 설정 (아직 설정되지 않은 경우)
        const parentPortrait = lightPortrait.parentElement;
        if (parentPortrait && !lightPortrait.style.backgroundImage) {
          const baseImage = parentPortrait.style.backgroundImage;
          if (baseImage) {
            lightPortrait.style.backgroundImage = baseImage;
          }
        }
        
        // CSS 클래스가 자동으로 적용되므로 JavaScript에서 filter 설정 불필요
        if (force) {
          // 강제 적용 시에만 트랜지션 적용
          lightPortrait.style.transition = 'filter 0.5s ease-in-out';
        }
      });
      
      // 현재 조명 상태 저장
      if (state.ui.battleState) {
        state.ui.battleState.lightingApplied = true;
        state.ui.battleState.currentLighting = preset.name;
      }
      
      return preset;
    } catch (e) {
      console.warn('[lighting-error]', e);
      return LIGHTING_PRESETS.DEFAULT;
    }
  }

  // Light 오버레이 제어 함수를 전역으로 노출
  window.toggleLightOverlay = toggleLightOverlay;

  // 선택된 카드 재클릭 시 실행되는 공통 플로우
  async function executeSelectedSkill(overrideSkill){
    if(!selectedSkill) return;
    const useSkill = overrideSkill || selectedSkill;
    if(useSkill.type!=='move' && !isTargetValid(useSkill, B.target)){
      selectedSkill = null; renderCards(); return;
    }
    try{ console.debug('[player-performSkill-start]', { unit:B.turnUnit, skill: useSkill?.id, target:B.target, time: Date.now() }); }catch{}
    window.UI_TIP?.hideTooltip();
    if(cleanupMoveOverlay){ try{ cleanupMoveOverlay(); }catch{} cleanupMoveOverlay=null; }
    const actorEl = (B.enemyOrder.includes(B.turnUnit)? enemyLane : allyLane).querySelector(`.unit-slot[data-unit-id="${B.turnUnit}"]`);
    const shout = (overrideSkill?.shout) || state.data.skills[useSkill.id]?.shout;
    if(actorEl && shout){ const sp=document.createElement('div'); sp.className='speech'; sp.textContent=shout; actorEl.appendChild(sp); setTimeout(()=>sp.remove(), 1800); }
    
    // 아군 스킬 애니메이션
    if(actorEl && B.allyOrder.includes(B.turnUnit)) {
      if(useSkill.type === 'strike' || useSkill.type === 'multi' || useSkill.type === 'line' || useSkill.type === 'row' || useSkill.type === 'cross' || useSkill.type === 'poison') {
        // 공격/마법 스킬: 전진 > 공격 > 후퇴 애니메이션
        actorEl.classList.add('attacking');
        try{ applyPortraitState(B.turnUnit, 'attack'); }catch{}
        try{
          const sprite = actorEl.querySelector('.portrait');
          if(sprite){
            const dx = 40; // 아군은 오른쪽으로 전진
            const anim = sprite.animate([
              { transform: 'translate(-50%, 0) scale(1)', offset: 0 },
              { transform: `translate(calc(-50% + ${dx}px), 0) scale(1.05)`, offset: 0.2 },
              { transform: `translate(calc(-50% + ${dx}px), 0) scale(1.05)`, offset: 0.8 },
              { transform: 'translate(-50%, 0) scale(1)', offset: 1 }
            ], { duration: 500, easing:'ease-out' });
            
            // 후퇴 시작 시점(80%)에 기본 스프라이트로 변경
            setTimeout(() => {
              try{ applyPortraitState(B.turnUnit, 'default'); }catch{}
            }, 500 * 0.8);
            
            anim.addEventListener('finish', ()=>{ 
              try{ 
                applyPortraitState(B.turnUnit, 'default'); 
                actorEl.classList.remove('attacking');
              }catch{} 
            });
          }
        }catch{}
      } else if(useSkill.type === 'heal' || useSkill.type === 'regen' || useSkill.type === 'shield') {
        // 버프/힐 스킬: 제자리 점프 애니메이션
        try{
          const sprite = actorEl.querySelector('.portrait');
          if(sprite){
            const anim = sprite.animate([
              { transform: 'translate(-50%, 0) scale(1)', offset: 0 },
              { transform: 'translate(-50%, -8px) scale(1.05)', offset: 0.2 },
              { transform: 'translate(-50%, -8px) scale(1.05)', offset: 0.4 },
              { transform: 'translate(-50%, 0) scale(1)', offset: 0.6 },
              { transform: 'translate(-50%, -6px) scale(1.03)', offset: 0.8 },
              { transform: 'translate(-50%, 0) scale(1)', offset: 1 }
            ], { duration: 300, easing:'ease-out' });
            
            anim.addEventListener('finish', ()=>{ 
              try{ 
                applyPortraitState(B.turnUnit, 'default'); 
              }catch{} 
            });
          }
        }catch{}
      }
    }
    
    window.BATTLE.performSkill(state, B, actor, useSkill);
    await new Promise(r=>setTimeout(r, 10));
    B.animating = true;
    let animDelay = animateFromLog();
    await new Promise(r=>setTimeout(r, Math.max(200, animDelay||0)));
    
    // 아군 공격 후 스프라이트 상태 복귀 (즉시 처리)
    if(actorEl && B.allyOrder.includes(B.turnUnit)) {
      actorEl.classList.remove('attacking');
      try{ 
        console.debug('[ally-immediate-after-skill->default]', { unit: B.turnUnit, time: Date.now() }); 
        applyPortraitState(B.turnUnit, 'default'); 
      }catch{}
    }
    
    await new Promise(r=>setTimeout(r, 500));
    document.querySelectorAll('.unit-slot .hit-badge').forEach(n=>n.remove());
    document.querySelectorAll('.unit-slot .hpbar .pred').forEach(p=>{ p.style.width='0%'; p.style.left='0%'; });
    B.animating = false;
    try{ console.debug('[player-performSkill-end]', { unit:B.turnUnit, time: Date.now() }); }catch{}
    // 업그레이드 대기 시, 사용자가 선택할 때까지 멈춘 뒤 남은 이벤트가 있으면 다시 연출
    if(B.awaitingUpgrade){
      // 업그레이드 대기 전에도 스프라이트 상태 확실히 복귀
      if(actorEl && B.allyOrder.includes(B.turnUnit)) {
        actorEl.classList.remove('attacking');
        try{ 
          console.debug('[ally-before-upgrade->default]', { unit: B.turnUnit }); 
          applyPortraitState(B.turnUnit, 'default'); 
        }catch{}
      }
      
      await new Promise(r=>{ B._awaitUpgradeResolve = r; });
      if((B.log||[]).length){
        B.animating = true;
        animDelay = animateFromLog();
        await new Promise(r=>setTimeout(r, Math.max(250, animDelay||0)));
        B.animating = false;
      }
    }
    // 다음 턴 시작 효과(중독/재생 등) 즉시 적용 및 연출
    if(B.turnUnit && B.turnStartProcessedFor !== B.turnUnit){
      window.BATTLE.applyTurnStartEffects(B);
      const extraDelay = animateFromLog();
      await new Promise(r=>setTimeout(r, Math.max(250, extraDelay||0)));
      B.turnStartProcessedFor = B.turnUnit;
    }
    // 턴이 넘어간 후 하이라이트를 갱신
    setTurnHighlight();
    debugFinish('after-player-turn');
    if(!B.awaitingUpgrade && window.BATTLE.isBattleFinished(B)){ 
      console.debug('[finish] end after player turn', { battleId:B.id, winner:B.winner, gameOverTriggered: B.gameOverTriggered }); 
      // 게임 오버가 이미 트리거된 경우 전투 결과 처리 스킵
      if(B.gameOverTriggered) return;
      return showResult(B.winner==='ally'); 
    }
    if(B.awaitingUpgrade){ 
      console.debug('[upgrade-wait] start before enemy phase'); 
      await new Promise(r=>{ B._awaitUpgradeResolve = r; }); 
      debugFinish('after-upgrade-before-enemy'); 
      if(window.BATTLE.isBattleFinished(B)){ 
        console.debug('[finish] end after upgrade before enemy'); 
        if(B.gameOverTriggered) return; // 게임 오버 트리거된 경우 스킵
        return showResult(B.winner==='ally'); 
      } 
    }
    await runEnemyPhase();
  }

  // 적 턴 자동 수행 함수
  async function runEnemyPhase(){
    // 게임 오버가 트리거된 경우 적 턴 진행 중단
    if(B.gameOverTriggered || B.protagonistDead) {
      console.log('[ENEMY-PHASE] 게임 오버로 인한 적 턴 중단');
      return;
    }
    
    let safety=20;
    while(safety-- > 0 && B.enemyOrder.includes(B.turnUnit) && !B.gameOverTriggered && !B.protagonistDead){
      const attackerId = B.turnUnit; // 공격자 ID를 고정 캡처
      const foe = B.units[attackerId]; if(!foe) break;
      const foeSkillId = foe.skills?.[0]; const foeSkill = foeSkillId? state.data.skills[foeSkillId]: null;
      if(!foeSkill) break;
      // 현재 턴 유닛(적)으로 하이라이트 재지정
      setTurnHighlight();
      // 적 턴 시작 효과 즉시 적용(중독/재생 등)
      if(B.turnUnit && B.turnStartProcessedFor !== B.turnUnit){
        window.BATTLE.applyTurnStartEffects(B);
        const extraDelay = animateFromLog();
        await new Promise(r=>setTimeout(r, Math.max(250, extraDelay||0)));
        B.turnStartProcessedFor = B.turnUnit;
      }
      // 타겟 픽과 하이라이트(간단)
      B.target = window.BATTLE.pickTarget(state, B, false, foeSkill);
      document.querySelectorAll('.unit-slot.is-target').forEach(x=>x.classList.remove('is-target'));
      const foeEl = enemyLane.querySelector(`.unit-slot[data-unit-id="${attackerId}"]`);
      if(foeEl){
        if(foeSkill.type === 'strike' || foeSkill.type === 'multi' || foeSkill.type === 'line' || foeSkill.type === 'row' || foeSkill.type === 'cross' || foeSkill.type === 'poison') {
          // 공격/마법 스킬: 전진 > 공격 > 후퇴 애니메이션
          foeEl.classList.add('attacking');
          try{ applyPortraitState(attackerId, 'attack'); }catch{}
          try{
            const sprite = foeEl.querySelector('.portrait');
            if(sprite){
              const dx = B.enemyOrder.includes(attackerId)? -40 : 40;
              const anim = sprite.animate([
                { transform: 'translate(-50%, 0) scale(1)', offset: 0 },
                { transform: `translate(calc(-50% + ${dx}px), 0) scale(1.05)`, offset: 0.2 },
                { transform: `translate(calc(-50% + ${dx}px), 0) scale(1.05)`, offset: 0.8 },
                { transform: 'translate(-50%, 0) scale(1)', offset: 1 }
              ], { duration: 500, easing:'ease-out' });
              
              // 후퇴 시작 시점(80%)에 기본 스프라이트로 변경
              setTimeout(() => {
                try{ applyPortraitState(attackerId, 'default'); }catch{}
              }, 500 * 0.8);
              
              anim.addEventListener('finish', ()=>{ 
                try{ 
                  applyPortraitState(attackerId, 'default'); 
                  foeEl.classList.remove('attacking');
                }catch{} 
              });
            }
          }catch{}
        } else if(foeSkill.type === 'heal' || foeSkill.type === 'regen' || foeSkill.type === 'shield') {
          // 버프/힐 스킬: 제자리 점프 애니메이션
          try{
            const sprite = foeEl.querySelector('.portrait');
            if(sprite){
              const anim = sprite.animate([
                { transform: 'translate(-50%, 0) scale(1)', offset: 0 },
                { transform: 'translate(-50%, -8px) scale(1.05)', offset: 0.2 },
                { transform: 'translate(-50%, -8px) scale(1.05)', offset: 0.4 },
                { transform: 'translate(-50%, 0) scale(1)', offset: 0.6 },
                { transform: 'translate(-50%, -6px) scale(1.03)', offset: 0.8 },
                { transform: 'translate(-50%, 0) scale(1)', offset: 1 }
              ], { duration: 300, easing:'ease-out' });
              
              anim.addEventListener('finish', ()=>{ 
                try{ 
                  applyPortraitState(attackerId, 'default'); 
                }catch{} 
              });
            }
          }catch{}
        }
      }
      // 적 스킬 대사 표시
      const foeShout = foeSkill?.shout;
      if(foeEl && foeShout){ const sp=document.createElement('div'); sp.className='speech'; sp.textContent=foeShout; foeEl.appendChild(sp); setTimeout(()=>{ if(sp.parentElement) sp.remove(); }, 1800); }
      const tEl = (B.enemyOrder.includes(B.target)? enemyLane : allyLane).querySelector(`.unit-slot[data-unit-id="${B.target}"]`);
      if(tEl) tEl.classList.add('is-target');
      await new Promise(r=>setTimeout(r, 220));
      // 다단히트(2회) 시에도 같은 모션이 반복되도록 performSkill 호출 전후로 이미지/이동 처리를 유지
      console.debug('[enemy-performSkill]', { unit:attackerId, skill: foeSkill?.id, time: Date.now() });
      window.BATTLE.performSkill(state, B, foe, foeSkill);
      B.animating = true;
      const animDelay = animateFromLog();
      await new Promise(r=>setTimeout(r, Math.max(500, animDelay||0)));
      if(foeEl){ foeEl.classList.remove('attacking'); try{ console.debug('[enemy-after-anim->default]', { unit:attackerId, time: Date.now() }); applyPortraitState(attackerId, 'default'); }catch{} }
      await new Promise(r=>setTimeout(r, 500));
      B.animating = false;
      // 적 턴에도 업그레이드가 발생하면 대기
      if(B.awaitingUpgrade){ 
        // 업그레이드 대기 전에 스프라이트 상태 확실히 복귀
        if(foeEl){ 
          foeEl.classList.remove('attacking'); 
          try{ 
            console.debug('[enemy-before-upgrade->default]', { unit: attackerId }); 
            applyPortraitState(attackerId, 'default'); 
          }catch{} 
        }
        console.debug('[upgrade-wait] start during enemy phase'); 
        await new Promise(r=>{ B._awaitUpgradeResolve = r; }); 
        console.debug('[upgrade-wait] done during enemy phase'); 
      }
      // 스킬 처리로 다음 턴 유닛으로 넘어갔으므로 하이라이트 갱신
      setTurnHighlight();
      debugFinish('after-enemy-turn-iteration');
      if(window.BATTLE.isBattleFinished(B)){ 
        console.debug('[finish] end after enemy iteration', { battleId:B.id, winner:B.winner, gameOverTriggered: B.gameOverTriggered }); 
        if(B.gameOverTriggered) return; // 게임 오버 트리거된 경우 스킵
        showResult(B.winner==='ally'); 
        return; 
      }
    }
    // 애니메이션이 모두 끝난 후에만 리렌더(연출 보존)
    if(!B.refreshScheduled){
      B.refreshScheduled = true;
      setTimeout(async ()=>{
        B.refreshScheduled = false;
        debugFinish('enemy-phase-tail');
        if(!window.BATTLE.isBattleFinished(B) && !B.animating && !B.gameOverTriggered){
          await renderBattleView(root, state, true); // 전투 중 리렌더링은 로딩 스킵
        }
      }, 120);
    }
  }

  function showResult(isWin){
    // 주인공 사망 시 특별 처리
    const protagonistDead = B.protagonistDead || 
                           (B.deadAllies || []).includes('C-001') || 
                           (B.deadAllies || []).some(id => id && id.startsWith('C-001'));
    
    if(protagonistDead && !isWin) {
      console.log('[PROTAGONIST-DEATH] 주인공 사망으로 인한 패배 - 특별 처리', { deadAllies: B.deadAllies });
      handleProtagonistDefeat();
      return;
    }
    
    const backdrop = document.createElement('div'); backdrop.className='modal-backdrop';
    const modal = document.createElement('div'); modal.className='modal';
    modal.innerHTML = `<h3>${isWin? '승리': '패배'}</h3><p>${isWin? '전투에서 승리했습니다.': '전투에서 패배했습니다.'}</p><div class="actions"><button class="btn" id="btnToRoutes">루트로</button></div>`;
    backdrop.appendChild(modal); frame.appendChild(backdrop);
    modal.querySelector('#btnToRoutes').onclick=()=>{
      console.debug('[finish-click]', { isWin, battleId:B.id });
      // persist hp/mp of allies
      (B.allyOrder||[]).forEach(id=>{
        if(!id) return; const baseId = id.split('@')[0]; const u=B.units[id]; if(!u) return;
        if(!state.persist) state.persist={ hp:{}, mp:{} };
        if(!state.persist.hp) state.persist.hp={}; if(!state.persist.mp) state.persist.mp={};
        state.persist.hp[baseId] = u.hp;
        state.persist.mp[baseId] = u.mp;
      });
      // 영구 사망 처리: 이번 전투에서 죽은 아군을 회차 내에서 비활성화
      if(B.deadAllies && B.deadAllies.length){
        const deadSet = new Set(B.deadAllies);
        state.ownedUnits = state.ownedUnits || {};
        B.deadAllies.forEach(baseId=>{ state.ownedUnits[baseId] = false; });
        if(Array.isArray(state.party?.members)){
          state.party.members = state.party.members.map(id=> (id && deadSet.has(id)? null : id));
        }
        if(state.party?.positions){ Object.keys(state.party.positions).forEach(id=>{ if(deadSet.has(id)) delete state.party.positions[id]; }); }
        // persist는 0으로 고정하여 다음 전투에서도 HP 0 유지(부활 방지)
        state.persist = state.persist || { hp:{}, mp:{} };
        state.persist.hp = state.persist.hp || {};
        state.persist.mp = state.persist.mp || {};
        B.deadAllies.forEach(baseId=>{ state.persist.hp[baseId] = 0; state.persist.mp[baseId] = 0; });
      }
      // 전투 결과 플래그 기록(분기용)
      try{
        const key = `bt.${B.id||'BT-010'}.win`;
        import('../engine/rules.js').then(mod=>{
          const setFlag = mod.setFlag || ((st,k,v)=>{ st.flags=st.flags||{}; st.flags[k]=v; });
          setFlag(state, key, isWin);
        }).catch(()=>{ state.flags[key] = isWin; });
      }catch{ const key = `bt.${B.id||'BT-010'}.win`; state.flags[key] = isWin; }
      delete state.ui.battleState;
      const curBid = B.id || 'BT-010';
      // 전투 데이터 기반 분기: winNext/loseNext가 있으면 해당 타겟으로 이동
      const btData = state.data?.battles?.[curBid];
      const nextId = isWin ? (btData?.winNext || null) : (btData?.loseNext || null);
      console.debug('[finish-next]', { curBid, isWin, nextId, btData });
      // 이번 전투에서 사망한 아군은 보유/덱/영구 데이터에서 비활성화
      if(B.deadAllies && B.deadAllies.length){
        const deadSet = new Set(B.deadAllies);
        state.ownedUnits = state.ownedUnits || {};
        B.deadAllies.forEach(baseId=>{ state.ownedUnits[baseId] = false; });
        if(Array.isArray(state.party?.members)){
          state.party.members = state.party.members.map(id=> (id && deadSet.has(id)? null : id));
        }
        if(state.party?.positions){ Object.keys(state.party.positions).forEach(id=>{ if(deadSet.has(id)) delete state.party.positions[id]; }); }
        state.persist = state.persist || { hp:{}, mp:{} };
        state.persist.hp = state.persist.hp || {};
        state.persist.mp = state.persist.mp || {};
        B.deadAllies.forEach(baseId=>{ state.persist.hp[baseId] = 0; state.persist.mp[baseId] = 0; });
      }
      // EP로 이동하는 경우: 그 EP로 이어지는 루트를 자동 방문 처리(재선택 방지)
      if(nextId && nextId.startsWith('EP-')){
        const r = (state.data.routes||[]).find(rt=>rt.next===nextId);
        if(r){
          if(!state.flags.visitedRoutes) state.flags.visitedRoutes={};
          state.flags.visitedRoutes[r.id]=true;
          // 이번 회차 진행 기록도 함께 갱신하여 루트 UI 가시성/프론티어가 동작하도록 함
          state.flags.runVisitedRoutes = state.flags.runVisitedRoutes || {};
          state.flags.runVisitedRoutes[r.id] = true;
          state.flags.lastRouteId = r.id;
          console.debug('[finish-mark-route]', { route:r.id, forEpisode: nextId });
        }
      }
      if(nextId){
        // R-*** 또는 EP-***/BT-*** 모두 처리
        if(nextId.startsWith('R-')){
          const nr = (state.data.routes||[]).find(rt=> rt.id===nextId);
          if(nr){
            // 루트 방문 처리
            state.flags = state.flags || {}; state.flags.visitedRoutes = state.flags.visitedRoutes || {}; state.flags.runVisitedRoutes = state.flags.runVisitedRoutes || {};
            state.flags.visitedRoutes[nr.id] = true; state.flags.runVisitedRoutes[nr.id] = true; state.flags.lastRouteId = nr.id;
            if((nr.next||'').startsWith('EP-')){
              delete state.ui.battle; state.ui.currentEpisode = nr.next;
              console.debug('[finish-nav-after-route->episode]', { route: nr.id, ep: nr.next });
              const btnEp = document.querySelector('nav button[data-view=episode]'); if(btnEp){ btnEp.click(); return; }
            }
            if((nr.next||'').startsWith('BT-')){
              state.ui.battle = nr.next; state.ui.currentEpisode = null;
              console.debug('[finish-nav-after-route->battle]', { route: nr.id, bt: nr.next });
              const btnBt = document.querySelector('nav button[data-view=battle]'); if(btnBt){ btnBt.click(); return; }
            }
          }
          // 루트만 지정되어 있고 즉시 EP/BT가 없다면 루트 선택 화면으로
        } else if(nextId.startsWith('EP-')){
          delete state.ui.battle; state.ui.currentEpisode = nextId;
          console.debug('[finish-nav-episode]', { nextId });
          const btnEp = document.querySelector('nav button[data-view=episode]');
          if(btnEp){ btnEp.click(); return; }
        } else if(nextId.startsWith('BT-')){
          state.ui.battle = nextId; state.ui.currentEpisode = null;
          console.debug('[finish-nav-battle]', { nextId });
          const btnBt = document.querySelector('nav button[data-view=battle]');
          if(btnBt){ btnBt.click(); return; }
        }
      }
      // EP-220 처리는 episode 화면에서 resetState가 수행됨
      state.ui.currentEpisode = null; state.ui.battle = null;
      const btn = document.querySelector('nav button[data-view=routes]');
      if(btn){ btn.click(); }
    };
  }
  
  function handleProtagonistDefeat(){
    // 기존 모든 모달 제거
    document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
    
    const backdrop = document.createElement('div'); 
    backdrop.className='modal-backdrop';
    backdrop.id = 'protagonist-death-modal'; // 고유 ID로 보호
    backdrop.style.zIndex = '9999'; // 최상위 표시
    
    const modal = document.createElement('div'); 
    modal.className='modal';
    modal.innerHTML = `<h3>💀 주인공 사망</h3><p>주인공이 쓰러졌습니다...</p><div class="actions"><button class="btn" id="btnToDefeatEvent">계속</button></div>`;
    backdrop.appendChild(modal); 
    
    // body에 직접 추가하여 frame 밖에서 보호
    document.body.appendChild(backdrop);
    
    modal.querySelector('#btnToDefeatEvent').onclick=()=>{
      console.debug('[protagonist-defeat]', { battleId: B.id });
      
      // 전투 결과 플래그 기록 (패배)
      try{
        const key = `bt.${B.id||'BT-010'}.win`;
        import('../engine/rules.js').then(mod=>{
          const setFlag = mod.setFlag || ((st,k,v)=>{ st.flags=st.flags||{}; st.flags[k]=v; });
          setFlag(state, key, false);
        }).catch(()=>{ state.flags = state.flags || {}; state.flags[key] = false; });
      }catch{ const key = `bt.${B.id||'BT-010'}.win`; state.flags = state.flags || {}; state.flags[key] = false; }
      
      delete state.ui.battleState;
      const curBid = B.id || 'BT-010';
      const btData = state.data?.battles?.[curBid];
      
      // 주인공 사망 전용 패배 이벤트가 있는지 확인
      const defeatEvent = btData?.protagonistDeathNext || btData?.loseNext;
      
      if(defeatEvent) {
        console.log('[PROTAGONIST-DEATH] 패배 이벤트로 이동:', defeatEvent);
        
        if(defeatEvent.startsWith('EP-')) {
          state.ui.currentEpisode = defeatEvent;
          state.ui.battle = null;
          const btnEp = document.querySelector('nav button[data-view=episode]');
          if(btnEp) { btnEp.click(); return; }
        } else if(defeatEvent.startsWith('R-')) {
          const route = (state.data.routes||[]).find(r => r.id === defeatEvent);
          if(route) {
            // 루트 방문 처리
            state.flags = state.flags || {};
            state.flags.visitedRoutes = state.flags.visitedRoutes || {};
            state.flags.runVisitedRoutes = state.flags.runVisitedRoutes || {};
            state.flags.visitedRoutes[route.id] = true;
            state.flags.runVisitedRoutes[route.id] = true;
            state.flags.lastRouteId = route.id;
            
            if((route.next||'').startsWith('EP-')) {
              state.ui.currentEpisode = route.next;
              state.ui.battle = null;
              const btnEp = document.querySelector('nav button[data-view=episode]');
              if(btnEp) { btnEp.click(); return; }
            }
          }
          // 루트 화면으로
          const btnRoutes = document.querySelector('nav button[data-view=routes]');
          if(btnRoutes) { btnRoutes.click(); return; }
        }
      } else {
        // 패배 이벤트가 없으면 범용 게임 오버
        console.log('[PROTAGONIST-DEATH] 범용 게임 오버로 처리');
        if(typeof window.triggerGameOver === 'function') {
          window.triggerGameOver(state, 'protagonist_death_no_defeat_event');
        }
      }
      
      // 주인공 사망 모달 제거
      const deathModal = document.getElementById('protagonist-death-modal');
      if(deathModal) deathModal.remove();
    };
  }
}

// 로딩 화면 생성 함수
function createLoadingScreen(){
  const screen = document.createElement('div');
  screen.className = 'battle-loading-screen';
  screen.style.cssText = `
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, #0f1320 0%, #1a2332 50%, #0f1320 100%);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    transition: opacity 0.8s ease-out;
  `;
  
  screen.innerHTML = `
    <div style="text-align: center; color: #cbd5e1;">
      <div style="font-size: 32px; margin-bottom: 20px; font-weight: bold;">⚔️ 전투 준비 중</div>
      <div class="loading-spinner" style="width: 60px; height: 60px; border: 4px solid #2b3450; border-top: 4px solid #5cc8ff; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 20px;"></div>
      <div id="loadingText" style="font-size: 18px; color: #9aa0a6;">리소스를 불러오는 중...</div>
      <div id="loadingProgress" style="width: 300px; height: 6px; background: #2b3450; border-radius: 3px; margin-top: 12px; overflow: hidden;">
        <div id="progressBar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #5cc8ff, #a0ff9e); transition: width 0.3s ease; border-radius: 3px;"></div>
      </div>
    </div>
  `;
  
  // 스피너 애니메이션 CSS 추가
  if(!document.getElementById('loading-spinner-style')) {
    const style = document.createElement('style');
    style.id = 'loading-spinner-style';
    style.textContent = '@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }';
    document.head.appendChild(style);
  }
  
  return screen;
}

// 전투 리소스 사전 로딩 함수
async function preloadBattleResources(state, bt, btid){
  const loadingText = document.getElementById('loadingText');
  const progressBar = document.getElementById('progressBar');
  
  const resources = [];
  let loadedCount = 0;
  
  // 배경 이미지 수집
  if(bt?.bg) {
    const bgPath = (typeof bt.bg === 'string') 
      ? (bt.bg.includes('/') ? bt.bg : `assets/bg/${bt.bg}`)
      : (bt.bg?.path || 'assets/bg/BG_001.png');
    resources.push({ type: 'bg', url: bgPath, name: '배경' });
  }
  
  // 전투 상태 준비
  if(!state.ui.battleState || state.ui.battleState.id !== (bt.id||btid)){
    state.ui.battleState = window.BATTLE.createBattleState(state, bt);
  }
  const B = state.ui.battleState;
  
  // 모든 유닛의 스프라이트 수집
  const allUnits = [...(B.allyOrder || []), ...(B.enemyOrder || [])];
  allUnits.forEach(unitId => {
    if(!unitId) return;
    const baseId = unitId.split('@')[0];
    const unitData = state.data?.units?.[baseId];
    if(unitData?.sprite) {
      if(unitData.sprite.base) resources.push({ type: 'sprite', url: unitData.sprite.base, name: `${unitData.name} 기본` });
      if(unitData.sprite.attack) resources.push({ type: 'sprite', url: unitData.sprite.attack, name: `${unitData.name} 공격` });
      if(unitData.sprite.hit) resources.push({ type: 'sprite', url: unitData.sprite.hit, name: `${unitData.name} 피격` });
    }
  });
  
  const totalResources = resources.length;
  if(totalResources === 0) return;
  
  // 병렬 로딩
  const loadPromises = resources.map(async (resource, index) => {
    try {
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = resource.url;
      });
      
      loadedCount++;
      const progress = (loadedCount / totalResources) * 100;
      
      // UI 업데이트
      if(loadingText) loadingText.textContent = `${resource.name} 로딩 완료... (${loadedCount}/${totalResources})`;
      if(progressBar) progressBar.style.width = `${progress}%`;
      
      console.debug('[resource-loaded]', resource.name, `${loadedCount}/${totalResources}`);
    } catch(e) {
      console.warn('[resource-load-failed]', resource.name, e);
      loadedCount++; // 실패해도 진행
      const progress = (loadedCount / totalResources) * 100;
      if(progressBar) progressBar.style.width = `${progress}%`;
    }
  });
  
  await Promise.all(loadPromises);
  
  if(loadingText) loadingText.textContent = '로딩 완료!';
  await new Promise(r => setTimeout(r, 300)); // 완료 메시지 잠시 표시
}

// 로딩 화면 페이드 아웃
async function fadeOutLoading(loadingScreen){
  return new Promise(resolve => {
    loadingScreen.style.opacity = '0';
    setTimeout(() => {
      if(loadingScreen.parentElement) {
        loadingScreen.remove();
      }
      resolve();
    }, 800); // 0.8초 페이드 아웃
  });
}

  // remove cheat panel when leaving battle (expose cleanup)
  window.addEventListener('beforeunload', ()=>{ const c=document.getElementById('cheat-panel'); if(c) c.remove(); });



