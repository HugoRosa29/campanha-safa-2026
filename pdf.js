"use strict";

// ---------- Geração do relatório da gincana em PDF ----------
// Depende de jsPDF (window.jspdf) + plugin AutoTable e da logo (window.LOGO_SAFA),
// todos carregados no index.html.

// Paleta extraída da logo institucional Rede SAFA
const PDF_CORES = {
  azul: [50, 59, 141],
  azulEscuro: [36, 43, 105],
  azulClaro: [237, 239, 248],
  vermelho: [205, 41, 43],
  vermelhoEscuro: [185, 37, 40],
  vermelhoClaro: [253, 237, 237],
  verde: [21, 128, 61],
  verdeClaro: [236, 253, 243],
  texto: [40, 44, 52],
  suave: [107, 114, 128],
  linha: [222, 226, 232],
  fundo: [247, 248, 251],
  branco: [255, 255, 255],
  zebra: [250, 251, 253],
  prata: [231, 233, 238],
  bronze: [243, 235, 226],
};

const PDF_MARGEM = 12;
const PDF_ALTURA_CABECALHO = 28;
const PDF_LOGO_ALTURA = 13;

function pdfNum(v) {
  return Number(v || 0).toLocaleString("pt-BR");
}

function pdfDataHora() {
  const agora = new Date();
  const data = agora.toLocaleDateString("pt-BR");
  const hora = agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${data} às ${hora}`;
}

// Assinatura da marca: logo quando disponível, senão o logotipo em texto
function desenharLogo(doc, x, y, alturaDesejada) {
  const logo = window.LOGO_SAFA;
  if (logo && logo.dataUri) {
    const largura = alturaDesejada * (logo.largura / logo.altura);
    // o alias reaproveita a mesma imagem em todas as páginas
    doc.addImage(logo.dataUri, "PNG", x, y, largura, alturaDesejada, "logoSafa", "FAST");
    return largura;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(alturaDesejada * 0.9);
  doc.setTextColor(...PDF_CORES.azul);
  doc.text("SAFA", x, y + alturaDesejada);
  const larguraTexto = doc.getTextWidth("SAFA");
  doc.setFontSize(alturaDesejada * 0.34);
  doc.setTextColor(...PDF_CORES.vermelho);
  doc.text("REDE", x + 1, y + alturaDesejada * 0.42);
  return larguraTexto;
}

// Faixa superior, repetida em todas as páginas
function desenharCabecalho(doc, finalizada, emitidoEm) {
  const largura = doc.internal.pageSize.getWidth();

  doc.setFillColor(...PDF_CORES.branco);
  doc.rect(0, 0, largura, PDF_ALTURA_CABECALHO, "F");

  const larguraLogo = desenharLogo(doc, PDF_MARGEM, 7.5, PDF_LOGO_ALTURA);

  // Divisória vertical entre a logo e o título do documento
  const xTitulo = PDF_MARGEM + larguraLogo + 9;
  doc.setDrawColor(...PDF_CORES.linha);
  doc.setLineWidth(0.4);
  doc.line(xTitulo - 5, 7, xTitulo - 5, 21);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...PDF_CORES.azul);
  doc.text("GINCANA SAFA 2026", xTitulo, 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...PDF_CORES.suave);
  doc.text("Relatório de Ranking e Pontuação das Turmas", xTitulo, 19.5);

  // Selo de status, nas cores da marca
  const rotulo = finalizada ? "RESULTADO OFICIAL FINAL" : "APURAÇÃO PARCIAL";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  const larguraSelo = doc.getTextWidth(rotulo) + 11;
  const xSelo = largura - PDF_MARGEM - larguraSelo;
  doc.setFillColor(...(finalizada ? PDF_CORES.vermelho : PDF_CORES.azul));
  doc.roundedRect(xSelo, 7.5, larguraSelo, 8, 4, 4, "F");
  doc.setTextColor(...PDF_CORES.branco);
  doc.text(rotulo, xSelo + larguraSelo / 2, 13, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...PDF_CORES.suave);
  doc.text(`Emitido em ${emitidoEm}`, largura - PDF_MARGEM, 20, { align: "right" });

  // Régua bicolor: vermelho da chama + azul do logotipo
  doc.setFillColor(...PDF_CORES.vermelho);
  doc.rect(0, PDF_ALTURA_CABECALHO - 1.6, largura, 1.6, "F");
  doc.setFillColor(...PDF_CORES.azul);
  doc.rect(0, PDF_ALTURA_CABECALHO - 1.6, largura * 0.34, 1.6, "F");
}

// Rodapé numerado, aplicado no fim quando o total de páginas já é conhecido
function desenharRodapes(doc) {
  const total = doc.internal.getNumberOfPages();
  const largura = doc.internal.pageSize.getWidth();
  const altura = doc.internal.pageSize.getHeight();

  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setDrawColor(...PDF_CORES.linha);
    doc.setLineWidth(0.2);
    doc.line(PDF_MARGEM, altura - 12, largura - PDF_MARGEM, altura - 12);
    doc.setFillColor(...PDF_CORES.vermelho);
    doc.rect(PDF_MARGEM, altura - 12.4, 14, 0.8, "F");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...PDF_CORES.suave);
    doc.text(
      "Rede SAFA · documento gerado automaticamente pelo Sistema de Controle da Gincana SAFA 2026",
      PDF_MARGEM,
      altura - 7.5
    );

    doc.setFont("helvetica", "bold");
    doc.setTextColor(...PDF_CORES.azul);
    doc.text(`Página ${p} de ${total}`, largura - PDF_MARGEM, altura - 7.5, { align: "right" });
  }
}

function desenharCartoes(doc, y, cartoes) {
  const largura = doc.internal.pageSize.getWidth();
  const util = largura - PDF_MARGEM * 2;
  const espaco = 6;
  const larguraCartao = (util - espaco * (cartoes.length - 1)) / cartoes.length;
  const alturaCartao = 21;

  cartoes.forEach((cartao, i) => {
    const x = PDF_MARGEM + i * (larguraCartao + espaco);
    doc.setFillColor(...PDF_CORES.fundo);
    doc.setDrawColor(...PDF_CORES.linha);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, larguraCartao, alturaCartao, 2, 2, "FD");

    // faixa lateral azul, ecoando o logotipo
    doc.setFillColor(...PDF_CORES.azul);
    doc.rect(x, y + 3, 1.4, alturaCartao - 6, "F");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...PDF_CORES.suave);
    doc.text(cartao.rotulo.toUpperCase(), x + 6, y + 7.5);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(...PDF_CORES.azul);
    doc.text(cartao.valor, x + 6, y + 16.5);
  });

  return y + alturaCartao;
}

function desenharDestaque(doc, y, { titulo, texto, tom }) {
  const largura = doc.internal.pageSize.getWidth();
  const util = largura - PDF_MARGEM * 2;
  const positivo = tom === "campea";
  const corTom = positivo ? PDF_CORES.verde : PDF_CORES.vermelho;
  const corFundo = positivo ? PDF_CORES.verdeClaro : PDF_CORES.vermelhoClaro;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const linhas = doc.splitTextToSize(texto, util - 16);
  const altura = 10.5 + linhas.length * 4.6;

  doc.setFillColor(...corFundo);
  doc.setDrawColor(...corTom);
  doc.setLineWidth(0.3);
  doc.roundedRect(PDF_MARGEM, y, util, altura, 2, 2, "FD");
  doc.setFillColor(...corTom);
  doc.rect(PDF_MARGEM, y, 2, altura, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...corTom);
  doc.text(titulo, PDF_MARGEM + 7, y + 6.8);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...PDF_CORES.texto);
  doc.text(linhas, PDF_MARGEM + 7, y + 12.4);

  return y + altura;
}

function desenharTituloSecao(doc, y, titulo) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...PDF_CORES.azul);
  doc.text(titulo, PDF_MARGEM, y);
  doc.setFillColor(...PDF_CORES.vermelho);
  doc.rect(PDF_MARGEM, y + 1.6, 16, 0.9, "F");
  return y + 5;
}

function desenharRegulamento(doc, y, pontosPorItem) {
  const largura = doc.internal.pageSize.getWidth();
  const altura = doc.internal.pageSize.getHeight();

  // Quebra de página se o bloco inteiro não couber
  if (y + 62 > altura - 16) {
    doc.addPage();
    desenharCabecalho(doc, doc.__gincanaFinalizada, doc.__gincanaEmitidoEm);
    y = PDF_ALTURA_CABECALHO;
  }

  y = desenharTituloSecao(doc, y + 12, "Regulamento aplicado nesta apuração");

  const itens = Object.entries(pontosPorItem || {});
  const linhas = [];
  for (let i = 0; i < itens.length; i += 2) {
    const [nomeA, valorA] = itens[i];
    const par = itens[i + 1];
    linhas.push([nomeA, `${valorA[0]} pts`, par ? par[0] : "", par ? `${par[1][0]} pts` : ""]);
  }

  const larguraTabela = (largura - PDF_MARGEM * 2) * 0.6;

  doc.autoTable({
    startY: y + 2,
    head: [["Item doado", "Pontos", "Item doado", "Pontos"]],
    body: linhas,
    theme: "grid",
    margin: { left: PDF_MARGEM, right: PDF_MARGEM, bottom: 18 },
    tableWidth: larguraTabela,
    styles: {
      font: "helvetica",
      fontSize: 8,
      cellPadding: 2,
      lineColor: PDF_CORES.linha,
      lineWidth: 0.2,
      textColor: PDF_CORES.texto,
    },
    headStyles: {
      fillColor: PDF_CORES.azulClaro,
      textColor: PDF_CORES.azul,
      fontStyle: "bold",
      fontSize: 7.5,
    },
    columnStyles: {
      1: { halign: "right", fontStyle: "bold", cellWidth: 20, textColor: PDF_CORES.vermelho },
      3: { halign: "right", fontStyle: "bold", cellWidth: 20, textColor: PDF_CORES.vermelho },
    },
  });

  const xRegras = PDF_MARGEM + larguraTabela + 10;
  const larguraRegras = largura - PDF_MARGEM - xRegras;

  const regras = [
    "Agasalhos: são considerados no máximo 100 pontos válidos por turma; o excedente aparece apenas como pontuação bruta.",
    "Pontos nos Jogos: até 199 pts = 1 · 200 a 299 = 2 · 300 a 399 = 3 · 400 a 499 = 4 · 500 ou mais = 5. Turmas sem doação (ou com menos de 20 pontos) ficam zeradas.",
    "Prêmio principal: a turma líder só é declarada campeã ao atingir 60 cestas ou 700 pontos, recebendo 7 pontos nos Jogos e o passeio na chácara.",
    "Colocação: turmas com a mesma quantidade de Pts nos Jogos dividem a mesma posição, numerada por faixa (1º, 2º, 3º ...); a ordem interna segue a pontuação total e, depois, o número de cestas.",
  ];

  let yRegra = y + 6;
  doc.setFontSize(8);
  regras.forEach((regra) => {
    doc.setFillColor(...PDF_CORES.vermelho);
    doc.circle(xRegras + 0.8, yRegra - 1, 0.8, "F");
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...PDF_CORES.texto);
    const linhasRegra = doc.splitTextToSize(regra, larguraRegras - 5);
    doc.text(linhasRegra, xRegras + 4, yRegra);
    yRegra += linhasRegra.length * 3.9 + 2.6;
  });
}

// ---------- Entrada pública ----------
function gerarRelatorioPdf(ranking, opcoes) {
  const libs = window.jspdf;
  if (!libs || !libs.jsPDF) {
    alert(
      "Não foi possível carregar a biblioteca de PDF. Verifique a conexão com a internet e tente novamente."
    );
    return;
  }

  const { finalizada, unidadeFiltro, segmentoFiltro, pontosPorItem } = opcoes;
  const emitidoEm = pdfDataHora();

  const doc = new libs.jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  doc.__gincanaFinalizada = finalizada;
  doc.__gincanaEmitidoEm = emitidoEm;
  doc.setProperties({
    title: "Relatório da Gincana SAFA 2026",
    subject: finalizada ? "Resultado oficial final" : "Resultados parciais",
    author: "Rede SAFA — Sistema de Controle da Gincana SAFA 2026",
  });

  desenharCabecalho(doc, finalizada, emitidoEm);

  let y = PDF_ALTURA_CABECALHO + 9;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...PDF_CORES.suave);
  doc.text(
    `Filtros aplicados  ·  Unidade: ${unidadeFiltro}  ·  Segmento: ${segmentoFiltro}  ·  ${ranking.length} turma(s) apurada(s)`,
    PDF_MARGEM,
    y
  );

  const totalCestas = ranking.reduce((a, r) => a + r["Total Cestas"], 0);
  const ptsAlimentos = ranking.reduce((a, r) => a + r["Pts Alimentos"], 0);
  const ptsAgasalhos = ranking.reduce((a, r) => a + r["Pts Agasalhos (Max 100)"], 0);
  const pontuacaoGeral = ranking.reduce((a, r) => a + r["Pontuação Total"], 0);

  y = desenharCartoes(doc, y + 4, [
    { rotulo: "Total de cestas", valor: pdfNum(totalCestas) },
    { rotulo: "Pts alimentos", valor: pdfNum(ptsAlimentos) },
    { rotulo: "Pts agasalhos válidos", valor: pdfNum(ptsAgasalhos) },
    { rotulo: "Pontuação geral", valor: pdfNum(pontuacaoGeral) },
    { rotulo: "Turmas participantes", valor: pdfNum(ranking.length) },
  ]);

  const lider = ranking[0];
  if (finalizada && lider) {
    if (lider["Elegível Campeã"] === "SIM") {
      y = desenharDestaque(doc, y + 6, {
        tom: "campea",
        titulo: "TURMA CAMPEÃ DA GINCANA SAFA 2026",
        texto: `Turma ${lider.Turma} (${lider.Unidade} — ${lider.Segmento}), com ${pdfNum(
          lider["Pontuação Total"]
        )} pontos e ${pdfNum(
          lider["Total Cestas"]
        )} cestas. Premiação: 7 pontos nos Jogos e passeio na chácara.`,
      });
    } else {
      y = desenharDestaque(doc, y + 6, {
        tom: "alerta",
        titulo: "PRÊMIO PRINCIPAL NÃO CONCEDIDO",
        texto: `A turma ${lider.Turma} ficou em 1º lugar com ${pdfNum(
          lider["Pontuação Total"]
        )} pontos, porém nenhuma turma atingiu a meta mínima do regulamento (60 cestas ou 700 pontos).`,
      });
    }
  }

  y = desenharTituloSecao(doc, y + 11, "Ranking geral das turmas");

  const cabecalho = [
    "#",
    "Unidade",
    "Segmento",
    "Turma",
    "Cestas",
    "Pts alim.",
    "Pts agas.\n(máx 100)",
    "Agas.\nbrutos",
    "TOTAL",
    "Pts jogos",
    "Campeã?",
  ];

  const corpo = ranking.map((r) => [
    `${r["Posição"]}º`,
    r.Unidade,
    r.Segmento,
    r.Turma,
    pdfNum(r["Total Cestas"]),
    pdfNum(r["Pts Alimentos"]),
    pdfNum(r["Pts Agasalhos (Max 100)"]),
    pdfNum(r["Pts Brutos Agasalhos"]),
    pdfNum(r["Pontuação Total"]),
    pdfNum(r["Pts nos Jogos"]),
    r["Elegível Campeã"],
  ]);

  doc.autoTable({
    startY: y + 2,
    head: [cabecalho],
    body: corpo,
    theme: "grid",
    margin: { top: PDF_ALTURA_CABECALHO + 8, left: PDF_MARGEM, right: PDF_MARGEM, bottom: 18 },
    styles: {
      font: "helvetica",
      fontSize: 8,
      cellPadding: 2.2,
      overflow: "linebreak",
      lineColor: PDF_CORES.linha,
      lineWidth: 0.2,
      textColor: PDF_CORES.texto,
      valign: "middle",
    },
    headStyles: {
      fillColor: PDF_CORES.azul,
      textColor: PDF_CORES.branco,
      fontStyle: "bold",
      fontSize: 7.8,
      halign: "center",
      valign: "middle",
      lineColor: PDF_CORES.azulEscuro,
    },
    alternateRowStyles: { fillColor: PDF_CORES.zebra },
    columnStyles: {
      0: { cellWidth: 12, halign: "center", fontStyle: "bold" },
      1: { cellWidth: 32 },
      2: { cellWidth: 38 },
      3: { cellWidth: 32, fontStyle: "bold" },
      4: { cellWidth: 20, halign: "right" },
      5: { cellWidth: 22, halign: "right" },
      6: { cellWidth: 26, halign: "right" },
      7: { cellWidth: 24, halign: "right" },
      8: { cellWidth: 24, halign: "right", fontStyle: "bold" },
      9: { cellWidth: 20, halign: "center" },
      10: { cellWidth: 22, halign: "center", fontStyle: "bold" },
    },
    didParseCell: (dados) => {
      if (dados.section !== "body") return;
      const linha = dados.row.index;
      const coluna = dados.column.index;

      // Líder destacado na linha inteira; pódio marcado na coluna da posição
      if (linha === 0) dados.cell.styles.fillColor = PDF_CORES.azulClaro;
      if (coluna === 0) {
        if (linha === 0) {
          dados.cell.styles.fillColor = PDF_CORES.vermelho;
          dados.cell.styles.textColor = PDF_CORES.branco;
        } else if (linha === 1) {
          dados.cell.styles.fillColor = PDF_CORES.prata;
        } else if (linha === 2) {
          dados.cell.styles.fillColor = PDF_CORES.bronze;
        }
      }
      if (coluna === 8) dados.cell.styles.textColor = PDF_CORES.azul;
      if (coluna === 10) {
        dados.cell.styles.textColor =
          dados.cell.raw === "SIM" ? PDF_CORES.verde : PDF_CORES.suave;
      }
    },
    didDrawPage: () => desenharCabecalho(doc, finalizada, emitidoEm),
  });

  desenharRegulamento(doc, doc.lastAutoTable.finalY, pontosPorItem);
  desenharRodapes(doc);

  const carimbo = new Date().toISOString().slice(0, 10);
  doc.save(`Relatorio_${finalizada ? "Final" : "Parcial"}_Gincana_SAFA_2026_${carimbo}.pdf`);
}

window.gerarRelatorioPdf = gerarRelatorioPdf;
