import { initState } from './state.js';
import { renderRoutesView } from './views/routes.js';
import { renderPartyView } from './views/party.js';
import { renderEpisodeView } from './views/episode.js';
import { renderBattleView } from './views/battle.js';

const app = document.getElementById('app');
const seedSpan = document.getElementById('seed');

const state = initState();
if (seedSpan) seedSpan.textContent = state.rng.seed;

function render(view){
  try{
    if (window.UI_TIP && window.UI_TIP.hideTooltip) window.UI_TIP.hideTooltip();
    console.log('[render]', view);
    app.innerHTML = '';
    switch(view){
      case 'routes': return renderRoutesView(app, state);
      case 'party': return renderPartyView(app, state);
      case 'episode': return renderEpisodeView(app, state);
      case 'battle':
        if(!state.ui.battle){
          const ids = Object.keys(state.data.battles||{});
          state.ui.battle = ids[0] || 'BT-100';
        }
        return renderBattleView(app, state);
      default: return renderRoutesView(app, state);
    }
  }catch(err){
    console.error(err);
    app.innerHTML = `<div class="frame"><div style="padding:16px;color:#ff6b6b;">오류가 발생했습니다: ${err?.message||err}</div></div>`;
  }
}

document.querySelectorAll('nav button').forEach(btn=>{
  btn.addEventListener('click',()=>render(btn.dataset.view));
});

render('routes');

window.render = render;


