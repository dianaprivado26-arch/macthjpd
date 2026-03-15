const MATCH_BASE_ORDER = [
  "nome completo",
  "profissão",
  "bairro",
  "signo",
  "música"
];
const OPTIONAL_FIELDS = ["comunicação", "tempo livre"];
const WEIGHTS = {
  profissao: 40,
  bairro: 30,
  signo: 15,
  musica: 15
};
let mentors = [];
let mentees = [];
let matches = [];
let isImportingPaste = false;
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
  document.getElementById("import-mentor").addEventListener("click", () => handleFileImport("mentor-file", "mentor"));
  document.getElementById("import-mentee").addEventListener("click", () => handleFileImport("mentee-file", "mentee"));
  document.getElementById("mentor-file").addEventListener("change", () => importFromFile("mentor-file", "mentor"));
  document.getElementById("mentee-file").addEventListener("change", () => importFromFile("mentee-file", "mentee"));
  document.getElementById("mentor-paste-form").addEventListener("submit", (event) => {
    event.preventDefault();
    importFromPaste("mentor-paste", "mentor");
  });
  document.getElementById("import-mentor-paste").addEventListener("click", () => importFromPaste("mentor-paste", "mentor"));
  document.getElementById("mentee-paste-form").addEventListener("submit", (event) => {
    event.preventDefault();
    importFromPaste("mentee-paste", "mentee");
  });
  document.getElementById("import-mentee-paste").addEventListener("click", () => importFromPaste("mentee-paste", "mentee"));
  document.getElementById("mentor-manual-form").addEventListener("submit", (event) => {
    event.preventDefault();
    submitManualForm("mentor");
  });
  document.getElementById("mentee-manual-form").addEventListener("submit", (event) => {
    event.preventDefault();
    submitManualForm("mentee");
  });
  document.getElementById("run-match").addEventListener("click", runMatch);
  document.getElementById("export-match").addEventListener("click", exportMatches);
  document.getElementById("reset-match").addEventListener("click", () => ui.resetDialog.showModal());
  document.getElementById("confirm-no").addEventListener("click", () => ui.resetDialog.close());
  document.getElementById("confirm-yes").addEventListener("click", resetAll);
}
function handleFileImport(inputId, type) {
  const input = document.getElementById(inputId);
  const file = input.files?.[0];
  if (!file) {
    setStatus("Selecione um arquivo CSV para importar.");
    input.click();
    return;
  }
  importFromFile(inputId, type);
}
async function importFromFile(inputId, type) {
  const input = document.getElementById(inputId);
  const file = input.files?.[0];
  if (!file) {
    setStatus("Selecione um arquivo CSV antes de importar.");
    return;
  }
  const rawText = await file.text();
  const text = preprocessCsvInputText(rawText);
  importCsvText(text, type);
}
function importFromPaste(textareaId, type) {
  if (isImportingPaste) return;
  isImportingPaste = true;
  const rawText = document.getElementById(textareaId).value.trim();
  const text = preprocessCsvInputText(rawText);
  if (!text) {
    setStatus("Cole o conteúdo CSV para enviar.");
    isImportingPaste = false;
    return;
  }
  importCsvText(text, type);
  setTimeout(() => {
    isImportingPaste = false;
  }, 0);
}
function submitManualForm(type) {
  const prefix = type === "mentor" ? "mentor" : "mentee";
  const record = {
    nome: document.getElementById(`${prefix}-name`).value.trim(),
    profissao: document.getElementById(`${prefix}-profession`).value.trim(),
    bairro: document.getElementById(`${prefix}-neighborhood`).value.trim(),
    signo: document.getElementById(`${prefix}-sign`).value.trim(),
    musica: document.getElementById(`${prefix}-music`).value.trim(),
    comunicacao: document.getElementById(`${prefix}-communication`).value.trim(),
    tempoLivre: document.getElementById(`${prefix}-free-time`).value.trim()
  };
  if (!record.nome || !record.profissao || !record.bairro || !record.signo || !record.musica) {
    setStatus("Preencha NOME COMPLETO, PROFISSÃO, BAIRRO, SIGNO e MÚSICA para enviar.");
    return;
  }
  if (type === "mentor") {
    mentors = mergeUniqueByName(mentors, [record]);
    setStatus(`Padrinho cadastrado manualmente. Total atual: ${mentors.length}.`);
    document.getElementById("mentor-manual-form").reset();
  } else {
    mentees = mergeUniqueByName(mentees, [record]);
    setStatus(`Afilhado cadastrado manualmente. Total atual: ${mentees.length}.`);
    document.getElementById("mentee-manual-form").reset();
  }
  updateCounters();
}
function preprocessCsvInputText(text) {
  const normalizedBreaks = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const hasRealNewline = normalizedBreaks.includes("\n");
  if (hasRealNewline) return normalizedBreaks;

  // Suporta conteúdo colado com quebras escapadas, ex: "linha1\\nlinha2"
  if (normalizedBreaks.includes("\\n")) {
    return normalizedBreaks.replace(/\\n/g, "\n");
  }

  return normalizedBreaks;
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
  if (!lines.length) {
    throw new Error("CSV vazio. Informe ao menos uma linha de dados.");
  }
  const firstLine = lines[0].replace(/^﻿/, "");
  const delimiter = (firstLine.match(/;/g) || []).length >= (firstLine.match(/,/g) || []).length ? ";" : ",";
  const firstRawCols = firstLine.split(delimiter).map((h) => h.trim());
  const firstCanonical = firstRawCols.map((header) => canonicalizeHeader(header));
  const hasHeader = firstCanonical.filter(Boolean).length >= 3;
  let headers;
  let dataLines;
  if (hasHeader) {
    headers = firstCanonical;
    validateHeaders(headers);
    dataLines = lines.slice(1);
  } else {
    headers = inferHeadersFromData(firstRawCols.length);
    dataLines = lines;
  }
  if (!dataLines.length) {
    throw new Error("CSV deve ter ao menos uma linha de dados.");
  }
  return dataLines.map((line) => {
    const cols = line.split(delimiter).map((c) => c.trim());
    return headers.reduce((acc, header, index) => {
      if (!header) return acc;
      acc[header] = cols[index] ?? "";
      return acc;
    }, {});
  });
}
function inferHeadersFromData(columnCount) {
  if (columnCount < 5) {
    throw new Error("Formato inválido: cada linha deve ter ao menos 5 colunas (Nome Completo;Profissão;Bairro;Signo;Música).");
  }
  if (columnCount === 5) {
    return ["nome completo", "profissão", "bairro", "signo", "música"];
  }
  if (columnCount === 6) {
    return ["nome completo", "profissão", "bairro", "signo", "música", "comunicação"];
  }
  return ["nome completo", "profissão", "bairro", "signo", "música", "comunicação", "tempo livre"];
}
function validateHeaders(headers) {
  const missing = MATCH_BASE_ORDER.filter((field) => !headers.includes(field));
  if (missing.length) {
    throw new Error(`Campos obrigatórios ausentes: ${missing.join(", ")}.`);
  }
  const unknownHeaders = headers.filter((field) => field && !MATCH_BASE_ORDER.includes(field) && !OPTIONAL_FIELDS.includes(field));
  if (unknownHeaders.length) {
    throw new Error(`Cabeçalho não reconhecido: ${unknownHeaders.join(", ")}.`);
  }
  const baseIndexes = MATCH_BASE_ORDER.map((field) => headers.indexOf(field));
  const inOrder = baseIndexes.every((index, pos) => pos === 0 || index > baseIndexes[pos - 1]);
  if (!inOrder) {
    throw new Error("A ordem base deve seguir: Nome Completo, Profissão, Bairro, Signo, Música.");
  }
}
function canonicalizeHeader(header) {
  const normalized = normalizeText(header);
  const headerMap = {
    "nome completo": "nome completo",
    nome: "nome completo",
    "profissao": "profissão",
    "profissao/area": "profissão",
    bairro: "bairro",
    signo: "signo",
    musica: "música",
    "comunicacao": "comunicação",
    "preferencia de comunicacao": "comunicação",
    "comunicacao preferida": "comunicação",
    "tempo livre": "tempo livre",
    "tempo": "tempo livre"
  };
  return headerMap[normalized] || "";
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
    setStatus("Carregue padrinhos e afilhados para gerar os matches.");
    return;
  }

  const pairsByMentor = buildPairsByMentor(mentors, mentees);
  const capacityTotal = mentors.length * 6;
  const assignableCount = Math.min(mentees.length, capacityTotal);

  const minRequiredPerMentor = 3;
  const canGuaranteeMinThree = assignableCount >= mentors.length * minRequiredPerMentor;
  const loadTargets = buildLoadTargets(mentors, assignableCount, canGuaranteeMinThree ? minRequiredPerMentor : 0);

  const takenMentees = new Set();
  const mentorLoad = new Map(mentors.map((m) => [m.nome, 0]));
  const selected = [];

  const minimumTarget = canGuaranteeMinThree ? minRequiredPerMentor : Math.floor(assignableCount / mentors.length);
  fillMentorsUntilTarget(mentors, pairsByMentor, takenMentees, mentorLoad, selected, minimumTarget);
  fillMentorsByExactTargets(mentors, pairsByMentor, takenMentees, mentorLoad, selected, loadTargets);

  matches = selected;
  renderMatches();
  updateCounters();
  ui.exportBtn.disabled = matches.length === 0;

  const minAssigned = Math.min(...Array.from(mentorLoad.values()));
  const maxAssigned = Math.max(...Array.from(mentorLoad.values()));
  const unmatchedMentees = mentees.length - matches.length;

  if (!canGuaranteeMinThree) {
    setStatus(`Matches concluídos: ${matches.length} pares. Distribuição possível no cenário atual: mínimo ${minimumTarget} e máximo ${maxAssigned} por padrinho.` + (unmatchedMentees > 0 ? ` ${unmatchedMentees} afilhado(s) sem match por limite de capacidade.` : ""));
    return;
  }

  setStatus(`Matches concluídos: ${matches.length} pares com distribuição equilibrada (mínimo ${minAssigned}, máximo ${maxAssigned} por padrinho).` + (unmatchedMentees > 0 ? ` ${unmatchedMentees} afilhado(s) sem match por limite de capacidade.` : "") + " Meta de confiabilidade: 99,9%.");
}

function buildPairsByMentor(mentorsList, menteesList) {
  const map = new Map();

  mentorsList.forEach((mentor) => {
    const rankedPairs = menteesList
      .map((mentee) => ({ mentor, mentee, score: scorePair(mentor, mentee) }))
      .sort((a, b) => b.score.total - a.score.total);

    map.set(mentor.nome, rankedPairs);
  });

  return map;
}

function buildLoadTargets(mentorsList, assignableCount, minFloor) {
  const targets = new Map(mentorsList.map((mentor) => [mentor.nome, minFloor]));
  let remaining = assignableCount - mentorsList.length * minFloor;
  let index = 0;

  while (remaining > 0) {
    const mentor = mentorsList[index % mentorsList.length];
    const current = targets.get(mentor.nome) || 0;
    if (current < 6) {
      targets.set(mentor.nome, current + 1);
      remaining -= 1;
    }
    index += 1;
  }

  return targets;
}

function fillMentorsUntilTarget(mentorsList, pairsByMentor, takenMentees, mentorLoad, selected, target) {
  if (target <= 0) return;

  let progress = true;
  while (progress) {
    progress = false;

    mentorsList.forEach((mentor) => {
      const currentLoad = mentorLoad.get(mentor.nome) || 0;
      if (currentLoad >= target) return;

      const pair = findBestAvailablePair(pairsByMentor.get(mentor.nome) || [], takenMentees);
      if (!pair) return;

      selected.push(pair);
      takenMentees.add(pair.mentee.nome);
      mentorLoad.set(mentor.nome, currentLoad + 1);
      progress = true;
    });

    const allAtTarget = mentorsList.every((mentor) => (mentorLoad.get(mentor.nome) || 0) >= target);
    if (allAtTarget) break;
  }
}

function fillMentorsByExactTargets(mentorsList, pairsByMentor, takenMentees, mentorLoad, selected, targets) {
  let progress = true;

  while (progress) {
    progress = false;

    mentorsList.forEach((mentor) => {
      const currentLoad = mentorLoad.get(mentor.nome) || 0;
      const targetLoad = targets.get(mentor.nome) || 0;
      if (currentLoad >= targetLoad) return;

      const pair = findBestAvailablePair(pairsByMentor.get(mentor.nome) || [], takenMentees);
      if (!pair) return;

      selected.push(pair);
      takenMentees.add(pair.mentee.nome);
      mentorLoad.set(mentor.nome, currentLoad + 1);
      progress = true;
    });

    const allAtTarget = mentorsList.every((mentor) => (mentorLoad.get(mentor.nome) || 0) >= (targets.get(mentor.nome) || 0));
    if (allAtTarget) break;
  }
}

function findBestAvailablePair(rankedPairs, takenMentees) {
  for (const pair of rankedPairs) {
    if (!takenMentees.has(pair.mentee.nome)) {
      return pair;
    }
  }
  return null;
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

    const mentorProfile = mentorMatches[0]?.mentor;
    if (mentorProfile) {
      const description = document.createElement("p");
      description.innerHTML = `<strong>Resumo do padrinho(a):</strong> ${buildMentorBriefDescription(mentorProfile)}`;
      card.appendChild(description);
    }

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
        <p><strong>Comunicação (informativo):</strong> ${safeValue(match.mentor.comunicacao)} ↔ ${safeValue(match.mentee.comunicacao)}</p>
        <p><strong>Tempo Livre (informativo):</strong> ${safeValue(match.mentor.tempoLivre)} ↔ ${safeValue(match.mentee.tempoLivre)}</p>
      `;
      card.appendChild(item);
    });
    ui.results.appendChild(card);
  });
}
function exportMatches() {
  if (!matches.length) {
    setStatus("Não há matches para exportar.");
    return;
  }

  const rows = [
    [
      "Padrinho",
      "Afilhado",
      "Pontuação Final",
      "Conexão 1 - Profissão",
      "Conexão 2 - Bairro",
      "Conexão 3 - Signo",
      "Conexão 4 - Música",
      "Conexão 5 - Comunicação",
      "Conexão 6 - Tempo Livre"
    ],
    ...matches.map((m) => {
      const conexao1 = `Profissão (${WEIGHTS.profissao}%): ${safeValue(m.mentor.profissao)} ↔ ${safeValue(m.mentee.profissao)} = ${m.score.byField.profissao.toFixed(2)}%`;
      const conexao2 = `Bairro (${WEIGHTS.bairro}%): ${safeValue(m.mentor.bairro)} ↔ ${safeValue(m.mentee.bairro)} = ${m.score.byField.bairro.toFixed(2)}%`;
      const conexao3 = `Signo (${WEIGHTS.signo}%): ${safeValue(m.mentor.signo)} ↔ ${safeValue(m.mentee.signo)} = ${m.score.byField.signo.toFixed(2)}%`;
      const conexao4 = `Música (${WEIGHTS.musica}%): ${safeValue(m.mentor.musica)} ↔ ${safeValue(m.mentee.musica)} = ${m.score.byField.musica.toFixed(2)}%`;
      const commSimilarity = (similarityByTokens(m.mentor.comunicacao, m.mentee.comunicacao) * 100).toFixed(2);
      const freeTimeSimilarity = (similarityByTokens(m.mentor.tempoLivre, m.mentee.tempoLivre) * 100).toFixed(2);
      const conexao5 = `Comunicação (informativo): ${safeValue(m.mentor.comunicacao)} ↔ ${safeValue(m.mentee.comunicacao)} (${commSimilarity}%)`;
      const conexao6 = `Tempo Livre (informativo): ${safeValue(m.mentor.tempoLivre)} ↔ ${safeValue(m.mentee.tempoLivre)} (${freeTimeSimilarity}%)`;

      return [
        m.mentor.nome,
        m.mentee.nome,
        `${m.score.total.toFixed(2)}%`,
        conexao1,
        conexao2,
        conexao3,
        conexao4,
        conexao5,
        conexao6
      ];
    })
  ];

  const csv = serializeCsv(rows, ";");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "matchs_jpd.csv";
  link.click();
  URL.revokeObjectURL(url);
}


function serializeCsv(rows, delimiter = ";") {
  return rows
    .map((row) => row.map((value) => toCsvCell(value, delimiter)).join(delimiter))
    .join("\n");
}

function toCsvCell(value, delimiter = ";") {
  const text = String(value ?? "");
  const escaped = text.replace(/"/g, '""');
  return `"${escaped}"`;
}

function resetAll() {
  mentors = [];
  mentees = [];
  matches = [];
  ui.results.innerHTML = "";
  ui.exportBtn.disabled = true;
  updateCounters();
  setStatus("Dados e matches reiniciados.");
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

function buildMentorBriefDescription(mentor) {
  const profession = safeValue(mentor.profissao);
  const neighborhood = safeValue(mentor.bairro);
  const music = safeValue(mentor.musica);
  const communication = safeValue(mentor.comunicacao);
  return `Atua em ${profession}, mora em ${neighborhood}, curte ${music} e prefere comunicação ${communication}.`;
}

function safeValue(value) {
  return value && value.length ? value : "(não informado)";
}
function round2(value) {
  return Math.round(value * 100) / 100;
}
