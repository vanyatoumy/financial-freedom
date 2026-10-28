// Initial configuration. Amounts are stored in centimes (1 F = 100).

export const DEFAULT_JARS = [
  { id: 'nec', name: 'Nécessité', pct: 50, color: '#2563eb', icon: 'home', rule: 'normal' },
  { id: 'inv', name: 'Investissement', pct: 10, color: '#0f766e', icon: 'trending-up', rule: 'no_spend', home: 'caisse' },
  { id: 'eco', name: 'Économie à long terme', pct: 10, color: '#7c3aed', icon: 'landmark', rule: 'goal', home: 'uba' },
  { id: 'edu', name: 'Instruction', pct: 10, color: '#ea580c', icon: 'book', rule: 'normal' },
  { id: 'fun', name: 'Amusement', pct: 10, color: '#db2777', icon: 'sparkles', rule: 'must_spend' },
  { id: 'don', name: 'Dons', pct: 10, color: '#ca8a04', icon: 'heart', rule: 'normal' },
];

// role: spending = usable daily, online = PAYSIKA style (keep at 0), vault = locked / protected
export const DEFAULT_WALLETS = [
  { id: 'om', name: 'OM', icon: 'smartphone', color: '#f97316', role: 'spending', decimals: true, daily: true },
  { id: 'momo', name: 'MOMO', icon: 'smartphone', color: '#eab308', role: 'spending', decimals: true, daily: true },
  { id: 'paysika', name: 'PAYSIKA', icon: 'card', color: '#6366f1', role: 'online', decimals: true, daily: true },
  { id: 'cash', name: 'CASH', icon: 'banknote', color: '#16a34a', role: 'spending', decimals: false, daily: true },
  { id: 'uba', name: 'UBA', icon: 'lock', color: '#dc2626', role: 'vault', decimals: true, daily: false,
    onlyFrom: ['momo'], interestPct: 1.3, interestDates: ['01-06', '07-06'] },
  { id: 'caisse', name: 'Caisse (boîte)', icon: 'box', color: '#a16207', role: 'vault', decimals: false, daily: false },
];

export const DEFAULT_CATEGORIES = [
  // expenses
  { id: 'food', kind: 'expense', name: 'Alimentation', icon: 'cart', jar: 'nec' },
  { id: 'rent', kind: 'expense', name: 'Loyer', icon: 'home', jar: 'nec' },
  { id: 'transport', kind: 'expense', name: 'Transport', icon: 'car', jar: 'nec' },
  { id: 'bills', kind: 'expense', name: 'Factures (eau, électricité)', icon: 'bulb', jar: 'nec' },
  { id: 'phone', kind: 'expense', name: 'Téléphone / Internet', icon: 'smartphone', jar: 'nec' },
  { id: 'health', kind: 'expense', name: 'Santé', icon: 'pill', jar: 'nec' },
  { id: 'fam_ob', kind: 'expense', name: 'Famille – obligation', icon: 'users', jar: 'nec', person: true },
  { id: 'fees', kind: 'expense', name: 'Frais de transaction', icon: 'receipt', jar: 'nec' },
  { id: 'interest_paid', kind: 'expense', name: 'Intérêts payés', icon: 'trending-down', jar: 'nec' },
  { id: 'misc', kind: 'expense', name: 'Divers', icon: 'tag', jar: 'nec' },
  { id: 'books', kind: 'expense', name: 'Livres / Formations', icon: 'book', jar: 'edu' },
  { id: 'subs', kind: 'expense', name: 'Abonnements', icon: 'repeat', jar: 'fun' },
  { id: 'leisure', kind: 'expense', name: 'Sorties / Loisirs', icon: 'sparkles', jar: 'fun' },
  { id: 'resto', kind: 'expense', name: 'Restaurant', icon: 'utensils', jar: 'fun' },
  { id: 'fam_don', kind: 'expense', name: 'Famille – don', icon: 'heart', jar: 'don', person: true },
  { id: 'charity', kind: 'expense', name: 'Charité', icon: 'lifebuoy', jar: 'don', person: true },
  { id: 'religion', kind: 'expense', name: 'Religion', icon: 'star', jar: 'don' },
  { id: 'community', kind: 'expense', name: 'Communauté', icon: 'building', jar: 'don' },
  { id: 'gifts', kind: 'expense', name: 'Cadeaux', icon: 'gift', jar: 'don', person: true },
  { id: 'big', kind: 'expense', name: 'Achat important', icon: 'target', jar: 'eco' },
  // incomes
  { id: 'salary', kind: 'income', name: 'Salaire', icon: 'briefcase' },
  { id: 'freelance', kind: 'income', name: 'Prestations / Freelance', icon: 'laptop' },
  { id: 'trade', kind: 'income', name: 'Commerce', icon: 'store' },
  { id: 'gift_in', kind: 'income', name: 'Cadeau reçu', icon: 'gift' },
  { id: 'inv_return', kind: 'income', name: "Revenus d'investissement", icon: 'trending-up', passive: true },
  { id: 'interest', kind: 'income', name: 'Intérêts reçus', icon: 'percent', passive: true },
  { id: 'rent_in', kind: 'income', name: 'Loyer perçu', icon: 'key', passive: true },
  { id: 'other_in', kind: 'income', name: 'Autre revenu', icon: 'plus-circle' },
];

export function defaultState() {
  return {
    version: 2,
    settings: { setupDone: false, currency: 'F', remainderJar: 'nec', gapJar: 'nec', feeJar: 'nec' },
    jars: structuredClone(DEFAULT_JARS),
    wallets: structuredClone(DEFAULT_WALLETS),
    categories: structuredClone(DEFAULT_CATEGORIES),
    tx: [],
    loans: [],
    investments: [],
    subs: [],
    counts: [],
    favorites: [],
  };
}
