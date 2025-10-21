// main.js - lógica do simulador
document.addEventListener('DOMContentLoaded', ()=>{
  const el = id => document.getElementById(id);
  const tableBody = document.querySelector('#results-table tbody');
  const chartDiv = document.getElementById('chart');
  const defaults = {
    principal:10000, monthly:200, months:36, inflation:4.0, cdi:13.15, cdb_nom:14.0, cdb_pct_cdi:0,
    lci:9.0, selic:13.75, poupanca:6.17, ipca_real:3.0, ipca:4.0
  };
  function resetDefaults(){
    Object.keys(defaults).forEach(k=>{ if(el(k)) el(k).value = defaults[k]; });
    calc();
  }
  document.getElementById('reset').addEventListener('click', resetDefaults);
  document.getElementById('calc').addEventListener('click', calc);

  // IOF table (percent of rendimento) for days 1..30 (common market table)
  const IOF_TABLE = [96,93,90,86,83,80,76,73,70,66,63,60,56,53,50,46,43,40,36,33,30,26,23,20,16,13,10,6,3,0];

  function annualToMonthly(a){ return Math.pow(1 + a/100, 1/12) - 1; }
  function fv_with_contrib(P, m, n, rm){ // aportes at end of period
    if(rm === 0) return P + m * n;
    return P * Math.pow(1+rm, n) + m * (Math.pow(1+rm, n) - 1) / rm;
  }
  function ir_percent_by_months(n){
    if(n <= 6*30/30 || n <= 180) return 22.5;
    if(n <= 360) return 20;
    if(n <= 720) return 17.5;
    return 15;
  }
  function iof_percent_by_days(days){
    if(days <= 0) return 0;
    if(days >= 30) return 0;
    const idx = Math.max(0, Math.min(29, Math.floor(days)-1));
    return IOF_TABLE[idx];
  }

  function calc(){
    // read inputs
    const P = parseFloat(el('principal').value) || 0;
    const M = parseFloat(el('monthly').value) || 0;
    const months = Math.max(1, parseInt(el('months').value) || 1);
    const days = months * 30; // approximation for IOF purposes
    const inflation = parseFloat(el('inflation').value) || 0;
    const cdi = parseFloat(el('cdi').value) || 0;
    const cdb_nom = parseFloat(el('cdb_nom').value) || 0;
    const cdb_pct = parseFloat(el('cdb_pct_cdi').value) || 0;
    const lci = parseFloat(el('lci').value) || 0;
    const selic = parseFloat(el('selic').value) || 0;
    const poup = parseFloat(el('poupanca').value) || 0;
    const ipca_real = parseFloat(el('ipca_real').value) || 0;
    const ipca = parseFloat(el('ipca').value) || 0;

    // Determine actual CDB rate used
    const cdb_rate = (cdb_pct > 0) ? (cdi * cdb_pct / 100) : cdb_nom;
    // Instruments list
    const instruments = [
      {name:'CDB (nominal)', annual:cdb_rate, isTaxable:true},
      {name:'CDB (% do CDI)', annual:(cdi * cdb_pct / 100), isTaxable:true},
      {name:'LCI/LCA (isento)', annual:lci, isTaxable:false},
      {name:'Tesouro Selic', annual:selic, isTaxable:true},
      {name:'Poupança', annual:poup, isTaxable:false},
      {name:'Tesouro IPCA+', annual:( (1+ipca_real/100)*(1+ipca/100) - 1 )*100, isTaxable:true, note:'real:'+ipca_real+'% ipca:'+ipca+'%'}
    ];

    // Clear table and chart
    tableBody.innerHTML = '';
    chartDiv.innerHTML = '';

    let maxNet = 0;
    const rows = [];

    instruments.forEach(inst => {
      const ann = inst.annual;
      const rm = annualToMonthly(ann);
      const fv = fv_with_contrib(P, M, months, rm);
      const totalContrib = P + M * months;
      const gross = fv - totalContrib;
      // IOF
      const iofPct = (days < 30) ? iof_percent_by_days(days) : 0; // percent of rendimento
      const iofAmount = Math.max(0, gross * (iofPct/100));
      // IR percent
      const irPct = inst.isTaxable ? ir_percent_by_months(months) : 0;
      const irAmount = Math.max(0, (gross - iofAmount) * (irPct/100));
      const net = gross - iofAmount - irAmount;
      // Real profit (ajustada pela inflação): subtrai inflação acumulada aproximada (monthly inflation comp)
      const monthlyInflation = annualToMonthly(inflation);
      const inflationFactor = Math.pow(1+monthlyInflation, months);
      const realNet = net / inflationFactor;
      rows.push({inst, ann, fv, totalContrib, gross, iofAmount, irPct, irAmount, net, realNet});
      if(net > maxNet) maxNet = net;
    });

    // render rows
    rows.forEach(r=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${r.inst.name}${r.inst.note? ' ('+r.inst.note+')':''}</td>
        <td>${Number(r.ann).toFixed(2)}</td>
        <td>${r.fv.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td>
        <td>${r.totalContrib.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td>
        <td>${r.gross.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td>
        <td>${r.iofAmount.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td>
        <td>${r.irPct.toFixed(2)}%</td>
        <td>${r.irAmount.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td>
        <td><strong>${r.net.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</strong></td>
        <td>${r.realNet.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td>
      `;
      tableBody.appendChild(tr);
    });

    // simple bar chart
    const gap = 8;
    rows.forEach(r=>{
      const div = document.createElement('div');
      div.className = 'bar';
      const height = (r.net <= 0) ? 6 : Math.max(6, Math.round((r.net / maxNet) * 120));
      div.style.height = height + 'px';
      div.style.background = '#2b7a78';
      div.title = `${r.inst.name}: ${r.net.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}`;
      const label = document.createElement('div');
      label.style.fontSize = '0.8rem';
      label.style.marginTop = '6px';
      label.textContent = r.inst.name.split(' ')[0];
      div.appendChild(label);
      chartDiv.appendChild(div);
    });
  }

  // initial calc
  resetDefaults();
});
