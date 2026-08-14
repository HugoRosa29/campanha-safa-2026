"use strict";

// ---------- Regulamento: pontuação por item ----------
// [pontos por unidade, ehCesta (1 = conta como cesta/alimento, 0 = agasalho)]
const PONTOS_POR_ITEM = {
  "Cesta Básica": [10, 1],
  "Cesta Intermediária": [15, 1],
  "Cesta Completa": [20, 1],
  "Coberta/Cobertor": [5, 0],
  "Casaco/Calça Moletom": [4, 0],
  "Calça/Camisa Manga Longa": [3, 0],
  "Camisa Manga Curta/Bermuda": [2, 0],
  "Calçados (par)": [2, 0],
};

// ---------- Links padrão (edite aqui se quiser trocar o valor inicial) ----------
const LINK_PADRAO_ASA_NORTE =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRWU0g72dH3E6mPhmenWZcmYXJK6VYeLVxYc8Uw15KNPqcJDVWr4qA9dbBHv-O_N4TlLHD6swdbh9Zd/pub?output=csv";
const LINK_PADRAO_SOBRADINHO =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRYFYgVzNjqRGTyLIIKoMxFOL3uZZiW9kTjHB3swX2NqNvfQEHibORaS3bAzYYrcH1w4LqgCex0KYsD/pub?output=csv";

const STORAGE_KEY = "gincana-safa-2026-links";

// ---------- Estado ----------
let state = {
  unidadeFiltro: "Todas",
  segmentoFiltro: "Todos",
};

// ---------- Elementos ----------
const el = {
  urlAsaNorte: document.getElementById("urlAsaNorte"),
  urlSobradinho: document.getElementById("urlSobradinho"),
  btnAtualizar: document.getElementById("btnAtualizar"),
  alerts: document.getElementById("alerts"),
  content: document.getElementById("content"),
  sidebar: document.getElementById("sidebar"),
  sidebarToggle: document.getElementById("sidebarToggle"),
  sidebarOverlay: document.getElementById("sidebarOverlay"),
};

// ---------- Persistência simples dos links no navegador ----------
function loadSavedLinks() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    el.urlAsaNorte.value = saved.asaNorte || LINK_PADRAO_ASA_NORTE;
    el.urlSobradinho.value = saved.sobradinho || LINK_PADRAO_SOBRADINHO;
  } catch {
    el.urlAsaNorte.value = LINK_PADRAO_ASA_NORTE;
    el.urlSobradinho.value = LINK_PADRAO_SOBRADINHO;
  }
}

function saveLinks() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      asaNorte: el.urlAsaNorte.value.trim(),
      sobradinho: el.urlSobradinho.value.trim(),
    })
  );
}

// ---------- Sidebar mobile ----------
el.sidebarToggle.addEventListener("click", () => {
  el.sidebar.classList.toggle("open");
  el.sidebarOverlay.classList.toggle("open");
});
el.sidebarOverlay.addEventListener("click", () => {
  el.sidebar.classList.remove("open");
  el.sidebarOverlay.classList.remove("open");
});

// ---------- Utilidades ----------
function toNum(v) {
  if (v === null || v === undefined || v === "") return 0;
  const cleaned = String(v).trim().replace(",", ".");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

function cleanText(v) {
  const s = (v === null || v === undefined ? "" : String(v)).trim();
  return s === "" ? "Não Informado" : s;
}

function statusFinalizada() {
  const checked = document.querySelector('input[name="status"]:checked');
  return checked && checked.value === "final";
}

async function fetchCsv(url) {
  const bust = (url.includes("?") ? "&" : "?") + "_=" + Date.now();
  const res = await fetch(url + bust, { cache: "no-store" });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const text = await res.text();
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
  // normaliza cabeçalhos (trim), igual ao df.columns.str.strip() do pandas
  return parsed.data.map((row) => {
    const clean = {};
    for (const k in row) clean[(k || "").trim()] = row[k];
    return clean;
  });
}

// ---------- Carregamento e processamento ----------
async function carregarDados() {
  el.btnAtualizar.disabled = true;
  el.btnAtualizar.textContent = "⏳ Carregando...";
  el.alerts.innerHTML = "";
  el.content.innerHTML = `<div class="empty-state"><div class="spinner"></div><p>Carregando dados das planilhas...</p></div>`;

  const urlAsaNorte = el.urlAsaNorte.value.trim();
  const urlSobradinho = el.urlSobradinho.value.trim();
  const listaDfs = [];
  const erros = [];

  const jobs = [];
  if (urlAsaNorte && !urlAsaNorte.includes("COLE_AQUI")) {
    jobs.push(
      fetchCsv(urlAsaNorte)
        .then((rows) => listaDfs.push(...rows))
        .catch(() => erros.push("⚠️ Erro ao ler a planilha da Asa Norte."))
    );
  }
  if (urlSobradinho && !urlSobradinho.includes("COLE_AQUI")) {
    jobs.push(
      fetchCsv(urlSobradinho)
        .then((rows) => listaDfs.push(...rows))
        .catch(() => erros.push("⚠️ Erro ao ler a planilha de Sobradinho."))
    );
  }

  await Promise.all(jobs);

  if (erros.length) {
    el.alerts.innerHTML = erros
      .map((e) => `<div class="sidebar-error">${e}</div>`)
      .join("");
  }

  el.btnAtualizar.disabled = false;
  el.btnAtualizar.textContent = "🔄 Atualizar / Recarregar Dados";

  if (listaDfs.length === 0) {
    el.content.innerHTML = `<div class="empty-state"><p>👈 Insira os links CSV das planilhas no menu lateral para carregar os dados!</p></div>`;
    return;
  }

  processarERenderizar(listaDfs);
}

function processarERenderizar(rawRows) {
  // Limpeza rigorosa de Turma / Unidade / Segmento
  const rows = rawRows
    .map((r) => {
      const copy = { ...r };
      for (const col of ["Turma", "Unidade", "Segmento"]) {
        if (col in copy) copy[col] = cleanText(copy[col]);
      }
      return copy;
    })
    .filter((r) => (r.Turma ?? "Não Informado") !== "Não Informado");

  // Filtros disponíveis
  const unidades = ["Todas", ...uniqueSorted(rows.map((r) => r.Unidade))];
  const segmentos = ["Todos", ...uniqueSorted(rows.map((r) => r.Segmento))];

  const filtrado = rows.filter((r) => {
    if (state.unidadeFiltro !== "Todas" && r.Unidade !== state.unidadeFiltro) return false;
    if (state.segmentoFiltro !== "Todos" && r.Segmento !== state.segmentoFiltro) return false;
    return true;
  });

  const ranking = calcularRanking(filtrado);

  renderPagina({ unidades, segmentos, ranking });
}

function uniqueSorted(arr) {
  return [...new Set(arr.filter((v) => v !== undefined && v !== null))].sort((a, b) =>
    String(a).localeCompare(String(b), "pt-BR")
  );
}

function calcularRanking(rows) {
  // agrupa por Unidade + Segmento + Turma
  const grupos = new Map();
  for (const r of rows) {
    const key = [r.Unidade, r.Segmento, r.Turma].join("|||");
    if (!grupos.has(key)) grupos.set(key, []);
    grupos.get(key).push(r);
  }

  const resumo = [];
  for (const [key, group] of grupos) {
    const [u, s, t] = key.split("|||");

    let totalCestas = 0;
    let ptsAlimentos = 0;
    let ptsAgasalhosBrutos = 0;

    const colunas = Object.keys(group[0] || {});
    for (const col of colunas) {
      const colClean = col.trim().toLowerCase();
      for (const [itemNome, [ptsUnit, ehCesta]] of Object.entries(PONTOS_POR_ITEM)) {
        if (colClean.includes(itemNome.toLowerCase())) {
          const qtd = group.reduce((acc, row) => acc + toNum(row[col]), 0);
          if (ehCesta === 1) {
            totalCestas += qtd;
            ptsAlimentos += qtd * ptsUnit;
          } else {
            ptsAgasalhosBrutos += qtd * ptsUnit;
          }
        }
      }
    }

    const ptsAgasalhosValidos = Math.min(ptsAgasalhosBrutos, 100);
    const pontosTotais = ptsAlimentos + ptsAgasalhosValidos;

    let ptsJogos;
    if (pontosTotais <= 100) ptsJogos = 1;
    else if (pontosTotais <= 200) ptsJogos = 2;
    else if (pontosTotais <= 300) ptsJogos = 3;
    else if (pontosTotais <= 400) ptsJogos = 4;
    else ptsJogos = 5;

    const elegivelCampea = totalCestas >= 60 || pontosTotais >= 700;

    resumo.push({
      Unidade: u,
      Segmento: s,
      Turma: t,
      "Total Cestas": Math.trunc(totalCestas),
      "Pts Alimentos": Math.trunc(ptsAlimentos),
      "Pts Agasalhos (Max 100)": Math.trunc(ptsAgasalhosValidos),
      "Pts Brutos Agasalhos": Math.trunc(ptsAgasalhosBrutos),
      "Pontuação Total": Math.trunc(pontosTotais),
      "Pts nos Jogos": ptsJogos,
      "Elegível Campeã": elegivelCampea ? "SIM" : "NÃO",
    });
  }

  resumo.sort((a, b) => {
    if (b["Pontuação Total"] !== a["Pontuação Total"]) return b["Pontuação Total"] - a["Pontuação Total"];
    return b["Total Cestas"] - a["Total Cestas"];
  });

  if (resumo.length && resumo[0]["Elegível Campeã"] === "SIM") {
    resumo[0]["Pts nos Jogos"] = 7;
  }

  return resumo;
}

// ---------- Renderização ----------
function renderPagina({ unidades, segmentos, ranking }) {
  const finalizada = statusFinalizada();

  const bannerHtml = finalizada
    ? `<div class="banner error">🔒 <strong>GINCANA FINALIZADA — RESULTADO OFICIAL DEFINITIVO</strong></div>`
    : `<div class="banner info">📊 <strong>APURAÇÃO EM ANDAMENTO — RESULTADOS PARCIAIS</strong></div>`;

  if (ranking.length === 0) {
    el.content.innerHTML =
      bannerHtml +
      renderFiltros(unidades, segmentos) +
      `<div class="empty-state"><p>Nenhum dado encontrado para os filtros selecionados.</p></div>`;
    bindFiltroEvents();
    return;
  }

  const totalCestas = ranking.reduce((a, r) => a + r["Total Cestas"], 0);
  const ptsAgasalhos = ranking.reduce((a, r) => a + r["Pts Agasalhos (Max 100)"], 0);
  const pontuacaoGeral = ranking.reduce((a, r) => a + r["Pontuação Total"], 0);
  const totalTurmas = ranking.length;

  const metricsHtml = `
    <div class="metrics">
      <div class="metric-card"><div class="metric-label">📦 Total de Cestas</div><div class="metric-value">${totalCestas}</div></div>
      <div class="metric-card"><div class="metric-label">🧥 Pts Agasalhos Válidos</div><div class="metric-value">${ptsAgasalhos}</div></div>
      <div class="metric-card"><div class="metric-label">🎯 Pontuação Geral</div><div class="metric-value">${pontuacaoGeral}</div></div>
      <div class="metric-card"><div class="metric-label">🏫 Total de Turmas</div><div class="metric-value">${totalTurmas}</div></div>
    </div>`;

  const cols = [
    "Posição",
    "Unidade",
    "Segmento",
    "Turma",
    "Total Cestas",
    "Pts Alimentos",
    "Pts Agasalhos (Max 100)",
    "Pts Brutos Agasalhos",
    "Pontuação Total",
    "Pts nos Jogos",
    "Elegível Campeã",
  ];

  const rowsHtml = ranking
    .map((r, i) => {
      const cells = cols
        .map((c) => {
          if (c === "Posição") return `<td>${i + 1}</td>`;
          if (c === "Elegível Campeã") {
            const yes = r[c] === "SIM";
            return `<td><span class="badge ${yes ? "yes" : "no"}">${r[c]}</span></td>`;
          }
          return `<td>${r[c]}</td>`;
        })
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  const tableHtml = `
    <h3 class="section-title">🥇 Ranking das Turmas</h3>
    <div class="table-wrap">
      <table class="ranking">
        <thead><tr>${cols.map((c) => `<th>${c}</th>`).join("")}</tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>`;

  let liderHtml = "";
  if (finalizada) {
    const lider = ranking[0];
    if (lider["Elegível Campeã"] === "SIM") {
      liderHtml = `<div class="banner success">🏆 <strong>TURMA CAMPEÃ DA GINCANA SAFA 2026:</strong> Turma <strong>${lider.Turma}</strong> (${lider.Unidade} - ${lider.Segmento}) com <strong>${lider["Pontuação Total"]} pontos</strong>! Prêmio: 7 Pontos nos Jogos + Passeio na Chácara! 🎉</div>`;
    } else {
      liderHtml = `<div class="banner error">⚠️ A Turma <strong>${lider.Turma}</strong> ficou em 1º lugar com ${lider["Pontuação Total"]} pts, mas NENHUMA turma atingiu a meta mínima (60 cestas ou 700 pts) para levar o prêmio principal do regulamento.</div>`;
    }
  }

  const exportHtml = `
    <div class="export-section">
      <h3 class="section-title">📥 Exportar Relatório Consolidado (Todas as Turmas)</h3>
      <div class="export-buttons">
        <button id="btnPdf" class="btn-pdf">🖨️ Emitir Relatório em PDF</button>
        <button id="btnDownload" class="btn-download">📄 Baixar Relatório Completo em CSV</button>
      </div>
      <p class="export-hint">O PDF traz cabeçalho oficial, indicadores gerais, ranking completo e o regulamento aplicado${finalizada ? ", além do destaque da turma campeã" : " (marcado como apuração parcial)"}.</p>
    </div>`;

  el.content.innerHTML =
    bannerHtml +
    renderFiltros(unidades, segmentos) +
    metricsHtml +
    tableHtml +
    liderHtml +
    exportHtml +
    `<footer class="site-footer">Gincana SAFA 2026 · dados atualizados a partir das planilhas do Google Sheets</footer>`;

  bindFiltroEvents();

  document.getElementById("btnDownload").addEventListener("click", () => {
    baixarCsv(ranking, cols);
  });

  document.getElementById("btnPdf").addEventListener("click", (e) => {
    const btn = e.currentTarget;
    const rotulo = btn.textContent;
    btn.disabled = true;
    btn.textContent = "⏳ Gerando PDF...";
    // deixa o navegador pintar o estado de carregamento antes de montar o documento
    setTimeout(() => {
      try {
        gerarRelatorioPdf(ranking, {
          finalizada,
          unidadeFiltro: state.unidadeFiltro,
          segmentoFiltro: state.segmentoFiltro,
          pontosPorItem: PONTOS_POR_ITEM,
        });
      } catch (err) {
        console.error(err);
        alert("Não foi possível gerar o PDF. Tente novamente.");
      } finally {
        btn.disabled = false;
        btn.textContent = rotulo;
      }
    }, 30);
  });
}

function renderFiltros(unidades, segmentos) {
  return `
    <div class="filters">
      <div class="filter-field">
        <label for="filtroUnidade">Filtrar Unidade</label>
        <select id="filtroUnidade">
          ${unidades.map((u) => `<option value="${u}" ${u === state.unidadeFiltro ? "selected" : ""}>${u}</option>`).join("")}
        </select>
      </div>
      <div class="filter-field">
        <label for="filtroSegmento">Filtrar Segmento</label>
        <select id="filtroSegmento">
          ${segmentos.map((s) => `<option value="${s}" ${s === state.segmentoFiltro ? "selected" : ""}>${s}</option>`).join("")}
        </select>
      </div>
    </div>`;
}

function bindFiltroEvents() {
  const selU = document.getElementById("filtroUnidade");
  const selS = document.getElementById("filtroSegmento");
  if (selU)
    selU.addEventListener("change", (e) => {
      state.unidadeFiltro = e.target.value;
      carregarDados();
    });
  if (selS)
    selS.addEventListener("change", (e) => {
      state.segmentoFiltro = e.target.value;
      carregarDados();
    });
}

function baixarCsv(ranking, cols) {
  const header = cols.join(",");
  const linhas = ranking.map((r, i) =>
    cols
      .map((c) => {
        const val = c === "Posição" ? i + 1 : r[c];
        const str = String(val ?? "");
        return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
      })
      .join(",")
  );
  const csv = "﻿" + [header, ...linhas].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "Relatorio_Final_Gincana_SAFA_2026.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---------- Eventos globais ----------
el.btnAtualizar.addEventListener("click", () => {
  saveLinks();
  state.unidadeFiltro = "Todas";
  state.segmentoFiltro = "Todos";
  carregarDados();
});

document.querySelectorAll('input[name="status"]').forEach((r) =>
  r.addEventListener("change", carregarDados)
);

// ---------- Atualização automática ----------
const AUTO_REFRESH_MS = 5 * 60 * 1000; // 5 minutos

setInterval(() => {
  if (!el.btnAtualizar.disabled) carregarDados();
}, AUTO_REFRESH_MS);

// ---------- Inicialização ----------
loadSavedLinks();
carregarDados();
