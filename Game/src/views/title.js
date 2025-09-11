export function renderTitleView(root, state, onStart){
  const frame = document.createElement('div');
  frame.className='frame';
  frame.innerHTML = `
    <div class="hud-top"><div class="hud-panel"><strong>Prototype RPG</strong></div></div>
    <div class="viewport" style="display:flex;align-items:center;justify-content:center;">
      <div class="panel" style="text-align:center;">
        <h2>Prototype RPG</h2>
        <p style="color:#9aa0a6;">간단한 프로토 타입</p>
        <button class="btn primary" id="btnStartGame">시작하기</button>
      </div>
    </div>
  `;
  root.innerHTML=''; root.appendChild(frame);
  frame.querySelector('#btnStartGame').onclick=()=>{
    // 첫 화면에서 시작 시, 이전 플레이 루트를 숨기지 않도록 visitedRoutes 유지
    onStart?.();
  };
}



