const days = ['seg','ter','qua','qui','sex','sab','dom'];
const credVals = [40,60,30,80,50,20,70];
const debVals = [30,45,25,60,40,15,50];

function renderCharts(){
  const c = document.getElementById('chartDays');
  c.innerHTML = '';
  days.forEach((d,i)=>{
    const g = document.createElement('div'); g.className='bar-group';
    const cb = document.createElement('div'); cb.className='bar'; cb.style.height=credVals[i]+'%';
    const db = document.createElement('div'); db.className='bar debit'; db.style.height=debVals[i]+'%';
    const s = document.createElement('span'); s.textContent=d;
    const wrap = document.createElement('div'); wrap.style.display='flex'; wrap.style.flexDirection='column'; wrap.style.alignItems='center'; wrap.style.flex='1'; wrap.style.gap='2px';
    const pair = document.createElement('div'); pair.style.display='flex'; pair.style.gap='2px'; pair.style.alignItems='flex-end'; pair.style.height='140px'; pair.style.width='100%';
    cb.style.width='50%'; db.style.width='50%';
    pair.appendChild(cb); pair.appendChild(db);
    wrap.appendChild(pair); wrap.appendChild(s);
    c.appendChild(wrap);
  });
}

const txs = [
  {desc:'Salário',who:'Maria',val:'+ R$ 4.800,00',cls:'credit'},
  {desc:'Supermercado',who:'João',val:'- R$ 280,00',cls:'debit'},
  {desc:'Netflix (assinatura)',who:'Família',val:'- R$ 39,90',cls:'debit'},
  {desc:'Parcela TV (3/12)',who:'Lucas',val:'- R$ 150,00',cls:'debit'},
];
function renderTx(){
  const ul = document.getElementById('listTx');
  ul.innerHTML = txs.map(t=>`<li><div>${t.desc}<div class="m">${t.who}</div></div><div class="${t.cls}">${t.val}</div></li>`).join('');
}

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

renderCharts();
renderTx();