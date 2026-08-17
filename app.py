import streamlit as st
import pandas as pd

# Configuração da página
st.set_page_config(page_title="Gincana SAFA 2026 - Controle de Doações", layout="wide")

st.title("🏆 Gincana SAFA 2026 — Sistema de Controle e Ranking")
st.markdown("---")

# DICIONÁRIO DE PONTUAÇÃO (Regulamento)
# Abaixo desta pontuação a turma não pontua nos Jogos (sem doação ou apenas 1 cesta).
PONTUACAO_MINIMA_PARA_PONTUAR = 20

PONTOS_POR_ITEM = {
    "Cesta Básica": (10, 1),
    "Cesta Intermediária": (15, 1),
    "Cesta Completa": (20, 1),
    "Coberta/Cobertor": (5, 0),
    "Casaco/Calça Moletom": (4, 0),
    "Calça/Camisa Manga Longa": (3, 0),
    "Camisa Manga Curta/Bermuda": (2, 0),
    "Calçados (par)": (2, 0)
}

# --- LINHAS COM LINKS FIXOS (COLE SEUS LINKS AQUI DENTRO DAS ASPAS) ---
LINK_PADRAO_ASA_NORTE = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRWU0g72dH3E6mPhmenWZcmYXJK6VYeLVxYc8Uw15KNPqcJDVWr4qA9dbBHv-O_N4TlLHD6swdbh9Zd/pub?output=csv"
LINK_PADRAO_SOBRADINHO = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRYFYgVzNjqRGTyLIIKoMxFOL3uZZiW9kTjHB3swX2NqNvfQEHibORaS3bAzYYrcH1w4LqgCex0KYsD/pub?output=csv"

# --- MENU LATERAL ---
st.sidebar.header("🔗 Planilhas do Google")
url_asa_norte = st.sidebar.text_input("Link CSV - Asa Norte:", value=LINK_PADRAO_ASA_NORTE)
url_sobradinho = st.sidebar.text_input("Link CSV - Sobradinho:", value=LINK_PADRAO_SOBRADINHO)

st.sidebar.markdown("---")
st.sidebar.header("⚙️ Status da Gincana")
status_gincana = st.sidebar.radio(
    "Fase da Apuração:",
    ["🟢 Em Andamento (Resultados Parciais)", "🔴 Finalizada (Resultado Oficial Final)"]
)

btn_atualizar = st.sidebar.button("🔄 Atualizar / Recarregar Dados")

lista_dfs = []

# Leitura da planilha Asa Norte
if url_asa_norte and "COLE_AQUI" not in url_asa_norte:
    try:
        df_an = pd.read_csv(url_asa_norte)
        df_an.columns = df_an.columns.str.strip()
        lista_dfs.append(df_an)
    except Exception:
        st.sidebar.error("⚠️ Erro ao ler a planilha da Asa Norte.")

# Leitura da planilha Sobradinho
if url_sobradinho and "COLE_AQUI" not in url_sobradinho:
    try:
        df_sob = pd.read_csv(url_sobradinho)
        df_sob.columns = df_sob.columns.str.strip()
        lista_dfs.append(df_sob)
    except Exception:
        st.sidebar.error("⚠️ Erro ao ler a planilha de Sobradinho.")

# Processamento Integrado
if lista_dfs:
    df_raw = pd.concat(lista_dfs, ignore_index=True)
    
    # Limpeza rigorosa para evitar erro de ordenação (trata nulos e vazios)
    for col_texto in ['Turma', 'Unidade', 'Segmento']:
        if col_texto in df_raw.columns:
            df_raw[col_texto] = df_raw[col_texto].fillna("").astype(str).str.strip()
            # Se ficou em branco, marca como Não Informado
            df_raw[col_texto] = df_raw[col_texto].replace("", "Não Informado")

    # Garante remover linhas completamente vazias
    df_raw = df_raw[df_raw['Turma'] != "Não Informado"].copy()

    # BANNER DE STATUS
    if "Finalizada" in status_gincana:
        st.error("🔒 **GINCANA FINALIZADA — RESULTADO OFICIAL DEFINITIVO**")
    else:
        st.info("📊 **APURAÇÃO EM ANDAMENTO — RESULTADOS PARCIAIS**")

    # FILTROS
    col_f1, col_f2 = st.columns(2)
    with col_f1:
        unidades_disponiveis = ["Todas"] + sorted(list(df_raw["Unidade"].unique()))
        unidade_filtro = st.selectbox("Filtrar Unidade:", unidades_disponiveis)
    with col_f2:
        segmentos_disponiveis = ["Todos"] + sorted(list(df_raw["Segmento"].unique()))
        segmento_filtro = st.selectbox("Filtrar Segmento:", segmentos_disponiveis)

    df_filtered = df_raw.copy()
    if unidade_filtro != "Todas":
        df_filtered = df_filtered[df_filtered["Unidade"] == unidade_filtro]
    if segmento_filtro != "Todos":
        df_filtered = df_filtered[df_filtered["Segmento"] == segmento_filtro]

    # CÁLCULO DAS TURMAS
    resumo_turmas = []

    for key, group in df_filtered.groupby(["Unidade", "Segmento", "Turma"]):
        u, s, t = key
        
        total_cestas = 0
        pts_alimentos = 0
        pts_agasalhos_brutos = 0

        for col in group.columns:
            col_clean = col.strip()
            for item_nome, (pts_unit, eh_cesta) in PONTOS_POR_ITEM.items():
                if item_nome.lower() in col_clean.lower():
                    qtd = pd.to_numeric(group[col], errors='coerce').fillna(0).sum()
                    if eh_cesta == 1:
                        total_cestas += qtd
                        pts_alimentos += (qtd * pts_unit)
                    else:
                        pts_agasalhos_brutos += (qtd * pts_unit)

        # Aplicação das regras do regulamento
        pts_agasalhos_validos = min(pts_agasalhos_brutos, 100)
        pontos_totais = pts_alimentos + pts_agasalhos_validos

        # Tabela dos Jogos (turmas sem doação relevante ficam zeradas)
        if pontos_totais < PONTUACAO_MINIMA_PARA_PONTUAR:
            pts_jogos = 0
        elif pontos_totais <= 199:
            pts_jogos = 1
        elif pontos_totais <= 299:
            pts_jogos = 2
        elif pontos_totais <= 399:
            pts_jogos = 3
        elif pontos_totais <= 499:
            pts_jogos = 4
        else:
            pts_jogos = 5

        # Elegibilidade (60 cestas OU 700 pontos)
        elegivel_campea = total_cestas >= 60 or pontos_totais >= 700

        resumo_turmas.append({
            "Unidade": u,
            "Segmento": s,
            "Turma": t,
            "Total Cestas": int(total_cestas),
            "Pts Alimentos": int(pts_alimentos),
            "Pts Agasalhos (Max 100)": int(pts_agasalhos_validos),
            "Pts Brutos Agasalhos": int(pts_agasalhos_brutos),
            "Pontuação Total": int(pontos_totais),
            "Pts nos Jogos": pts_jogos,
            "Elegível Campeã": "SIM" if elegivel_campea else "NÃO"
        })

    if resumo_turmas:
        df_ranking = pd.DataFrame(resumo_turmas)
        df_ranking = df_ranking.sort_values(by=["Pontuação Total", "Total Cestas"], ascending=[False, False]).reset_index(drop=True)
        df_ranking.index += 1
        df_ranking.index.name = "Posição"

        # Atribuição de 7 pts para o Campeão Elegível
        if not df_ranking.empty and df_ranking.iloc[0]["Elegível Campeã"] == "SIM":
            df_ranking.loc[1, "Pts nos Jogos"] = 7

        # Colocação: turmas com os mesmos Pts nos Jogos dividem a mesma posição
        posicoes = []
        for i, pts in enumerate(df_ranking["Pts nos Jogos"].tolist()):
            if i > 0 and pts == df_ranking["Pts nos Jogos"].iloc[i - 1]:
                posicoes.append(posicoes[-1])
            else:
                posicoes.append(i + 1)
        df_ranking.index = pd.Index(posicoes, name="Posição")

        # MÉTRICAS
        m1, m2, m3, m4 = st.columns(4)
        m1.metric("📦 Total de Cestas", int(df_ranking["Total Cestas"].sum()))
        m2.metric("🧥 Pts Agasalhos Válidos", int(df_ranking["Pts Agasalhos (Max 100)"].sum()))
        m3.metric("🎯 Pontuação Geral", int(df_ranking["Pontuação Total"].sum()))
        m4.metric("🏫 Total de Turmas", len(df_ranking))

        st.markdown("### 🥇 Ranking das Turmas")
        st.dataframe(df_ranking, use_container_width=True)

        # LÍDER / CAMPEÃO
        lider = df_ranking.iloc[0]
        if "Finalizada" in status_gincana:
            if lider["Elegível Campeã"] == "SIM":
                st.balloons()
                st.success(f"🏆 **TURMA CAMPEÃ DA GINCANA SAFA 2026:** Turma **{lider['Turma']}** ({lider['Unidade']} - {lider['Segmento']}) com **{lider['Pontuação Total']} pontos**! Prêmio: 7 Pontos nos Jogos + Passeio na Chácara! 🎉")
            else:
                st.error(f"⚠️ A Turma **{lider['Turma']}** ficou em 1º lugar com {lider['Pontuação Total']} pts, mas NENHUMA turma atingiu a meta mínima (60 cestas ou 700 pts) para levar o prêmio principal do regulamento.")

        # --- ÁREA DE DOWNLOAD DO RELATÓRIO ---
        st.markdown("---")
        st.markdown("### 📥 Exportar Relatório Consolidado (Todas as Turmas)")
        
        csv_buffer = df_ranking.to_csv().encode('utf-8-sig')
        st.download_button(
            label="📄 Baixar Relatório Completo em Excel / CSV",
            data=csv_buffer,
            file_name="Relatorio_Final_Gincana_SAFA_2026.csv",
            mime="text/csv"
        )

else:
    st.info("👈 Insira os links CSV das planilhas no menu lateral para carregar os dados!")