// ═══════════════════════════════════════
//   CHEMSAFE AI — APP.JS
//   Chat  — chỉ dùng dữ liệu local trong chemdata.js, không gọi API
// ═══════════════════════════════════════


// ── Lịch sử hội thoại ──
let conversationHistory = [];

// ── THÍ NGHIỆM MÔ PHỎNG ──
const EXPERIMENT_DATABASE = {
  "fe|cuso4": {
    title: "Thí nghiệm: Đinh sắt + dung dịch CuSO₄",
    src: "experiments/fe-cuso4.html"
  }
};

// ═══════════════════════════════════════
//   LỚP HỌC ĐANG CHỌN (toàn app)
//   "all" = tất cả (lớp 6–12 + Nâng cao); 6..12 = chỉ nhận diện chất
//   đã học từ lớp 6 tới lớp đó (dữ liệu CHEM_GRADES trong chemdata.js)
// ═══════════════════════════════════════
const GRADE_NUMBERS = [6, 7, 8, 9, 10, 11, 12];
let currentGrade = "all";
try {
  const saved = localStorage.getItem("chemsafe-grade");
  if (saved && GRADE_NUMBERS.includes(Number(saved))) currentGrade = Number(saved);
} catch (e) { /* trình duyệt chặn localStorage → dùng mặc định */ }

function parseGrade(value) {
  const n = Number(value);
  return GRADE_NUMBERS.includes(n) ? n : "all";
}

// Chất có thuộc phạm vi lớp đang chọn không (học ở lớp ≤ lớp đã chọn)
function isChemInGrade(chem, grade = currentGrade) {
  if (grade === "all") return true;
  return (chem.grades || []).some(g => g <= grade);
}

function getGradeLabel(grade = currentGrade) {
  return grade === "all" ? "Tất cả các lớp" : `Lớp ${grade}`;
}

function getGradeSubject(grade) {
  const lv = (typeof GRADE_LEVELS !== "undefined" ? GRADE_LEVELS : []).find(l => l.id === grade);
  return lv ? lv.subject : "";
}

// "Lớp 8 (KHTN 8): Acid · Lớp 10 (Hóa học 10): Halogen"
function formatGradeTopics(chem) {
  if (!chem || chem.isAdvanced || !(chem.gradeTopics || []).length) {
    return "Nâng cao: ngoài chương trình phổ thông, chủ yếu gặp trong phòng thí nghiệm.";
  }
  const byGrade = {};
  chem.gradeTopics.forEach(([g, topic]) => { (byGrade[g] = byGrade[g] || []).push(topic); });
  return Object.keys(byGrade).map(Number).sort((a, b) => a - b)
    .map(g => `Lớp ${g} (${getGradeSubject(g)}): ${byGrade[g].join("; ")}`)
    .join(" · ");
}

function getGradeBadgesHtml(chem) {
  if (chem.isAdvanced) return `<span class="grade-badge nc">Nâng cao</span>`;
  return (chem.grades || []).map(g => `<span class="grade-badge g${g}">L${g}</span>`).join("");
}

// Liệt kê chất của một lớp (dùng cho câu hỏi "lớp 8 học những chất nào?")
function buildGradeListResponse(grade) {
  const seenF = new Set();
  const list = getUniqueChemicalCatalog(true).filter(c => (c.grades || []).includes(grade))
    .filter(c => !seenF.has(c.formula) && seenF.add(c.formula));
  if (!list.length) return `Chưa có chất nào gắn với **Lớp ${grade}** trong dữ liệu.`;
  const byTopic = {};
  list.forEach(c => c.gradeTopics.filter(t => t[0] === grade).forEach(([, topic]) => {
    (byTopic[topic] = byTopic[topic] || []).push(c.formula);
  }));
  const rows = Object.entries(byTopic).map(([topic, f]) => `- **${topic}:** ${[...new Set(f)].join(", ")}`);
  return `📚 **Lớp ${grade} · ${getGradeSubject(grade)}** (${list.length} chất)\n\n${rows.join("\n")}\n\nBấm một chất ở tab **Cơ sở dữ liệu** hoặc hỏi tên chất để xem chi tiết.`;
}

// Câu hỏi nhanh thay đổi theo lớp
const GRADE_QUICK = {
  all: [
    ["HCl là gì?", "HCl là gì? Cho tôi biết tính chất và mức độ nguy hiểm"],
    ["NaOH + HCl?", "Trộn NaOH và HCl có nguy hiểm không? Giải thích phản ứng"],
    ["Sơ cứu axit", "Axit đổ ra da phải làm gì? Hướng dẫn sơ cứu khẩn cấp"],
    ["Lưu trữ H₂SO₄", "H2SO4 đặc bảo quản và lưu trữ thế nào cho an toàn?"],
    ["Hóa chất cấm trộn", "Các hóa chất tuyệt đối không được trộn với nhau là gì?"],
    ["MSDS là gì?", "MSDS là gì và cách đọc tài liệu an toàn hóa chất?"]
  ],
  6: [["Chất lớp 6", "Lớp 6 học những chất nào?"], ["O₂ là gì?", "O2 là gì?"], ["CO₂ là gì?", "CO2 là gì?"], ["Muối ăn NaCl", "NaCl là gì?"], ["Đường sucrose", "Sucrose là gì?"], ["Cồn C₂H₅OH", "Ethanol là gì?"]],
  7: [["Chất lớp 7", "Lớp 7 học những chất nào?"], ["NaCl liên kết gì?", "NaCl là gì?"], ["NH₃ là gì?", "NH3 là gì?"], ["Khí Cl₂", "Cl2 là gì?"], ["Glucose (quang hợp)", "Glucose là gì?"], ["Lưu huỳnh S", "Lưu huỳnh là gì?"]],
  8: [["Chất lớp 8", "Lớp 8 học những chất nào?"], ["HCl là gì?", "HCl là gì? Cho tôi biết tính chất và mức độ nguy hiểm"], ["NaOH + HCl?", "Trộn NaOH và HCl có nguy hiểm không? Giải thích phản ứng"], ["Lưu trữ H₂SO₄", "H2SO4 đặc bảo quản và lưu trữ thế nào cho an toàn?"], ["Phân urea", "Urea là gì?"], ["Sơ cứu axit", "Axit đổ ra da phải làm gì? Hướng dẫn sơ cứu khẩn cấp"]],
  9: [["Chất lớp 9", "Lớp 9 học những chất nào?"], ["Ethanol", "C2H5OH là gì?"], ["Acetic acid", "CH3COOH là gì?"], ["Đá vôi CaCO₃", "CaCO3 là gì?"]],
  10: [["Chất lớp 10", "Lớp 10 học những chất nào?"], ["Khí Cl₂", "Cl2 là gì?"], ["KMnO₄", "KMnO4 là gì?"], ["Nước Javel", "NaClO là gì?"], ["HF nguy hiểm?", "HF là gì?"], ["NaClO + HCl?", "Trộn NaClO và HCl có nguy hiểm không?"]],
  11: [["Chất lớp 11", "Lớp 11 học những chất nào?"], ["NH₃", "NH3 là gì?"], ["HNO₃ đặc", "HNO3 là gì?"], ["Benzene", "Benzene là gì?"], ["Phenol", "Phenol là gì?"], ["Lưu trữ H₂SO₄", "H2SO4 đặc bảo quản và lưu trữ thế nào cho an toàn?"]],
  12: [["Chất lớp 12", "Lớp 12 học những chất nào?"], ["Glucose", "Glucose là gì?"], ["Aniline", "Aniline là gì?"], ["Ethyl acetate", "Ethyl Acetate là gì?"], ["K₂Cr₂O₇", "K2Cr2O7 là gì?"], ["Nước vôi Ca(OH)₂", "Ca(OH)2 là gì?"]]
};

function renderQuickChips() {
  const row = document.getElementById("quick-chips");
  if (!row) return;
  const items = GRADE_QUICK[currentGrade] || GRADE_QUICK.all;
  row.innerHTML = items.map(([label, q]) =>
    `<button class="chip" onclick="sendQuick('${q.replace(/'/g, "\\'")}')">${escapeHtml(label)}</button>`).join("");
}

function updateGradeUI() {
  const sel = document.getElementById("grade-select");
  if (sel) sel.value = String(currentGrade);
  const count = getUniqueChemicalCatalog().length;
  const total = getUniqueChemicalCatalog(true).length;
  const countEl = document.getElementById("grade-count");
  if (countEl) countEl.textContent = currentGrade === "all"
    ? `Nhận diện ${total} chất`
    : `Nhận diện ${count}/${total} chất (lớp 6–${currentGrade})`;
  const sub = document.getElementById("chat-sub");
  if (sub) sub.textContent = currentGrade === "all"
    ? "Hỏi bất cứ điều gì về hóa chất — đang nhận diện tất cả các lớp"
    : `Đang nhận diện chất trong chương trình từ lớp 6 đến lớp ${currentGrade} (${getGradeSubject(currentGrade)})`;
}

// Đổi lớp → cập nhật lại toàn bộ giao diện
function setGrade(value, silent = false) {
  currentGrade = parseGrade(value);
  try { localStorage.setItem("chemsafe-grade", String(currentGrade)); } catch (e) { }
  dbGradeView = "group";
  renderMixOptions();
  renderDBGradeChips();
  filterDB(document.querySelector(".db-search")?.value || "");
  renderQuickChips();
  updateGradeUI();
  const calcSearch = document.getElementById("calc-chemical-search");
  if (calcSearch && document.getElementById("calc-chemical-results")?.classList.contains("show")) {
    renderCalcChemicalResults(calcSearch.value);
  }
  if (!silent) {
    appendMessage("bot", currentGrade === "all"
      ? "📚 Đã chuyển sang **Tất cả các lớp**: nhận diện mọi chất, gồm cả nhóm Nâng cao."
      : `📚 Đã chuyển sang **Lớp ${currentGrade}** (${getGradeSubject(currentGrade)}): chỉ nhận diện ${getUniqueChemicalCatalog().length} chất học từ lớp 6 đến lớp ${currentGrade}.`);
  }
}

const SUBSCRIPT_DIGITS = {
  "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4",
  "₅": "5", "₆": "6", "₇": "7", "₈": "8", "₉": "9"
};

const ELEMENT_SYMBOLS = new Set([
  "H", "He", "Li", "Be", "B", "C", "N", "O", "F", "Ne",
  "Na", "Mg", "Al", "Si", "P", "S", "Cl", "Ar", "K", "Ca",
  "Sc", "Ti", "V", "Cr", "Mn", "Fe", "Co", "Ni", "Cu", "Zn",
  "Ga", "Ge", "As", "Se", "Br", "Kr", "Rb", "Sr", "Y", "Zr",
  "Nb", "Mo", "Tc", "Ru", "Rh", "Pd", "Ag", "Cd", "In", "Sn",
  "Sb", "Te", "I", "Xe", "Cs", "Ba", "La", "Ce", "Pr", "Nd",
  "Pm", "Sm", "Eu", "Gd", "Tb", "Dy", "Ho", "Er", "Tm", "Yb",
  "Lu", "Hf", "Ta", "W", "Re", "Os", "Ir", "Pt", "Au", "Hg",
  "Tl", "Pb", "Bi", "Po", "At", "Rn", "Fr", "Ra", "Ac", "Th",
  "Pa", "U", "Np", "Pu", "Am", "Cm", "Bk", "Cf", "Es", "Fm",
  "Md", "No", "Lr", "Rf", "Db", "Sg", "Bh", "Hs", "Mt", "Ds",
  "Rg", "Cn", "Nh", "Fl", "Mc", "Lv", "Ts", "Og"
]);

function normalizeText(value) {
  return String(value || "")
    .replace(/[₀₁₂₃₄₅₆₇₈₉]/g, ch => SUBSCRIPT_DIGITS[ch] || ch)
    .toLowerCase()
    .normalize("NFD")
    .replace(/Ä'/g, "d")
    .replace(/[\u0300-\u036f]/g, "");
}

function compactFormula(value) {
  return normalizeText(value).replace(/[^a-z0-9]/g, "");
}

function getCompactTokens(value) {
  const plain = String(value || "").replace(/[₀₁₂₃₄₅₆₇₈₉]/g, ch => SUBSCRIPT_DIGITS[ch] || ch);
  return (plain.match(/[A-Za-z0-9]+/g) || []).map(compactFormula).filter(Boolean);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsTextAlias(aliasText, normalizedText) {
  const escaped = escapeRegExp(aliasText).replace(/\s+/g, "\\s+");
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}(?=$|[^\\p{L}\\p{N}])`, "u").test(normalizedText);
}

function matchesChemicalAlias(alias, normalizedText, compactTokens) {
  const aliasText = normalizeText(alias);
  const aliasCompact = compactFormula(alias);
  if (!aliasText || !aliasCompact) return false;

  if (isValidFormula(alias)) {
    if (aliasCompact.length < 2) return false;
    return containsTextAlias(aliasText, normalizedText);
  }

  return aliasText.length >= 3 && containsTextAlias(aliasText, normalizedText);
}

function getChemicalNameAliases(name) {
  const raw = String(name || "").trim();
  if (!raw) return [];

  const aliases = new Set([raw]);
  const primary = raw.split(/[(/]/)[0].trim();
  if (primary) aliases.add(primary);

  for (const match of raw.matchAll(/\(([^)]+)\)/g)) {
    const part = match[1].trim();
    if (!part) continue;
    aliases.add(part);
    part.split(/[;,/]/).map(item => item.trim()).filter(Boolean).forEach(item => aliases.add(item));
  }

  return [...aliases].filter(alias => normalizeText(alias).length >= 3);
}

function isValidFormula(value) {
  const formula = String(value || "").replace(/[₀₁₂₃₄₅₆₇₈₉]/g, ch => SUBSCRIPT_DIGITS[ch] || ch);
  if (!formula || /[^A-Za-z0-9]/.test(formula)) return false;

  let position = 0;
  const matcher = /([A-Z][a-z]?)(\d*)/g;
  let match;
  while ((match = matcher.exec(formula)) !== null) {
    if (match.index !== position || !ELEMENT_SYMBOLS.has(match[1])) return false;
    position = matcher.lastIndex;
  }

  return position === formula.length;
}

function getChemicalCatalog(includeAll = false) {
  const keysByFormula = {
    hcl: "hcl", h2so4: "h2so4", hno3: "hno3", naoh: "naoh", koh: "koh",
    nh3: "nh3", h2o2: "h2o2", cl2: "cl2", c2h5oh: "ethanol",
    ch3coch3: "acetone", ch3oh: "methanol", nacl: "nacl", hf: "hf", kmno4: "kmno4",
    fe: "fe", cuso4: "cuso4"
  };

  return CHEM_DATABASE.filter(chem => includeAll || isChemInGrade(chem)).map(chem => ({
    ...chem,
    key: keysByFormula[compactFormula(chem.formula)] || compactFormula(chem.formula),
    aliases: [chem.formula, ...getChemicalNameAliases(chem.name), ...(chem.aliases || [])]
  }));
}

function findMentionedChemicals(text, includeAll = false) {
  const normalized = normalizeText(text);
  const compactTokens = getCompactTokens(text);
  const seen = new Set();

  return getChemicalCatalog(includeAll).filter(chem => {
    const formula = compactFormula(chem.formula);
    const name = normalizeText(chem.name);
    const aliases = chem.aliases || [];

    const matched =
      (name.length >= 3 && normalized.includes(name)) ||
      aliases.some(alias => matchesChemicalAlias(alias, normalized, compactTokens));

    if (!matched || seen.has(chem.key)) return false;
    seen.add(chem.key);
    return true;
  });
}

function formatDanger(chem) {
  return chem.dangerLabel || ({ danger: "NGUY HIỂM", caution: "THẬN TRỌNG", safe: "AN TOÀN" }[chem.danger] || "CHƯA RÕ");
}

function getPpeForChem(chem) {
  if (chem.ppe) return chem.ppe;
  const text = normalizeText(`${chem.name} ${chem.properties} ${chem.msds}`);

  if (text.includes("khi") || text.includes("amoniac") || text.includes("clo") || text.includes("hoi")) {
    return "Kính kín chống hóa chất, găng phù hợp, áo choàng/tạp dề; thao tác trong tủ hút hoặc khu vực thông gió mạnh.";
  }
  if (text.includes("axit")) {
    return "Kính chống bắn, găng chống axit, áo blouse/tạp dề chống hóa chất; dùng tủ hút nếu có hơi axit.";
  }
  if (text.includes("kiem") || text.includes("hydroxide")) {
    return "Kính chống bắn, găng nitrile/neoprene, áo blouse; tránh tiếp xúc da và mắt.";
  }
  if (text.includes("dung moi") || text.includes("de chay")) {
    return "Kính bảo hộ, găng nitrile, áo blouse; tránh nguồn lửa và làm việc nơi thông gió.";
  }
  return "Kính bảo hộ, găng tay phù hợp hóa chất và áo blouse phòng thí nghiệm.";
}

function getFirstAidForChem(chem) {
  if (chem.firstAid) return chem.firstAid;
  const text = normalizeText(`${chem.name} ${chem.properties} ${chem.msds}`);

  if (text.includes("hf") || text.includes("flohidric")) {
    return "Rửa nước ngay ít nhất 15 phút, dùng gel calcium gluconate nếu có theo SOP và gọi cấp cứu/chống độc ngay.";
  }
  if (text.includes("axit") || text.includes("kiem") || text.includes("an mon") || text.includes("hydroxide")) {
    return "Dính da/mắt: rửa nước liên tục 15-20 phút, tháo đồ nhiễm bẩn. Hít phải: ra nơi thoáng khí. Nuốt phải: không gây nôn, gọi y tế.";
  }
  if (text.includes("dung moi") || text.includes("de chay")) {
    return "Hít phải: ra nơi thoáng khí. Dính da: rửa bằng nước/xà phòng. Vào mắt: rửa 15 phút. Nuốt phải hoặc chóng mặt nặng: gọi y tế.";
  }
  return "Dính da/mắt: rửa nước 15 phút. Hít phải: ra nơi thoáng khí. Nuốt phải hoặc triệu chứng nặng: gọi cơ sở y tế.";
}

function getPhysicalProperties(chem) {
  if (chem.physicalProperties) return chem.physicalProperties;
  if (chem.physical) return chem.physical;

  const details = [
    chem.state,
    chem.appearance,
    chem.colorName,
    chem.boiling && `Nhiệt độ sôi: ${chem.boiling}`,
    chem.melting && `Nhiệt độ nóng chảy: ${chem.melting}`,
    chem.solubility && `Độ tan: ${chem.solubility}`,
    chem.ph && `pH tham khảo: ${chem.ph}`
  ].filter(Boolean);

  return details.join("; ") || "Chưa cập nhật dữ liệu tính chất vật lý.";
}

function getChemicalProperties(chem) {
  return chem.chemicalProperties || chem.chemical || chem.properties || "Chưa cập nhật dữ liệu tính chất hóa học.";
}

function buildChemicalInfoResponse(chem) {
  return `🔬 **${chem.name}**\n\n**Công thức:** ${chem.formula}\n\n**Khối lượng mol:** ${chem.molar || formatCalcNumber(chem.molarMass, "g/mol")}\n\n**Tính chất vật lý:** ${getPhysicalProperties(chem)}\n\n**Tính chất hóa học:** ${getChemicalProperties(chem)}\n\n**Cảnh báo nguy hiểm:** ${formatDanger(chem)} - ${chem.msds || getChemicalProperties(chem)}\n\n**PPE:** ${getPpeForChem(chem)}\n\n**Bảo quản:** ${chem.storage || "Bảo quản kín, có nhãn rõ, tách khỏi nhóm hóa chất tương kỵ."}\n\n**Sơ cứu:** ${getFirstAidForChem(chem)}\n\n**📚 Chương trình học:** ${formatGradeTopics(chem)}`;
}

function buildMixResponse(first, second) {
  const key = getMixKey(first.key, second.key);
  window.lastMatchedMix = { first, second, key };
  if (!key) {
    return `⚗️ **${first.formula} + ${second.formula}**\n\nChưa có cảnh báo đặc biệt trong dữ liệu nội bộ cho tổ hợp này.\n\nVẫn cần xử lý như tình huống có rủi ro: dùng lượng nhỏ, kiểm soát nhiệt, làm trong khu vực thông gió/tủ hút, chuẩn bị PPE và không trộn nếu chưa có quy trình được phê duyệt.`;
  }

  const warning = MIX_WARNINGS[key];
  return `${warning.title}\n\n**Tổ hợp:** ${first.formula} + ${second.formula}\n\n**Phản ứng:** ${warning.reaction}\n\n**Mô tả:** ${warning.desc}\n\n**Rủi ro:** ${warning.tags.join(", ")}\n\n**Khuyến nghị:** không tự ý trộn; nếu bắt buộc trong phòng thí nghiệm, chỉ thực hiện theo SOP, trong tủ hút, có giám sát và PPE đầy đủ.`;
}

function buildCommonWarningsResponse() {
  const catalog = getChemicalCatalog(true);
  const byKey = Object.fromEntries(catalog.map(chem => [chem.key, chem]));
  const rows = Object.entries(MIX_WARNINGS).slice(0, 8).map(([key, warning]) => {
    const pair = key.split("|").map(part => byKey[part]?.formula || part).join(" + ");
    return `- **${pair}:** ${warning.title} - ${warning.tags.join(", ")}`;
  });

  return `⚠️ **Một số cặp hóa chất không nên trộn**\n\n${rows.join("\n")}\n\nDanh sách này không thay thế MSDS/SDS hoặc SOP của phòng thí nghiệm. Khi không chắc, hãy coi là nguy hiểm và hỏi người phụ trách an toàn.`;
}

function buildFirstAidResponse() {
  return `🚨 **Sơ cứu khi tiếp xúc hóa chất**\n\n1. Ngừng tiếp xúc ngay, đưa người bị nạn ra khu vực an toàn nếu không gây nguy hiểm thêm.\n2. Dính da: xả dưới vòi nước sạch ít nhất 15-20 phút, tháo bỏ quần áo/găng bị nhiễm.\n3. Vào mắt: rửa mắt liên tục 15-20 phút, giữ mí mắt mở, không dụi mắt.\n4. Hít phải: đưa ra nơi thoáng khí, nới lỏng quần áo, theo dõi khó thở.\n5. Nuốt phải: không tự gây nôn; kiểm tra SDS và gọi cấp cứu/trung tâm chống độc.\n\nNếu bỏng nặng, khó thở, đau mắt, hoặc hóa chất là HF/oxy hóa mạnh/ăn mòn mạnh: gọi 115 hoặc cơ sở y tế ngay.`;
}

function buildMsdsResponse(chem) {
  if (chem) {
    return `📋 **MSDS/SDS tóm tắt cho ${chem.formula} - ${chem.name}**\n\n**Nguy cơ:** ${formatDanger(chem)}\n\n**Thông tin an toàn:** ${chem.msds}\n\n**PPE:** ${getPpeForChem(chem)}\n\n**Bảo quản:** ${chem.storage}\n\n**Sơ cứu:** ${getFirstAidForChem(chem)}\n\nKhi dùng thực tế, hãy đối chiếu SDS chính thức của nhà cung cấp vì nồng độ và dạng tồn tại có thể làm thay đổi mức nguy hiểm.`;
  }

  return `📋 **MSDS/SDS là gì?**\n\nSDS là tài liệu an toàn hóa chất, thường có 16 mục: nhận dạng hóa chất, nguy cơ GHS, thành phần, sơ cứu, chữa cháy, xử lý tràn đổ, lưu trữ, PPE, tính chất lý hóa, độc tính, vận chuyển và thải bỏ.\n\nKhi đọc SDS, ưu tiên các mục: nguy cơ GHS, sơ cứu, PPE, lưu trữ, xử lý tràn đổ và tương kỵ hóa chất.`;
}

function buildStorageResponse(chem) {
  if (chem) {
    return `🏷️ **Lưu trữ ${chem.formula} - ${chem.name}**\n\n${chem.storage}\n\n**Lưu ý:** dán nhãn rõ, đóng kín nắp, tách nhóm tương kỵ, kiểm tra rò rỉ định kỳ và luôn để SDS gần khu vực sử dụng.`;
  }

  return `🏷️ **Nguyên tắc lưu trữ hóa chất**\n\n- Tách axit, bazơ, chất oxy hóa, dung môi dễ cháy và chất độc thành khu riêng.\n- Không để hóa chất theo alphabet nếu chúng tương kỵ.\n- Dán nhãn đầy đủ: tên, công thức, nồng độ, ngày nhận/mở, người phụ trách.\n- Dùng tủ hút/tủ cháy/tủ axit đúng loại và có khay chống tràn.`;
}

function buildCalculatorTutorResponse(question) {

  // ─────────────────────────────────────
  // Lấy thông tin từ prompt Calculator
  // ─────────────────────────────────────

  const chemicalMatch =
    question.match(/- Tên:\s*(.+)/);

  const formulaMatch =
    question.match(/- Công thức:\s*(.+)/);

  const molarMatch =
    question.match(/- Khối lượng mol:\s*([\d.]+)/);

  const massMatch =
    question.match(/- Khối lượng:\s*([\d.]+)/);

  const molesMatch =
    question.match(/- Số mol:\s*([\d.]+)/);

  const volumeMatch =
    question.match(/- Thể tích dung dịch:\s*([\d.]+)/);

  const resultMolesMatch =
    question.match(/Số mol:\s*([\d.]+)/);

  const molarityMatch =
    question.match(/Nồng độ mol:\s*([\d.]+)/);


  const chemical =
    chemicalMatch
      ? chemicalMatch[1].trim()
      : "hóa chất";

  const formula =
    formulaMatch
      ? formulaMatch[1].trim()
      : "";

  const molarMass =
    molarMatch
      ? Number(molarMatch[1])
      : null;

  const mass =
    massMatch
      ? Number(massMatch[1])
      : null;

  const moles =
    molesMatch
      ? Number(molesMatch[1])
      : null;

  const volume =
    volumeMatch
      ? Number(volumeMatch[1])
      : null;

  const resultMoles =
    resultMolesMatch
      ? Number(resultMolesMatch[1])
      : null;

  const molarity =
    molarityMatch
      ? Number(molarityMatch[1])
      : null;


  // ═══════════════════════════════════════
  // BẮT ĐẦU TẠO CÂU TRẢ LỜI
  // ═══════════════════════════════════════

  let response = `
🧪 **PHÂN TÍCH BÀI TOÁN TỪ CALCULATOR**

---

### 📌 1. Dữ kiện

**Hóa chất:** ${chemical}

**Công thức:** ${formula || "Không xác định"}

**Khối lượng mol:** ${molarMass !== null
      ? molarMass.toFixed(4) + " g/mol"
      : "Không xác định"
    }

`;


  // ═══════════════════════════════════════
  // KHỐI LƯỢNG → MOL
  // ═══════════════════════════════════════

  if (
    mass !== null &&
    molarMass !== null
  ) {

    const calculatedMoles =
      mass / molarMass;


    response += `
### 📐 2. Tính số mol

Khi biết khối lượng của chất, ta sử dụng công thức:

**n = m / M**

Trong đó:

- **n**: số mol (mol)
- **m**: khối lượng chất (g)
- **M**: khối lượng mol (g/mol)

Thay số:

**n = ${mass} / ${molarMass.toFixed(4)}**

→ **n ≈ ${calculatedMoles.toFixed(6)} mol**

`;


    // kiểm tra kết quả Calculator

    if (resultMoles !== null) {

      const difference =
        Math.abs(
          calculatedMoles - resultMoles
        );

      if (difference < 0.00001) {

        response += `
✅ **Kiểm tra:** Kết quả Calculator chính xác.

Calculator đã tính:

**n = ${resultMoles.toFixed(6)} mol**
`;
      } else {

        response += `
⚠️ **Kiểm tra:** Kết quả Calculator có sự chênh lệch nhỏ.

Giá trị tính lại:

**n ≈ ${calculatedMoles.toFixed(6)} mol**
`;
      }
    }
  }


  // ═══════════════════════════════════════
  // TÍNH NỒNG ĐỘ MOL
  // ═══════════════════════════════════════

  if (
    volume !== null &&
    volume > 0 &&
    resultMoles !== null
  ) {

    const calculatedMolarity =
      resultMoles / volume;


    response += `
### 🧪 3. Tính nồng độ mol

Công thức:

**C = n / V**

Trong đó:

- **C**: nồng độ mol (mol/L)
- **n**: số mol
- **V**: thể tích dung dịch (L)

Thay số:

**C = ${resultMoles.toFixed(6)} / ${volume}**

→ **C ≈ ${calculatedMolarity.toFixed(6)} M**

`;


    if (molarity !== null) {

      response += `
✅ **Kết quả Calculator:** ${molarity.toFixed(6)} M
`;
    }
  }


  // ═══════════════════════════════════════
  // KẾT LUẬN
  // ═══════════════════════════════════════

  response += `
---

### 💡 4. Mẹo ghi nhớ

Khi gặp bài toán liên quan đến khối lượng và số mol:

**n = m / M**

Có thể nhớ theo tam giác:

        m
      ─────
      n × M

Suy ra:

- **n = m / M**
- **m = n × M**
- **M = m / n**

`;

  response += `
### 🎯 Tóm tắt

Calculator đã giúp bạn thực hiện phần tính toán.

AI Tutor giúp bạn hiểu:

**Dữ kiện → Công thức → Thay số → Kết quả → Kiểm tra**

Hãy chú ý đến **đơn vị** khi làm bài: khối lượng thường dùng g, khối lượng mol dùng g/mol và thể tích dung dịch dùng L.
`;


  return response;
}

function getLocalChatResponse(question) {
  window.lastMatchedChem = null;
  window.lastMatchedMix = null;
  if (question.includes("Tôi đang học Hóa học và vừa sử dụng Chemistry Calculator")) {
    return buildCalculatorTutorResponse(question);
  }
  const normalized = normalizeText(question);
  const mentioned = findMentionedChemicals(question);
  const isMixQuestion = normalized.includes("tron") || normalized.includes("ket hop") || normalized.includes("pha") || question.includes("+");
  const isFirstAidQuestion = [
    "so cuu", "do ra da", "dinh da", "vao mat", "hit phai", "nuot",
    "tiep xuc", "bi ban", "tran do", "do hoa chat", "hoa chat ban"
  ].some(phrase => normalized.includes(phrase));
  const isStorageQuestion = ["luu tru", "bao quan", "cat giu", "cach luu", "de hoa chat"].some(
    phrase => normalized.includes(phrase)
  );

  const gradeAsk = normalized.match(/\blop\s*(6|7|8|9|10|11|12)\b/);
  if (gradeAsk && mentioned.length === 0) {
    return buildGradeListResponse(Number(gradeAsk[1]));
  }

  if (normalized.includes("cam tron") || normalized.includes("khong duoc tron") || normalized.includes("tuyet doi khong")) {
    return buildCommonWarningsResponse();
  }

  if ((isMixQuestion || mentioned.length >= 2) && mentioned.length >= 2) {
    return buildMixResponse(mentioned[0], mentioned[1]);
  }

  if (normalized.includes("msds") || normalized.includes("sds")) {
    return buildMsdsResponse(mentioned[0]);
  }

  if (isFirstAidQuestion) {
    return buildFirstAidResponse();
  }

  if (isStorageQuestion) {
    return buildStorageResponse(mentioned[0]);
  }

  if (mentioned.length > 0) {
    window.lastMatchedChem = mentioned[0];
    return buildChemicalInfoResponse(mentioned[0]);
  }

  return null;
}

function extractChemicalQuery(question) {
  const formulaText = question.replace(/[₀₁₂₃₄₅₆₇₈₉]/g, ch => SUBSCRIPT_DIGITS[ch] || ch);
  const formulaTokens = [...formulaText.matchAll(/(?:^|[^\p{L}\p{N}])((?:[A-Z][a-z]?\d*)+)(?=$|[^\p{L}\p{N}])/gu)]
    .map(match => match[1]);
  const formulaMatch = formulaTokens.find(isValidFormula);
  if (formulaMatch) return formulaMatch;

  return normalizeText(question)
    .replace(/\b(la gi|tim|tra cuu|cho toi biet|thong tin|hoa chat|chat|ve|cua|msds|sds|ppe|bao quan|luu tru|so cuu|nguy hiem|khong)\b/g, " ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ═══════════════════════════════════════════════════════════════
//   TÍCH HỢP CHATBOT: LOCAL DATABASE + BACKEND OLLAMA API
// ═══════════════════════════════════════════════════════════════

/**
 * Gọi endpoint POST /api/chat từ server backend kết nối với Ollama.
 * Tự động gửi kèm tối đa 10 lượt hội thoại gần nhất để giữ ngữ cảnh.
 */
async function fetchChatApi(question) {
  const endpoint = window.location.protocol.startsWith("http")
    ? "/api/chat"
    : "http://localhost:3000/api/chat";

  const recentHistory = conversationHistory.slice(-10).map(msg => ({
    role: msg.role === "bot" ? "assistant" : msg.role,
    content: msg.content
  }));

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message: question,
      history: recentHistory
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error ${response.status}`);
  }

  const data = await response.json();
  if (!data || !data.answer) {
    throw new Error("Phản hồi không hợp lệ từ máy chủ AI.");
  }

  return data.answer;
}

/**
 * Nhận diện câu hỏi bài tập, câu hỏi tính toán hoặc lý thuyết nâng cao
 */
function isComplexOrHomeworkQuestion(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  const homeworkKeywords = [
    "tính", "giải", "bài toán", "bài tập", "hòa tan", "nồng độ", "phản ứng", 
    "khối lượng", "thể tích", "số mol", "hiệu suất", "cân bằng", "phương trình", 
    "pha loãng", "dung dịch", "kết tủa", "chất rắn", "dư", "hỗn hợp", "gam", "mol", 
    "giải thích", "tại sao", "cơ chế", "so sánh", "học sinh", "c1v1"
  ];
  if (text.length > 50) return true;
  return homeworkKeywords.some(kw => lower.includes(kw));
}

/**
 * Điều phối chatbot thông minh:
 * 1. Tra cứu local (chemdata.js) trước cho phản hồi tức thì (MSDS, cảnh báo trộn).
 * 2. Nếu câu hỏi phức tạp hoặc yêu cầu giải bài tập -> chuyển tiếp sang POST /api/chat (Ollama).
 * 3. Hiển thị thông báo thân thiện nếu Ollama chưa bật (không làm sập app).
 */
async function getChatResponse(question) {
  // 1. Phản hồi tức thì từ cơ sở dữ liệu local (không độ trễ)
  const localResponse = getLocalChatResponse(question);
  if (localResponse) return localResponse;

  // 2. Kiểm tra nếu chất có trong DB nhưng nằm ngoài phạm vi khối lớp đang chọn
  if (currentGrade !== "all") {
    const hidden = findMentionedChemicals(question, true);
    if (hidden.length) {
      const c = hidden[0];
      return `📚 **${c.formula} (${c.name})** chưa thuộc phạm vi **Lớp 6–${currentGrade}** bạn đang chọn.\n\n**Chương trình học:** ${formatGradeTopics(c)}\n\nĐổi ô **Lớp học** ở thanh bên trái sang lớp cao hơn hoặc **Tất cả các lớp** để xem thông tin đầy đủ.`;
    }
  }

  // 3. Nếu là câu hỏi bài tập hoặc chất ngoài danh mục local -> Chuyển tiếp tới Ollama Backend API
  try {
    const aiAnswer = await fetchChatApi(question);
    if (aiAnswer) return aiAnswer;
  } catch (err) {
    console.warn("[ChemSafe AI] Backend Ollama API chưa sẵn sàng:", err.message);
    
    // Nếu là câu hỏi bài tập mà Ollama chưa bật, hướng dẫn người dùng khởi động
    if (isComplexOrHomeworkQuestion(question)) {
      return `⚠️ **Không thể kết nối với mô hình AI giải bài tập (Ollama).**\n\n` +
        `*Nguyên nhân:* Server backend chưa chạy hoặc dịch vụ Ollama chưa được khởi động.\n\n` +
        `🔧 **Hướng dẫn kích hoạt:**\n` +
        `1. Khởi động server: chạy lệnh \`npm start\` trong terminal.\n` +
        `2. Chạy Ollama với mô hình hóa học: \`ollama run gemma3:4b\`.\n\n` +
        `💡 *Lưu ý:* Tra cứu MSDS, cảnh báo nguy cơ trộn chất và các công cụ tính toán số học trên web vẫn hoạt động bình thường!`;
    }
  }

  // 4. Nếu không phải bài tập và không có trong CSDL local
  const query = extractChemicalQuery(question);
  if (!query) {
    return `Tôi chưa nhận diện được tên hoặc công thức hóa chất trong câu hỏi.\n\n` +
      `💡 **Gợi ý tra cứu:**\n` +
      `- Tên/công thức hóa chất: \`HCl\`, \`NaOH\`, \`H2SO4\`, \`benzene\`, \`acetone\...\n` +
      `- Cảnh báo trộn hóa chất: \`Trộn NaOH và HCl\`, \`Bleach + Acid\...\n` +
      `- Giải bài toán Hóa học: Hãy nhập chi tiết đề bài (yêu cầu bật server backend Ollama).`;
  }

  return `Không tìm thấy thông tin của **${query}** trong cơ sở dữ liệu nội bộ (\`chemdata.js\`, ${getUniqueChemicalCatalog().length} chất).\n\n` +
    `Hãy thử tìm theo tên tiếng Việt/tiếng Anh hoặc công thức chuẩn, ví dụ: \`HCl\`, \`sodium hydroxide\`, \`C6H6\`, hoặc xem danh sách tại tab **Cơ sở dữ liệu**. Với các hóa chất chuyên dụng ngoài danh mục, vui lòng đối chiếu tài liệu an toàn SDS/GHS chính thức của nhà sản xuất.`;
}

// ── GIAO DIỆN & TÁC VỤ ──
function switchTab(tabId, btn) {
  document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
  document.getElementById("tab-" + tabId).classList.add("active");
  btn.classList.add("active");
}

function autoResize(el) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 160) + "px";
}

function handleKey(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

function showLoading(show) {
  const el = document.getElementById("loading");
  if (el) el.classList.toggle("visible", show);
}

// ── KIỂM TRA ĐƠN CHẤT (chỉ hợp chất mới có video / mô phỏng) ──
// Đơn chất: công thức chỉ gồm 1 nguyên tố, vd: Fe, Cu, Na, O2, H2, Cl2, S8
function isElementalSubstance(chem) {
  if (!chem) return false;
  const formula = String(chem.formula || "")
    .replace(/[₀₁₂₃₄₅₆₇₈₉]/g, ch => SUBSCRIPT_DIGITS[ch] || ch)
    .replace(/\s+/g, "");
  return /^[A-Z][a-z]?\d*$/.test(formula);
}

// ── CHAT & TẠO NÚT XEM VIDEO ──
function attachVideoButton(chem, bubbleElement) {
  if (!chem || !bubbleElement) return;

  const chemKey = chem.key || compactFormula(chem.formula);
  const videoMap = typeof VIDEO_DATABASE !== "undefined" ? VIDEO_DATABASE : {};
  const videoUrl = videoMap[chemKey] || chem.videoUrl;

  if (bubbleElement.querySelector(".btn-video-chip") || !videoUrl) return;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn-video-chip";
  btn.style.cssText = `
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-top: 10px;
    margin-right: 8px;
    padding: 5px 12px;
    background: rgba(16, 163, 127, 0.1);
    border: 1px solid #10a37f;
    border-radius: 12px;
    color: #10a37f;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  `;
  btn.innerHTML = `🎬 Xem video`;
  btn.onclick = () => openVideoModal(chem.name || chem.formula, videoUrl);

  bubbleElement.appendChild(btn);
}

function attachReactionVideoButton(reaction, bubbleElement) {
  if (!reaction || !bubbleElement || !reaction.key) return;

  const videoMap = typeof VIDEO_DATABASE !== "undefined" ? VIDEO_DATABASE : {};
  const warning = MIX_WARNINGS[reaction.key];
  const videoUrl = videoMap[reaction.key] || warning?.videoUrl;
  if (!videoUrl || bubbleElement.querySelector(".btn-video-chip")) return;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn-video-chip";
  btn.style.cssText = `
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-top: 10px;
    padding: 5px 12px;
    background: rgba(16, 163, 127, 0.1);
    border: 1px solid #10a37f;
    border-radius: 12px;
    color: #10a37f;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
  `;
  btn.textContent = "🎬 Xem video phản ứng";
  btn.onclick = () => openVideoModal(
    `${reaction.first.formula} + ${reaction.second.formula}`,
    videoUrl
  );
  bubbleElement.appendChild(btn);
}

function attachExperimentButton(reaction, bubbleElement) {
  if (!reaction || !bubbleElement || !reaction.key) return;

  const exp = EXPERIMENT_DATABASE[reaction.key];
  if (!exp || bubbleElement.querySelector(".btn-exp-chip")) return;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn-exp-chip";
  btn.style.cssText = `
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-top: 10px;
    margin-right: 8px;
    padding: 5px 12px;
    background: rgba(30, 111, 217, 0.1);
    border: 1px solid #1e6fd9;
    border-radius: 12px;
    color: #1e6fd9;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
  `;
  btn.textContent = "🧪 Xem video & tự làm thí nghiệm";
  btn.onclick = () => openExperimentModal(exp.title, exp.src);
  bubbleElement.appendChild(btn);
}

function openExperimentModal(title, src) {
  let modal = document.getElementById("chem-exp-modal");

  if (!modal) {
    modal = document.createElement("div");
    modal.id = "chem-exp-modal";
    modal.style.cssText = `
      position: fixed; inset: 0; background: rgba(0, 0, 0, 0.75);
      display: flex; justify-content: center; align-items: center;
      z-index: 9999; opacity: 0; transition: opacity 0.2s ease;
    `;
    modal.innerHTML = `
      <div style="position:relative;width:96%;max-width:1180px;height:92vh;background:#1e1e24;border-radius:12px;padding:16px;border:1px solid #333;display:flex;flex-direction:column">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <h3 id="exp-modal-title" style="margin:0;font-size:16px;color:#fff"></h3>
          <button type="button" aria-label="Đóng" onclick="closeExperimentModal()" style="background:transparent;color:#aaa;font-size:24px;padding:0 6px">&times;</button>
        </div>
        <div id="exp-modal-container" style="flex:1;width:100%;border-radius:8px;overflow:hidden;background:#fff"></div>
      </div>
    `;
    modal.onclick = event => {
      if (event.target === modal) closeExperimentModal();
    };
    document.body.appendChild(modal);
  }

  modal.querySelector("#exp-modal-title").textContent = title;
  const container = modal.querySelector("#exp-modal-container");
  container.innerHTML = "";
  const iframe = document.createElement("iframe");
  iframe.title = title;
  iframe.src = src;
  iframe.style.cssText = "width:100%;height:100%;border:0";
  container.appendChild(iframe);

  modal.style.display = "flex";
  setTimeout(() => { modal.style.opacity = "1"; }, 10);
}

function closeExperimentModal() {
  const modal = document.getElementById("chem-exp-modal");
  if (!modal) return;
  modal.style.opacity = "0";
  setTimeout(() => {
    modal.style.display = "none";
    modal.querySelector("#exp-modal-container").innerHTML = "";
  }, 200);
}

function openVideoModal(title, videoUrl) {
  let modal = document.getElementById("chem-video-modal");

  if (!modal) {
    modal = document.createElement("div");
    modal.id = "chem-video-modal";
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0, 0, 0, 0.75); display: flex; justify-content: center;
      align-items: center; z-index: 9999; opacity: 0; transition: opacity 0.2s ease;
    `;
    modal.innerHTML = `
      <div style="position: relative; width: 90%; max-width: 650px; background: #1e1e24; border-radius: 12px; padding: 16px; border: 1px solid #333;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <h3 id="video-modal-title" style="margin: 0; font-size: 16px; color: #fff;">Xem Video</h3>
          <span style="color: #aaa; font-size: 24px; cursor: pointer; line-height: 1;" onclick="closeVideoModal()">&times;</span>
        </div>
        <div id="video-modal-container" style="width: 100%; border-radius: 8px; overflow: hidden; background: #000;"></div>
      </div>
    `;
    modal.onclick = (e) => { if (e.target === modal) closeVideoModal(); };
    document.body.appendChild(modal);
  }

  const titleEl = modal.querySelector("#video-modal-title");
  const container = modal.querySelector("#video-modal-container");

  if (titleEl) titleEl.textContent = `Video: ${title}`;

  const youtubeMatch = videoUrl.match(
    /(?:youtube\.com\/watch\?v=|youtube\.com\/embed\/|youtu\.be\/)([A-Za-z0-9_-]{11})/
  );
  if (youtubeMatch) {
    const embedUrl = `https://www.youtube.com/embed/${youtubeMatch[1]}`;
    container.innerHTML = `<iframe src="${embedUrl}" width="100%" height="360" frameborder="0" allowfullscreen></iframe>`;
  } else {
    container.innerHTML = `
      <video controls autoplay style="width:100%; max-height:360px;">
        <source src="${videoUrl}" type="video/mp4">
        Trình duyệt không hỗ trợ phát video này.
      </video>`;
  }

  modal.style.display = "flex";
  setTimeout(() => { modal.style.opacity = "1"; }, 10);
}

function closeVideoModal() {
  const modal = document.getElementById("chem-video-modal");
  if (modal) {
    modal.style.opacity = "0";
    setTimeout(() => {
      modal.style.display = "none";
      const container = modal.querySelector("#video-modal-container");
      if (container) container.innerHTML = "";
    }, 200);
  }
}

// ── CHAT & TẠO NÚT XEM MÔ PHỎNG THÍ NGHIỆM ──
function sendQuick(text) {
  document.getElementById("chat-input").value = text;
  sendMessage();
}

function clearChat() {
  conversationHistory = [];
  const msgs = document.getElementById("chat-messages");
  msgs.innerHTML = `
    <div class="msg bot">
      <div class="msg-avatar">AI</div>
      <div class="msg-content">
        <div class="msg-bubble">
          Cuộc trò chuyện đã được xóa. Tôi sẵn sàng hỗ trợ bạn!<br><br>
          Hãy đặt câu hỏi về hóa chất bất cứ lúc nào. 🔬
        </div>
        <div class="msg-time">Hệ thống</div>
      </div>
    </div>`;
}

async function sendMessage() {
  const sendBtn = document.getElementById("send-btn");
  if (sendBtn.disabled) return;

  const input = document.getElementById("chat-input");
  const text = input.value.trim();
  if (!text) return;

  input.value = "";
  input.style.height = "auto";
  sendBtn.disabled = true;

  // Hiển thị tin nhắn người dùng
  appendMessage("user", text);

  // Thêm vào lịch sử
  conversationHistory.push({ role: "user", content: text });

  const typingId = showTyping();

  try {
    const botReply = await getChatResponse(text);
    removeTyping(typingId);
    conversationHistory.push({ role: "assistant", content: botReply });
    const bubble = appendMessage("bot", botReply);

    if (window.lastMatchedChem) {
      if (typeof attachMol3DButton === "function") {
        attachMol3DButton(window.lastMatchedChem, bubble);
      }
      attachVideoButton(window.lastMatchedChem, bubble);
    }
    attachReactionVideoButton(window.lastMatchedMix, bubble);
    attachExperimentButton(window.lastMatchedMix, bubble);
  } catch (err) {
    removeTyping(typingId);
    appendMessage("bot", "❌ Có lỗi khi xử lý câu hỏi. Mở Console (F12) để xem chi tiết.");
    console.error("Lookup error:", err);
  } finally {
    sendBtn.disabled = false;
  }
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatMessageText(text) {
  return text
    .split(/(`[^`\n]+`)/g)
    .map(part => {
      if (/^`[^`\n]+`$/.test(part)) {
        return `<code>${escapeHtml(part.slice(1, -1))}</code>`;
      }

      return escapeHtml(part).replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    })
    .join("")
    .replace(/\n/g, "<br>");
}

function appendMessage(role, text) {
  const msgs = document.getElementById("chat-messages");
  const now = new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });

  const div = document.createElement("div");
  div.className = "msg " + role;

  const formatted = formatMessageText(text);

  const avatarLabel = role === "bot" ? "AI" : "BẠN";
  div.innerHTML = `
    <div class="msg-avatar">${avatarLabel}</div>
    <div class="msg-content">
      <div class="msg-bubble">${formatted}</div>
      <div class="msg-time">${now}</div>
    </div>`;

  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
  return div.querySelector(".msg-bubble");
}

function showTyping() {
  const msgs = document.getElementById("chat-messages");
  const id = "typing-" + Date.now();
  const div = document.createElement("div");
  div.className = "msg bot";
  div.id = id;
  div.innerHTML = `
    <div class="msg-avatar">AI</div>
    <div class="msg-content">
      <div class="msg-bubble">
        <div class="typing-indicator">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        </div>
      </div>
    </div>`;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
  return id;
}

function removeTyping(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

// ── WARNING TAB ──
function getUniqueChemicalCatalog(includeAll = false) {
  const unique = new Map();
  getChemicalCatalog(includeAll).forEach(chem => {
    if (!unique.has(chem.key)) unique.set(chem.key, chem);
  });
  return [...unique.values()];
}

function getChemByKey(key) {
  return getUniqueChemicalCatalog(true).find(chem => chem.key === key);
}

function getChemLabel(key) {
  const chem = getChemByKey(key);
  return chem ? `${chem.formula} (${chem.name})` : key;
}

function getChemShortLabel(key) {
  return getChemByKey(key)?.formula || key;
}

function getMixGroupLabel(chem) {
  const text = normalizeText(`${chem.formula} ${chem.name} ${chem.properties} ${chem.msds}`);
  const formula = compactFormula(chem.formula);

  if (text.includes("khi ") || text.includes("gas") || ["cl2", "nh3", "h2s", "so2", "co", "co2", "o2", "h2", "n2"].includes(formula)) return "Khí";
  if (text.includes("axit") || text.includes("acid") || ["hcl", "h2so4", "hno3", "hf", "hbr", "hi", "hclo4"].includes(formula)) return "Axit";
  if (text.includes("kiem") || text.includes("hydroxide") || text.includes("amoniac")) return "Bazơ / kiềm";
  if (text.includes("oxy hoa") || text.includes("hypochlorite") || text.includes("nitrate") || text.includes("nitrite") || text.includes("perchloric")) return "Oxy hóa / nitrate";
  if (text.includes("dung moi") || text.includes("de chay") || text.includes("solvent") || text.includes("alcohol") || text.includes("ether")) return "Dung môi / hữu cơ";
  if (text.includes("kim loai") || ["mg", "zn", "al", "fe", "cu", "p", "s", "c"].includes(formula)) return "Kim loại / nguyên tố";
  if (text.includes("muoi") || text.includes("chloride") || text.includes("sulfate") || text.includes("carbonate") || text.includes("fluoride")) return "Muối vô cơ";
  return "Khác";
}

function renderMixOptions() {
  const selects = [document.getElementById("chem1"), document.getElementById("chem2")].filter(Boolean);
  if (!selects.length) return;

  const groupOrder = ["Axit", "Bazơ / kiềm", "Oxy hóa / nitrate", "Dung môi / hữu cơ", "Khí", "Muối vô cơ", "Kim loại / nguyên tố", "Khác"];
  const groups = Object.fromEntries(groupOrder.map(group => [group, []]));
  getUniqueChemicalCatalog().forEach(chem => {
    const group = getMixGroupLabel(chem);
    (groups[group] || groups["Khác"]).push(chem);
  });

  const optionsHtml = `<option value="">— Chọn hóa chất —</option>` + groupOrder
    .filter(group => groups[group].length)
    .map(group => {
      const options = groups[group]
        .sort((a, b) => a.formula.localeCompare(b.formula, "vi"))
        .map(chem => `<option value="${escapeHtml(chem.key)}">${escapeHtml(`${chem.formula} —${chem.name}`)}</option>`)
        .join("");
      return `<optgroup label="${escapeHtml(group)}">${options}</optgroup>`;
    })
    .join("");

  selects.forEach(select => {
    const selected = select.value;
    select.innerHTML = optionsHtml;
    if (selected) select.value = selected;
  });
}

function renderCommonWarnings() {
  const list = document.getElementById("common-warnings");
  if (!list) return;

  const priority = [
    "naclo|hcl", "naclo|nh3", "na2s|hcl", "nano2|hcl", "hclo4|ethanol",
    "h2|o2", "h2s|cl2", "hcl|naoh", "h2so4|naoh", "hno3|ethanol",
    "h2o2|acetone", "cl2|nh3", "h2so4|h2o2", "k2cr2o7|h2so4"
  ];
  const orderedKeys = [
    ...priority.filter(key => MIX_WARNINGS[key]),
    ...Object.keys(MIX_WARNINGS).filter(key => !priority.includes(key))
  ].slice(0, 16);

  list.innerHTML = orderedKeys.map(key => {
    const warning = MIX_WARNINGS[key];
    const [first, second] = key.split("|");
    const badgeClass = warning.level === "caution" ? "amber" : "red";
    const badgeText = warning.level === "caution" ? "THẬN TRỌNG" : "NGUY HIỂM";
    const pair = `${getChemShortLabel(first)} + ${getChemShortLabel(second)}`;
    const desc = warning.desc.split(".")[0];

    return `
      <div class="warn-item ${escapeHtml(warning.level)}" onclick="loadWarn('${first}','${second}')">
        <div class="warn-badge ${badgeClass}">${badgeText}</div>
        <div class="warn-info">
          <div class="warn-name">${escapeHtml(pair)}</div>
          <div class="warn-desc">${escapeHtml(desc)}</div>
        </div>
      </div>`;
  }).join("");
}

function loadWarn(c1, c2) {
  // Cảnh báo an toàn luôn xem được: nếu chất nằm ngoài lớp đang chọn thì thêm tạm vào ô chọn
  ["chem1", "chem2"].forEach((id, i) => {
    const sel = document.getElementById(id);
    const key = i === 0 ? c1 : c2;
    if (sel && ![...sel.options].some(o => o.value === key)) {
      const chem = getChemByKey(key);
      sel.insertAdjacentHTML("beforeend", `<option value="${escapeHtml(key)}">${escapeHtml(`${chem ? chem.formula + " —" + chem.name : key} (ngoài lớp đang chọn)`)}</option>`);
    }
  });
  document.getElementById("chem1").value = c1;
  document.getElementById("chem2").value = c2;
  autoCheck();
}

function autoCheck() {
  const c1 = document.getElementById("chem1").value;
  const c2 = document.getElementById("chem2").value;
  if (!c1 || !c2) return;
  if (c1 === c2) {
    document.getElementById("mix-result").innerHTML = `
      <div class="result-card neutral">
        <div class="result-title">— Cùng một chất</div>
        Không có phản ứng đặc biệt khi trộn một chất với chính nó.
      </div>`;
    return;
  }
  const key = getMixKey(c1, c2);
  const resultEl = document.getElementById("mix-result");
  if (key) {
    const w = MIX_WARNINGS[key];
    const tags = w.tags.map(t => `<span class="rtag">${t}</span>`).join("");
    resultEl.innerHTML = `
      <div class="result-card ${w.level}">
        <div class="result-title">${w.title}</div>
        <div style="font-family:var(--font-mono);font-size:12px;color:var(--text-secondary);margin-bottom:8px">${w.reaction}</div>
        ${w.desc}
        <div class="result-tags">${tags}</div>
      </div>`;
  } else {
    resultEl.innerHTML = `
      <div class="result-card safe">
        <div class="result-title">✅ Không có cảnh báo đặc biệt</div>
        Tổ hợp này không nằm trong danh sách nguy hiểm đã biết. Tuy nhiên vẫn cần tuân thủ quy trình an toàn cơ bản. Nhấn "Phân tích bằng chatbot" để kiểm tra chi tiết hơn.
      </div>`;
  }
}

async function analyzeWithAI() {
  const c1 = document.getElementById("chem1").value;
  const c2 = document.getElementById("chem2").value;
  if (!c1 || !c2) { alert("Vui lòng chọn 2 hóa chất trước!"); return; }

  const question = `Phân tích nguy hiểm khi trộn ${getChemLabel(c1)} với ${getChemLabel(c2)}. Cho biết: phản ứng xảy ra, mức độ nguy hiểm, biện pháp an toàn và PPE cần thiết.`;

  // Chuyển sang tab chat và gửi câu hỏi
  const chatBtn = document.querySelector('[data-tab="chat"]');
  switchTab("chat", chatBtn);
  document.getElementById("chat-input").value = question;
  sendMessage();
}

// ── CALC TAB ──
function renderCalcOptions() {

  const searchInput =
    document.getElementById("calc-chemical-search");

  const hiddenInput =
    document.getElementById("calc-chem");

  if (!searchInput || !hiddenInput) return;

  hiddenInput.value = 0;

  const firstChemical = CHEM_DATABASE[0];

  if (firstChemical) {
    searchInput.value =
      `${firstChemical.formula} - ${firstChemical.name}`;
  }

  renderCalcChemicalResults("");

  updateCalc();
}


function searchCalcChemical(keyword) {

  const results =
    document.getElementById(
      "calc-chemical-results"
    );

  if (!results) return;

  renderCalcChemicalResults(keyword);

  results.classList.add("show");
}


function showCalcChemicalResults() {

  const keyword =
    document.getElementById(
      "calc-chemical-search"
    )?.value || "";

  const results =
    document.getElementById(
      "calc-chemical-results"
    );

  if (!results) return;

  renderCalcChemicalResults(keyword);

  results.classList.add("show");
}


function renderCalcChemicalResults(keyword = "") {

  const results =
    document.getElementById(
      "calc-chemical-results"
    );

  if (!results) return;

  const search =
    normalizeText(keyword.trim());

  let chemicals = CHEM_DATABASE.filter(chem => isChemInGrade(chem));

  if (search) {

    chemicals = chemicals.filter(chem => {

      const formula =
        normalizeText(chem.formula || "");

      const name =
        normalizeText(chem.name || "");

      return (
        formula.includes(search) ||
        name.includes(search)
      );

    });

  }

  // Giới hạn số kết quả hiển thị
  chemicals = chemicals.slice(0, 20);


  if (!chemicals.length) {

    results.innerHTML = `
      <div class="chemical-no-result">
        Không tìm thấy hóa chất
      </div>
    `;

    return;
  }


  results.innerHTML =
    chemicals.map(chem => {

      const index =
        CHEM_DATABASE.indexOf(chem);

      const molarMass =
        chem.molarMass ||
        Number.parseFloat(chem.molar);


      return `
        <button
          type="button"
          class="chemical-search-item"
          onclick="selectCalcChemical(${index})"
        >

          <div class="chemical-result-main">

            <span class="chemical-result-formula">
              ${escapeHtml(chem.formula || "--")}
            </span>

            <span class="chemical-result-name">
              ${escapeHtml(chem.name || "Không có tên")}
            </span>

          </div>

          <span class="chemical-result-molar">
            M = ${formatCalcNumber(molarMass, "g/mol")}
          </span>

        </button>
      `;

    }).join("");
}


function selectCalcChemical(index) {

  const chem =
    CHEM_DATABASE[index];

  if (!chem) return;


  // Lưu index
  const hiddenInput =
    document.getElementById("calc-chem");

  if (hiddenInput) {
    hiddenInput.value = index;
  }


  // Hiển thị tên trong ô tìm kiếm
  const searchInput =
    document.getElementById(
      "calc-chemical-search"
    );

  if (searchInput) {

    searchInput.value =
      `${chem.formula} - ${chem.name}`;

  }


  // Đóng danh sách
  const results =
    document.getElementById(
      "calc-chemical-results"
    );

  if (results) {
    results.classList.remove("show");
  }


  // Cập nhật Calculator
  updateCalc();
}

function getSelectedCalcChemical() {
  const index = Number(document.getElementById("calc-chem")?.value || 0);
  return CHEM_DATABASE[index] || CHEM_DATABASE[0];
}

function readCalcNumber(id) {
  const raw = document.getElementById(id)?.value;
  if (raw === undefined || raw === null || String(raw).trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function formatCalcNumber(value, unit) {
  if (!Number.isFinite(value)) return "--";
  const formatted = value === 0
    ? "0"
    : value.toLocaleString("vi-VN", { maximumSignificantDigits: 6 });
  return unit ? `${formatted} ${unit}` : formatted;
}

function setCalcText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

// =========================================
// CALCULATOR UNIT CONVERSION
// =========================================

function convertMassToGram(value, unit) {

  if (value === null) return null;

  switch (unit) {

    case "mg":
      return value / 1000;

    case "kg":
      return value * 1000;

    case "g":
    default:
      return value;

  }
}


function convertVolumeToLiter(value, unit) {

  if (value === null) return null;

  switch (unit) {

    case "mL":
      return value / 1000;

    case "L":
    default:
      return value;

  }
}

function updateCalc() {
  const chem = getSelectedCalcChemical();
  if (!chem) return;

  const molarMass = chem.molarMass || Number.parseFloat(chem.molar);
  setCalcText("calc-formula", chem.formula);
  setCalcText("calc-name", chem.name);
  setCalcText("calc-molar-mass", formatCalcNumber(molarMass, "g/mol"));
  setCalcText("calc-danger", chem.dangerLabel);
  setCalcText("calc-ph", chem.ph);

  const massInput = readCalcNumber("calc-mass-g");
  const massUnit =
    document.getElementById("calc-mass-unit")?.value || "g";

  const moles = readCalcNumber("calc-moles");

  const volumeInput = readCalcNumber("calc-volume-l");
  const volumeUnit =
    document.getElementById("calc-volume-unit")?.value || "L";


  // Quy đổi về đơn vị chuẩn
  // Khối lượng → g
  // Thể tích → L

  const mass = convertMassToGram(
    massInput,
    massUnit
  );

  const volume = convertVolumeToLiter(
    volumeInput,
    volumeUnit
  );


  // Tính toán

  const molesFromMass =
    mass !== null && molarMass > 0
      ? mass / molarMass
      : NaN;

  const massFromMoles =
    moles !== null
      ? moles * molarMass
      : NaN;

  const baseMoles =
    moles !== null
      ? moles
      : molesFromMass;

  const molarity =
    Number.isFinite(baseMoles) &&
      volume !== null &&
      volume > 0
      ? baseMoles / volume
      : NaN;

  setCalcText("calc-result-moles", formatCalcNumber(molesFromMass, "mol"));
  setCalcText("calc-result-mass", formatCalcNumber(massFromMoles, "g"));
  setCalcText("calc-result-molarity", formatCalcNumber(molarity, "M"));

  const targetM =
    readCalcNumber("calc-target-m");

  const targetVolumeInput =
    readCalcNumber("calc-target-volume-l");

  const targetVolumeUnit =
    document.getElementById(
      "calc-target-volume-unit"
    )?.value || "L";

  const targetVolume =
    convertVolumeToLiter(
      targetVolumeInput,
      targetVolumeUnit
    );
  const targetMoles = targetM && targetVolume ? targetM * targetVolume : NaN;
  const gramsNeeded = Number.isFinite(targetMoles) ? targetMoles * molarMass : NaN;

  setCalcText("calc-result-target-moles", formatCalcNumber(targetMoles, "mol"));
  setCalcText("calc-result-grams-needed", formatCalcNumber(gramsNeeded, "g"));

  const stockM =
    readCalcNumber("calc-stock-m");

  const finalM =
    readCalcNumber("calc-final-m");

  const finalVolumeInput =
    readCalcNumber("calc-final-volume-l");

  const finalVolumeUnit =
    document.getElementById(
      "calc-final-volume-unit"
    )?.value || "L";

  const finalVolume =
    convertVolumeToLiter(
      finalVolumeInput,
      finalVolumeUnit
    );
  const stockVolume = stockM && finalM && finalVolume ? (finalM * finalVolume) / stockM : NaN;
  const solventVolume = Number.isFinite(stockVolume) && finalVolume !== null
    ? Math.max(finalVolume - stockVolume, 0)
    : NaN;

  setCalcText("calc-result-stock-volume", formatCalcNumber(stockVolume, "L"));
  setCalcText("calc-result-solvent", formatCalcNumber(solventVolume, "L"));
}

// ── DATABASE TAB (nhóm theo lớp) ──
let dbGradeView = "group"; // "group" = chia nhóm theo lớp; 6..12 hoặc "nc" = chỉ một nhóm

function getAllowedGradeGroups() {
  const nums = currentGrade === "all" ? GRADE_NUMBERS : GRADE_NUMBERS.filter(g => g <= currentGrade);
  return currentGrade === "all" ? [...nums, "nc"] : nums;
}

function renderDBGradeChips() {
  const row = document.getElementById("db-grade-chips");
  if (!row) return;
  const groups = getAllowedGradeGroups();
  if (dbGradeView !== "group" && !groups.includes(dbGradeView)) dbGradeView = "group";
  const chip = (v, label) => `<button class="grade-chip${dbGradeView === v ? " active" : ""}" type="button" onclick="setDbGradeView(${typeof v === "number" ? v : `'${v}'`})">${label}</button>`;
  row.innerHTML = chip("group", "Tất cả nhóm") + groups.map(g => chip(g, g === "nc" ? "Nâng cao" : `Lớp ${g}`)).join("");
}

function setDbGradeView(v) {
  dbGradeView = v;
  renderDBGradeChips();
  filterDB(document.querySelector(".db-search")?.value || "");
}

function renderDBCard(chem) {
  const dangerColors = {
    danger: { color: "#ff4757", bg: "rgba(255,71,87,0.1)", border: "rgba(255,71,87,0.3)" },
    caution: { color: "#ffa502", bg: "rgba(255,165,2,0.1)", border: "rgba(255,165,2,0.3)" },
    safe: { color: "#2ed573", bg: "rgba(46,213,115,0.1)", border: "rgba(46,213,115,0.3)" }
  };
  const dc = dangerColors[chem.danger] || dangerColors.safe;
  const f = chem.formula.replace(/'/g, "\\'"), n = chem.name.replace(/'/g, "\\'");
  return `
      <div class="db-card" onclick="askAbout('${f}', '${n}')" title="${escapeHtml(formatGradeTopics(chem))}">
        <div class="db-card-grades">${getGradeBadgesHtml(chem)}</div>
        <div class="db-card-formula" style="color:${dc.color}">${chem.formula}</div>
        <div class="db-card-name">${chem.name}</div>
        <div class="db-card-props">
          <div class="db-prop-row"><span>Khối lượng phân tử</span><span class="db-prop-val">${chem.molar}</span></div>
          <div class="db-prop-row"><span>Điểm sôi</span><span class="db-prop-val">${chem.boiling}</span></div>
          <div class="db-prop-row"><span>pH (dd)</span><span class="db-prop-val">${chem.ph}</span></div>
        </div>
        <span class="db-danger-badge" style="background:${dc.bg};color:${dc.color};border:1px solid ${dc.border}">
          ${chem.dangerLabel}
        </span>
        <div style="margin-top:8px;font-size:11px;color:var(--text-dim)">Nhấn để hỏi AI →</div>
        <button class="mol3d-db-btn" type="button" onclick="event.stopPropagation(); openMol3DByFormula('${f}')">🧬 Xem 3D</button>
      </div>`;
}

// data = danh sách đã lọc theo ô tìm kiếm; hàm này chia tiếp theo lớp
function renderDB(data) {
  const grid = document.getElementById("db-grid");
  const groups = dbGradeView === "group" ? getAllowedGradeGroups() : [dbGradeView];
  const html = groups.map(g => {
    const seen = new Set(); // CSDL có vài mục trùng công thức (vd. NaCl) → chỉ hiện 1 thẻ
    const items = data.filter(c => g === "nc" ? c.isAdvanced : (c.grades || []).includes(g))
      .filter(c => !seen.has(c.formula) && seen.add(c.formula));
    if (!items.length) return "";
    const title = g === "nc"
      ? `Nâng cao <small>· ngoài chương trình phổ thông / phòng thí nghiệm</small>`
      : `Lớp ${g} <small>· ${getGradeSubject(g)}</small>`;
    return `
      <section class="db-grade-group">
        <h2 class="db-grade-title">${title}<span class="db-grade-count">${items.length} chất</span></h2>
        <div class="db-grade-cards">${items.map(renderDBCard).join("")}</div>
      </section>`;
  }).join("");
  grid.innerHTML = html || `<div class="chemical-no-result">Không có hóa chất phù hợp trong phạm vi ${getGradeLabel()}.</div>`;
}

let filterDBDebounceTimer = null;
function filterDB(query) {
  if (filterDBDebounceTimer) clearTimeout(filterDBDebounceTimer);
  filterDBDebounceTimer = setTimeout(() => {
    const q = normalizeText(query);
    const compact = compactFormula(query);
    const filtered = CHEM_DATABASE.filter(c => {
      const searchableText = normalizeText([
        c.formula,
        c.name,
        c.properties,
        c.msds,
        ...(c.aliases || [])
      ].join(" "));
      const searchableFormula = compactFormula(c.formula);

      return searchableText.includes(q) ||
        (compact && searchableFormula.includes(compact));
    });
    renderDB(filtered);
  }, 120);
}

function askAbout(formula, name) {
  const chatBtn = document.querySelector('[data-tab="chat"]');
  switchTab("chat", chatBtn);
  document.getElementById("chat-input").value = `Cho tôi biết thông tin đầy đủ về ${formula} (${name}): tính chất, mức độ nguy hiểm và PPE cần thiết.`;
  sendMessage();
}

// ── KHỞI TẠO ──
document.addEventListener("DOMContentLoaded", () => {
  renderMixOptions();
  renderCommonWarnings();
  renderDBGradeChips();
  renderDB(CHEM_DATABASE);
  renderCalcOptions();
  renderQuickChips();
  updateGradeUI();
});

// ═══════════════════════════════════════
// STEP-BY-STEP CHEMISTRY SOLUTIONS
// ═══════════════════════════════════════

function showSolution(id, html) {
  const box = document.getElementById(id);

  if (!box) {
    console.error("Không tìm thấy solution box:", id);
    return;
  }

  box.innerHTML = html;
  box.classList.add("show");
}


// ═══════════════════════════════════════
// MOL / MASS / MOLARITY
// ═══════════════════════════════════════

function showMoleSolution() {
  const chem = getSelectedCalcChemical();

  if (!chem) {
    alert("Vui lòng chọn hóa chất.");
    return;
  }

  const molarMass =
    chem.molarMass ||
    Number.parseFloat(chem.molar);

  const mass = readCalcNumber("calc-mass-g");
  const moles = readCalcNumber("calc-moles");
  const volume = readCalcNumber("calc-volume-l");

  let html = `
        <div class="solution-header">
            📘 LỜI GIẢI TỪNG BƯỚC
        </div>
    `;


  if (
    mass === null &&
    moles === null &&
    volume === null
  ) {

    html += `
            <div class="solution-empty">
                ⚠️ Vui lòng nhập dữ liệu trước khi xem lời giải.
            </div>
        `;

    showSolution("mole-solution", html);
    return;
  }


  // KHỐI LƯỢNG → MOL
  if (mass !== null) {

    const calculatedMoles =
      mass / molarMass;

    html += `
            <div class="solution-step">

                <div class="solution-step-title">
                    Bước 1 — Dữ kiện
                </div>

                <div>
                    Hóa chất:
                    <strong>${chem.formula}</strong>
                </div>

                <div>
                    Khối lượng:
                    <strong>${mass} g</strong>
                </div>

                <div>
                    Khối lượng mol:
                    <strong>${molarMass.toFixed(4)} g/mol</strong>
                </div>

            </div>


            <div class="solution-step">

                <div class="solution-step-title">
                    Bước 2 — Công thức
                </div>

                <div class="solution-formula">
                    n = m / M
                </div>

            </div>


            <div class="solution-step">

                <div class="solution-step-title">
                    Bước 3 — Thay số
                </div>

                <div class="solution-formula">
                    n = ${mass} / ${molarMass.toFixed(4)}
                </div>

            </div>


            <div class="solution-step">

                <div class="solution-step-title">
                    Bước 4 — Kết quả
                </div>

                <div class="solution-answer">
                    n = ${calculatedMoles.toFixed(6)} mol
                </div>

            </div>
        `;
  }


  // MOL → KHỐI LƯỢNG
  if (moles !== null) {

    const calculatedMass =
      moles * molarMass;

    html += `
            <div class="solution-step">

                <div class="solution-step-title">
                    Tính khối lượng
                </div>

                <div class="solution-formula">
                    m = n × M
                </div>

                <br>

                <div class="solution-formula">
                    m = ${moles} × ${molarMass.toFixed(4)}
                </div>

                <div class="solution-answer">
                    m = ${calculatedMass.toFixed(6)} g
                </div>

            </div>
        `;
  }


  // MOLARITY
  if (
    volume !== null &&
    volume > 0
  ) {

    const baseMoles =
      moles !== null
        ? moles
        : mass !== null
          ? mass / molarMass
          : null;


    if (baseMoles !== null) {

      const molarity =
        baseMoles / volume;

      html += `
                <div class="solution-step">

                    <div class="solution-step-title">
                        Tính nồng độ mol
                    </div>

                    <div class="solution-formula">
                        C = n / V
                    </div>

                    <br>

                    <div class="solution-formula">
                        C =
                        ${baseMoles.toFixed(6)}
                        /
                        ${volume}
                    </div>

                    <div class="solution-answer">
                        C = ${molarity.toFixed(6)} M
                    </div>

                </div>
            `;
    }
  }


  showSolution(
    "mole-solution",
    html
  );
}


// ═══════════════════════════════════════
// PHA DUNG DỊCH
// ═══════════════════════════════════════

function showPreparationSolution() {

  const chem =
    getSelectedCalcChemical();

  if (!chem) {
    alert("Vui lòng chọn hóa chất.");
    return;
  }

  const molarMass =
    chem.molarMass ||
    Number.parseFloat(chem.molar);

  const targetM =
    readCalcNumber("calc-target-m");

  const targetVolume =
    readCalcNumber("calc-target-volume-l");


  let html = `
        <div class="solution-header">
            📘 LỜI GIẢI PHA DUNG DỊCH
        </div>
    `;


  if (
    targetM === null ||
    targetVolume === null ||
    targetM <= 0 ||
    targetVolume <= 0
  ) {

    html += `
            <div class="solution-empty">
                ⚠️ Vui lòng nhập nồng độ và thể tích cần pha.
            </div>
        `;

    showSolution(
      "preparation-solution",
      html
    );

    return;
  }


  const targetMoles =
    targetM * targetVolume;

  const gramsNeeded =
    targetMoles * molarMass;


  html += `

        <div class="solution-step">

            <div class="solution-step-title">
                Bước 1 — Dữ kiện
            </div>

            <div>
                Hóa chất:
                <strong>${chem.formula}</strong>
            </div>

            <div>
                Nồng độ:
                <strong>${targetM} M</strong>
            </div>

            <div>
                Thể tích:
                <strong>${targetVolume} L</strong>
            </div>

            <div>
                Khối lượng mol:
                <strong>${molarMass.toFixed(4)} g/mol</strong>
            </div>

        </div>


        <div class="solution-step">

            <div class="solution-step-title">
                Bước 2 — Tính số mol
            </div>

            <div class="solution-formula">
                n = C × V
            </div>

            <br>

            <div class="solution-formula">
                n = ${targetM} × ${targetVolume}
            </div>

            <div class="solution-answer">
                n = ${targetMoles.toFixed(6)} mol
            </div>

        </div>


        <div class="solution-step">

            <div class="solution-step-title">
                Bước 3 — Tính khối lượng
            </div>

            <div class="solution-formula">
                m = n × M
            </div>

            <br>

            <div class="solution-formula">
                m =
                ${targetMoles.toFixed(6)}
                ×
                ${molarMass.toFixed(4)}
            </div>

            <div class="solution-answer">
                m = ${gramsNeeded.toFixed(6)} g
            </div>

        </div>


        <div class="solution-step">

            <div class="solution-step-title">
                Bước 4 — Kết luận
            </div>

            <div class="solution-answer">
                Cần cân
                ${gramsNeeded.toFixed(4)} g
                ${chem.formula}
                để pha
                ${targetVolume} L
                dung dịch
                ${targetM} M.
            </div>

        </div>

    `;


  showSolution(
    "preparation-solution",
    html
  );
}


// ═══════════════════════════════════════
// PHA LOÃNG
// ═══════════════════════════════════════

function showDilutionSolution() {

  const stockM =
    readCalcNumber("calc-stock-m");

  const finalM =
    readCalcNumber("calc-final-m");

  const finalVolume =
    readCalcNumber("calc-final-volume-l");


  let html = `
        <div class="solution-header">
            📘 LỜI GIẢI PHA LOÃNG
        </div>
    `;


  if (
    stockM === null ||
    finalM === null ||
    finalVolume === null ||
    stockM <= 0 ||
    finalM <= 0 ||
    finalVolume <= 0
  ) {

    html += `
            <div class="solution-empty">
                ⚠️ Vui lòng nhập đầy đủ C₁, C₂ và V₂.
            </div>
        `;

    showSolution(
      "dilution-solution",
      html
    );

    return;
  }


  const stockVolume =
    (finalM * finalVolume) /
    stockM;

  const solventVolume =
    Math.max(
      finalVolume - stockVolume,
      0
    );


  html += `

        <div class="solution-step">

            <div class="solution-step-title">
                Bước 1 — Dữ kiện
            </div>

            <div>
                C₁ =
                <strong>${stockM} M</strong>
            </div>

            <div>
                C₂ =
                <strong>${finalM} M</strong>
            </div>

            <div>
                V₂ =
                <strong>${finalVolume} L</strong>
            </div>

        </div>


        <div class="solution-step">

            <div class="solution-step-title">
                Bước 2 — Công thức
            </div>

            <div class="solution-formula">
                C₁V₁ = C₂V₂
            </div>

        </div>


        <div class="solution-step">

            <div class="solution-step-title">
                Bước 3 — Tính V₁
            </div>

            <div class="solution-formula">
                V₁ = (C₂ × V₂) / C₁
            </div>

            <br>

            <div class="solution-formula">
                V₁ =
                (${finalM} × ${finalVolume})
                /
                ${stockM}
            </div>

            <div class="solution-answer">
                V₁ = ${stockVolume.toFixed(6)} L
            </div>

        </div>


        <div class="solution-step">

            <div class="solution-step-title">
                Bước 4 — Lượng dung môi
            </div>

            <div class="solution-formula">
                Vdung môi = V₂ − V₁
            </div>

            <br>

            <div class="solution-formula">
                ${finalVolume}
                −
                ${stockVolume.toFixed(6)}
            </div>

            <div class="solution-answer">
                Dung môi ≈
                ${solventVolume.toFixed(6)} L
            </div>

        </div>

    `;


  showSolution(
    "dilution-solution",
    html
  );
}


// ═══════════════════════════════════════
// MAKE FUNCTIONS AVAILABLE TO HTML
// ═══════════════════════════════════════

window.showMoleSolution = showMoleSolution;
window.showPreparationSolution = showPreparationSolution;
window.showDilutionSolution = showDilutionSolution;

// ═══════════════════════════════════════
// CALCULATOR → AI
// ═══════════════════════════════════════


// ───────────────────────────────────────
// Lấy thông tin hóa chất hiện tại
// ───────────────────────────────────────

function getCalculatorChemicalContext() {

  const chem = getSelectedCalcChemical();

  if (!chem) {
    return null;
  }

  const molarMass =
    chem.molarMass ||
    Number.parseFloat(chem.molar);

  return {
    name: chem.name || chem.formula,
    formula: chem.formula || "",
    molarMass: molarMass
  };
}


// ───────────────────────────────────────
// MOL / MASS / MOLARITY → AI
// ───────────────────────────────────────

function askAIAboutMoleProblem() {

  const chem =
    getCalculatorChemicalContext();

  if (!chem) {
    alert("Vui lòng chọn hóa chất trước.");
    return;
  }


  const mass =
    readCalcNumber("calc-mass-g");

  const moles =
    readCalcNumber("calc-moles");

  const volume =
    readCalcNumber("calc-volume-l");


  if (
    mass === null &&
    moles === null &&
    volume === null
  ) {
    alert("Vui lòng nhập dữ liệu Calculator trước.");
    return;
  }


  const calculatedMoles =
    mass !== null
      ? mass / chem.molarMass
      : moles;


  let calculatedMolarity = null;

  if (
    volume !== null &&
    volume > 0 &&
    calculatedMoles !== null
  ) {
    calculatedMolarity =
      calculatedMoles / volume;
  }


  const prompt = `
Tôi đang học Hóa học và vừa sử dụng Chemistry Calculator.

Hóa chất:
- Tên: ${chem.name}
- Công thức: ${chem.formula}
- Khối lượng mol: ${chem.molarMass.toFixed(4)} g/mol

Dữ kiện:
- Khối lượng: ${mass !== null ? mass + " g" : "Không nhập"}
- Số mol: ${moles !== null ? moles + " mol" : "Không nhập"}
- Thể tích dung dịch: ${volume !== null ? volume + " L" : "Không nhập"}

Kết quả Calculator:
- Số mol: ${calculatedMoles !== null
      ? calculatedMoles.toFixed(6) + " mol"
      : "Không tính được"
    }

- Nồng độ mol: ${calculatedMolarity !== null
      ? calculatedMolarity.toFixed(6) + " M"
      : "Không tính được"
    }

Hãy giải thích bài toán này cho một học sinh.

Yêu cầu:
1. Giải thích dữ kiện.
2. Giải thích công thức được sử dụng.
3. Giải thích tại sao dùng công thức đó.
4. Kiểm tra kết quả Calculator.
5. Nếu có lỗi, chỉ ra lỗi.
6. Đưa ra một mẹo để nhớ công thức.

Không cần giải thích quá dài.
Hãy dùng tiếng Việt dễ hiểu.
    `;


  sendQuick(prompt);
}


// ───────────────────────────────────────
// PHA DUNG DỊCH → AI
// ───────────────────────────────────────

function askAIAboutPreparation() {

  const chem =
    getCalculatorChemicalContext();

  if (!chem) {
    alert("Vui lòng chọn hóa chất trước.");
    return;
  }


  const targetM =
    readCalcNumber("calc-target-m");

  const targetVolume =
    readCalcNumber(
      "calc-target-volume-l"
    );


  if (
    targetM === null ||
    targetVolume === null
  ) {
    alert("Vui lòng nhập đầy đủ dữ liệu.");
    return;
  }


  const targetMoles =
    targetM * targetVolume;


  const gramsNeeded =
    targetMoles * chem.molarMass;


  const prompt = `
Tôi đang học Hóa học.

Tôi cần pha dung dịch:

Hóa chất:
${chem.name}
Công thức:
${chem.formula}

Khối lượng mol:
${chem.molarMass.toFixed(4)} g/mol

Nồng độ cần pha:
${targetM} M

Thể tích cần pha:
${targetVolume} L

Calculator tính được:

Số mol:
${targetMoles.toFixed(6)} mol

Khối lượng hóa chất:
${gramsNeeded.toFixed(6)} g

Hãy giải thích cho học sinh:

1. Tại sao phải tính số mol trước?
2. Công thức n = C × V có ý nghĩa gì?
3. Tại sao m = n × M?
4. Kiểm tra kết quả.
5. Giải thích ngắn gọn quy trình pha dung dịch.

Dùng tiếng Việt dễ hiểu.
    `;


  sendQuick(prompt);
}


// ───────────────────────────────────────
// PHA LOÃNG → AI
// ───────────────────────────────────────

function askAIAboutDilution() {

  const stockM =
    readCalcNumber("calc-stock-m");

  const finalM =
    readCalcNumber("calc-final-m");

  const finalVolume =
    readCalcNumber(
      "calc-final-volume-l"
    );


  if (
    stockM === null ||
    finalM === null ||
    finalVolume === null
  ) {
    alert("Vui lòng nhập đầy đủ dữ liệu.");
    return;
  }


  const stockVolume =
    (finalM * finalVolume) /
    stockM;


  const solventVolume =
    Math.max(
      finalVolume - stockVolume,
      0
    );


  const prompt = `
Tôi đang học Hóa học.

Tôi đang giải bài toán pha loãng.

Dữ kiện:

C₁ = ${stockM} M

C₂ = ${finalM} M

V₂ = ${finalVolume} L

Calculator đã tính:

Công thức:
C₁V₁ = C₂V₂

V₁ =
${stockVolume.toFixed(6)} L

Lượng dung môi cần thêm ≈
${solventVolume.toFixed(6)} L

Hãy:

1. Giải thích công thức C₁V₁ = C₂V₂.
2. Giải thích tại sao có thể sử dụng công thức này.
3. Kiểm tra kết quả.
4. Giải thích cách thực hiện pha loãng ngoài thực tế.
5. Nêu một lỗi học sinh thường mắc khi làm dạng bài này.

Dùng tiếng Việt dễ hiểu.
    `;


  sendQuick(prompt);
}
// Bấm ra ngoài ô tìm hóa chất thì đóng danh sách gợi ý
document.addEventListener("click", e => {
  if (!e.target.closest(".chemical-search-wrap")) {
    document.getElementById("calc-chemical-results")?.classList.remove("show");
  }
});


// ═══════════════════════════════════════════════════════════════
//   SECTION: 3D MOLECULAR VIEWER & STRUCTURE AUDIT (MOL3D)
//   (Tích hợp từ mol3d.js - Tối ưu hóa gom file tĩnh và quản lý bộ nhớ)
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════
//   CHEMSAFE AI — MOL3D.JS (bản OFFLINE)
//   Mô hình cấu tạo 3D hóa chất — đọc THẲNG từ trường chem.sdf3d đã được
//   nhúng sẵn trong chemdata.js. Tọa độ = hình học cân bằng tính bằng DFT
//   (B3LYP-D3(BJ)/def2, PySCF). chem.bonds3d = [i, j, độ dài Å, bậc liên kết
//   Mayer, "cov" | "ion"] tính từ mật độ electron DFT. Không gọi API nào.
// ═══════════════════════════════════════

let currentMol3DViewer = null;
let mol3DSpinning = false;
const MOL3D_SPIN_SPEED = 1; // tốc độ xoay (độ/khung hình), có thể chỉnh 0.5 (chậm) - 2 (nhanh)

// Trạng thái lớp phủ (trục tọa độ, độ dài, góc, nguyên tử đang chọn)
const mol3DOverlay = { axes: true, lengths: false, angles: false, axisScale: 1, picked: null, atoms: [], chem: null };

// Tra bậc liên kết Mayer (DFT) của cặp nguyên tử i–j (chỉ số 0-based)
function mol3DBondInfo(i, j) {
  const list = mol3DOverlay.chem && mol3DOverlay.chem.bonds3d;
  if (!list) return null;
  return list.find(b => (b[0] === i && b[1] === j) || (b[0] === j && b[1] === i)) || null;
}

// Ion kim loại đơn nguyên tử → vẽ nét đứt (liên kết ion) tới nguyên tử gần nhất
const MOL3D_METALS = new Set(["Li","Na","K","Mg","Ca","Ba","Al","Fe","Cu","Zn","Ag","Pb","Hg","Cd","Co","Ni","Mn","Cr"]);
const MOL3D_AXIS_COLORS = { x: "#ff4d5e", y: "#2ed573", z: "#3d8bff" };
// Jmol/CPK là quy ước màu nguyên tử chuẩn được 3Dmol.js hỗ trợ.
const MOL3D_ATOM_COLOR_SCHEME = "Jmol";

const v3 = {
  sub: (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }),
  add: (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }),
  mul: (a, k) => ({ x: a.x * k, y: a.y * k, z: a.z * k }),
  len: a => Math.hypot(a.x, a.y, a.z),
  dot: (a, b) => a.x * b.x + a.y * b.y + a.z * b.z,
  unit: a => { const l = Math.hypot(a.x, a.y, a.z) || 1; return { x: a.x / l, y: a.y / l, z: a.z / l }; }
};

function mol3DLabel(viewer, text, pos, opts = {}) {
  return viewer.addLabel(text, Object.assign({
    position: pos, fontSize: 11, fontColor: "#e8ecf0", backgroundColor: "#0a0c0f",
    backgroundOpacity: 0.7, borderThickness: 0, inFront: true, alignment: "center",
    font: "Space Mono, monospace"
  }, opts));
}

// Các cặp ion tiếp xúc (kim loại không có liên kết cộng hóa trị ↔ nguyên tử gần)
function mol3DIonContacts(atoms) {
  const out = [];
  const list = mol3DOverlay.chem && mol3DOverlay.chem.bonds3d;
  if (list && atoms === mol3DOverlay.atoms) {
    // Dữ liệu DFT: dùng đúng các cặp ion đã tính sẵn (kèm bậc liên kết Mayer)
    list.filter(b => b[4] === "ion").forEach(b => { if (atoms[b[0]] && atoms[b[1]]) out.push([atoms[b[0]], atoms[b[1]], b[2], b[3]]); });
    return out;
  }
  atoms.forEach((a, i) => {
    if (a.bonds.length || !MOL3D_METALS.has(a.elem)) return;
    const cutoff = ["K","Ba","Pb","Ag","Hg","Cd"].includes(a.elem) ? 3.5 : 3.2;
    atoms.forEach((b, j) => {
      if (i === j || MOL3D_METALS.has(b.elem) || b.elem === "H" || b.elem === "C") return;
      const d = v3.len(v3.sub(a, b));
      if (d <= cutoff) out.push([a, b, d]);
    });
  });
  return out;
}

function drawMol3DOverlays() {
  const viewer = currentMol3DViewer;
  if (!viewer) return;
  viewer.removeAllShapes();
  viewer.removeAllLabels();
  const atoms = mol3DOverlay.atoms;

  // Liên kết ion: luôn hiển thị (nét đứt) để thấy cặp ion
  const ions = mol3DIonContacts(atoms);
  ions.forEach(([a, b, d, bo]) => {
    viewer.addCylinder({ start: { x: a.x, y: a.y, z: a.z }, end: { x: b.x, y: b.y, z: b.z }, radius: 0.04, color: "#c9a227", dashed: true, dashLength: 0.18, gapLength: 0.14, fromCap: 1, toCap: 1 });
    if (mol3DOverlay.lengths) mol3DLabel(viewer, d.toFixed(3) + " Å" + (bo !== undefined ? ` · BO ${bo.toFixed(2)}` : ""), v3.mul(v3.add(a, b), 0.5), { fontColor: "#ffd166" });
  });

  // ── Trục tọa độ X, Y, Z (mũi tên từ gốc O) ──
  if (mol3DOverlay.axes) {
    let ext = 0;
    atoms.forEach(a => { ext = Math.max(ext, Math.abs(a.x), Math.abs(a.y), Math.abs(a.z)); });
    const L = Math.max(ext + 1.0, 1.6) * mol3DOverlay.axisScale;      // chiều dài mũi tên (Å)
    const r = Math.min(Math.max(0.035 * L, 0.04), 0.12);               // bán kính thân mũi tên
    const dirs = { x: { x: 1, y: 0, z: 0 }, y: { x: 0, y: 1, z: 0 }, z: { x: 0, y: 0, z: 1 } };
    Object.entries(dirs).forEach(([k, d]) => {
      const col = MOL3D_AXIS_COLORS[k];
      viewer.addArrow({ start: { x: 0, y: 0, z: 0 }, end: v3.mul(d, L), radius: r, radiusRatio: 2.4, mid: Math.max(0.75, 1 - 0.45 / L), color: col });
      // nửa âm của trục: nét đứt mờ
      viewer.addCylinder({ start: { x: 0, y: 0, z: 0 }, end: v3.mul(d, -L * 0.6), radius: r * 0.45, color: col, dashed: true, dashLength: 0.15, gapLength: 0.15, opacity: 0.6 });
      // vạch chia mỗi 1 Å
      for (let t = 1; t < L - 0.3; t++) viewer.addSphere({ center: v3.mul(d, t), radius: r * 1.5, color: col });
      mol3DLabel(viewer, `${k.toUpperCase()}  ${L.toFixed(1)} Å`, v3.mul(d, L + 0.45), { fontColor: col, fontSize: 12, backgroundOpacity: 0.5 });
    });
    viewer.addSphere({ center: { x: 0, y: 0, z: 0 }, radius: r * 1.8, color: "#ffffff" });
    mol3DLabel(viewer, "O", { x: -0.3, y: -0.3, z: -0.3 }, { fontSize: 10, fontColor: "#ffffff", backgroundOpacity: 0.4 });
  }

  // ── Độ dài liên kết cộng hóa trị ──
  if (mol3DOverlay.lengths) {
    atoms.forEach((a, i) => a.bonds.forEach(j => {
      if (j <= i) return;
      const b = atoms[j];
      const bi = mol3DBondInfo(i, j);
      mol3DLabel(viewer, v3.len(v3.sub(a, b)).toFixed(3) + " Å" + (bi ? ` · BO ${bi[3].toFixed(2)}` : ""), v3.mul(v3.add(a, b), 0.5), { fontSize: 10 });
    }));
  }

  // ── Góc liên kết ──
  if (mol3DOverlay.angles) {
    const big = atoms.length > 20;
    atoms.forEach(c => {
      const nb = c.bonds.map(j => atoms[j]);
      for (let p = 0; p < nb.length; p++) for (let q = p + 1; q < nb.length; q++) {
        if (big && nb[p].elem === "H" && nb[q].elem === "H") continue; // bớt nhãn H–X–H với phân tử lớn
        const u = v3.unit(v3.sub(nb[p], c)), w = v3.unit(v3.sub(nb[q], c));
        const ang = Math.acos(Math.min(1, Math.max(-1, v3.dot(u, w)))) * 180 / Math.PI;
        let bis = v3.add(u, w);
        if (v3.len(bis) < 1e-3) bis = { x: 0, y: 0, z: 0.5 }; // góc 180°
        const pos = v3.add(c, v3.mul(v3.unit(bis), 0.55));
        mol3DLabel(viewer, ang.toFixed(1) + "°", pos, { fontSize: 10, fontColor: "#7fdbff" });
      }
    });
  }

  // ── Nguyên tử đang chọn: hiện tọa độ ──
  const pk = mol3DOverlay.picked;
  if (pk) {
    viewer.addSphere({ center: { x: pk.x, y: pk.y, z: pk.z }, radius: 0.45, color: "#00d4a8", opacity: 0.35 });
    mol3DLabel(viewer, `${pk.elem}${pk.serial} (${pk.x.toFixed(3)}, ${pk.y.toFixed(3)}, ${pk.z.toFixed(3)})`, v3.add(pk, { x: 0, y: 0.6, z: 0 }), { fontColor: "#00d4a8", fontSize: 11 });
  }
  viewer.render();
}

function toggleMol3DOverlay(key, btn) {
  mol3DOverlay[key] = !mol3DOverlay[key];
  if (btn) btn.classList.toggle("active", mol3DOverlay[key]);
  drawMol3DOverlays();
}

function setMol3DAxisScale(val) {
  mol3DOverlay.axisScale = parseFloat(val) || 1;
  const lbl = document.getElementById("mol3d-axis-scale-val");
  if (lbl) lbl.textContent = mol3DOverlay.axisScale.toFixed(1) + "×";
  if (!mol3DOverlay.axes) {
    mol3DOverlay.axes = true;
    const b = document.querySelector('.mol3d-ov-btn[data-ov="axes"]');
    if (b) b.classList.add("active");
  }
  drawMol3DOverlays();
}

function updateMol3DInfo() {
  const info = document.getElementById("mol3d-info");
  if (!info) return;
  const atoms = mol3DOverlay.atoms;
  if (!atoms.length) { info.innerHTML = ""; return; }
  const ext = ["x", "y", "z"].map(k => Math.max(...atoms.map(a => a[k])) - Math.min(...atoms.map(a => a[k])));
  const nBonds = atoms.reduce((s, a) => s + a.bonds.length, 0) / 2;
  const pk = mol3DOverlay.picked;
  info.innerHTML = `
    <span><b>Kích thước</b> X × Y × Z = ${ext.map(e => e.toFixed(2)).join(" × ")} Å</span>
    <span><b>${atoms.length}</b> nguyên tử · <b>${nBonds}</b> liên kết</span>
    ${mol3DOverlay.chem && typeof formatGradeTopics === "function" ? `<span><b>Chương trình</b> ${formatGradeTopics(mol3DOverlay.chem)}</span>` : ""}
    ${mol3DOverlay.chem && mol3DOverlay.chem.sdf3dMethod ? `<span><b>Phương pháp</b> ${mol3DOverlay.chem.sdf3dMethod}</span>` : ""}
    ${pk ? `<span class="mol3d-info-pick"><b>${pk.elem}${pk.serial}</b>: x=${pk.x.toFixed(3)} · y=${pk.y.toFixed(3)} · z=${pk.z.toFixed(3)} Å · r=${v3.len(pk).toFixed(3)} Å</span>` : ""}`;
}

// ── Modal hiển thị mô hình 3D ──
function ensureMol3DModal() {
  if (document.getElementById("mol3d-modal")) return;

  const modal = document.createElement("div");
  modal.id = "mol3d-modal";
  modal.className = "mol3d-modal";
  modal.innerHTML = `
    <div class="mol3d-box">
      <div class="mol3d-head">
        <div>
          <div class="mol3d-title" id="mol3d-title">Mô hình 3D</div>
          <div class="mol3d-sub" id="mol3d-sub"></div>
        </div>
        <button class="mol3d-close" type="button" onclick="closeMol3DModal()">✕</button>
      </div>
      <div class="mol3d-style-row">
        <button class="mol3d-style-btn active" type="button" data-style="stick" onclick="setMol3DStyle('stick', this)">Que</button>
        <button class="mol3d-style-btn" type="button" data-style="sphere" onclick="setMol3DStyle('sphere', this)">Đặc khối</button>
        <button class="mol3d-style-btn" type="button" data-style="line" onclick="setMol3DStyle('line', this)">Nét mảnh</button>
        <button class="mol3d-style-btn mol3d-spin-btn active" type="button" id="mol3d-spin-btn" onclick="toggleMol3DSpin()">🔄 Xoay tự động</button>
      </div>
      <div class="mol3d-style-row mol3d-overlay-row">
        <button class="mol3d-ov-btn active" type="button" data-ov="axes" onclick="toggleMol3DOverlay('axes', this)">↗ Trục XYZ</button>
        <button class="mol3d-ov-btn" type="button" data-ov="lengths" onclick="toggleMol3DOverlay('lengths', this)">📏 Độ dài liên kết</button>
        <button class="mol3d-ov-btn" type="button" data-ov="angles" onclick="toggleMol3DOverlay('angles', this)">∠ Góc liên kết</button>
        <label class="mol3d-axis-size" title="Kích thước mũi tên trục tọa độ">
          Cỡ mũi tên
          <input type="range" id="mol3d-axis-scale" min="0.5" max="2.5" step="0.1" value="1" oninput="setMol3DAxisScale(this.value)" />
          <span id="mol3d-axis-scale-val">1.0×</span>
        </label>
      </div>
      <div class="mol3d-viewport" id="mol3d-viewport"></div>
      <div class="mol3d-info" id="mol3d-info"></div>
      <div class="mol3d-foot" id="mol3d-foot">Mô hình 3D nhúng sẵn offline · Bấm vào một nguyên tử để xem tọa độ.</div>
    </div>`;
  document.body.appendChild(modal);

  modal.addEventListener("click", e => { if (e.target === modal) closeMol3DModal(); });
}

function closeMol3DModal() {
  const modal = document.getElementById("mol3d-modal");
  if (currentMol3DViewer) currentMol3DViewer.spin(false);
  if (modal) modal.classList.remove("visible");
  currentMol3DViewer = null;
  mol3DSpinning = false;
}

// Bật/tắt xoay tự động 360°
function toggleMol3DSpin() {
  if (!currentMol3DViewer) return;
  mol3DSpinning = !mol3DSpinning;
  currentMol3DViewer.spin(mol3DSpinning ? "y" : false, MOL3D_SPIN_SPEED);

  const btn = document.getElementById("mol3d-spin-btn");
  if (btn) {
    btn.classList.toggle("active", mol3DSpinning);
    btn.textContent = mol3DSpinning ? "🔄 Xoay tự động" : "⏸ Đang dừng";
  }
}

function setMol3DStyle(style, btn) {
  document.querySelectorAll(".mol3d-style-btn").forEach(b => b.classList.remove("active"));
  if (btn) btn.classList.add("active");
  if (!currentMol3DViewer) return;

  const styleMap = {
    stick: {
      stick: { radius: 0.15, colorscheme: MOL3D_ATOM_COLOR_SCHEME },
      sphere: { scale: 0.22, colorscheme: MOL3D_ATOM_COLOR_SCHEME }
    },
    sphere: { sphere: { scale: 0.55, colorscheme: MOL3D_ATOM_COLOR_SCHEME } },
    line: { line: { colorscheme: MOL3D_ATOM_COLOR_SCHEME } }
  };
  currentMol3DViewer.setStyle({}, styleMap[style] || styleMap.stick);
  drawMol3DOverlays();
}

// Mở modal và vẽ mô hình 3D CHỈ từ dữ liệu đã có sẵn trong chem.sdf3d.
// Không có fetch(), không có await mạng nào ở đây cả.
function openMol3DModal(chem) {
  if (!chem) return;
  ensureMol3DModal();

  const modal = document.getElementById("mol3d-modal");
  const viewport = document.getElementById("mol3d-viewport");
  modal.classList.add("visible");
  currentMol3DViewer = null;
  document.getElementById("mol3d-title").textContent = `${chem.formula} — ${chem.name}`;
  viewport.innerHTML = "";
  mol3DOverlay.atoms = []; mol3DOverlay.picked = null; mol3DOverlay.chem = chem;
  updateMol3DInfo();

  if (typeof $3Dmol === "undefined") {
    document.getElementById("mol3d-sub").textContent =
      "Thư viện 3Dmol.js chưa tải được. Kiểm tra thẻ <script> 3Dmol trong index.html và kết nối mạng (thư viện này tải từ CDN).";
    return;
  }

  if (!chem.sdf3d) {
    document.getElementById("mol3d-sub").textContent = "Chất này chưa có dữ liệu 3D trong chemdata.js.";
    viewport.innerHTML = `
      <div class="mol3d-empty">
        <strong>${chem.formula}</strong> chưa được nhúng dữ liệu cấu trúc 3D.<br><br>
        Chạy lệnh sau (ở nơi có mạng, một lần duy nhất) để tự động bổ sung:<br>
        <code>node embed-sdf-into-chemdata.js</code><br><br>
        Sau khi chạy xong, mở lại app — không cần chỉnh sửa gì thêm.
      </div>`;
    return;
  }

  currentMol3DViewer = $3Dmol.createViewer(viewport, { backgroundColor: "#0f1420" });
  const model = currentMol3DViewer.addModel(chem.sdf3d, "sdf");
  currentMol3DViewer.setStyle({}, {
    stick: { radius: 0.15, colorscheme: MOL3D_ATOM_COLOR_SCHEME },
    sphere: { scale: 0.22, colorscheme: MOL3D_ATOM_COLOR_SCHEME }
  });
  document.querySelectorAll(".mol3d-style-btn[data-style]").forEach(b => b.classList.toggle("active", b.dataset.style === "stick"));

  mol3DOverlay.atoms = model.selectedAtoms({});
  mol3DOverlay.atoms.forEach((a, i) => { a.serial = i + 1; });
  mol3DOverlay.picked = null;
  currentMol3DViewer.setClickable({}, true, atom => {
    mol3DOverlay.picked = (mol3DOverlay.picked === atom) ? null : atom;
    drawMol3DOverlays();
    updateMol3DInfo();
  });

  drawMol3DOverlays();
  updateMol3DInfo();
  currentMol3DViewer.zoomTo();
  // Nghiêng góc nhìn ban đầu để thấy đủ cả 3 trục X, Y, Z
  currentMol3DViewer.rotate(-25, "y");
  currentMol3DViewer.rotate(20, "x");
  currentMol3DViewer.zoom(1.15);
  currentMol3DViewer.render();

  // Mặc định tự xoay 360° khi vừa mở mô hình; người dùng vẫn kéo chuột được
  // để xoay/zoom thủ công lúc đang xoay (3Dmol tự tạm dừng khi kéo).
  mol3DSpinning = true;
  currentMol3DViewer.spin("y", MOL3D_SPIN_SPEED);
  const spinBtn = document.getElementById("mol3d-spin-btn");
  if (spinBtn) {
    spinBtn.classList.add("active");
    spinBtn.textContent = "🔄 Xoay tự động";
  }

  const isIonic = mol3DIonContacts(mol3DOverlay.atoms).length > 0;
  const foot = document.getElementById("mol3d-foot");
  if (foot) {
    foot.textContent = [
      chem.modelScope,
      chem.sdfFormula ? `Công thức trong SDF: ${chem.sdfFormula}.` : "",
      `Nguồn đối chiếu đề xuất: ${chem.recommendedSource}`,
      `Công nghệ phù hợp: ${chem.recommendedTechnology}`,
      "Gốc O(0,0,0) = tâm khối lượng · X/Y/Z theo trục quán tính chính · đơn vị Å."
    ].filter(Boolean).join(" ");
  }
  document.getElementById("mol3d-sub").textContent = chem.sdf3dIsReal
    ? `${chem.validationTier || "Mô hình tính toán"} · ${chem.sdf3dMethod || "GFN2-xTB"}${chem.bonds3d ? " · BO = bậc liên kết Mayer" : ""}${isIonic ? " · nét đứt vàng = liên kết ion" : ""}`
    : "Đơn chất kim loại/nguyên tố: hiển thị 1 nguyên tử đặt tại gốc tọa độ (không có cấu trúc phân tử).";
}

// Mở mô hình 3D từ tab "Cơ sở dữ liệu" bằng công thức (tra lại trong CHEM_DATABASE)
function openMol3DByFormula(formula) {
  const chem = CHEM_DATABASE.find(c => c.formula === formula);
  if (chem) openMol3DModal(chem);
}

// ═══════════════════════════════════════
//   KIỂM TRA TOÀN BỘ MÔ HÌNH 3D (audit)
//   Chỉ quét chem.sdf3d trong dữ liệu nội bộ, không gọi mạng.
//   Vì vậy chạy gần như tức thì, không cần vòng lặp có delay như bản cũ.
// ═══════════════════════════════════════

function ensureMol3DAuditModal() {
  if (document.getElementById("mol3d-audit-modal")) return;

  const modal = document.createElement("div");
  modal.id = "mol3d-audit-modal";
  modal.className = "mol3d-modal";
  modal.innerHTML = `
    <div class="mol3d-box">
      <div class="mol3d-head">
        <div>
          <div class="mol3d-title">Kiểm tra mô hình 3D toàn bộ CSDL</div>
          <div class="mol3d-sub" id="mol3d-audit-sub">Đang quét dữ liệu nội bộ...</div>
        </div>
        <button class="mol3d-close" type="button" onclick="closeMol3DAuditModal()">✕</button>
      </div>
      <div class="mol3d-audit-body">
        <div class="mol3d-audit-progress-wrap">
          <div class="mol3d-audit-bar"><div class="mol3d-audit-bar-fill" id="mol3d-audit-bar-fill"></div></div>
          <div class="mol3d-audit-count" id="mol3d-audit-count">0 / 0</div>
        </div>
        <div class="mol3d-audit-summary" id="mol3d-audit-summary"></div>
        <div class="mol3d-audit-list" id="mol3d-audit-list"></div>
        <button class="mol3d-db-btn mol3d-audit-copy-btn" type="button" id="mol3d-audit-copy-btn" style="display:none" onclick="copyMol3DAuditFails()">📋 Sao chép báo cáo kiểm định</button>
      </div>
      <div class="mol3d-foot">Quét trực tiếp trong chemdata.js — không cần mạng, không gọi API.</div>
    </div>`;
  document.body.appendChild(modal);

  modal.addEventListener("click", e => { if (e.target === modal) closeMol3DAuditModal(); });
}

function closeMol3DAuditModal() {
  const modal = document.getElementById("mol3d-audit-modal");
  if (modal) modal.classList.remove("visible");
}

function parseFormulaCounts(formula) {
  const text = formula
    .replace(/\s*\(aq\).*$/i, "")
    .replace(/[·.]/g, ".")
    .replace(/[₀₁₂₃₄₅₆₇₈₉]/g, digit => "₀₁₂₃₄₅₆₇₈₉".indexOf(digit));
  const total = {};

  function parsePart(part, start = 0, endChar = "") {
    const counts = {};
    let i = start;
    while (i < part.length && part[i] !== endChar) {
      if (part[i] === "(") {
        const nested = parsePart(part, i + 1, ")");
        i = nested.index;
        const multiplierMatch = part.slice(i).match(/^(\d+)/);
        const multiplier = multiplierMatch ? Number(multiplierMatch[1]) : 1;
        i += multiplierMatch ? multiplierMatch[1].length : 0;
        Object.entries(nested.counts).forEach(([element, count]) => {
          counts[element] = (counts[element] || 0) + count * multiplier;
        });
        continue;
      }
      const elementMatch = part.slice(i).match(/^([A-Z][a-z]?)(\d*)/);
      if (!elementMatch) return { counts, index: part.length };
      const count = elementMatch[2] ? Number(elementMatch[2]) : 1;
      counts[elementMatch[1]] = (counts[elementMatch[1]] || 0) + count;
      i += elementMatch[0].length;
    }
    return { counts, index: i + (endChar && part[i] === endChar ? 1 : 0) };
  }

  text.split(".").forEach(part => {
    const leadingMultiplier = part.match(/^(\d+)/);
    const multiplier = leadingMultiplier ? Number(leadingMultiplier[1]) : 1;
    const parsed = parsePart(part, leadingMultiplier ? leadingMultiplier[1].length : 0);
    Object.entries(parsed.counts).forEach(([element, count]) => {
      total[element] = (total[element] || 0) + count * multiplier;
    });
  });
  return total;
}

function parseSdfAtoms(sdf) {
  const lines = String(sdf || "").split(/\r?\n/);
  const countsLine = lines.findIndex(line => line.includes("V2000"));
  if (countsLine < 0) return { atoms: [], bonds: 0 };
  const counts = lines[countsLine].trim().split(/\s+/);
  const atomCount = Number(counts[0]);
  const bondCount = Number(counts[1]);
  if (!Number.isInteger(atomCount) || atomCount < 1) return { atoms: [], bonds: 0 };
  const atoms = lines.slice(countsLine + 1, countsLine + 1 + atomCount)
    .map(line => line.trim().split(/\s+/)[3])
    .filter(Boolean);
  return { atoms, bonds: Number.isInteger(bondCount) ? bondCount : 0 };
}

function validateMol3DRecord(chem) {
  const issues = [];
  if (!chem.sdf3d) issues.push("Thiếu SDF");
  if (!chem.sdf3dIsReal) issues.push("Chưa có hình học phân tử đáng tin cậy");
  if (!chem.structureType || !chem.validationTier) issues.push("Thiếu hồ sơ phân loại");
  if (!chem.recommendedSource || !chem.recommendedTechnology) issues.push("Thiếu nguồn/công nghệ đối chiếu");

  const sdf = parseSdfAtoms(chem.sdf3d);
  if (!sdf.atoms.length) {
    issues.push("SDF không đọc được danh sách nguyên tử");
  } else {
    const formulaCounts = parseFormulaCounts(chem.sdfFormula || chem.formula);
    const sdfCounts = sdf.atoms.reduce((counts, element) => {
      counts[element] = (counts[element] || 0) + 1;
      return counts;
    }, {});
    const formulaElements = Object.keys(formulaCounts).sort();
    const sdfElements = Object.keys(sdfCounts).sort();
    const formulaMatchesSdf = formulaElements.length === sdfElements.length
      && formulaElements.every((element, index) => element === sdfElements[index] && formulaCounts[element] === sdfCounts[element]);
    if (!formulaMatchesSdf) {
      issues.push("Công thức không khớp số nguyên tử trong SDF");
    }
    if (sdf.bonds < 0) issues.push("Số liên kết SDF không hợp lệ");
  }
  if (chem.sdf3dSource === "rdkit-gfn2xtb-offline" && String(chem.sdf3dMethod || "").includes("DFT")) {
    issues.push("Nguồn xTB nhưng phương pháp ghi DFT");
  }
  return { valid: issues.length === 0, issues };
}

function getMol3DMethodGroup(chem) {
  if (chem.sdf3dSource === "rdkit-gfn2xtb-offline" || /xTB/i.test(chem.sdf3dMethod || "")) {
    return "GFN2-xTB";
  }
  if (/DFT|PySCF/i.test(`${chem.sdf3dSource || ""} ${chem.sdf3dMethod || ""}`)) {
    return "DFT/PySCF";
  }
  return "Khác/chưa xác định";
}

function auditAllMol3D() {
  ensureMol3DAuditModal();

  const modal = document.getElementById("mol3d-audit-modal");
  const sub = document.getElementById("mol3d-audit-sub");
  const barFill = document.getElementById("mol3d-audit-bar-fill");
  const countEl = document.getElementById("mol3d-audit-count");
  const summaryEl = document.getElementById("mol3d-audit-summary");
  const listEl = document.getElementById("mol3d-audit-list");
  const copyBtn = document.getElementById("mol3d-audit-copy-btn");

  modal.classList.add("visible");
  listEl.innerHTML = "";
  summaryEl.innerHTML = "";
  copyBtn.style.display = "none";

  const total = CHEM_DATABASE.length;
  let okCount = 0, partialCount = 0, failCount = 0, warningCount = 0;
  window.mol3dAuditFails = [];
  window.mol3dAuditPartials = [];
  window.mol3dAuditWarnings = [];
  const groupedRows = {
    "DFT/PySCF": document.createElement("section"),
    "GFN2-xTB": document.createElement("section"),
    "Khác/chưa xác định": document.createElement("section")
  };
  Object.entries(groupedRows).forEach(([group, section]) => {
    section.className = "mol3d-audit-group";
    section.innerHTML = `<h3 class="mol3d-audit-group-title">${group}</h3>`;
    listEl.appendChild(section);
  });

  CHEM_DATABASE.forEach((chem, idx) => {
    const row = document.createElement("div");
    const methodGroup = getMol3DMethodGroup(chem);

    const validation = validateMol3DRecord(chem);
    if (chem.sdf3d && chem.sdf3dIsReal && validation.valid) {
      okCount++;
      row.className = "mol3d-audit-row";
      row.innerHTML = `
        <div><span class="mol3d-audit-row-name">✅ ${chem.name}</span><span class="mol3d-audit-row-formula">${chem.formula}</span></div>
        <span class="mol3d-audit-row-formula">${chem.validationTier}</span>`;
    } else if (chem.sdf3d && chem.sdf3dIsReal && !validation.valid) {
      warningCount++;
      window.mol3dAuditWarnings.push({ chem, issues: validation.issues });
      row.className = "mol3d-audit-row partial";
      row.innerHTML = `
        <div><span class="mol3d-audit-row-name">🟡 ${chem.name}</span><span class="mol3d-audit-row-formula">${chem.formula}</span></div>
        <span class="mol3d-audit-row-formula">${validation.issues.join("; ")}</span>`;
    } else if (chem.sdf3d && !chem.sdf3dIsReal) {
      partialCount++;
      window.mol3dAuditPartials.push(chem);
      row.className = "mol3d-audit-row partial";
      row.innerHTML = `
        <div><span class="mol3d-audit-row-name">🟡 ${chem.name}</span><span class="mol3d-audit-row-formula">${chem.formula}</span></div>
        <span class="mol3d-audit-row-formula">Nguyên tử đơn lẻ</span>`;
    } else {
      failCount++;
      window.mol3dAuditFails.push(chem);
      row.className = "mol3d-audit-row fail";
      row.innerHTML = `
        <div><span class="mol3d-audit-row-name">⚠️ ${chem.name}</span><span class="mol3d-audit-row-formula">${chem.formula}</span></div>
        <span class="mol3d-audit-row-formula">Chưa nhúng dữ liệu</span>`;
    }
    groupedRows[methodGroup].appendChild(row);

    const pct = Math.round(((idx + 1) / total) * 100);
    barFill.style.width = pct + "%";
    countEl.textContent = `${idx + 1} / ${total}`;
  });

  const dftCount = CHEM_DATABASE.filter(chem => getMol3DMethodGroup(chem) === "DFT/PySCF").length;
  const xtbCount = CHEM_DATABASE.filter(chem => getMol3DMethodGroup(chem) === "GFN2-xTB").length;
  const otherCount = total - dftCount - xtbCount;
  summaryEl.innerHTML = `<span class="ok">✅ Hợp lệ nội bộ: ${okCount}</span><span class="partial">🟡 Cần xem lại: ${warningCount + partialCount}</span><span class="fail">⚠️ Chưa có: ${failCount}</span><span>DFT/PySCF: ${dftCount}</span><span>GFN2-xTB: ${xtbCount}</span><span>Khác: ${otherCount}</span>`;
  sub.textContent = `Đã kiểm tra SDF, công thức, phân loại và nguồn: ${okCount} hợp lệ nội bộ, ${warningCount} cảnh báo, ${partialCount} mô hình đơn giản, ${failCount} thiếu dữ liệu.`;
  if (failCount > 0 || partialCount > 0 || warningCount > 0) copyBtn.style.display = "inline-flex";
}

function copyMol3DAuditFails() {
  const fails = (window.mol3dAuditFails || []).map(c => `${c.formula}\t${c.name}\tCHƯA CÓ`);
  const partials = (window.mol3dAuditPartials || []).map(c => `${c.formula}\t${c.name}\tCHỈ CÓ 2D`);
  const warnings = (window.mol3dAuditWarnings || []).map(({ chem, issues }) =>
    `${chem.formula}\t${chem.name}\tCẦN XEM LẠI\t${issues.join("; ")}`
  );
  const all = [...fails, ...partials, ...warnings];
  if (!all.length) return;
  const text = all.join("\n");
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById("mol3d-audit-copy-btn");
    if (btn) {
      const original = btn.textContent;
      btn.textContent = "✔️ Đã sao chép!";
      setTimeout(() => { btn.textContent = original; }, 1800);
    }
  }).catch(() => {
    alert(text);
  });
}

// Gắn nút "Xem mô hình 3D" vào một bong bóng chat đã render
function attachMol3DButton(chem, bubbleEl) {
  if (!chem || !bubbleEl) return;
  if (bubbleEl.querySelector(".mol3d-trigger")) return;

  const btn = document.createElement("button");
  btn.className = "mol3d-trigger";
  btn.type = "button";
  btn.textContent = "🧬 Xem mô hình 3D";
  btn.onclick = () => openMol3DModal(chem);
  bubbleEl.appendChild(btn);
}


// Lắng nghe sự kiện Escape toàn cục để đóng các modal 3D (tránh duplicate listeners)
document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    closeMol3DModal();
    closeMol3DAuditModal();
  }
});
