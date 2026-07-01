// Deterministic Quick Capture parser.
// Parses "50 tomatoes" or "10000 wedding photography" into { amount, term, categoryMatch }.

export type Category = {
  id: string;
  name: string;
  workspace: "personal" | "business";
};

// Seeded synonyms — deterministic string matching, no ML claims.
// term (lowercase) -> canonical category name (case-insensitive match against user's categories)
export const SEEDED_SYNONYMS: Record<string, string> = {
  // Food
  tomatoes: "Food", tomato: "Food", onions: "Food", onion: "Food",
  veggies: "Food", vegetables: "Food", groceries: "Food", grocery: "Food",
  lunch: "Food", dinner: "Food", breakfast: "Food", food: "Food",
  chapati: "Food", ugali: "Food", meat: "Food", milk: "Food", bread: "Food",
  supermarket: "Food", kiosk: "Food",
  // Transport
  transport: "Transport", matatu: "Transport", boda: "Transport", uber: "Transport",
  bolt: "Transport", fare: "Transport", fuel: "Transport", petrol: "Transport",
  diesel: "Transport", parking: "Transport", taxi: "Transport",
  // Utilities
  electricity: "Utilities", kplc: "Utilities", power: "Utilities", water: "Utilities",
  internet: "Utilities", wifi: "Utilities", airtime: "Utilities", data: "Utilities",
  // Rent
  rent: "Rent", house: "Rent",
  // Entertainment
  netflix: "Entertainment", spotify: "Entertainment", movie: "Entertainment",
  concert: "Entertainment", drinks: "Entertainment", bar: "Entertainment",
  // Salary / income
  salary: "Salary", pay: "Salary", wage: "Salary",
  // Business
  wedding: "Revenue", photography: "Revenue", event: "Revenue", gig: "Revenue",
  client: "Revenue", invoice: "Revenue", booking: "Revenue",
  equipment: "Equipment", camera: "Equipment", lens: "Equipment", lights: "Equipment",
  marketing: "Marketing", ads: "Marketing", advertising: "Marketing",
};

export type ParseResult = {
  raw: string;
  amount: number | null;
  term: string;                       // remaining text after amount
  matchedCategory: Category | null;   // deterministic match, if any
  matchSource: "learning" | "exact" | "synonym" | "fuzzy" | null;
  type: "income" | "expense";
};

export function parseQuickCapture(
  input: string,
  categories: Category[],
  learnings: Map<string, string>, // term -> category id
  workspace: "personal" | "business",
): ParseResult {
  const raw = input.trim();
  const result: ParseResult = {
    raw,
    amount: null,
    term: "",
    matchedCategory: null,
    matchSource: null,
    type: "expense",
  };
  if (!raw) return result;

  // Amount: leading number (with optional decimal), possibly with commas
  const m = raw.match(/^([+-]?)([\d,]+(?:\.\d+)?)\s*(.*)$/);
  if (!m) {
    result.term = raw.toLowerCase();
  } else {
    const sign = m[1];
    result.amount = Number(m[2].replace(/,/g, ""));
    result.term = m[3].trim().toLowerCase();
    if (sign === "+") result.type = "income";
  }

  const wsCats = categories.filter((c) => c.workspace === workspace);
  if (!result.term) return result;

  // 1. Learning table (user's own prior choices) — highest priority
  const learnedId = learnings.get(result.term);
  if (learnedId) {
    const c = wsCats.find((x) => x.id === learnedId);
    if (c) { result.matchedCategory = c; result.matchSource = "learning"; return result; }
  }

  // 2. Exact category name match
  const exact = wsCats.find((c) => c.name.toLowerCase() === result.term);
  if (exact) { result.matchedCategory = exact; result.matchSource = "exact"; }

  // 3. Word-in-term matches user category name
  if (!result.matchedCategory) {
    const words = result.term.split(/\s+/);
    for (const w of words) {
      const hit = wsCats.find((c) => c.name.toLowerCase() === w);
      if (hit) { result.matchedCategory = hit; result.matchSource = "exact"; break; }
    }
  }

  // 4. Synonyms → canonical category name → find in user's categories
  if (!result.matchedCategory) {
    for (const w of result.term.split(/\s+/)) {
      const canonical = SEEDED_SYNONYMS[w];
      if (canonical) {
        const hit = wsCats.find((c) => c.name.toLowerCase() === canonical.toLowerCase());
        if (hit) {
          result.matchedCategory = hit;
          result.matchSource = "synonym";
          if (canonical === "Salary" || canonical === "Revenue") result.type = "income";
          break;
        }
      }
    }
  }

  // 5. Fuzzy: category name contains term or vice-versa
  if (!result.matchedCategory) {
    const hit = wsCats.find(
      (c) => c.name.toLowerCase().includes(result.term) || result.term.includes(c.name.toLowerCase()),
    );
    if (hit) { result.matchedCategory = hit; result.matchSource = "fuzzy"; }
  }

  return result;
}
