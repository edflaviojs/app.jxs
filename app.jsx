import { FaWhatsapp } from "react-icons/fa";
import React, { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import LeadForm from "./components/LeadForm";
import Papa from "papaparse";
import Painel from "./components/Painel";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";


function App() {
  const handleChecklistChange = (leadId, etapaIdx) => {
    setLeads((prevLeads) =>
      prevLeads.map((lead) => {
        if (lead.id === leadId) {
          const novoChecklist = lead.checklist.map((item, idx) =>
            idx === etapaIdx ? { ...item, concluido: !item.concluido } : item,
          );
          return { ...lead, checklist: novoChecklist };
        }
        return lead;
      }),
    );
  };

  const exportarCSV = () => {
    const csv = Papa.unparse(leads); // ou leadsFiltrados, se preferir exportar os filtrados
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "leads.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const templates = [
    "Olá, ${nome}! Tudo bem? Vim lembrar do seu aniversário!",
    "Olá, ${nome}! Sua renovação está chegando, posso ajudar?",
    "Parabéns pela sua conquista, ${nome}! Conte sempre comigo.",
    "Olá, ${nome}! Estou à disposição para tirar dúvidas sobre sua proposta.",
    "Temos uma oferta especial para você este mês, ${nome}!",
  ];
  const [mensagemCopiada, setMensagemCopiada] = useState(null);

  // Autenticação
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [authMsg, setAuthMsg] = useState("");

  // Leads e formulário
  const [leads, setLeads] = useState([]);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [produto, setProduto] = useState("");
  const [etiqueta, setEtiqueta] = useState("quente");
  const [observacoes, setObservacoes] = useState("");
  const [aniversario, setAniversario] = useState("");
  const [renovacaoCredito, setRenovacaoCredito] = useState("");
  const [followup, setFollowup] = useState("");
  const [documentacaoPendente, setDocumentacaoPendente] = useState(true);
  const [propostaEnviadaEm, setPropostaEnviadaEm] = useState("");
  const [propostaRespondida, setPropostaRespondida] = useState(false);
  const [posVendaEm, setPosVendaEm] = useState("");
  const [ofertaEspecialEm, setOfertaEspecialEm] = useState("");
  const [mensagemTipo, setMensagemTipo] = useState("");
  const [indicacaoPendente, setIndicacaoPendente] = useState(true);
  const [mensagem, setMensagem] = useState("");
  const [editando, setEditando] = useState(null);
  // Produtos dinâmicos
  const [produtos, setProdutos] = useState([]);
  const [novoProduto, setNovoProduto] = useState("");
  const [editandoProduto, setEditandoProduto] = useState(null);
  const [nomeEditandoProduto, setNomeEditandoProduto] = useState("");

  // Filtros e automações
  const [busca, setBusca] = useState("");
  const [filtroEtiqueta, setFiltroEtiqueta] = useState("");
  const [diasSemContato, setDiasSemContato] = useState(3);
  const [diasSemResposta, setDiasSemResposta] = useState(3);
  const [diasInativo, setDiasInativo] = useState(7);
  const [diasParaFrio, setDiasParaFrio] = useState(10);
  const [leadSelecionado, setLeadSelecionado] = useState(null);
  const theme = createTheme({
    palette: {
      primary: { main: "#1976d2" },
      secondary: { main: "#ff9800" },
    },
    typography: {
      fontFamily: "Inter, Roboto, Arial, sans-serif",
    },
  });


  // --- Autenticação
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
    supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session) setLeads([]);
    });
  }, []);

  useEffect(() => {
    if (user) {
      buscarLeads();
      buscarProdutos();
    }
  }, [user]);

  // --- Automação: muda etiqueta para "frio" se lead não responde em X dias
  useEffect(() => {
    leads.forEach(async (lead) => {
      if (
        lead.etiqueta !== "frio" &&
        lead.ultimo_contato &&
        Math.floor(
          (new Date() - new Date(lead.ultimo_contato)) / (1000 * 60 * 60 * 24),
        ) >= diasParaFrio
      ) {
        await supabase
          .from("leads")
          .update({ etiqueta: "frio" })
          .eq("id", lead.id)
          .eq("user_id", user.id);
        buscarLeads();
      }
    });
    // eslint-disable-next-line
  }, [leads, diasParaFrio]);

  async function buscarLeads() {
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .eq("user_id", user.id);
    if (error) setMensagem("Erro ao buscar leads: " + error.message);
    else setLeads(data);
  }

  // --- Login, cadastro, logout
  async function login(e) {
    e.preventDefault();
    setAuthMsg("Entrando...");
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });
    if (error) setAuthMsg("Erro: " + error.message);
    else setAuthMsg("");
  }
  async function cadastro(e) {
    e.preventDefault();
    setAuthMsg("Cadastrando...");
    const { error } = await supabase.auth.signUp({
      email,
      password: senha,
    });
    if (error) setAuthMsg("Erro: " + error.message);
    else setAuthMsg("Cadastro realizado! Verifique seu e-mail.");
  }
  async function logout() {
    await supabase.auth.signOut();
    setUser(null);
    setLeads([]);
  }

  // --- Cadastrar ou editar lead
  async function salvarLead(e) {
    e.preventDefault();
    if (!user) return;
    const agora = new Date().toISOString();
    if (editando) {
      const { data: leadAtual } = await supabase
        .from("leads")
        .select("historico")
        .eq("id", editando)
        .single();

      const novoHistorico = [
        ...(leadAtual?.historico || []),
        {
          acao: "Lead editado",
          usuario: user.email,
          data: agora,
          detalhes: "Alteração de dados",
        },
      ];

      const { error } = await supabase
        .from("leads")
        .update({
          nome,
          telefone,
          produto,
          etiqueta,
          observacoes,
          aniversario: aniversario || null,
          renovacao_credito: renovacaoCredito || null,
          followup: followup || null,
          documentacao_pendente: documentacaoPendente,
          proposta_enviada_em: propostaEnviadaEm || null,
          proposta_respondida: propostaRespondida,
          pos_venda_em: posVendaEm || null,
          oferta_especial_em: ofertaEspecialEm || null,
          mensagem_tipo: mensagemTipo,
          indicacao_pendente: indicacaoPendente,
          ultimo_contato: agora,
          historico: novoHistorico,
        })
        .eq("id", editando)
        .eq("user_id", user.id);
      if (error) setMensagem("Erro ao editar: " + error.message);
      else {
        setMensagem("Lead editado com sucesso!");
        limparFormulario();
        buscarLeads();
      }
    } else {
      const { error } = await supabase.from("leads").insert([
        {
          nome,
          telefone,
          produto,
          etiqueta,
          observacoes,
          aniversario: aniversario || null,
          renovacao_credito: renovacaoCredito || null,
          followup: followup || null,
          documentacao_pendente: documentacaoPendente,
          proposta_enviada_em: propostaEnviadaEm || null,
          proposta_respondida: propostaRespondida,
          pos_venda_em: posVendaEm || null,
          oferta_especial_em: ofertaEspecialEm || null,
          mensagem_tipo: mensagemTipo,
          indicacao_pendente: indicacaoPendente,
          user_id: user.id,
          ultimo_contato: agora,
          checklist: [
            { etapa: "Contato inicial", concluido: false },
            { etapa: "Proposta enviada", concluido: false },
            { etapa: "Proposta aceita", concluido: false },
            { etapa: "Contrato assinado", concluido: false },
          ],
          historico: [
            {
              acao: "Lead criado",
              usuario: user.email,
              data: new Date().toISOString(),
              detalhes: "",
            },
          ],
        },
      ]);
      if (error) setMensagem("Erro ao cadastrar: " + error.message);
      else {
        setMensagem("Lead cadastrado com sucesso!");
        limparFormulario();
        buscarLeads();
      }
    }
  }

  function limparFormulario() {
    setNome("");
    setTelefone("");
    setProduto("");
    setEtiqueta("quente");
    setObservacoes("");
    setAniversario("");
    setRenovacaoCredito("");
    setFollowup("");
    setDocumentacaoPendente(true);
    setPropostaEnviadaEm("");
    setPropostaRespondida(false);
    setPosVendaEm("");
    setOfertaEspecialEm("");
    setMensagemTipo("");
    setIndicacaoPendente(true);
    setEditando(null);
  }

  function corEtiqueta(etq) {
    if (etq === "quente") return "red";
    if (etq === "morno") return "orange";
    return "blue";
  }

  function editarLead(lead) {
    setNome(lead.nome);
    setTelefone(lead.telefone);
    setProduto(lead.produto);
    setEtiqueta(lead.etiqueta);
    setObservacoes(lead.observacoes || "");
    setAniversario(lead.aniversario || "");
    setRenovacaoCredito(lead.renovacao_credito || "");
    setFollowup(lead.followup || "");
    setDocumentacaoPendente(lead.documentacao_pendente ?? true);
    setPropostaEnviadaEm(lead.proposta_enviada_em || "");
    setPropostaRespondida(!!lead.proposta_respondida);
    setPosVendaEm(lead.pos_venda_em || "");
    setOfertaEspecialEm(lead.oferta_especial_em || "");
    setMensagemTipo(lead.mensagem_tipo || "");
    setIndicacaoPendente(lead.indicacao_pendente ?? true);
    setEditando(lead.id);
    setMensagem("");
  }

  async function excluirLead(id) {
    if (!window.confirm("Tem certeza que deseja excluir?")) return;
    const { error } = await supabase
      .from("leads")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) setMensagem("Erro ao excluir: " + error.message);
    else {
      setMensagem("Lead excluído!");
      buscarLeads();
    }
  }

  // Buscar produtos do usuário logado
  async function buscarProdutos() {
    if (!user) return;
    const { data, error } = await supabase
      .from("produtos")
      .select("*")
      .eq("user_id", user.id)
      .order("nome", { ascending: true });
    if (!error) setProdutos(data);
  }

  // Criar produto
  async function criarProduto(e) {
    e.preventDefault();
    if (!novoProduto.trim()) return;
    const { error } = await supabase
      .from("produtos")
      .insert([{ nome: novoProduto.trim(), user_id: user.id }]);
    if (!error) {
      setNovoProduto("");
      buscarProdutos();
    }
  }

  // Editar produto
  async function salvarEdicaoProduto(e) {
    e.preventDefault();
    if (!nomeEditandoProduto.trim()) return;
    const { error } = await supabase
      .from("produtos")
      .update({ nome: nomeEditandoProduto.trim() })
      .eq("id", editandoProduto)
      .eq("user_id", user.id);
    if (!error) {
      setEditandoProduto(null);
      setNomeEditandoProduto("");
      buscarProdutos();
    }
  }

  // Excluir produto
  async function excluirProduto(id) {
    if (!window.confirm("Excluir este produto?")) return;
    const { error } = await supabase
      .from("produtos")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);
    if (!error) buscarProdutos();
  }

  // --- Filtros e lembretes
  const leadsFiltrados = leads.filter((lead) => {
    const nomeMatch = lead.nome?.toLowerCase().includes(busca.toLowerCase());
    const etiquetaMatch = filtroEtiqueta
      ? lead.etiqueta === filtroEtiqueta
      : true;
    return nomeMatch && etiquetaMatch;
  });

  function diasDesde(dateStr) {
    if (!dateStr) return 9999;
    const data = new Date(dateStr);
    const agora = new Date();
    return Math.floor((agora - data) / (1000 * 60 * 60 * 24));
  }

  // Lembretes
  const docsPendentes = leadsFiltrados.filter(
    (lead) => lead.documentacao_pendente,
  );
  const propostasNaoRespondidas = leadsFiltrados.filter((lead) => {
    if (!lead.proposta_enviada_em || lead.proposta_respondida) return false;
    return diasDesde(lead.proposta_enviada_em) >= diasSemResposta;
  });
  const leadsInativos = leadsFiltrados.filter(
    (lead) => diasDesde(lead.ultimo_contato) >= diasInativo,
  );
  const aniversariantesHoje = leadsFiltrados.filter((lead) => {
    if (!lead.aniversario) return false;
    const hoje = new Date();
    const data = new Date(lead.aniversario);
    return (
      data.getDate() === hoje.getDate() && data.getMonth() === hoje.getMonth()
    );
  });
  const renovacoesHoje = leadsFiltrados.filter((lead) => {
    if (!lead.renovacao_credito) return false;
    const hoje = new Date();
    const data = new Date(lead.renovacao_credito);
    return (
      data.getFullYear() <= hoje.getFullYear() &&
      (data.getMonth() < hoje.getMonth() ||
        (data.getMonth() === hoje.getMonth() &&
          data.getDate() <= hoje.getDate()))
    );
  });
  const followupsHoje = leadsFiltrados.filter((lead) => {
    if (!lead.followup) return false;
    const hoje = new Date();
    const data = new Date(lead.followup);
    return (
      data.getFullYear() <= hoje.getFullYear() &&
      (data.getMonth() < hoje.getMonth() ||
        (data.getMonth() === hoje.getMonth() &&
          data.getDate() <= hoje.getDate()))
    );
  });
  // Pós-venda: lembrete X dias após venda
  const posVendasHoje = leadsFiltrados.filter((lead) => {
    if (!lead.pos_venda_em) return false;
    return diasDesde(lead.pos_venda_em) >= 7 && lead.indicacao_pendente; // Exemplo: 7 dias
  });
  // Oferta especial: lembrete na data marcada
  const ofertasHoje = leadsFiltrados.filter((lead) => {
    if (!lead.oferta_especial_em) return false;
    const hoje = new Date();
    const data = new Date(lead.oferta_especial_em);
    return (
      data.getDate() === hoje.getDate() &&
      data.getMonth() === hoje.getMonth() &&
      data.getFullYear() === hoje.getFullYear()
    );
  });

  // Mensagens automáticas sugeridas
  function mensagemAutomatica(tipo, nome) {
    switch (tipo) {
      case "pós-venda":
        return `Olá ${nome}, tudo bem? Só passando para saber se está satisfeito com nosso serviço. Se precisar de algo, conte comigo!`;
      case "aniversário":
        return `Parabéns, ${nome}! Muita saúde e sucesso. Conte sempre comigo para o que precisar!`;
      case "renovação":
        return `Olá ${nome}, lembrei que sua renovação está próxima. Quer aproveitar uma condição especial?`;
      case "indicação":
        return `Oi ${nome}, ficou satisfeito? Indique um amigo e ganhe benefícios!`;
      case "oferta":
        return `Olá ${nome}, tenho uma oferta especial para você hoje!`;
      default:
        return "";
    }
  }

  // --- TELA DE LOGIN/CADASTRO
  if (!user) {
    return (
      <div
        style={{ maxWidth: 400, margin: "40px auto", fontFamily: "sans-serif" }}
      >
        <h1>Login</h1>
        <form onSubmit={login} style={{ marginBottom: 16 }}>
          <input
            type="email"
            placeholder="Seu e-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: "100%", marginBottom: 8, padding: 8 }}
          />
          <input
            type="password"
            placeholder="Senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
            style={{ width: "100%", marginBottom: 8, padding: 8 }}
          />
          <button type="submit" style={{ width: "100%", padding: 10 }}>
            Entrar
          </button>
        </form>
        <form onSubmit={cadastro}>
          <h2 style={{ fontSize: 18, margin: "16px 0 8px" }}>
            Ou cadastre-se:
          </h2>
          <input
            type="email"
            placeholder="Seu e-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: "100%", marginBottom: 8, padding: 8 }}
          />
          <input
            type="password"
            placeholder="Senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
            style={{ width: "100%", marginBottom: 8, padding: 8 }}
          />
          <button type="submit" style={{ width: "100%", padding: 10 }}>
            Cadastrar
          </button>
        </form>
        {authMsg && <div style={{ marginTop: 20 }}>{authMsg}</div>}
      </div>
    );
  }

  // --- TELA PRINCIPAL
  return (
    <div
      style={{ maxWidth: 470, margin: "40px auto", fontFamily: "sans-serif" }}
    >
      <hr
        style={{ margin: "32px 0", border: 0, borderTop: "2px solid #eee" }}
      />

      <div
        style={{
          margin: "24px 0",
          padding: 16,
          border: "1px solid #eee",
          borderRadius: 8,
          background: "#fafafa",
        }}
      >
        <h2>Produtos cadastrados</h2>
        <p style={{ color: "#666", fontSize: 14, marginBottom: 8 }}>
          Aqui você pode adicionar, editar ou excluir os produtos disponíveis
          para leads.
        </p>
        <form
          onSubmit={editandoProduto ? salvarEdicaoProduto : criarProduto}
          style={{ display: "flex", gap: 8, marginBottom: 12 }}
        >
          <input
            type="text"
            placeholder="Nome do produto"
            value={editandoProduto ? nomeEditandoProduto : novoProduto}
            onChange={(e) =>
              editandoProduto
                ? setNomeEditandoProduto(e.target.value)
                : setNovoProduto(e.target.value)
            }
            required
            style={{ flex: 1, padding: 8 }}
          />
          <button type="submit" style={{ padding: "8px 16px" }}>
            {editandoProduto ? "Salvar" : "Adicionar"}
          </button>
          {editandoProduto && (
            <button
              type="button"
              onClick={() => {
                setEditandoProduto(null);
                setNomeEditandoProduto("");
              }}
            >
              Cancelar
            </button>
          )}
        </form>
        <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
          {produtos.map((prod) => (
            <li key={prod.id} style={{ marginBottom: 4 }}>
              {editandoProduto === prod.id ? (
                <b>Editando...</b>
              ) : (
                <>
                  {prod.nome}
                  <button
                    style={{ marginLeft: 8 }}
                    onClick={() => {
                      setEditandoProduto(prod.id);
                      setNomeEditandoProduto(prod.nome);
                    }}
                  >
                    Editar
                  </button>
                  <button
                    style={{ marginLeft: 4, color: "red" }}
                    onClick={() => excluirProduto(prod.id)}
                  >
                    Excluir
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      </div>
      <Painel leads={leads} />
      <LeadForm
        nome={nome}
        setNome={setNome}
        telefone={telefone}
        setTelefone={setTelefone}
        produto={produto}
        setProduto={setProduto}
        etiqueta={etiqueta}
        setEtiqueta={setEtiqueta}
        observacoes={observacoes}
        setObservacoes={setObservacoes}
        aniversario={aniversario}
        setAniversario={setAniversario}
        renovacaoCredito={renovacaoCredito}
        setRenovacaoCredito={setRenovacaoCredito}
        followup={followup}
        setFollowup={setFollowup}
        propostaEnviadaEm={propostaEnviadaEm}
        setPropostaEnviadaEm={setPropostaEnviadaEm}
        propostaRespondida={propostaRespondida}
        setPropostaRespondida={setPropostaRespondida}
        posVendaEm={posVendaEm}
        setPosVendaEm={setPosVendaEm}
        ofertaEspecialEm={ofertaEspecialEm}
        setOfertaEspecialEm={setOfertaEspecialEm}
        mensagemTipo={mensagemTipo}
        setMensagemTipo={setMensagemTipo}
        documentacaoPendente={documentacaoPendente}
        setDocumentacaoPendente={setDocumentacaoPendente}
        indicacaoPendente={indicacaoPendente}
        setIndicacaoPendente={setIndicacaoPendente}
        editando={editando}
        limparFormulario={limparFormulario}
        salvarLead={salvarLead}
        produtos={produtos}
      />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h1>Leads</h1>
        <button onClick={logout}>Sair</button>
      </div>
      <div
        style={{
          margin: "24px 0",
          padding: 16,
          border: "1px solid #eee",
          borderRadius: 8,
          background: "#fafafa",
        }}
      >
        <h2>Produtos</h2>
        <form
          onSubmit={editandoProduto ? salvarEdicaoProduto : criarProduto}
          style={{ display: "flex", gap: 8, marginBottom: 12 }}
        >
          <input
            type="text"
            placeholder="Nome do produto"
            value={editandoProduto ? nomeEditandoProduto : novoProduto}
            onChange={(e) =>
              editandoProduto
                ? setNomeEditandoProduto(e.target.value)
                : setNovoProduto(e.target.value)
            }
            required
            style={{ flex: 1, padding: 8 }}
          />
          <button type="submit" style={{ padding: "8px 16px" }}>
            {editandoProduto ? "Salvar" : "Adicionar"}
          </button>
          {editandoProduto && (
            <button
              type="button"
              onClick={() => {
                setEditandoProduto(null);
                setNomeEditandoProduto("");
              }}
            >
              Cancelar
            </button>
          )}
        </form>
        <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
          {produtos.map((prod) => (
            <li key={prod.id} style={{ marginBottom: 4 }}>
              {editandoProduto === prod.id ? (
                <b>Editando...</b>
              ) : (
                <>
                  {prod.nome}
                  <button
                    style={{ marginLeft: 8 }}
                    onClick={() => {
                      setEditandoProduto(prod.id);
                      setNomeEditandoProduto(prod.nome);
                    }}
                  >
                    Editar
                  </button>
                  <button
                    style={{ marginLeft: 4, color: "red" }}
                    onClick={() => excluirProduto(prod.id)}
                  >
                    Excluir
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* Busca e filtro */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Buscar por nome"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          style={{ flex: 2, padding: 8 }}
        />
        <select
          value={filtroEtiqueta}
          onChange={(e) => setFiltroEtiqueta(e.target.value)}
          style={{ flex: 1, padding: 8 }}
        >
          <option value="">Todas</option>
          <option value="quente">Quente</option>
          <option value="morno">Morno</option>
          <option value="frio">Frio</option>
        </select>
      </div>

      {/* Lembretes principais */}
      {/* Pós-venda */}
      <div
        style={{
          background: "#e0ffe0",
          padding: 12,
          borderRadius: 6,
          marginBottom: 8,
        }}
      >
        <b>🤝 Pós-venda (após 7 dias da venda):</b>
        {posVendasHoje.length === 0 ? (
          <span style={{ marginLeft: 8 }}>Nenhum lembrete de pós-venda!</span>
        ) : (
          <ul style={{ margin: "8px 0 0 0", padding: 0, listStyle: "none" }}>
            {posVendasHoje.map((lead) => (
              <li key={lead.id}>
                <b>{lead.nome}</b> ({lead.telefone}) - Venda:{" "}
                {lead.pos_venda_em
                  ? new Date(lead.pos_venda_em).toLocaleDateString()
                  : "Sem data"}
                <br />
                <span style={{ color: "#333", fontSize: 13 }}>
                  Mensagem sugerida:{" "}
                  <i>{mensagemAutomatica("pós-venda", lead.nome)}</i>
                </span>
                <button
                  onClick={async () => {
                    await supabase
                      .from("leads")
                      .update({ indicacao_pendente: false })
                      .eq("id", lead.id)
                      .eq("user_id", user.id);
                    buscarLeads();
                  }}
                  style={{
                    marginLeft: 8,
                    background: "#4caf50",
                    color: "#fff",
                    border: "none",
                    borderRadius: 4,
                    padding: "4px 10px",
                    cursor: "pointer",
                  }}
                >
                  Marcar pós-venda feita
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Oferta especial */}
      <div
        style={{
          background: "#fff0c2",
          padding: 12,
          borderRadius: 6,
          marginBottom: 8,
        }}
      >
        <b>🎁 Ofertas especiais do dia:</b>
        {ofertasHoje.length === 0 ? (
          <span style={{ marginLeft: 8 }}>Nenhuma oferta especial hoje!</span>
        ) : (
          <ul style={{ margin: "8px 0 0 0", padding: 0, listStyle: "none" }}>
            {ofertasHoje.map((lead) => (
              <li key={lead.id}>
                <b>{lead.nome}</b> ({lead.telefone}) - Oferta para hoje!
                <br />
                <span style={{ color: "#333", fontSize: 13 }}>
                  Mensagem sugerida:{" "}
                  <i>{mensagemAutomatica("oferta", lead.nome)}</i>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Leads inativos */}
      <div
        style={{
          background: "#f0eaff",
          padding: 12,
          borderRadius: 6,
          marginBottom: 8,
        }}
      >
        <b>🛑 Leads inativos há mais de</b>
        <input
          type="number"
          min={1}
          value={diasInativo}
          onChange={(e) => setDiasInativo(Number(e.target.value))}
          style={{ width: 40, margin: "0 8px", textAlign: "center" }}
        />
        <b>dias:</b>
        {leadsInativos.length === 0 ? (
          <span style={{ marginLeft: 8 }}>Nenhum lead inativo!</span>
        ) : (
          <ul style={{ margin: "8px 0 0 0", padding: 0, listStyle: "none" }}>
            {leadsInativos.map((lead) => (
              <li key={lead.id}>
                <b>{lead.nome}</b> ({lead.telefone}) - Último contato:{" "}
                {lead.ultimo_contato
                  ? new Date(lead.ultimo_contato).toLocaleDateString()
                  : "Nunca"}
                <br />
                <span style={{ color: "#333", fontSize: 13 }}>
                  Mensagem sugerida:{" "}
                  <i>{mensagemAutomatica("indicação", lead.nome)}</i>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Propostas não respondidas */}
      <div
        style={{
          background: "#ffeaea",
          padding: 12,
          borderRadius: 6,
          marginBottom: 8,
        }}
      >
        <b>📬 Propostas não respondidas há mais de</b>
        <input
          type="number"
          min={1}
          value={diasSemResposta}
          onChange={(e) => setDiasSemResposta(Number(e.target.value))}
          style={{ width: 40, margin: "0 8px", textAlign: "center" }}
        />
        <b>dias:</b>
        {propostasNaoRespondidas.length === 0 ? (
          <span style={{ marginLeft: 8 }}>
            Nenhuma proposta pendente de resposta!
          </span>
        ) : (
          <ul style={{ margin: "8px 0 0 0", padding: 0, listStyle: "none" }}>
            {propostasNaoRespondidas.map((lead) => (
              <li key={lead.id}>
                <b>{lead.nome}</b> ({lead.telefone}) - Proposta enviada em:{" "}
                {lead.proposta_enviada_em
                  ? new Date(lead.proposta_enviada_em).toLocaleDateString()
                  : "Sem data"}
                <button
                  onClick={async () => {
                    await supabase
                      .from("leads")
                      .update({ proposta_respondida: true })
                      .eq("id", lead.id)
                      .eq("user_id", user.id);
                    buscarLeads();
                  }}
                  style={{
                    marginLeft: 8,
                    background: "#4caf50",
                    color: "#fff",
                    border: "none",
                    borderRadius: 4,
                    padding: "4px 10px",
                    cursor: "pointer",
                  }}
                >
                  Marcar como respondida
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Documentação pendente */}
      <div
        style={{
          background: "#ffeedd",
          padding: 12,
          borderRadius: 6,
          marginBottom: 8,
        }}
      >
        <b>📄 Leads com documentação pendente:</b>
        {docsPendentes.length === 0 ? (
          <span style={{ marginLeft: 8 }}>
            Nenhum lead com documentação pendente!
          </span>
        ) : (
          <ul style={{ margin: "8px 0 0 0", padding: 0, listStyle: "none" }}>
            {docsPendentes.map((lead) => (
              <li key={lead.id}>
                <b>{lead.nome}</b> ({lead.telefone}){" "}
                <button
                  onClick={async () => {
                    await supabase
                      .from("leads")
                      .update({ documentacao_pendente: false })
                      .eq("id", lead.id)
                      .eq("user_id", user.id);
                    buscarLeads();
                  }}
                  style={{
                    marginLeft: 8,
                    background: "#4caf50",
                    color: "#fff",
                    border: "none",
                    borderRadius: 4,
                    padding: "4px 10px",
                    cursor: "pointer",
                  }}
                >
                  Marcar como recebido
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Aniversariantes */}
      <div
        style={{
          background: "#e5ffe5",
          padding: 12,
          borderRadius: 6,
          marginBottom: 8,
        }}
      >
        <b>🎉 Aniversariantes de hoje:</b>
        {aniversariantesHoje.length === 0 ? (
          <span style={{ marginLeft: 8 }}>
            Nenhum lead faz aniversário hoje.
          </span>
        ) : (
          <ul style={{ margin: "8px 0 0 0", padding: 0, listStyle: "none" }}>
            {aniversariantesHoje.map((lead) => (
              <li key={lead.id}>
                <b>{lead.nome}</b> ({lead.telefone}) - Parabéns! 🎂
                <br />
                <span style={{ color: "#333", fontSize: 13 }}>
                  Mensagem sugerida:{" "}
                  <i>{mensagemAutomatica("aniversário", lead.nome)}</i>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Renovação de crédito */}
      <div
        style={{
          background: "#e5f1ff",
          padding: 12,
          borderRadius: 6,
          marginBottom: 8,
        }}
      >
        <b>💳 Renovação de crédito hoje ou atrasada:</b>
        {renovacoesHoje.length === 0 ? (
          <span style={{ marginLeft: 8 }}>Nenhuma renovação pendente!</span>
        ) : (
          <ul style={{ margin: "8px 0 0 0", padding: 0, listStyle: "none" }}>
            {renovacoesHoje.map((lead) => (
              <li key={lead.id}>
                <b>{lead.nome}</b> ({lead.telefone}) - Renovar crédito:{" "}
                {lead.renovacao_credito
                  ? new Date(lead.renovacao_credito).toLocaleDateString()
                  : "Sem data"}
                <br />
                <span style={{ color: "#333", fontSize: 13 }}>
                  Mensagem sugerida:{" "}
                  <i>{mensagemAutomatica("renovação", lead.nome)}</i>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Follow-up */}
      <div
        style={{
          background: "#fffbe5",
          padding: 12,
          borderRadius: 6,
          marginBottom: 8,
        }}
      >
        <b>📞 Follow-ups agendados para hoje ou atrasados:</b>
        {followupsHoje.length === 0 ? (
          <span style={{ marginLeft: 8 }}>Nenhum follow-up pendente!</span>
        ) : (
          <ul style={{ margin: "8px 0 0 0", padding: 0, listStyle: "none" }}>
            {followupsHoje.map((lead) => (
              <li key={lead.id}>
                <b>{lead.nome}</b> ({lead.telefone}) - Follow-up:{" "}
                {lead.followup
                  ? new Date(lead.followup).toLocaleDateString()
                  : "Sem data"}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Leads sem contato há X dias */}
      <div
        style={{
          background: "#ffe5e5",
          padding: 12,
          borderRadius: 6,
          marginBottom: 16,
        }}
      >
        <b>Leads sem contato há</b>
        <input
          type="number"
          min={1}
          value={diasSemContato}
          onChange={(e) => setDiasSemContato(Number(e.target.value))}
          style={{ width: 40, margin: "0 8px", textAlign: "center" }}
        />
        <b>dias:</b>
        {leadsFiltrados.filter(
          (lead) => diasDesde(lead.ultimo_contato) >= diasSemContato,
        ).length === 0 ? (
          <span style={{ marginLeft: 8 }}>Nenhum lead sem contato!</span>
        ) : (
          <ul style={{ margin: "8px 0 0 0", padding: 0, listStyle: "none" }}>
            {leadsFiltrados
              .filter(
                (lead) => diasDesde(lead.ultimo_contato) >= diasSemContato,
              )
              .map((lead) => (
                <li key={lead.id}>
                  <b>{lead.nome}</b> ({lead.telefone}) - Último contato:{" "}
                  {lead.ultimo_contato
                    ? new Date(lead.ultimo_contato).toLocaleDateString()
                    : "Nunca"}
                </li>
              ))}
          </ul>
        )}
      </div>

      {mensagem && <div style={{ marginBottom: 20 }}>{mensagem}</div>}
      <h2>Leads cadastrados</h2>

      <button
        onClick={exportarCSV}
        style={{ marginBottom: 16, fontWeight: "bold" }}
      >
        Exportar para CSV
      </button>

      <ul>
        {leadsFiltrados.map((lead) => (
          <li
            key={lead.id}
            style={{
              marginBottom: 12,
              cursor: "pointer",
              background:
                leadSelecionado === lead.id ? "#f0f8ff" : "transparent",
              borderRadius: 6,
              transition: "background 0.2s",
            }}
            onClick={() =>
              setLeadSelecionado(leadSelecionado === lead.id ? null : lead.id)
            }
          >
            <b>{lead.nome}</b> - {lead.telefone}
            <a
              href={`https://wa.me/${lead.telefone.replace(/\D/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                marginLeft: 8,
                background: "#25D366",
                color: "#fff",
                padding: "6px 10px",
                borderRadius: 4,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              onClick={(e) => e.stopPropagation()} // Não fecha histórico ao clicar no botão
            >
              <FaWhatsapp size={20} />
            </a>
            {" - "}
            {lead.produto} -{" "}
            <span
              style={{ color: corEtiqueta(lead.etiqueta), fontWeight: "bold" }}
            >
              {lead.etiqueta}
            </span>
            <br />
            <span style={{ fontSize: 13, color: "#555" }}>
              {lead.observacoes}
            </span>
            <br />
            <span style={{ fontSize: 12, color: "#888" }}>
              Último contato:{" "}
              {lead.ultimo_contato
                ? new Date(lead.ultimo_contato).toLocaleDateString()
                : "Nunca"}
              {lead.aniversario
                ? " | Aniversário: " +
                  new Date(lead.aniversario).toLocaleDateString()
                : ""}
              {lead.renovacao_credito
                ? " | Renovação: " +
                  new Date(lead.renovacao_credito).toLocaleDateString()
                : ""}
              {lead.followup
                ? " | Follow-up: " +
                  new Date(lead.followup).toLocaleDateString()
                : ""}
              {lead.proposta_enviada_em
                ? " | Proposta enviada: " +
                  new Date(lead.proposta_enviada_em).toLocaleDateString()
                : ""}
              {lead.proposta_respondida ? " | Proposta respondida" : ""}
              {lead.pos_venda_em
                ? " | Pós-venda: " +
                  new Date(lead.pos_venda_em).toLocaleDateString()
                : ""}
              {lead.oferta_especial_em
                ? " | Oferta especial: " +
                  new Date(lead.oferta_especial_em).toLocaleDateString()
                : ""}
              {lead.documentacao_pendente ? " | 📄 Documentação pendente" : ""}
              {lead.indicacao_pendente ? " | Indicação pendente" : ""}
            </span>
            <br />
            <button
              onClick={(e) => {
                e.stopPropagation();
                editarLead(lead);
              }}
              style={{ marginRight: 8 }}
            >
              Editar
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                excluirLead(lead.id);
              }}
              style={{ color: "red" }}
            >
              Excluir
            </button>
            <div style={{ marginTop: 8 }}>
              <b>Checklist de Venda:</b>
              {lead.checklist &&
                lead.checklist.map((item, idx) => (
                  <label
                    key={idx}
                    style={{ display: "block", fontSize: 13, marginLeft: 8 }}
                  >
                    <input
                      type="checkbox"
                      checked={item.concluido}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleChecklistChange(lead.id, idx);
                      }}
                      style={{ marginRight: 4 }}
                    />
                    {item.etapa}
                  </label>
                ))}
            </div>
            <div style={{ marginTop: 8 }}>
              {templates.map((msg, i) => (
                <button
                  key={i}
                  onClick={(e) => {
                    e.stopPropagation();
                    const mensagemPersonalizada = msg.replace(
                      /\$\{nome\}/g,
                      lead.nome,
                    );
                    navigator.clipboard.writeText(mensagemPersonalizada);
                    setMensagemCopiada(i);
                    setTimeout(() => setMensagemCopiada(null), 1500);
                  }}
                  style={{
                    marginRight: 6,
                    marginBottom: 4,
                    fontSize: 12,
                    padding: "4px 8px",
                  }}
                >
                  Copiar mensagem {i + 1}
                  {mensagemCopiada === i && (
                    <span
                      style={{
                        marginLeft: 8,
                        color: "#25D366",
                        fontWeight: "bold",
                      }}
                    >
                      Mensagem copiada!
                    </span>
                  )}
                </button>
              ))}
            </div>
            {/* Histórico de Interações - só aparece se for o lead selecionado */}
            {leadSelecionado === lead.id &&
              lead.historico &&
              lead.historico.length > 0 && (
                <div
                  style={{
                    background: "#f9f9f9",
                    border: "1px solid #eee",
                    borderRadius: 8,
                    marginTop: 10,
                    padding: "8px 14px",
                    fontSize: 14,
                  }}
                >
                  <strong>Histórico de Interações:</strong>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {lead.historico.map((item, idx) => (
                      <li key={idx}>
                        <b>{item.acao}</b>
                        {" em "}
                        {new Date(item.data).toLocaleString("pt-BR")}
                        {" por "}
                        {item.usuario}
                        {item.detalhes && <> - {item.detalhes}</>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
          </li>
        ))}
      </ul>
      {leadsFiltrados.length === 0 && <div>Nenhum lead encontrado.</div>}
    </div>
  );
}

export default App;


