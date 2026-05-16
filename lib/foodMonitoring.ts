// lib/foodMonitoring.ts
// Rule-based food intake monitoring and risk classification
// Anchored on WHO nutrition guidelines (2023):
// - Free sugar: <25g/day (strict) to <50g/day (upper limit)
// - Sodium: <2000mg/day (2g/day)
// - Saturated fat: <10% total energy (~20g/day for 2000kcal diet)
// - Vegetables/fruits: ≥400g/day (5 portions)
// Reference: WHO Guidelines on sugars intake (2015), WHO SHAKE technical package (2016)

export type FoodQuestion = {
  id: string;
  question: string;
  options: { label: string; value: string; score: number }[];
  applicableTo: ('Diabetes' | 'Hypertension' | 'Both')[];
};

export type FoodLogEntry = {
  questionId: string;
  answer: string;
  score: number; // 0 = healthy, 1-3 = increasing risk
  timestamp: Date;
};

export type RiskLevel = 'Low' | 'Moderate' | 'High';

export type FoodRiskResult = {
  riskLevel: RiskLevel;
  normalizedScore: number; // 0-100
  breakdown: { category: string; score: number; maxScore: number }[];
};

// WHO-based scoring rubric:
// Score 0 = within WHO guidelines (healthy)
// Score 1 = slightly above guidelines (mild risk)
// Score 2 = moderately above guidelines (moderate risk)
// Score 3 = significantly exceeds guidelines (high risk)

export const FOOD_QUESTIONS: FoodQuestion[] = [
  // ── DIABETES questions ─────────────────────────────────────────────────────
  {
    id: 'sugar_intake',
    question: 'How much sugary food/drinks (soda, sweets, pastries, white rice in large portions) did you consume before taking your medication?',
    options: [
      { label: 'None or very little (within WHO <25g free sugar)', value: 'none', score: 0 },
      { label: 'Small amount (25–50g free sugar, WHO upper limit)', value: 'small', score: 1 },
      { label: 'Moderate amount (50–75g free sugar)', value: 'moderate', score: 2 },
      { label: 'Large amount (>75g free sugar, well above WHO limit)', value: 'large', score: 3 },
    ],
    applicableTo: ['Diabetes', 'Both'],
  },
  {
    id: 'meal_skip',
    question: 'Did you skip or delay a major meal before taking this medication?',
    options: [
      { label: 'No, I ate a balanced meal on schedule', value: 'no_skip', score: 0 },
      { label: 'I ate a light snack instead of a full meal', value: 'light_snack', score: 1 },
      { label: 'I skipped a meal (risk of hypoglycemia with some medications)', value: 'skipped', score: 2 },
      { label: 'I have been skipping multiple meals today', value: 'multi_skip', score: 3 },
    ],
    applicableTo: ['Diabetes', 'Both'],
  },
  {
    id: 'carb_quality',
    question: 'What type of carbohydrates did you mainly consume?',
    options: [
      { label: 'Mostly complex carbs (vegetables, legumes, whole grains – WHO recommended)', value: 'complex', score: 0 },
      { label: 'Mix of complex and simple carbs', value: 'mixed', score: 1 },
      { label: 'Mostly simple/refined carbs (white bread, white rice, sugary cereals)', value: 'simple', score: 2 },
      { label: 'Mostly ultra-processed foods high in sugar', value: 'ultra_processed', score: 3 },
    ],
    applicableTo: ['Diabetes', 'Both'],
  },
  // ── HYPERTENSION questions ─────────────────────────────────────────────────
  {
    id: 'salt_intake',
    question: 'How much salty food (processed food, fast food, canned goods, added table salt) did you eat today?',
    options: [
      { label: 'Very little – I follow the WHO <2000mg sodium/day guideline', value: 'very_low', score: 0 },
      { label: 'Moderate – around 2000–3000mg sodium (slightly above WHO limit)', value: 'moderate', score: 1 },
      { label: 'High – around 3000–4000mg sodium (exceeds WHO guideline significantly)', value: 'high', score: 2 },
      { label: 'Very high – >4000mg sodium (processed/fast foods, heavy salting)', value: 'very_high', score: 3 },
    ],
    applicableTo: ['Hypertension', 'Both'],
  },
  {
    id: 'fast_food',
    question: 'Did you consume fast food, processed meats (hotdogs, ham, bacon), or canned goods today?',
    options: [
      { label: 'No – I avoided these high-sodium/high-fat foods', value: 'none', score: 0 },
      { label: 'Small portion (one small item)', value: 'small', score: 1 },
      { label: 'One full fast-food meal or several processed items', value: 'one_meal', score: 2 },
      { label: 'Multiple fast-food meals or heavily processed diet today', value: 'multiple', score: 3 },
    ],
    applicableTo: ['Hypertension', 'Both'],
  },
  {
    id: 'fruit_veg',
    question: 'How many servings of fruits and vegetables did you eat today? (WHO recommends ≥5 servings/≥400g/day)',
    options: [
      { label: '5 or more servings (≥400g – meets WHO recommendation)', value: 'five_plus', score: 0 },
      { label: '3–4 servings (slightly below WHO target)', value: 'three_four', score: 1 },
      { label: '1–2 servings (well below WHO target)', value: 'one_two', score: 2 },
      { label: 'None (no fruits or vegetables today)', value: 'none', score: 3 },
    ],
    applicableTo: ['Hypertension', 'Both'],
  },
];

/**
 * Get applicable questions for a user's condition.
 * Conditions: 'Diabetes', 'Hypertension', 'Both', 'None', 'Other'
 */
export function getQuestionsForCondition(condition: string): FoodQuestion[] {
  const normalized = condition?.trim();
  if (normalized === 'Diabetes') {
    return FOOD_QUESTIONS.filter(q => q.applicableTo.includes('Diabetes') || q.applicableTo.includes('Both'));
  }
  if (normalized === 'Hypertension') {
    return FOOD_QUESTIONS.filter(q => q.applicableTo.includes('Hypertension') || q.applicableTo.includes('Both'));
  }
  if (normalized === 'Both') {
    return FOOD_QUESTIONS; // All questions apply
  }
  return []; // None/Other: no food monitoring
}

/**
 * Check if food monitoring is applicable for this condition.
 */
export function isFoodMonitoringApplicable(condition: string): boolean {
  return ['Diabetes', 'Hypertension', 'Both'].includes(condition?.trim() ?? '');
}

/**
 * Calculate food risk score using cumulative weighted scoring with time decay.
 * Based on WHO dietary risk assessment principles.
 *
 * @param entries - Array of food log entries (historical + current)
 * @param condition - User's medical condition
 * @returns FoodRiskResult with risk level and breakdown
 */
export function calculateFoodRisk(
  entries: FoodLogEntry[]
): FoodRiskResult {
  if (!entries || entries.length === 0) {
    return {
      riskLevel: 'Low',
      normalizedScore: 0,
      breakdown: [],
    };
  }

  const now = Date.now();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  // ── Time-decay weighting ─────────────────────────────────────────────────
  // Recent entries have more weight (exponential decay, half-life = 3 days)
  // This reflects real-world health impact: recent diet matters more
  const HALF_LIFE_DAYS = 3;
  const DECAY_CONSTANT = Math.LN2 / HALF_LIFE_DAYS;

  let totalWeightedScore = 0;
  let totalWeight = 0;

  // ── Frequency-based adjustment ───────────────────────────────────────────
  // Detect repeated unhealthy answers per question (frequency sensitivity)
  const questionFrequency: Record<string, number[]> = {};

  for (const entry of entries) {
    const ageMs = now - new Date(entry.timestamp).getTime();
    const ageDays = ageMs / ONE_DAY_MS;
    const weight = Math.exp(-DECAY_CONSTANT * ageDays);

    if (!questionFrequency[entry.questionId]) {
      questionFrequency[entry.questionId] = [];
    }
    questionFrequency[entry.questionId].push(entry.score);

    totalWeightedScore += entry.score * weight;
    totalWeight += weight;
  }

  // ── Frequency penalty ────────────────────────────────────────────────────
  // If the same unhealthy behavior (score >= 2) appears ≥3 times, add penalty
  let frequencyPenalty = 0;
  for (const scores of Object.values(questionFrequency)) {
    const highRiskCount = scores.filter(s => s >= 2).length;
    if (highRiskCount >= 3) {
      frequencyPenalty += 0.5; // escalating penalty per repeatedly risky category
    }
    if (highRiskCount >= 5) {
      frequencyPenalty += 0.5; // additional penalty for very frequent risky behavior
    }
  }

  // ── Normalize score ──────────────────────────────────────────────────────
  // Max possible raw score per entry = 3
  // Normalize to 0–100 scale; add frequency penalty proportionally
  const rawAverage = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;
  const maxPossibleRaw = 3; // max score per question
  const normalizedBase = (rawAverage / maxPossibleRaw) * 100;
  const normalizedScore = Math.min(100, normalizedBase + frequencyPenalty * 5);

  // ── Classify risk ────────────────────────────────────────────────────────
  // Thresholds calibrated against WHO dietary risk assessment categories:
  // Low:      0–33  → diet largely within WHO guidelines
  // Moderate: 34–66 → diet moderately above WHO guidelines
  // High:     67–100 → diet significantly exceeds WHO guidelines
  let riskLevel: RiskLevel;
  if (normalizedScore < 34) {
    riskLevel = 'Low';
  } else if (normalizedScore < 67) {
    riskLevel = 'Moderate';
  } else {
    riskLevel = 'High';
  }

  // ── Breakdown by category ────────────────────────────────────────────────
  const categoryMap: Record<string, { total: number; max: number; label: string }> = {
    sugar_intake: { total: 0, max: 0, label: 'Sugar Intake' },
    meal_skip: { total: 0, max: 0, label: 'Meal Regularity' },
    carb_quality: { total: 0, max: 0, label: 'Carbohydrate Quality' },
    salt_intake: { total: 0, max: 0, label: 'Salt Intake' },
    fast_food: { total: 0, max: 0, label: 'Processed/Fast Food' },
    fruit_veg: { total: 0, max: 0, label: 'Fruit & Vegetable Intake' },
  };

  for (const entry of entries) {
    if (categoryMap[entry.questionId]) {
      const ageMs = now - new Date(entry.timestamp).getTime();
      const ageDays = ageMs / ONE_DAY_MS;
      const weight = Math.exp(-DECAY_CONSTANT * ageDays);
      categoryMap[entry.questionId].total += entry.score * weight;
      categoryMap[entry.questionId].max += 3 * weight; // max score is 3
    }
  }

  const breakdown = Object.entries(categoryMap)
    .filter(([, v]) => v.max > 0)
    .map(([, v]) => ({
      category: v.label,
      score: Math.round((v.total / v.max) * 100),
      maxScore: 100,
    }));

  return { riskLevel, normalizedScore: Math.round(normalizedScore), breakdown };
}

/**
 * Generate food reminder content based on condition.
 * Content sourced from WHO dietary guidelines and clinical nutrition evidence.
 */
export function getFoodReminderContent(condition: string): {
  eat: string[];
  avoid: string[];
} | null {
  if (!isFoodMonitoringApplicable(condition)) return null;

  const diabetesEat = [
    'Non-starchy vegetables (leafy greens, broccoli, cauliflower)',
    'Whole grains (brown rice, oats, whole wheat bread)',
    'Legumes (beans, lentils, chickpeas) – low glycemic index',
    'Lean proteins (fish, chicken without skin, tofu)',
    'Low-fat dairy or plant-based alternatives',
    'Nuts and seeds in small portions (almonds, walnuts)',
    'Fresh fruits with low GI (berries, apples, pears) in moderation',
  ];
  const diabetesAvoid = [
    'Sugary beverages (soda, fruit juice, sweetened tea)',
    'Refined carbohydrates (white bread, white rice, sugary cereals)',
    'Ultra-processed sweets (cakes, pastries, candy)',
    'Fried foods and trans fats',
    'Alcohol (disrupts blood glucose control)',
    'High-glycemic fruits in large portions (watermelon, ripe bananas)',
    'Skipping meals (can cause dangerous blood sugar swings)',
  ];

  const hypertensionEat = [
    'Potassium-rich foods (bananas, sweet potatoes, leafy greens) – counters sodium',
    'Low-fat dairy (yogurt, skim milk) – calcium helps regulate blood pressure',
    'Whole grains (oats, quinoa, whole wheat)',
    'Fatty fish (salmon, mackerel) – omega-3s reduce inflammation',
    'Unsalted nuts and seeds',
    'Fresh herbs and spices instead of salt for flavoring',
    'Garlic and onion (contain natural ACE-inhibitor compounds)',
  ];
  const hypertensionAvoid = [
    'Table salt and high-sodium condiments (soy sauce, fish sauce, MSG)',
    'Processed and canned foods (very high in hidden sodium)',
    'Fast food and deli meats (hotdogs, ham, bacon)',
    'Pickled and fermented foods high in salt',
    'Saturated fats (fatty meats, full-fat dairy, butter)',
    'Alcohol (raises blood pressure over time)',
    'Caffeine in excess (temporarily raises blood pressure)',
  ];

  if (condition === 'Diabetes') {
    return { eat: diabetesEat, avoid: diabetesAvoid };
  }
  if (condition === 'Hypertension') {
    return { eat: hypertensionEat, avoid: hypertensionAvoid };
  }
  if (condition === 'Both') {
    // Merge and deduplicate, highlighting overlapping advice
    return {
      eat: [
        'Non-starchy vegetables and leafy greens (lowers blood sugar & blood pressure)',
        'Whole grains (brown rice, oats, quinoa – complex carbs, low sodium)',
        'Legumes (beans, lentils – low GI, high potassium)',
        'Lean protein (grilled fish, chicken without skin, tofu)',
        'Potassium-rich foods (bananas, sweet potatoes) – offsets sodium effect',
        'Low-fat dairy or unsweetened plant-based alternatives',
        'Berries and low-GI fruits in moderation',
        'Unsalted nuts and seeds (heart-healthy fats)',
        'Fresh herbs and garlic instead of salt or sugar',
      ],
      avoid: [
        'Sugary beverages and sweets (spikes blood sugar)',
        'Refined/processed carbohydrates (white bread, pastries, sugary cereals)',
        'Table salt, soy sauce, and high-sodium condiments',
        'Processed meats (hotdogs, ham, bacon) – high sodium AND saturated fat',
        'Fast food and fried foods (high in salt, sugar, and unhealthy fats)',
        'Alcohol (disrupts blood glucose AND raises blood pressure)',
        'Skipping meals (dangerous for blood glucose management)',
        'High-sodium canned or packaged foods',
      ],
    };
  }
  return null;
}
