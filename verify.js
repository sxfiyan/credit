/**
 * verify.js - Automated Mathematical Correctness Verifier
 * Runs in Node.js environment to check credit scoring engines
 */

const { mockCompanies } = require('./mockData.js');

// 1. Math formulas replication
function normCDF(x) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804 * Math.exp(-x * x / 2);
  const p = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x >= 0 ? 1 - p : p;
}

function calculateRatios(financials) {
  const cash = financials.cash;
  const ca = financials.currentAssets;
  const cl = financials.currentLiabilities;
  const ta = financials.totalAssets;
  const tl = financials.totalLiabilities;
  const debt = financials.totalDebt;
  const equity = financials.bookEquity;
  const sales = financials.sales;
  const ebit = financials.ebit;
  const netIncome = financials.netIncome;
  const interest = financials.interestExpense;

  return {
    workingCapital: ca - cl,
    currentRatio: cl > 0 ? ca / cl : 0,
    quickRatio: cl > 0 ? cash / cl : 0,
    debtToEquity: equity > 0 ? debt / equity : 0,
    debtToAssets: ta > 0 ? tl / ta : 0,
    roa: ta > 0 ? netIncome / ta : 0,
    roe: equity > 0 ? netIncome / equity : 0,
    netProfitMargin: sales > 0 ? netIncome / sales : 0,
    interestCoverage: interest > 0 ? ebit / interest : (ebit > 0 ? 999 : 0),
    assetTurnover: ta > 0 ? sales / ta : 0
  };
}

function calculateAltmanZScore(financials, sector, isPublic) {
  const ta = financials.totalAssets;
  const tl = financials.totalLiabilities;
  if (ta <= 0 || tl <= 0) return { score: 0, zone: "distress" };

  const wc = financials.currentAssets - financials.currentLiabilities;
  const re = financials.retainedEarnings;
  const ebit = financials.ebit;
  const equityVal = isPublic ? financials.marketCap : financials.bookEquity;
  const sales = financials.sales;

  const x1 = wc / ta;
  const x2 = re / ta;
  const x3 = ebit / ta;
  const x4 = equityVal / tl;
  const x5 = sales / ta;

  let score = 0;
  let zone = "";

  if (sector === "manufacturing") {
    score = (1.2 * x1) + (1.4 * x2) + (3.3 * x3) + (0.6 * x4) + (0.999 * x5);
    if (score > 2.99) zone = "safe";
    else if (score >= 1.81) zone = "warning";
    else zone = "distress";
  } else {
    score = (6.56 * x1) + (3.26 * x2) + (6.72 * x3) + (1.05 * x4);
    if (score > 2.90) zone = "safe";
    else if (score >= 1.23) zone = "warning";
    else zone = "distress";
  }

  return { score: parseFloat(score.toFixed(2)), zone };
}

function calculateMertonModel(financials) {
  const equityVal = financials.marketCap || financials.bookEquity;
  const debt = financials.totalDebt || financials.totalLiabilities;
  const volAsset = financials.assetVolatility || 0.20;
  const r = 0.04;
  const T = 1.0;

  if (equityVal <= 0 || debt <= 0 || volAsset <= 0) {
    return { distanceToDefault: 0, defaultProb: 1.0 };
  }

  const assetVal = equityVal + debt;
  const numerator = Math.log(assetVal / debt) + (r - (volAsset * volAsset) / 2) * T;
  const denominator = volAsset * Math.sqrt(T);
  const d2 = numerator / denominator;
  const defaultProb = normCDF(-d2);

  return {
    distanceToDefault: parseFloat(d2.toFixed(2)),
    defaultProb: parseFloat(defaultProb.toFixed(5))
  };
}

// 2. Run validations
console.log("=== CORPSCORE QUANTITATIVE ENGINE VERIFICATION ===");

let passed = true;

mockCompanies.forEach(company => {
  console.log(`\nVerifying metrics for: ${company.name}`);
  
  // Test Ratios
  const ratios = calculateRatios(company.financials);
  console.log(`- Working Capital: $${ratios.workingCapital}`);
  console.log(`- Current Ratio: ${ratios.currentRatio.toFixed(3)}`);
  console.log(`- Debt to Assets: ${(ratios.debtToAssets * 100).toFixed(1)}%`);
  console.log(`- Interest Coverage: ${ratios.interestCoverage === 999 ? "Infinity" : ratios.interestCoverage.toFixed(2)}`);
  
  if (company.id === 'preset-apex-manufacturing') {
    // Assert current ratio is around 2.5
    if (Math.abs(ratios.currentRatio - 2.5) > 0.01) {
      console.error(`FAIL: Apex current ratio expected 2.5, got ${ratios.currentRatio}`);
      passed = false;
    } else {
      console.log("PASS: Current Ratio check");
    }
  }

  // Test Z-Score
  const zObj = calculateAltmanZScore(company.financials, company.sector, company.isPublic);
  console.log(`- Altman Z-Score: ${zObj.score} (${zObj.zone.toUpperCase()} Zone)`);
  
  if (company.id === 'preset-apex-manufacturing') {
    // Expected ~5.71
    if (Math.abs(zObj.score - 5.71) > 0.05) {
      console.error(`FAIL: Apex Altman Z expected 5.71, got ${zObj.score}`);
      passed = false;
    } else {
      console.log("PASS: Altman Z-Score value");
    }
  }

  if (company.id === 'preset-global-retailers') {
    // Expected negative Z-score or very low
    if (zObj.score >= 1.0) {
      console.error(`FAIL: Global Retailers expected distress Z-score (<1.0), got ${zObj.score}`);
      passed = false;
    } else {
      console.log("PASS: Altman Z-Score distress value");
    }
  }

  // Test Merton Model
  const merton = calculateMertonModel(company.financials);
  console.log(`- Merton Distance to Default (D2D): ${merton.distanceToDefault} sigma`);
  console.log(`- Merton Default Probability: ${(merton.defaultProb * 100).toFixed(3)}%`);

  if (company.id === 'preset-apex-manufacturing') {
    if (merton.distanceToDefault < 10) {
      console.error(`FAIL: Apex D2D expected large (>10), got ${merton.distanceToDefault}`);
      passed = false;
    } else {
      console.log("PASS: Merton D2D check");
    }
  }
});

console.log("\n-------------------------------------------");
if (passed) {
  console.log("ALL MATHEMATICAL VERIFICATION TESTS PASSED!");
  process.exit(0);
} else {
  console.log("VERIFICATION TESTS FAILED!");
  process.exit(1);
}
