import { renderEpisodeVN } from '../engine/epEngine.js';

export async function renderEpisodeView(root, state){
  // cleanup any lingering modals
  document.querySelectorAll('.modal-backdrop').forEach(el=>el.remove());
  const id = state.ui.currentEpisode || 'EP-001';
  // 루트 동기화: 이 에피소드(id)로 들어오는 루트를 마킹
  try{
    const rIn = (state.data.routes||[]).find(rt=> rt.next === id);
    if(rIn){
      state.flags = state.flags || {};
      state.flags.visitedRoutes = state.flags.visitedRoutes || {};
      state.flags.runVisitedRoutes = state.flags.runVisitedRoutes || {};
      if(!state.flags.visitedRoutes[rIn.id]) state.flags.visitedRoutes[rIn.id] = true;
      if(!state.flags.runVisitedRoutes[rIn.id]) state.flags.runVisitedRoutes[rIn.id] = true;
      state.flags.lastRouteId = rIn.id;
    }
  }catch{}
  await renderEpisodeVN(root, state, id, {/* cfg override if needed */});
}


