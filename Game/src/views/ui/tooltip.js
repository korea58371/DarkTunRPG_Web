// Simple tooltip utility (robust)
export function showTooltip(arg1, arg2, arg3){
  // support both showTooltip(text,x,y) and showTooltip(x,y,text)
  let text, x, y;
  if(typeof arg1 === 'string'){ text = arg1; x = arg2; y = arg3; }
  else { x = arg1; y = arg2; text = arg3; }
  if(x == null || y == null) return; // ignore invalid calls
  hideTooltip();
  const tip = document.createElement('div');
  tip.className='tooltip';
  tip.textContent = text || '';
  positionTip(tip, x, y);
  document.body.appendChild(tip);
}

export function positionTip(tipOrX, xOrY, yMaybe){
  let tip, x, y;
  if(typeof tipOrX === 'number'){ // called as positionTip(x,y)
    tip = document.querySelector('.tooltip'); x = tipOrX; y = xOrY;
  } else { tip = tipOrX; x = xOrY; y = yMaybe; }
  if(!tip || x == null || y == null) return;
  const pad=10; const vw=window.innerWidth; const vh=window.innerHeight;
  tip.style.left = Math.min(vw - 220, Math.max(0, x + pad)) + 'px';
  tip.style.top = Math.min(vh - 48, Math.max(0, y - 30)) + 'px';
}

export function hideTooltip(){
  const tip=document.querySelector('.tooltip');
  if(tip) tip.remove();
}


