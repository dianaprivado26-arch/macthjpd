const REQUIRED_FIELDS = [
  "nome completo",
  "profissão",
  "bairro",
  "signo",
  "música",
  "comunicação",
  "tempo livre"
];

const WEIGHTS = {
  profissao: 40,
  bairro: 30,
  signo: 15,
  musica: 15
};

let mentors = [];
let mentees = [];
let matches = [];

const ui = {
  mentorCount: document.getElementById("mentor-count"),
  menteeCount: document.getElementById("mentee-count"),
  matchCount: document.getElementById("match-count"),
  status: document.getElementById("status"),
  exportBtn: document.getElementById("export-match"),
  results: document.getElementById("match-results"),
  resetDialog: document.getElementById("confirm-reset")
};

setupTabs();
setupActions();
updateCounters();

function setupTabs() {
  const buttons = document.querySelectorAll(".tab-button");
  const contents = {
    padrinho: document.getElementById("tab-padrinho"),
    afilhado: document.getElementById("tab-afilhado"),
    guia: document.getElementById("tab-guia")
  };

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      buttons.forEach((b) => {
        b.classList.remove("active");
        b.setAttribute("aria-selected", "false");
      });
      Object.values(contents).forEach((c) => c.classList.remove("active"));
      button.classList.add("active");
      button.setAttribute("aria-selected", "true");
      contents[button.dataset.tab].classList.add("active");
    });
  });
}

function setupActions() {
  document.getElementById("import-mentor").addEventListener("click", () => importFromFile("mentor-file", "mentor"));
  document.getElementById("import-mentee").addEventListener("click", () => importFromFile("mentee-file", "mentee"));
  document.getElementById("import-mentor-paste").addEventListener("click", () => importFromPaste("mentor-paste", "mentor"));
  document.getElementById("import-mentee-paste").addEventListener("click", () => importFromPaste("mentee-paste", "mentee"));
  document.getElementById("run-match").addEventListener("click", runMatch);
  document.getElementById("export-match").addEventListener("click", exportMatches);
  document.getElementById("reset-match").addEventListener("click", () => ui.resetDialog.showModal());
  document.getElementById("confirm-no").addEventListener("click", () => ui.resetDialog.close());
  document.getElementById("confirm-yes").addEventListener("click", resetAll);
}

async function importFromFile(inputId, type) {
  const input = document.getElementById(inputId);
  const file = input.files?.[0];
  if (!file) {
    setStatus("Selecione um arquivo CSV antes de importar.");
    return;
  }

  const text = await file.text();
  importCsvText(text, type);
}

function importFromPaste(textareaId, type) {
  const text = document.getElementById(textareaId).value.trim();
  if (!text) {
    setStatus("Cole o conteúdo CSV para enviar.");
    return;
  }
  importCsvText(text, type);
}

function importCsvText(text, type) {
  try {
    const parsed = parseCsv(text);
    const normalized = normalizeRecords(parsed);
    if (type === "mentor") {
      mentors = mergeUniqueByName(mentors, normalized);
      setStatus(`Padrinhos importados com sucesso. Total atual: ${mentors.length}.`);
    } else {
      mentees = mergeUniqueByName(mentees, normalized);
      setStatus(`Afilhados importados com sucesso. Total atual: ${mentees.length}.`);
    }
    updateCounters();
  } catch (error) {
    setStatus(`Erro na importação: ${error.message}`);
  }
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    throw new Error("CSV deve ter cabeçalho e ao menos uma linha de dados.");
  }

  const headerLine = lines[0];
  const delimiter = (headerLine.match(/;/g) || []).length > (headerLine.match(/,/g) || []).length ? ";" : ",";
  const headers = headerLine.split(delimiter).map((h) => h.trim().toLowerCase());

  validateHeaders(headers);

  return lines.slice(1).map((line) => {
    const cols = line.split(delimiter).map((c) => c.trim());
    return headers.reduce((acc, header, index) => {
      acc[header] = cols[index] ?? "";
      return acc;
    }, {});
  });
}

function validateHeaders(headers) {
  const missing = REQUIRED_FIELDS.filter((field) => !headers.includes(field));
  if (missing.length) {
    throw new Error(`Campos obrigatórios ausentes: ${missing.join(", ")}.`);
  }
}

function normalizeRecords(records) {
  return records
    .map((r) => ({
      nome: (r["nome completo"] || "").trim(),
      profissao: normalizeText(r["profissão"]),
      bairro: normalizeText(r["bairro"]),
      signo: normalizeText(r["signo"]),
      musica: normalizeText(r["música"]),
      comunicacao: normalizeText(r["comunicação"]),
      tempoLivre: normalizeText(r["tempo livre"])
    }))
    .filter((r) => r.nome.length > 0);
}

function mergeUniqueByName(base, incoming) {
  const map = new Map(base.map((item) => [item.nome.toLowerCase(), item]));
  incoming.forEach((item) => {
    const key = item.nome.toLowerCase();
    if (!map.has(key)) map.set(key, item);
  });
  return Array.from(map.values());
}

function runMatch() {
  if (!mentors.length || !mentees.length) {
    setStatus("Carregue padrinhos e afilhados para gerar os matchs.");
    return;
  }

  const pairs = [];
  mentors.forEach((mentor) => {
    mentees.forEach((mentee) => {
      pairs.push({ mentor, mentee, score: scorePair(mentor, mentee) });
    });
  });

  pairs.sort((a, b) => b.score.total - a.score.total);

  const takenMentees = new Set();
  const mentorLoad = new Map(mentors.map((m) => [m.nome, 0]));
  const selected = [];

  for (const pair of pairs) {
    const mentorCount = mentorLoad.get(pair.mentor.nome) || 0;
    if (takenMentees.has(pair.mentee.nome) || mentorCount >= 6) continue;

    selected.push(pair);
    takenMentees.add(pair.mentee.nome);
    mentorLoad.set(pair.mentor.nome, mentorCount + 1);

    if (takenMentees.size === mentees.length) break;
  }

  matches = selected;
  renderMatches();
  updateCounters();
  ui.exportBtn.disabled = matches.length === 0;
  setStatus(`Matchs concluídos: ${matches.length} pares gerados com objetivo de 98% de assertividade.`);
}

function scorePair(mentor, mentee) {
  const byField = {
    profissao: mentor.profissao === mentee.profissao ? WEIGHTS.profissao : 0,
    bairro: mentor.bairro === mentee.bairro ? WEIGHTS.bairro : 0,
    signo: mentor.signo === mentee.signo ? WEIGHTS.signo : 0,
    musica: mentor.musica === mentee.musica ? WEIGHTS.musica : 0
  };

  const total = byField.profissao + byField.bairro + byField.signo + byField.musica;
  return { total, byField };
}

function renderMatches() {
  ui.results.innerHTML = "";
  if (!matches.length) {
    ui.results.innerHTML = "<p>Nenhum match gerado ainda.</p>";
    return;
  }

  const grouped = new Map();
  matches.forEach((match) => {
    if (!grouped.has(match.mentor.nome)) grouped.set(match.mentor.nome, []);
    grouped.get(match.mentor.nome).push(match);
  });

  Array.from(grouped.entries()).forEach(([mentorName, mentorMatches]) => {
    const card = document.createElement("article");
    card.className = "mentor-group";
    const title = document.createElement("h3");
    title.textContent = `${mentorName} (${mentorMatches.length}/6 afilhados)`;
    card.appendChild(title);

    mentorMatches.forEach((match) => {
      const item = document.createElement("div");
      item.className = "match-item";
      item.innerHTML = `
        <p><strong>Afilhado:</strong> ${match.mentee.nome}</p>
        <p><strong>Pontuação:</strong> ${match.score.total}%</p>
        <p><strong>Motivos (com peso):</strong>
        Profissão: ${match.score.byField.profissao}% ·
        Bairro: ${match.score.byField.bairro}% ·
        Signo: ${match.score.byField.signo}% ·
        Música: ${match.score.byField.musica}%</p>
      `;
      card.appendChild(item);
    });

    ui.results.appendChild(card);
  });
}

function exportMatches() {
  if (!matches.length) {
    setStatus("Não há matchs para exportar.");
    return;
  }

  const rows = [
    ["Padrinho", "Afilhado", "Pontuação", "Profissão", "Bairro", "Signo", "Música"],
    ...matches.map((m) => [
      m.mentor.nome,
      m.mentee.nome,
      `${m.score.total}%`,
      `${m.score.byField.profissao}%`,
      `${m.score.byField.bairro}%`,
      `${m.score.byField.signo}%`,
      `${m.score.byField.musica}%`
    ])
  ];

  const csv = rows.map((line) => line.join(";")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "matchs_ong.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function resetAll() {
  mentors = [];
  mentees = [];
  matches = [];
  ui.results.innerHTML = "";
  ui.exportBtn.disabled = true;
  updateCounters();
  setStatus("Dados e matchs reiniciados.");
  ui.resetDialog.close();
}

function updateCounters() {
  ui.mentorCount.textContent = mentors.length;
  ui.menteeCount.textContent = mentees.length;
  ui.matchCount.textContent = matches.length;
}

function setStatus(message) {
  ui.status.textContent = message;
}

function normalizeText(value = "") {
  return value
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
