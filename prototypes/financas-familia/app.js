const days = ['seg','ter','qua','qui','sex','sab','dom'];
let credVals = [40,60,30,80,50,20,70];
let debVals = [30,45,25,60,40,15,50];

function renderCharts(){
  const c = document.getElementById('chartDays');
  c.innerHTML = '';
  days.forEach((d,i)=>{
    const wrap = document.createElement('div'); wrap.style.display='flex'; wrap.style.flexDirection='column'; wrap.style.alignItems='center'; wrap.style.flex='1'; wrap.style.gap='2px';
    const pair = document.createElement('div'); pair.style.display='flex'; pair.style.gap='2px'; pair.style.alignItems='flex-end'; pair.style.height='140px'; pair.style.width='100%';
    const cb = document.createElement('div'); cb.className='bar'; cb.style.height=credVals[i]+'%'; cb.style.width='50%';
    const db = document.createElement('div'); db.className='bar debit'; db.style.height=debVals[i]+'%'; db.style.width='50%';
    const s = document.createElement('span'); s.textContent=d;
    pair.appendChild(cb); pair.appendChild(db);
    wrap.appendChild(pair); wrap.appendChild(s);
    c.appendChild(wrap);
  });
}

let txs = [
  {desc:'Salário',who:'Maria',val:'+ R$ 4.800,00',cls:'credit'},
  {desc:'Supermercado',who:'João',val:'- R$ 280,00',cls:'debit'},
  {desc:'Netflix (assinatura)',who:'Família',val:'- R$ 39,90',cls:'debit'},
  {desc:'Parcela TV (3/12)',who:'Lucas',val:'- R$ 150,00',cls:'debit'},
];
function renderTx(){
  const ul = document.getElementById('listTx');
  ul.innerHTML = txs.map(t=>'<li><div>'+t.desc+'<div class="m">'+t.who+'</div></div><div class="'+t.cls+'">'+t.val+'</div></li>').join('');
}

document.querySelectorAll('.member[contenteditable="true"]').forEach(b=>{
  const rm = document.createElement('button');
  rm.className = 'remove-btn';
  rm.textContent = '×';
  rm.title = 'Remover membro';
  rm.addEventListener('click',(e)=>{
    e.stopPropagation();
    if(!confirm('Remover membro "'+b.textContent.replace('×','').trim()+'"?')) return;
    b.remove();
  });
  b.appendChild(rm);

  b.addEventListener('blur',()=>{
    const name = b.textContent.replace('×','').trim() || b.dataset.member;
    b.textContent = name;
    const rm2 = document.createElement('button');
    rm2.className = 'remove-btn';
    rm2.textContent = '×';
    rm2.title = 'Remover membro';
    rm2.addEventListener('click',(e)=>{
      e.stopPropagation();
      if(!confirm('Remover membro "'+b.textContent.replace('×','').trim()+'"?')) return;
      b.remove();
    });
    b.appendChild(rm2);
  });
  b.addEventListener('keydown',(e)=>{
    if(e.key==='Enter'){ e.preventDefault(); b.blur(); }
  });
});

document.getElementById('addMemberBtn').addEventListener('click',()=>{
  const name = prompt('Nome do novo membro:');
  if(!name || !name.trim()) return;
  const key = name.trim().toLowerCase().replace(/\s+/g,'-');
  const btn = document.createElement('button');
  btn.className = 'member';
  btn.dataset.member = key;
  btn.contentEditable = 'true';
  btn.spellcheck = false;
  btn.textContent = name.trim();
  const rm = document.createElement('button');
  rm.className = 'remove-btn';
  rm.textContent = '×';
  rm.title = 'Remover membro';
  rm.addEventListener('click',(e)=>{
    e.stopPropagation();
    if(!confirm('Remover membro "'+btn.textContent.replace('×','').trim()+'"?')) return;
    btn.remove();
  });
  btn.appendChild(rm);
  btn.addEventListener('blur',()=>{
    const n = btn.textContent.replace('×','').trim()||key;
    btn.textContent = n;
    const rm2 = document.createElement('button');
    rm2.className = 'remove-btn';
    rm2.textContent = '×';
    rm2.title = 'Remover membro';
    rm2.addEventListener('click',(e)=>{
      e.stopPropagation();
      if(!confirm('Remover membro "'+btn.textContent.replace('×','').trim()+'"?')) return;
      btn.remove();
    });
    btn.appendChild(rm2);
  });
  btn.addEventListener('keydown',(e)=>{ if(e.key==='Enter'){e.preventDefault();btn.blur();} });
  const nav = document.querySelector('.members');
  nav.insertBefore(btn, document.getElementById('addMemberBtn'));
});

document.querySelectorAll('.member').forEach(b=>{
  b.addEventListener('click',()=>{
    document.querySelectorAll('.member').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
  });
});

const modal = document.getElementById('modal');
const micBtn = document.getElementById('micBtn');
micBtn.addEventListener('click',()=>{ modal.hidden=false; document.getElementById('transcript').hidden=true; document.getElementById('startRec').disabled=false; document.getElementById('stopRec').disabled=true; });
document.getElementById('startRec').addEventListener('click',()=>{
  document.getElementById('startRec').disabled=true;
  document.getElementById('stopRec').disabled=false;
  document.getElementById('wave').style.animation='pulse 1s infinite';
});
document.getElementById('stopRec').addEventListener('click',()=>{
  document.getElementById('stopRec').disabled=true;
  document.getElementById('transcript').hidden=false;
});
document.getElementById('cancelTx').addEventListener('click',()=>{ modal.hidden=true; });
document.getElementById('confirmTx').addEventListener('click',()=>{
  txs.unshift({desc:'Mercado (áudio)',who:'João',val:'- R$ 45,00',cls:'debit'});
  renderTx();
  modal.hidden=true;
});

document.getElementById('resetBtn').addEventListener('click',()=>{
  if(!confirm('Zerar todos os créditos e débitos? Esta ação não pode ser desfeita.')) return;
  credVals = credVals.map(()=>0);
  debVals = debVals.map(()=>0);
  txs = [];
  document.getElementById('saldo').textContent = 'R$ 0,00';
  document.getElementById('cred').textContent = 'R$ 0,00';
  document.getElementById('deb').textContent = 'R$ 0,00';
  document.getElementById('parc').textContent = 'R$ 0,00';
  renderCharts();
  renderTx();
});

renderCharts();
renderTx();