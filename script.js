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

  document.getElementById("mentor-paste-form").addEventListener("submit", (event) => {
    event.preventDefault();
    importFromPaste("mentor-paste", "mentor");
  });

  document.getElementById("mentee-paste-form").addEventListener("submit", (event) => {
    event.preventDefault();
    importFromPaste("mentee-paste", "mentee");
  });

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
      profissao: (r["profissão"] || "").trim(),
      bairro: (r["bairro"] || "").trim(),
      signo: (r["signo"] || "").trim(),
      musica: (r["música"] || "").trim(),
      comunicacao: (r["comunicação"] || "").trim(),
      tempoLivre: (r["tempo livre"] || "").trim()
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
  const professionSimilarity = similarityByTokens(mentor.profissao, mentee.profissao);
  const neighborhoodSimilarity = scoreNeighborhood(mentor.bairro, mentee.bairro);
  const signSimilarity = scoreSign(mentor.signo, mentee.signo);
  const musicSimilarity = similarityByTokens(mentor.musica, mentee.musica);

  const byField = {
    profissao: round2(professionSimilarity * WEIGHTS.profissao),
    bairro: round2(neighborhoodSimilarity * WEIGHTS.bairro),
    signo: round2(signSimilarity * WEIGHTS.signo),
    musica: round2(musicSimilarity * WEIGHTS.musica)
  };

  const total = round2(byField.profissao + byField.bairro + byField.signo + byField.musica);
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
        <p><strong>Pontuação:</strong> ${match.score.total.toFixed(2)}%</p>
        <p><strong>Profissão (${WEIGHTS.profissao}%):</strong> ${safeValue(match.mentor.profissao)} ↔ ${safeValue(match.mentee.profissao)} = ${match.score.byField.profissao.toFixed(2)}%</p>
        <p><strong>Bairro (${WEIGHTS.bairro}%):</strong> ${safeValue(match.mentor.bairro)} ↔ ${safeValue(match.mentee.bairro)} = ${match.score.byField.bairro.toFixed(2)}%</p>
        <p><strong>Signo (${WEIGHTS.signo}%):</strong> ${safeValue(match.mentor.signo)} ↔ ${safeValue(match.mentee.signo)} = ${match.score.byField.signo.toFixed(2)}%</p>
        <p><strong>Música (${WEIGHTS.musica}%):</strong> ${safeValue(match.mentor.musica)} ↔ ${safeValue(match.mentee.musica)} = ${match.score.byField.musica.toFixed(2)}%</p>
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
      `${m.score.total.toFixed(2)}%`,
      `${m.score.byField.profissao.toFixed(2)}%`,
      `${m.score.byField.bairro.toFixed(2)}%`,
      `${m.score.byField.signo.toFixed(2)}%`,
      `${m.score.byField.musica.toFixed(2)}%`
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

function scoreNeighborhood(mentorBairro, menteeBairro) {
  const mentorNorm = normalizeText(mentorBairro);
  const menteeNorm = normalizeText(menteeBairro);

  if (!mentorNorm || !menteeNorm) return 0;
  if (mentorNorm === menteeNorm) return 1;

  const metroTerms = ["metropolitana", "regiao metropolitana", "rmf"];
  if ((metroTerms.some((term) => mentorNorm.includes(term)) && menteeNorm.includes("caucaia")) ||
      (metroTerms.some((term) => menteeNorm.includes(term)) && mentorNorm.includes("caucaia"))) {
    return 0.5;
  }

  return similarityByTokens(mentorNorm, menteeNorm);
}

function scoreSign(mentorSign, menteeSign) {
  const mentorNorm = normalizeText(mentorSign);
  const menteeNorm = normalizeText(menteeSign);
  if (!mentorNorm || !menteeNorm) return 0;
  return mentorNorm === menteeNorm ? 1 : 0;
}

function similarityByTokens(left, right) {
  const leftNorm = normalizeText(left);
  const rightNorm = normalizeText(right);
  if (!leftNorm || !rightNorm) return 0;
  if (leftNorm === rightNorm) return 1;

  const leftTokens = new Set(leftNorm.split(/\s+/).filter(Boolean));
  const rightTokens = new Set(rightNorm.split(/\s+/).filter(Boolean));
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return union === 0 ? 0 : intersection / union;
}

function safeValue(value) {
  return value && value.length ? value : "(não informado)";
}

function round2(value) {
  return Math.round(value * 100) / 100;
}
