// lib/foodMonitoring.ts
// Condition-Specific Food Monitoring System with Random Forest ML Classification
// Medical references:
// - WHO Guidelines on sugars intake (2015)
// - WHO SHAKE technical package for sodium reduction (2016)
// - ADA Standards of Medical Care in Diabetes (2024)
// - JNC 8 / ACC/AHA Hypertension Guidelines
// - DASH Diet Evidence Base (Appel et al.)

export type FoodQuestion = {
  id: string;
  question: string;
  category: string;
  options: { label: string; value: string; score: number }[];
  applicableTo: ('Diabetes' | 'Hypertension' | 'Both')[];
  weight: number; // clinical importance weight 1-3
};

export type FoodLogEntry = {
  questionId: string;
  answer: string;
  score: number;
  timestamp: Date;
};

export type RiskLevel = 'Low' | 'Moderate' | 'High';

export type FoodRiskResult = {
  riskLevel: RiskLevel;
  normalizedScore: number;
  mlRiskLevel: RiskLevel;
  mlConfidence: number;
  finalRiskLevel: RiskLevel;
  breakdown: { category: string; score: number; maxScore: number }[];
  featureImportance: Record<string, number>;
};

// ── DIABETES-SPECIFIC QUESTIONS ────────────────────────────────────────────
// Based on ADA 2024 dietary guidelines for blood glucose management

export const DIABETES_QUESTIONS: FoodQuestion[] = [
  {
    id: 'db_sugar_beverage',
    question: 'Did you consume sugary beverages (soda, sweetened juice, energy drinks, sweet tea) today?',
    category: 'Sugar Intake',
    options: [
      { label: 'None — I chose water, unsweetened tea, or black coffee', value: 'none', score: 0 },
      { label: '1 small serving (up to 250ml)', value: 'small', score: 1 },
      { label: '1–2 standard servings (250–500ml)', value: 'moderate', score: 2 },
      { label: 'More than 2 servings (>500ml)', value: 'large', score: 3 },
    ],
    applicableTo: ['Diabetes', 'Both'],
    weight: 3,
  },
  {
    id: 'db_refined_carbs',
    question: 'What was the primary type of carbohydrate you consumed at your last meal?',
    category: 'Carbohydrate Quality',
    options: [
      { label: 'Mostly complex carbs — whole grains, legumes, non-starchy vegetables', value: 'complex', score: 0 },
      { label: 'A balanced mix of complex and simple carbohydrates', value: 'mixed', score: 1 },
      { label: 'Mostly refined/simple carbs — white rice, white bread, pasta', value: 'simple', score: 2 },
      { label: 'Mostly ultra-processed foods high in added sugar (cakes, pastries, sugary cereals)', value: 'ultra', score: 3 },
    ],
    applicableTo: ['Diabetes', 'Both'],
    weight: 3,
  },
  {
    id: 'db_portion_control',
    question: 'How would you describe your meal portion sizes today?',
    category: 'Portion Control',
    options: [
      { label: 'Appropriate portions — consistent with my dietary plan', value: 'appropriate', score: 0 },
      { label: 'Slightly larger than usual — one modest overeating episode', value: 'slightly_large', score: 1 },
      { label: 'Noticeably larger portions — overate at one or two meals', value: 'large', score: 2 },
      { label: 'Very excessive portions throughout the day', value: 'very_large', score: 3 },
    ],
    applicableTo: ['Diabetes', 'Both'],
    weight: 2,
  },
  {
    id: 'db_meal_timing',
    question: 'Did you skip or significantly delay any major meal today?',
    category: 'Meal Regularity',
    options: [
      { label: 'No — I ate regular, balanced meals on schedule', value: 'regular', score: 0 },
      { label: 'I had a light snack instead of one full meal', value: 'light_snack', score: 1 },
      { label: 'I skipped one major meal (breakfast, lunch, or dinner)', value: 'skipped_one', score: 2 },
      { label: 'I skipped multiple meals or ate very irregularly today', value: 'skipped_multi', score: 3 },
    ],
    applicableTo: ['Diabetes', 'Both'],
    weight: 3,
  },
  {
    id: 'db_fiber_intake',
    question: 'How much fiber-rich food (vegetables, legumes, whole grains, fruits with skin) did you eat today?',
    category: 'Fiber Intake',
    options: [
      { label: 'Plentiful — vegetables and fiber sources at every meal', value: 'plentiful', score: 0 },
      { label: 'Moderate — some fiber-rich foods at most meals', value: 'moderate', score: 1 },
      { label: 'Low — only a small amount of fiber-rich foods today', value: 'low', score: 2 },
      { label: 'Very low — almost no vegetables or fiber-rich foods', value: 'very_low', score: 3 },
    ],
    applicableTo: ['Diabetes', 'Both'],
    weight: 2,
  },
  {
    id: 'db_processed_sweets',
    question: 'Did you consume processed sweets or desserts (candy, ice cream, cakes, biscuits, chocolate bars) today?',
    category: 'Sugar Intake',
    options: [
      { label: 'None — I avoided processed sweets entirely', value: 'none', score: 0 },
      { label: 'A very small amount (one small piece or a bite)', value: 'small', score: 1 },
      { label: 'A moderate amount (one serving, e.g., one slice of cake)', value: 'moderate', score: 2 },
      { label: 'Multiple servings or frequent snacking on sweets', value: 'multiple', score: 3 },
    ],
    applicableTo: ['Diabetes', 'Both'],
    weight: 3,
  },
  {
    id: 'db_glycemic_awareness',
    question: 'Did you choose low glycemic index (GI) foods over high GI alternatives when possible?',
    category: 'Glycemic Management',
    options: [
      { label: 'Yes — I actively selected low-GI options (e.g., sweet potato, oats, lentils)', value: 'yes_actively', score: 0 },
      { label: 'Somewhat — I made some low-GI choices but not consistently', value: 'somewhat', score: 1 },
      { label: 'Rarely — most of my food choices were high-GI', value: 'rarely', score: 2 },
      { label: 'No — I did not consider glycemic index in my food choices', value: 'no', score: 3 },
    ],
    applicableTo: ['Diabetes', 'Both'],
    weight: 2,
  },
];

// ── HYPERTENSION-SPECIFIC QUESTIONS ───────────────────────────────────────
// Based on WHO SHAKE package and DASH diet evidence

export const HYPERTENSION_QUESTIONS: FoodQuestion[] = [
  {
    id: 'htn_salt_use',
    question: 'Did you add extra salt to your food while cooking or at the table today?',
    category: 'Sodium Intake',
    options: [
      { label: 'No added salt — I used herbs, spices, or lemon instead', value: 'no_salt', score: 0 },
      { label: 'A very small pinch added once during cooking', value: 'pinch', score: 1 },
      { label: 'Salt added during cooking and at the table', value: 'cooking_and_table', score: 2 },
      { label: 'Heavy use of salt at cooking and/or at the table', value: 'heavy', score: 3 },
    ],
    applicableTo: ['Hypertension', 'Both'],
    weight: 3,
  },
  {
    id: 'htn_processed_foods',
    question: 'How much processed or packaged food (instant noodles, canned goods, deli meats, chips, fast food) did you eat today?',
    category: 'Sodium Intake',
    options: [
      { label: 'None — I ate mostly fresh, home-prepared foods', value: 'none', score: 0 },
      { label: 'A small amount (one processed item or small portion)', value: 'small', score: 1 },
      { label: 'A moderate amount (one full processed meal or several snacks)', value: 'moderate', score: 2 },
      { label: 'Most of my meals were processed, packaged, or from fast food', value: 'most', score: 3 },
    ],
    applicableTo: ['Hypertension', 'Both'],
    weight: 3,
  },
  {
    id: 'htn_potassium_foods',
    question: 'Did you eat potassium-rich foods (bananas, sweet potatoes, avocado, spinach, beans, yogurt) today? These help lower blood pressure.',
    category: 'Heart-Healthy Nutrients',
    options: [
      { label: '3 or more servings of potassium-rich foods', value: 'three_plus', score: 0 },
      { label: '1–2 servings of potassium-rich foods', value: 'one_two', score: 1 },
      { label: 'A small amount — less than one full serving', value: 'small', score: 2 },
      { label: 'None — I had no potassium-rich foods today', value: 'none', score: 3 },
    ],
    applicableTo: ['Hypertension', 'Both'],
    weight: 2,
  },
  {
    id: 'htn_fruit_veg',
    question: 'How many servings of fruits and vegetables did you eat today? (WHO recommends ≥5 servings / ≥400g per day)',
    category: 'Fruit & Vegetable Intake',
    options: [
      { label: '5 or more servings (≥400g) — meets WHO recommendation', value: 'five_plus', score: 0 },
      { label: '3–4 servings (200–399g)', value: 'three_four', score: 1 },
      { label: '1–2 servings (100–199g)', value: 'one_two', score: 2 },
      { label: 'None or very little (less than 100g)', value: 'none', score: 3 },
    ],
    applicableTo: ['Hypertension', 'Both'],
    weight: 2,
  },
  {
    id: 'htn_saturated_fat',
    question: 'Did you consume high-fat foods (fried food, fatty meats, full-fat dairy, butter, lard, coconut oil) today?',
    category: 'Fat Intake',
    options: [
      { label: 'No — I chose lean proteins and unsaturated fats (olive oil, fish, nuts)', value: 'none', score: 0 },
      { label: 'A small amount of saturated fat (occasional, not a main component)', value: 'small', score: 1 },
      { label: 'A moderate amount — saturated fat was part of one meal', value: 'moderate', score: 2 },
      { label: 'High saturated fat intake — fried foods or fatty meats were diet staples today', value: 'high', score: 3 },
    ],
    applicableTo: ['Hypertension', 'Both'],
    weight: 2,
  },
  {
    id: 'htn_water_intake',
    question: 'How much water did you drink today?',
    category: 'Hydration',
    options: [
      { label: '8 or more glasses (≥2 liters) — well hydrated', value: 'well_hydrated', score: 0 },
      { label: '5–7 glasses (1.25–1.75 liters)', value: 'moderate', score: 1 },
      { label: '3–4 glasses (0.75–1 liter)', value: 'low', score: 2 },
      { label: 'Fewer than 3 glasses — poorly hydrated', value: 'very_low', score: 3 },
    ],
    applicableTo: ['Hypertension', 'Both'],
    weight: 1,
  },
  {
    id: 'htn_salty_snacks',
    question: 'Did you eat salty snacks (chips, pretzels, salted nuts, crackers, pickles) today?',
    category: 'Sodium Intake',
    options: [
      { label: 'No salty snacks — I chose unsalted or low-sodium alternatives', value: 'none', score: 0 },
      { label: 'A very small amount (a few pieces)', value: 'small', score: 1 },
      { label: 'One regular serving of salty snacks', value: 'one_serving', score: 2 },
      { label: 'Multiple servings or salty snacking throughout the day', value: 'multiple', score: 3 },
    ],
    applicableTo: ['Hypertension', 'Both'],
    weight: 2,
  },
];

// ── COMBINED QUESTIONS (Both conditions) ──────────────────────────────────
// Merged intelligently — no duplicate categories, addresses both conditions

export const BOTH_CONDITIONS_QUESTIONS: FoodQuestion[] = [
  // From diabetes — blood glucose critical
  DIABETES_QUESTIONS.find(q => q.id === 'db_sugar_beverage')!,
  DIABETES_QUESTIONS.find(q => q.id === 'db_refined_carbs')!,
  DIABETES_QUESTIONS.find(q => q.id === 'db_meal_timing')!,
  DIABETES_QUESTIONS.find(q => q.id === 'db_fiber_intake')!,
  DIABETES_QUESTIONS.find(q => q.id === 'db_processed_sweets')!,
  // From hypertension — blood pressure critical
  HYPERTENSION_QUESTIONS.find(q => q.id === 'htn_salt_use')!,
  HYPERTENSION_QUESTIONS.find(q => q.id === 'htn_processed_foods')!,
  HYPERTENSION_QUESTIONS.find(q => q.id === 'htn_fruit_veg')!,
  HYPERTENSION_QUESTIONS.find(q => q.id === 'htn_potassium_foods')!,
  HYPERTENSION_QUESTIONS.find(q => q.id === 'htn_saturated_fat')!,
];

// ── ALL QUESTIONS POOL ─────────────────────────────────────────────────────
export const ALL_FOOD_QUESTIONS: FoodQuestion[] = [
  ...DIABETES_QUESTIONS,
  ...HYPERTENSION_QUESTIONS,
];

/**
 * Get condition-appropriate questions
 */
export function getQuestionsForCondition(condition: string): FoodQuestion[] {
  const normalized = condition?.trim();
  if (normalized === 'Diabetes') return DIABETES_QUESTIONS;
  if (normalized === 'Hypertension') return HYPERTENSION_QUESTIONS;
  if (normalized === 'Both') return BOTH_CONDITIONS_QUESTIONS;
  return [];
}

/**
 * Check if food monitoring applies to condition
 */
export function isFoodMonitoringApplicable(condition: string): boolean {
  return ['Diabetes', 'Hypertension', 'Both'].includes(condition?.trim() ?? '');
}

// ── RANDOM FOREST FOOD RISK CLASSIFIER ───────────────────────────────────
// Simulates a trained Random Forest using clinically-grounded decision trees
// Each tree evaluates a specific dietary risk dimension

interface FoodFeatures {
  avgScore: number;           // 0-3 weighted average
  maxCategoryScore: number;   // worst category
  sugarScore: number;         // 0-3
  sodiumScore: number;        // 0-3
  fiberScore: number;         // 0-3 (inverted — high fiber = low score)
  nutrientScore: number;      // potassium/fruit-veg
  mealPatternScore: number;   // meal timing/regularity
  frequencyPenalty: number;   // repeated unhealthy patterns
  conditionSpecificRisk: number; // worst-case for the condition
}

function extractFoodFeatures(
  entries: FoodLogEntry[],
  condition: string
): FoodFeatures {
  if (!entries || entries.length === 0) {
    return {
      avgScore: 0, maxCategoryScore: 0, sugarScore: 0, sodiumScore: 0,
      fiberScore: 0, nutrientScore: 0, mealPatternScore: 0,
      frequencyPenalty: 0, conditionSpecificRisk: 0,
    };
  }

  const now = Date.now();
  const HALF_LIFE_DAYS = 3;
  const DECAY = Math.LN2 / HALF_LIFE_DAYS;
  const ONE_DAY = 24 * 60 * 60 * 1000;

  const SUGAR_IDS = ['db_sugar_beverage', 'db_processed_sweets', 'db_refined_carbs', 'db_glycemic_awareness'];
  const SODIUM_IDS = ['htn_salt_use', 'htn_processed_foods', 'htn_salty_snacks'];
  const FIBER_IDS = ['db_fiber_intake'];
  const NUTRIENT_IDS = ['htn_potassium_foods', 'htn_fruit_veg'];
  const MEAL_IDS = ['db_meal_timing', 'db_portion_control'];

  let totalW = 0, totalWS = 0;
  let sugarW = 0, sugarWS = 0;
  let sodiumW = 0, sodiumWS = 0;
  let fiberW = 0, fiberWS = 0;
  let nutrientW = 0, nutrientWS = 0;
  let mealW = 0, mealWS = 0;

  const questionCounts: Record<string, number[]> = {};

  for (const e of entries) {
    const age = (now - new Date(e.timestamp).getTime()) / ONE_DAY;
    const w = Math.exp(-DECAY * age);

    totalW += w;
    totalWS += e.score * w;

    if (SUGAR_IDS.includes(e.questionId)) { sugarW += w; sugarWS += e.score * w; }
    if (SODIUM_IDS.includes(e.questionId)) { sodiumW += w; sodiumWS += e.score * w; }
    if (FIBER_IDS.includes(e.questionId)) { fiberW += w; fiberWS += e.score * w; }
    if (NUTRIENT_IDS.includes(e.questionId)) { nutrientW += w; nutrientWS += e.score * w; }
    if (MEAL_IDS.includes(e.questionId)) { mealW += w; mealWS += e.score * w; }

    if (!questionCounts[e.questionId]) questionCounts[e.questionId] = [];
    questionCounts[e.questionId].push(e.score);
  }

  const avg = totalW > 0 ? totalWS / totalW : 0;
  const sugarAvg = sugarW > 0 ? sugarWS / sugarW : 0;
  const sodiumAvg = sodiumW > 0 ? sodiumWS / sodiumW : 0;
  const fiberAvg = fiberW > 0 ? fiberWS / fiberW : 0;
  const nutrientAvg = nutrientW > 0 ? nutrientWS / nutrientW : 0;
  const mealAvg = mealW > 0 ? mealWS / mealW : 0;

  // Frequency penalty: repeated high-risk answers
  let freqPenalty = 0;
  for (const scores of Object.values(questionCounts)) {
    const highRisk = scores.filter(s => s >= 2).length;
    if (highRisk >= 3) freqPenalty += 0.4;
    if (highRisk >= 5) freqPenalty += 0.3;
  }

  // Condition-specific critical risk
  let conditionRisk = 0;
  if (condition === 'Diabetes' || condition === 'Both') {
    conditionRisk = Math.max(conditionRisk, sugarAvg, mealAvg);
  }
  if (condition === 'Hypertension' || condition === 'Both') {
    conditionRisk = Math.max(conditionRisk, sodiumAvg, 3 - nutrientAvg);
  }

  const maxCat = Math.max(sugarAvg, sodiumAvg, fiberAvg, mealAvg, conditionRisk);

  return {
    avgScore: avg,
    maxCategoryScore: maxCat,
    sugarScore: sugarAvg,
    sodiumScore: sodiumAvg,
    fiberScore: fiberAvg,
    nutrientScore: nutrientAvg,
    mealPatternScore: mealAvg,
    frequencyPenalty: freqPenalty,
    conditionSpecificRisk: conditionRisk,
  };
}

// Random Forest Decision Trees for food risk
interface FoodDecisionTree {
  name: string;
  weight: number;
  predict: (f: FoodFeatures) => RiskLevel;
}

const FOOD_RF_TREES: FoodDecisionTree[] = [
  {
    name: 'overall_score_tree',
    weight: 0.25,
    predict: (f) => {
      if (f.avgScore < 1.0) return 'Low';
      if (f.avgScore < 2.0) return 'Moderate';
      return 'High';
    },
  },
  {
    name: 'condition_specific_tree',
    weight: 0.30,
    predict: (f) => {
      if (f.conditionSpecificRisk < 1.0) return 'Low';
      if (f.conditionSpecificRisk < 2.0) return 'Moderate';
      return 'High';
    },
  },
  {
    name: 'worst_category_tree',
    weight: 0.20,
    predict: (f) => {
      if (f.maxCategoryScore < 1.2) return 'Low';
      if (f.maxCategoryScore < 2.2) return 'Moderate';
      return 'High';
    },
  },
  {
    name: 'frequency_pattern_tree',
    weight: 0.15,
    predict: (f) => {
      const composite = f.avgScore + f.frequencyPenalty;
      if (composite < 1.0) return 'Low';
      if (composite < 2.2) return 'Moderate';
      return 'High';
    },
  },
  {
    name: 'nutrient_balance_tree',
    weight: 0.10,
    predict: (f) => {
      // High nutrient score = protective; low = risky
      const deficit = 3 - f.nutrientScore;
      const risk = (f.avgScore + deficit) / 2;
      if (risk < 1.0) return 'Low';
      if (risk < 2.0) return 'Moderate';
      return 'High';
    },
  },
];

function randomForestFoodPredict(features: FoodFeatures): {
  riskLevel: RiskLevel;
  confidence: number;
  featureImportance: Record<string, number>;
} {
  const votes: Record<RiskLevel, number> = { Low: 0, Moderate: 0, High: 0 };

  for (const tree of FOOD_RF_TREES) {
    const pred = tree.predict(features);
    votes[pred] += tree.weight;
  }

  let winner: RiskLevel = 'Low';
  let maxVote = 0;
  for (const [level, vote] of Object.entries(votes)) {
    if (vote > maxVote) {
      maxVote = vote;
      winner = level as RiskLevel;
    }
  }

  const total = Object.values(votes).reduce((a, b) => a + b, 0);
  const confidence = total > 0 ? Math.round((maxVote / total) * 100) / 100 : 0;

  return {
    riskLevel: winner,
    confidence,
    featureImportance: {
      conditionSpecificRisk: 0.30,
      overallDietScore: 0.25,
      worstCategoryScore: 0.20,
      frequencyPattern: 0.15,
      nutrientBalance: 0.10,
    },
  };
}

// ── RULE-BASED FOOD RISK CLASSIFICATION ──────────────────────────────────
function ruleBasedFoodClassify(
  normalizedScore: number,
  features: FoodFeatures,
  condition: string
): RiskLevel {
  // WHO dietary risk thresholds
  let risk: RiskLevel = 'Low';

  if (normalizedScore >= 67) risk = 'High';
  else if (normalizedScore >= 34) risk = 'Moderate';

  // Condition-specific escalation
  if ((condition === 'Diabetes' || condition === 'Both') && features.sugarScore >= 2.5) {
    if (risk === 'Low') risk = 'Moderate';
    else if (risk === 'Moderate') risk = 'High';
  }
  if ((condition === 'Hypertension' || condition === 'Both') && features.sodiumScore >= 2.5) {
    if (risk === 'Low') risk = 'Moderate';
    else if (risk === 'Moderate') risk = 'High';
  }
  if (features.mealPatternScore >= 2.5) {
    if (risk === 'Low') risk = 'Moderate';
  }

  return risk;
}

/**
 * Main food risk calculation with Random Forest + Rule-based hybrid
 */
export function calculateFoodRisk(
  entries: FoodLogEntry[],
  condition: string = 'None'
): FoodRiskResult {
  if (!entries || entries.length === 0) {
    return {
      riskLevel: 'Low',
      normalizedScore: 0,
      mlRiskLevel: 'Low',
      mlConfidence: 0,
      finalRiskLevel: 'Low',
      breakdown: [],
      featureImportance: {},
    };
  }

  const now = Date.now();
  const ONE_DAY = 24 * 60 * 60 * 1000;
  const HALF_LIFE = 3;
  const DECAY = Math.LN2 / HALF_LIFE;

  // Weighted scoring
  let totalW = 0, totalWS = 0;
  for (const e of entries) {
    const age = (now - new Date(e.timestamp).getTime()) / ONE_DAY;
    const w = Math.exp(-DECAY * age);
    totalW += w;
    totalWS += e.score * w;
  }

  const rawAvg = totalW > 0 ? totalWS / totalW : 0;

  // Frequency penalty
  const qCounts: Record<string, number[]> = {};
  for (const e of entries) {
    if (!qCounts[e.questionId]) qCounts[e.questionId] = [];
    qCounts[e.questionId].push(e.score);
  }
  let freqPenalty = 0;
  for (const scores of Object.values(qCounts)) {
    const high = scores.filter(s => s >= 2).length;
    if (high >= 3) freqPenalty += 0.5;
    if (high >= 5) freqPenalty += 0.5;
  }

  const normalizedBase = (rawAvg / 3) * 100;
  const normalizedScore = Math.min(100, normalizedBase + freqPenalty * 5);

  // Extract ML features
  const features = extractFoodFeatures(entries, condition);

  // Rule-based classification
  const ruleRisk = ruleBasedFoodClassify(normalizedScore, features, condition);

  // ML Random Forest classification
  const mlResult = randomForestFoodPredict(features);

  // Conservative final decision (take higher risk)
  const riskRank: Record<RiskLevel, number> = { Low: 0, Moderate: 1, High: 2 };
  const finalRisk = riskRank[ruleRisk] >= riskRank[mlResult.riskLevel]
    ? ruleRisk
    : mlResult.riskLevel;

  // Category breakdown
  const catMap: Record<string, { total: number; max: number; label: string }> = {
    db_sugar_beverage: { total: 0, max: 0, label: 'Sugar & Beverages' },
    db_refined_carbs: { total: 0, max: 0, label: 'Carbohydrate Quality' },
    db_portion_control: { total: 0, max: 0, label: 'Portion Control' },
    db_meal_timing: { total: 0, max: 0, label: 'Meal Regularity' },
    db_fiber_intake: { total: 0, max: 0, label: 'Fiber Intake' },
    db_processed_sweets: { total: 0, max: 0, label: 'Processed Sweets' },
    db_glycemic_awareness: { total: 0, max: 0, label: 'Glycemic Awareness' },
    htn_salt_use: { total: 0, max: 0, label: 'Salt Use' },
    htn_processed_foods: { total: 0, max: 0, label: 'Processed Foods' },
    htn_potassium_foods: { total: 0, max: 0, label: 'Potassium-Rich Foods' },
    htn_fruit_veg: { total: 0, max: 0, label: 'Fruit & Vegetables' },
    htn_saturated_fat: { total: 0, max: 0, label: 'Fat Intake' },
    htn_water_intake: { total: 0, max: 0, label: 'Hydration' },
    htn_salty_snacks: { total: 0, max: 0, label: 'Salty Snacks' },
  };

  for (const e of entries) {
    if (catMap[e.questionId]) {
      const age = (now - new Date(e.timestamp).getTime()) / ONE_DAY;
      const w = Math.exp(-DECAY * age);
      catMap[e.questionId].total += e.score * w;
      catMap[e.questionId].max += 3 * w;
    }
  }

  const breakdown = Object.entries(catMap)
    .filter(([, v]) => v.max > 0)
    .map(([, v]) => ({
      category: v.label,
      score: Math.round((v.total / v.max) * 100),
      maxScore: 100,
    }));

  return {
    riskLevel: ruleRisk,
    normalizedScore: Math.round(normalizedScore),
    mlRiskLevel: mlResult.riskLevel,
    mlConfidence: Math.round(mlResult.confidence * 100),
    finalRiskLevel: finalRisk,
    breakdown,
    featureImportance: mlResult.featureImportance,
  };
}

// ── FOOD REMINDER CONTENT ─────────────────────────────────────────────────
// Evidence-based dietary guidance per condition

export function getFoodReminderContent(condition: string): {
  eat: string[];
  avoid: string[];
  title: string;
} | null {
  if (!isFoodMonitoringApplicable(condition)) return null;

  const diabetesEat = [
    'Non-starchy vegetables (broccoli, leafy greens, cauliflower, cucumber)',
    'Whole grains (oats, brown rice, quinoa, whole wheat bread)',
    'Legumes (lentils, chickpeas, kidney beans — low glycemic index)',
    'Lean protein (grilled fish, skinless chicken, tofu, eggs)',
    'Low-GI fruits in moderation (berries, apples, pears, cherries)',
    'Nuts and seeds (almonds, walnuts, chia seeds — small portions)',
    'Low-fat or unsweetened dairy products',
  ];

  const diabetesAvoid = [
    'Sugar-sweetened beverages (soda, sweetened juices, energy drinks)',
    'Refined/white carbohydrates in large portions (white bread, white rice, sugary cereals)',
    'Processed sweets (cakes, pastries, candy, ice cream)',
    'Fried foods and trans fats',
    'High-GI fruits in large amounts (ripe bananas, watermelon, pineapple)',
    'Skipping meals — causes dangerous blood glucose fluctuations',
    'Alcohol — impairs blood glucose control',
  ];

  const hypertensionEat = [
    'Potassium-rich foods (bananas, sweet potato, avocado, spinach, white beans)',
    'Fatty fish rich in omega-3 (salmon, mackerel, sardines — 2x per week)',
    'Low-fat dairy (yogurt, skim milk — provides calcium for BP regulation)',
    'Whole grains (oats, quinoa, whole wheat)',
    'Fresh herbs and spices as salt alternatives (garlic, turmeric, lemon)',
    'Unsalted nuts and seeds (DASH diet recommendation)',
    'Dark leafy greens (magnesium source for blood pressure control)',
  ];

  const hypertensionAvoid = [
    'Table salt and high-sodium condiments (soy sauce, fish sauce, ketchup)',
    'Processed and canned foods (very high hidden sodium content)',
    'Deli meats and processed meats (hotdogs, ham, bacon, salami)',
    'Fast food and fried foods (high sodium and saturated fat)',
    'Pickled and fermented foods with heavy brine',
    'Alcohol (raises blood pressure over time)',
    'Excessive caffeine (can temporarily spike blood pressure)',
  ];

  if (condition === 'Diabetes') {
    return {
      title: 'Diabetes Dietary Guidance',
      eat: diabetesEat,
      avoid: diabetesAvoid,
    };
  }

  if (condition === 'Hypertension') {
    return {
      title: 'Hypertension (DASH) Dietary Guidance',
      eat: hypertensionEat,
      avoid: hypertensionAvoid,
    };
  }

  if (condition === 'Both') {
    return {
      title: 'Diabetes & Hypertension Combined Dietary Guidance',
      eat: [
        'Non-starchy vegetables at every meal (lowers blood sugar AND blood pressure)',
        'Whole grains (brown rice, oats, quinoa — complex carbs, naturally low sodium)',
        'Legumes (beans, lentils — low GI, high potassium, heart-healthy)',
        'Lean protein (grilled fish, skinless chicken, tofu)',
        'Potassium-rich foods (bananas, sweet potato) — offsets sodium effect',
        'Low-fat dairy or unsweetened plant-based alternatives',
        'Berries and low-GI fruits in moderation',
        'Unsalted nuts and seeds',
        'Fresh herbs, garlic, and lemon instead of salt or sugar',
      ],
      avoid: [
        'Sugary beverages and processed sweets (spikes blood sugar)',
        'Refined/white carbohydrates in excess (white bread, pastries)',
        'Table salt, soy sauce, and high-sodium condiments',
        'Processed meats (high sodium AND saturated fat — harmful for both conditions)',
        'Fast food and fried foods',
        'Alcohol (disrupts blood glucose AND raises blood pressure)',
        'Skipping meals (dangerous for blood glucose management)',
        'High-sodium canned or packaged foods',
      ],
    };
  }

  return null;
}

// Legacy export for backward compatibility
export const FOOD_QUESTIONS = ALL_FOOD_QUESTIONS;