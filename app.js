/**
 * app.js - CorpScore AI Controller & Financial Engines
 */

// Global State
let portfolio = [];
let currentAssessment = null;
let stressedAssessment = null;
let charts = {
  radar: null,
  gauge: null,
  stressLine: null,
  portfolioDist: null
};

// Default industry benchmarks (normalized to a 0-10 scale for radar charting)
const INDUSTRY_BENCHMARKS = {
  currentRatio: 1.8,
  debtToAssets: 0.45,
  roa: 0.08,
  interestCoverage: 4.5,
  assetTurnover: 1.2
};

// Base interest rate (simulated SOFR or reference rate)
const BASE_INTEREST_RATE = 0.045; // 4.5%

/* ==========================================================================
   1. Initialization & State Management
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  initApp();
});

function initApp() {
  // Load portfolio from LocalStorage or initialize with mock data
  const stored = localStorage.getItem("corpscore_portfolio");
  if (stored) {
    portfolio = JSON.parse(stored);
  } else {
    // Populate with mock data if empty
    portfolio = [...mockCompanies];
    savePortfolio();
  }

  // Setup navigation tabs
  setupNavigation();

  // Setup form submission
  setupFormHandlers();

  // Setup stress sliders
  setupStressHandlers();

  // Load portfolio list in dashboard
  renderPortfolioTable();
  updatePortfolioStats();
  renderPortfolioCharts();

  // Initialize theme from storage/system
  initTheme();
}

function savePortfolio() {
  localStorage.setItem("corpscore_portfolio", JSON.stringify(portfolio));
}

function initTheme() {
  const toggleBtn = document.getElementById("theme-toggle");
  if (!toggleBtn) return;

  const currentTheme = localStorage.getItem("color-scheme") || 
                       (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  
  document.documentElement.setAttribute("color-scheme", currentTheme);
  
  toggleBtn.addEventListener("click", () => {
    const isDark = document.documentElement.getAttribute("color-scheme") === "dark";
    const newTheme = isDark ? "light" : "dark";
    document.documentElement.setAttribute("color-scheme", newTheme);
    localStorage.setItem("color-scheme", newTheme);
    showToast(`Switched to ${newTheme} mode`, "info");
    
    // Re-render charts to adapt colors to the new theme
    setTimeout(() => {
      recreateCharts();
    }, 150);
  });
}

function setupNavigation() {
  const tabs = document.querySelectorAll(".tab-btn");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const targetSectionId = tab.getAttribute("data-target");
      
      // Update active tab styling
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");

      // Switch section visibility
      document.querySelectorAll(".app-section").forEach(sec => {
        sec.classList.remove("active");
      });
      document.getElementById(targetSectionId).classList.add("active");

      // Special action on tab change
      if (targetSectionId === "section-dashboard") {
        renderPortfolioTable();
        updatePortfolioStats();
        renderPortfolioCharts();
      } else if (targetSectionId === "section-results" && currentAssessment) {
        renderResultsView();
      } else if (targetSectionId === "section-stress" && currentAssessment) {
        initStressSimulation();
      }
    });
  });
}

/* ==========================================================================
   2. Quantitative Scoring Engines & Mathematical Models
   ========================================================================== */

/**
 * Normal Distribution Cumulative Distribution Function approximation
 * (Abramowitz and Stegun 1964)
 */
function normCDF(x) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804 * Math.exp(-x * x / 2);
  const p = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x >= 0 ? 1 - p : p;
}

/**
 * Calculates standard corporate financial ratios
 */
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

/**
 * Altman Z-Score Model
 * Z = 1.2*X1 + 1.4*X2 + 3.3*X3 + 0.6*X4 + 0.999*X5 (Manufacturing)
 * Z' = 6.56*X1 + 3.26*X2 + 6.72*X3 + 1.05*X4 (Service / Non-Manufacturing)
 */
function calculateAltmanZScore(financials, sector, isPublic) {
  const ta = financials.totalAssets;
  const tl = financials.totalLiabilities;
  
  if (ta <= 0 || tl <= 0) return { score: 0, zone: "distress", zoneLabel: "Distress Zone" };

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
  let zoneLabel = "";

  if (sector === "manufacturing") {
    score = (1.2 * x1) + (1.4 * x2) + (3.3 * x3) + (0.6 * x4) + (0.999 * x5);
    if (score > 2.99) {
      zone = "safe";
      zoneLabel = "Safe Zone (Low Bankruptcy Risk)";
    } else if (score >= 1.81) {
      zone = "warning";
      zoneLabel = "Grey Zone (Moderate Bankruptcy Risk)";
    } else {
      zone = "distress";
      zoneLabel = "Distress Zone (High Bankruptcy Risk)";
    }
  } else {
    // Service/Non-manufacturing Altman Z'' 4-variable model
    score = (6.56 * x1) + (3.26 * x2) + (6.72 * x3) + (1.05 * x4);
    if (score > 2.90) {
      zone = "safe";
      zoneLabel = "Safe Zone (Low Bankruptcy Risk)";
    } else if (score >= 1.23) {
      zone = "warning";
      zoneLabel = "Grey Zone (Moderate Bankruptcy Risk)";
    } else {
      zone = "distress";
      zoneLabel = "Distress Zone (High Bankruptcy Risk)";
    }
  }

  return {
    score: parseFloat(score.toFixed(2)),
    zone,
    zoneLabel,
    ratios: { x1, x2, x3, x4, x5 }
  };
}

/**
 * Merton Distance-to-Default Model (Simplified Quantitative Black-Scholes framework)
 * Uses equity value, debt, asset volatility, and risk free rate to compute default probability
 */
function calculateMertonModel(financials) {
  const equityVal = financials.marketCap || financials.bookEquity;
  const debt = financials.totalDebt || financials.totalLiabilities;
  const volAsset = financials.assetVolatility || 0.20;
  const r = 0.04; // risk-free rate of 4%
  const T = 1.0;  // 1-year time horizon

  if (equityVal <= 0 || debt <= 0 || volAsset <= 0) {
    return { d2: 0, defaultProb: 1.0, distanceToDefault: 0 };
  }

  // Under Merton, total assets V_A ≈ Equity + Debt
  const assetVal = equityVal + debt;

  // d2 = [ln(V_A / D) + (r - vol_A^2 / 2)*T] / [vol_A * sqrt(T)]
  const numerator = Math.log(assetVal / debt) + (r - (volAsset * volAsset) / 2) * T;
  const denominator = volAsset * Math.sqrt(T);
  const d2 = numerator / denominator;

  // Probability of default (PD) = N(-d2)
  const defaultProb = normCDF(-d2);

  return {
    distanceToDefault: parseFloat(d2.toFixed(2)),
    defaultProb: parseFloat(defaultProb.toFixed(5)),
    assetValue: assetVal
  };
}

/**
 * Multi-criteria weighted financial ratio scoring engine (0-100 score)
 * Maps to credit rating levels and 1-year default probability
 */
function calculateWeightedCreditScore(ratios) {
  let score = 0;

  // 1. Liquidity (Current Ratio): Weight = 20 pts. Target >= 2.0
  const cr = ratios.currentRatio;
  if (cr >= 2.0) score += 20;
  else if (cr > 0.5) score += ((cr - 0.5) / 1.5) * 20;

  // 2. Leverage (Debt-to-Assets): Weight = 20 pts. Target <= 0.35 (Max score), >= 0.8 (0 score)
  const da = ratios.debtToAssets;
  if (da <= 0.35) score += 20;
  else if (da < 0.8) score += (1 - (da - 0.35) / 0.45) * 20;

  // 3. Profitability (ROA): Weight = 20 pts. Target >= 12% (Max score), <= 0% (0 score)
  const roa = ratios.roa;
  if (roa >= 0.12) score += 20;
  else if (roa > 0) score += (roa / 0.12) * 20;

  // 4. Solvency (Interest Coverage): Weight = 20 pts. Target >= 6.0 (Max score), <= 1.0 (0 score)
  const ic = ratios.interestCoverage;
  if (ic >= 6.0) score += 20;
  else if (ic > 1.0) score += ((ic - 1.0) / 5.0) * 20;

  // 5. Efficiency (Asset Turnover): Weight = 20 pts. Target >= 1.5 (Max score), <= 0.2 (0 score)
  const at = ratios.assetTurnover;
  if (at >= 1.5) score += 20;
  else if (at > 0.2) score += ((at - 0.2) / 1.3) * 20;

  // Final aggregate score
  score = Math.max(0, Math.min(100, Math.round(score)));

  // Map score to rating and default probability
  let rating = "D";
  let pd = 0.25; // 25% default prob base

  if (score >= 90) {
    rating = "AAA";
    pd = 0.0002; // 0.02%
  } else if (score >= 80) {
    rating = "AA";
    pd = 0.0005; // 0.05%
  } else if (score >= 70) {
    rating = "A";
    pd = 0.0015; // 0.15%
  } else if (score >= 60) {
    rating = "BBB";
    pd = 0.0040; // 0.40%
  } else if (score >= 50) {
    rating = "BB";
    pd = 0.0120; // 1.20%
  } else if (score >= 40) {
    rating = "B";
    pd = 0.0350; // 3.50%
  } else if (score >= 30) {
    rating = "CCC";
    pd = 0.1200; // 12%
  } else {
    rating = "D";
    pd = 0.2800; // 28%
  }

  return {
    score,
    rating,
    defaultProb: pd
  };
}

/**
 * Loan Evaluation & Decision Engine
 */
function evaluateLoanRequest(financials, ratios, ratingInfo, request) {
  const reqAmount = request.amount;
  const term = request.term;
  const collateral = request.collateralValue;

  if (reqAmount <= 0 || term <= 0) {
    return {
      decision: "Rejected",
      reason: "Invalid loan amount or term request.",
      interestRate: 0,
      dscr: 0,
      ltv: 0
    };
  }

  // 1. Calculate Debt Service Coverage Ratio (DSCR)
  // Approximate annual debt service: principal amortization + annual interest (at recommended rate)
  const ratingSpreads = {
    "AAA": 0.010, "AA": 0.0125, "A": 0.015, "BBB": 0.020,
    "BB": 0.035, "B": 0.055, "CCC": 0.090, "D": 0.150
  };
  const spread = ratingSpreads[ratingInfo.rating] || 0.05;
  const suggestedRate = BASE_INTEREST_RATE + spread;
  
  const annualAmortization = reqAmount / term;
  const annualInterest = reqAmount * suggestedRate;
  const annualDebtService = annualAmortization + annualInterest;

  const dscr = financials.ebit / annualDebtService;

  // 2. Calculate Loan-to-Value (LTV)
  const ltv = collateral > 0 ? reqAmount / collateral : 999;

  // 3. Determine Decision
  let decision = "Rejected";
  let reason = "";

  if (ratingInfo.rating === "D" || ratingInfo.rating === "CCC") {
    decision = "Rejected";
    reason = "Corporate Credit Rating indicates extreme distress/default risk.";
  } else if (dscr < 1.0) {
    decision = "Rejected";
    reason = "Insufficient cash flow coverage. Debt Service Coverage Ratio (DSCR) is less than 1.0.";
  } else if (ltv > 0.95) {
    decision = "Rejected";
    reason = "Excessive leverage relative to collateral. Loan-to-Value (LTV) exceeds 95%.";
  } else if (ratingInfo.rating === "BB" || ratingInfo.rating === "B" || dscr < 1.25 || ltv > 0.8) {
    decision = "Review";
    reason = "Borderline parameters. Requires manual underwriting committee approval due to high leverage or modest cash coverage.";
  } else {
    decision = "Approved";
    reason = "Corporate profile satisfies all risk boundaries: robust rating, solid debt coverage, and sufficient collateral buffer.";
  }

  // Compute maximum loan capacity (assuming DSCR must be >= 1.25)
  // Max Annual Debt Service = EBIT / 1.25
  // Max Loan principal approximate: (Max Annual Debt Service) / (1/term + rate)
  const maxAnnualDebtService = financials.ebit / 1.25;
  const maxAmortFactor = (1 / term) + suggestedRate;
  const maxCapacity = financials.ebit > 0 ? maxAnnualDebtService / maxAmortFactor : 0;

  return {
    decision,
    reason,
    interestRate: suggestedRate,
    dscr: parseFloat(dscr.toFixed(2)),
    ltv: parseFloat(ltv.toFixed(2)),
    maxCapacity: Math.round(maxCapacity)
  };
}

/**
 * Aggregates all model outputs into a single assessment payload
 */
function runFullAssessment(company) {
  const ratios = calculateRatios(company.financials);
  const zScore = calculateAltmanZScore(company.financials, company.sector, company.isPublic);
  const merton = calculateMertonModel(company.financials);
  const creditScoring = calculateWeightedCreditScore(ratios);
  
  // Blend default probabilities: 40% Weighted Ratio Engine, 30% Altman Z-score zone, 30% Merton Model
  // Altman Z zone mapping: safe = 0.05% PD, warning = 3.0% PD, distress = 20.0% PD
  let zScorePD = 0.03;
  if (zScore.zone === "safe") zScorePD = 0.0005;
  else if (zScore.zone === "warning") zScorePD = 0.025;
  else zScorePD = 0.18;

  const blendedPD = (creditScoring.defaultProb * 0.4) + (zScorePD * 0.3) + (merton.defaultProb * 0.3);

  // Recalculate rating from blended PD for final combined rating
  let finalRating = "D";
  if (blendedPD < 0.0005) finalRating = "AAA";
  else if (blendedPD < 0.001) finalRating = "AA";
  else if (blendedPD < 0.003) finalRating = "A";
  else if (blendedPD < 0.01) finalRating = "BBB";
  else if (blendedPD < 0.03) finalRating = "BB";
  else if (blendedPD < 0.08) finalRating = "B";
  else if (blendedPD < 0.20) finalRating = "CCC";

  const ratingInfo = {
    score: creditScoring.score,
    rating: finalRating,
    defaultProb: blendedPD
  };

  const loanEvaluation = evaluateLoanRequest(company.financials, ratios, ratingInfo, company.loanRequest);

  return {
    ...company,
    ratios,
    zScore,
    merton,
    ratingInfo,
    loanEvaluation,
    assessedAt: new Date().toISOString()
  };
}

/* ==========================================================================
   3. Portfolio Dashboard Renderer
   ========================================================================== */

function updatePortfolioStats() {
  if (portfolio.length === 0) {
    document.getElementById("stat-total-loans").textContent = "$0";
    document.getElementById("stat-avg-score").textContent = "N/A";
    document.getElementById("stat-avg-pd").textContent = "0.00%";
    document.getElementById("stat-default-rate").textContent = "0.00%";
    return;
  }

  let totalPortfolioValue = 0;
  let scoreSum = 0;
  let pdSum = 0;
  let defaultCount = 0;

  portfolio.forEach(comp => {
    const assessment = runFullAssessment(comp);
    totalPortfolioValue += comp.loanRequest.amount;
    scoreSum += assessment.ratingInfo.score;
    pdSum += assessment.ratingInfo.defaultProb;
    
    if (assessment.ratingInfo.rating === "D" || assessment.ratingInfo.rating === "CCC") {
      defaultCount++;
    }
  });

  const avgScore = Math.round(scoreSum / portfolio.length);
  const avgPD = (pdSum / portfolio.length) * 100;
  const defaultRate = (defaultCount / portfolio.length) * 100;

  document.getElementById("stat-total-loans").textContent = formatCurrency(totalPortfolioValue);
  document.getElementById("stat-avg-score").textContent = avgScore;
  document.getElementById("stat-avg-pd").textContent = avgPD.toFixed(2) + "%";
  document.getElementById("stat-default-rate").textContent = defaultRate.toFixed(1) + "%";
}

function renderPortfolioTable() {
  const tbody = document.querySelector("#portfolio-table-body");
  const searchQuery = document.getElementById("search-company").value.toLowerCase();
  const sectorFilter = document.getElementById("filter-sector").value;
  const ratingFilter = document.getElementById("filter-rating").value;

  tbody.innerHTML = "";

  const filtered = portfolio.filter(comp => {
    const assessment = runFullAssessment(comp);
    
    const matchesSearch = comp.name.toLowerCase().includes(searchQuery);
    const matchesSector = sectorFilter === "all" || comp.sector === sectorFilter;
    
    // Group rating classes (investment vs speculative vs distress)
    let matchesRating = ratingFilter === "all";
    if (!matchesRating) {
      const rating = assessment.ratingInfo.rating;
      if (ratingFilter === "investment") {
        matchesRating = ["AAA", "AA", "A", "BBB"].includes(rating);
      } else if (ratingFilter === "speculative") {
        matchesRating = ["BB", "B"].includes(rating);
      } else if (ratingFilter === "distress") {
        matchesRating = ["CCC", "D"].includes(rating);
      }
    }

    return matchesSearch && matchesSector && matchesRating;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          <p>No matching corporate assessments found</p>
        </td>
      </tr>
    `;
    return;
  }

  filtered.forEach(comp => {
    const assessment = runFullAssessment(comp);
    const tr = document.createElement("tr");

    const zScoreVal = assessment.zScore.score;
    const zZone = assessment.zScore.zone;
    const pdVal = (assessment.ratingInfo.defaultProb * 100).toFixed(2) + "%";
    const dec = assessment.loanEvaluation.decision;

    let decBadge = "";
    if (dec === "Approved") decBadge = `<span class="rating-badge AAA">Approved</span>`;
    else if (dec === "Review") decBadge = `<span class="rating-badge BBB">Review</span>`;
    else decBadge = `<span class="rating-badge CCC">Rejected</span>`;

    tr.innerHTML = `
      <td style="font-weight: 600;">${comp.name}</td>
      <td style="text-transform: capitalize;">${comp.sector}</td>
      <td>
        <span class="zone-dot ${zZone}"></span>
        <span>${zScoreVal}</span>
      </td>
      <td>${pdVal}</td>
      <td><span class="rating-badge ${assessment.ratingInfo.rating}">${assessment.ratingInfo.rating}</span></td>
      <td>${decBadge}</td>
      <td style="text-align: right; white-space: nowrap;">
        <button class="action-btn" onclick="viewAssessmentDetails('${comp.id}')">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
          View
        </button>
        <button class="action-btn" onclick="openStressFromDashboard('${comp.id}')">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
          Stress
        </button>
        <button class="action-btn delete-btn" onclick="deleteAssessment('${comp.id}')">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function viewAssessmentDetails(id) {
  const comp = portfolio.find(c => c.id === id);
  if (!comp) return;

  currentAssessment = runFullAssessment(comp);
  
  // Switch to results tab
  const resultsTab = document.querySelector('.tab-btn[data-target="section-results"]');
  if (resultsTab) resultsTab.click();
}

function openStressFromDashboard(id) {
  const comp = portfolio.find(c => c.id === id);
  if (!comp) return;

  currentAssessment = runFullAssessment(comp);
  
  // Switch to stress tab
  const stressTab = document.querySelector('.tab-btn[data-target="section-stress"]');
  if (stressTab) stressTab.click();
}

function deleteAssessment(id) {
  if (confirm("Are you sure you want to delete this company assessment?")) {
    portfolio = portfolio.filter(comp => comp.id !== id);
    savePortfolio();
    renderPortfolioTable();
    updatePortfolioStats();
    renderPortfolioCharts();
    showToast("Assessment deleted from portfolio", "warning");
  }
}

/* ==========================================================================
   4. Form Handlers & Presets Loaders
   ========================================================================== */

function setupFormHandlers() {
  // Setup inputs search listeners
  document.getElementById("search-company").addEventListener("input", renderPortfolioTable);
  document.getElementById("filter-sector").addEventListener("change", renderPortfolioTable);
  document.getElementById("filter-rating").addEventListener("change", renderPortfolioTable);

  // Load Presets side menu in the assessment screen
  const presetsBox = document.getElementById("presets-box");
  presetsBox.innerHTML = "";
  
  mockCompanies.forEach(comp => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "preset-card interactive glass-card";
    
    // Quick evaluate to show score
    const evalResult = runFullAssessment(comp);
    const rating = evalResult.ratingInfo.rating;

    card.innerHTML = `
      <div class="preset-title">${comp.name}</div>
      <div class="preset-desc" style="display: flex; justify-content: space-between;">
        <span>${comp.sector.toUpperCase()} • ${comp.size.toUpperCase()}</span>
        <span class="rating-badge ${rating}">${rating}</span>
      </div>
    `;

    card.addEventListener("click", () => {
      document.querySelectorAll(".preset-card").forEach(c => c.classList.remove("active"));
      card.classList.add("active");
      populateForm(comp);
      showToast(`Loaded details for ${comp.name}`, "info");
    });

    presetsBox.appendChild(card);
  });

  // Handle Assessment submission
  const form = document.getElementById("credit-scoring-form");
  form.addEventListener("submit", (e) => {
    e.preventDefault();

    if (!form.checkValidity()) {
      showToast("Please check the form fields for errors.", "error");
      return;
    }

    const companyData = {
      id: "assess-" + Date.now(),
      name: document.getElementById("comp-name").value,
      sector: document.getElementById("comp-sector").value,
      size: document.getElementById("comp-size").value,
      isPublic: document.getElementById("comp-public").checked,
      financials: {
        cash: parseFloat(document.getElementById("fin-cash").value) || 0,
        currentAssets: parseFloat(document.getElementById("fin-ca").value) || 0,
        currentLiabilities: parseFloat(document.getElementById("fin-cl").value) || 0,
        retainedEarnings: parseFloat(document.getElementById("fin-re").value) || 0,
        totalAssets: parseFloat(document.getElementById("fin-ta").value) || 0,
        totalLiabilities: parseFloat(document.getElementById("fin-tl").value) || 0,
        totalDebt: parseFloat(document.getElementById("fin-debt").value) || 0,
        bookEquity: parseFloat(document.getElementById("fin-equity").value) || 0,
        marketCap: parseFloat(document.getElementById("fin-market").value) || 0,
        sales: parseFloat(document.getElementById("fin-sales").value) || 0,
        ebit: parseFloat(document.getElementById("fin-ebit").value) || 0,
        interestExpense: parseFloat(document.getElementById("fin-interest").value) || 0,
        netIncome: parseFloat(document.getElementById("fin-net").value) || 0,
        assetVolatility: parseFloat(document.getElementById("fin-vol").value) / 100 || 0.20
      },
      loanRequest: {
        amount: parseFloat(document.getElementById("loan-amount").value) || 0,
        term: parseInt(document.getElementById("loan-term").value) || 1,
        collateralValue: parseFloat(document.getElementById("loan-collateral").value) || 0,
        collateralType: document.getElementById("loan-collateral-type").value
      }
    };

    // Calculate market cap default if private
    if (!companyData.isPublic) {
      companyData.financials.marketCap = companyData.financials.bookEquity;
    }

    // Save to global portfolio
    // Check if name already exists, if so overwrite, else add new
    const existingIndex = portfolio.findIndex(c => c.name === companyData.name);
    if (existingIndex > -1) {
      companyData.id = portfolio[existingIndex].id; // Retain ID
      portfolio[existingIndex] = companyData;
      showToast("Updated existing corporate assessment", "success");
    } else {
      portfolio.push(companyData);
      showToast("New corporate assessment saved", "success");
    }

    savePortfolio();
    currentAssessment = runFullAssessment(companyData);
    
    // Switch to Results Tab
    document.querySelector('.tab-btn[data-target="section-results"]').click();
  });

  // Listen to public/private checkbox to show/hide market cap
  document.getElementById("comp-public").addEventListener("change", (e) => {
    const marketGroup = document.getElementById("market-cap-group");
    if (e.target.checked) {
      marketGroup.style.display = "flex";
      document.getElementById("fin-market").required = true;
    } else {
      marketGroup.style.display = "none";
      document.getElementById("fin-market").required = false;
    }
  });
}

function populateForm(comp) {
  document.getElementById("comp-name").value = comp.name;
  document.getElementById("comp-sector").value = comp.sector;
  document.getElementById("comp-size").value = comp.size;
  document.getElementById("comp-public").checked = comp.isPublic;
  
  const marketGroup = document.getElementById("market-cap-group");
  if (comp.isPublic) {
    marketGroup.style.display = "flex";
    document.getElementById("fin-market").required = true;
    document.getElementById("fin-market").value = comp.financials.marketCap;
  } else {
    marketGroup.style.display = "none";
    document.getElementById("fin-market").required = false;
  }

  document.getElementById("fin-cash").value = comp.financials.cash;
  document.getElementById("fin-ca").value = comp.financials.currentAssets;
  document.getElementById("fin-cl").value = comp.financials.currentLiabilities;
  document.getElementById("fin-re").value = comp.financials.retainedEarnings;
  document.getElementById("fin-ta").value = comp.financials.totalAssets;
  document.getElementById("fin-tl").value = comp.financials.totalLiabilities;
  document.getElementById("fin-debt").value = comp.financials.totalDebt;
  document.getElementById("fin-equity").value = comp.financials.bookEquity;
  document.getElementById("fin-sales").value = comp.financials.sales;
  document.getElementById("fin-ebit").value = comp.financials.ebit;
  document.getElementById("fin-interest").value = comp.financials.interestExpense;
  document.getElementById("fin-net").value = comp.financials.netIncome;
  document.getElementById("fin-vol").value = Math.round(comp.financials.assetVolatility * 100);

  document.getElementById("loan-amount").value = comp.loanRequest.amount;
  document.getElementById("loan-term").value = comp.loanRequest.term;
  document.getElementById("loan-collateral").value = comp.loanRequest.collateralValue;
  document.getElementById("loan-collateral-type").value = comp.loanRequest.collateralType;
}

/* ==========================================================================
   5. Results View Renderer
   ========================================================================== */

function renderResultsView() {
  if (!currentAssessment) return;

  const r = currentAssessment;
  
  // Show print-friendly corporate details
  document.getElementById("print-comp-name").textContent = r.name;
  document.getElementById("print-date").textContent = new Date(r.assessedAt).toLocaleDateString();

  // Company Name Headers
  document.getElementById("res-comp-name").textContent = r.name;
  document.getElementById("res-meta").textContent = `${r.size.toUpperCase()} ENTERPRISE • ${r.sector.toUpperCase()} SECTOR • ${r.isPublic ? 'PUBLIC' : 'PRIVATE'}`;

  // Big Score Badge
  const ratingBox = document.getElementById("res-rating-box");
  ratingBox.className = "score-badge-large glass-card " + getRiskClass(r.ratingInfo.rating);
  document.getElementById("res-large-rating").textContent = r.ratingInfo.rating;
  document.getElementById("res-score-val").textContent = `CorpScore: ${r.ratingInfo.score}/100`;
  document.getElementById("res-pd-val").textContent = `${(r.ratingInfo.defaultProb * 100).toFixed(3)}%`;

  // 1. Altman Z-Score Card
  const zScoreCard = document.getElementById("model-zscore");
  zScoreCard.className = "model-card glass-card";
  zScoreCard.querySelector(".model-score-display").textContent = r.zScore.score;
  const zInterpretation = zScoreCard.querySelector(".model-interpretation");
  zInterpretation.textContent = r.zScore.zoneLabel;
  zInterpretation.className = "model-interpretation " + r.zScore.zone;

  const formulaText = r.sector === "manufacturing" 
    ? "Z = 1.2*X1 + 1.4*X2 + 3.3*X3 + 0.6*X4 + 1.0*X5" 
    : "Z' = 6.56*X1 + 3.26*X2 + 6.72*X3 + 1.05*X4";
  zScoreCard.querySelector(".model-formula").textContent = formulaText;

  // 2. Merton Model Card
  const mertonCard = document.getElementById("model-merton");
  mertonCard.querySelector(".model-score-display").textContent = `${(r.merton.defaultProb * 100).toFixed(3)}%`;
  const mertonInterpretation = mertonCard.querySelector(".model-interpretation");
  mertonInterpretation.textContent = `Distance to Default: ${r.merton.distanceToDefault} σ`;
  mertonInterpretation.className = "model-interpretation " + (r.merton.distanceToDefault > 2.5 ? "safe" : (r.merton.distanceToDefault > 1.2 ? "warning" : "danger"));

  // 3. Ratio Weighted Card
  const weightedCard = document.getElementById("model-weighted");
  weightedCard.querySelector(".model-score-display").textContent = `${r.ratingInfo.score}/100`;
  const weightedInterpretation = weightedCard.querySelector(".model-interpretation");
  weightedInterpretation.textContent = `Credit Rating: ${r.ratingInfo.rating}`;
  weightedInterpretation.className = "model-interpretation " + getRiskClass(r.ratingInfo.rating);

  // Financial Ratios Grid
  renderRatiosGrid(r.ratios);

  // Loan Evaluation
  const decCard = document.getElementById("res-decision-card");
  const dec = r.loanEvaluation.decision;
  decCard.className = "glass-card decision-card " + dec.toLowerCase();
  
  // Set Decision Icon
  let iconSvg = "";
  if (dec === "Approved") {
    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;
  } else if (dec === "Review") {
    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`;
  } else {
    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;
  }
  document.getElementById("res-decision-icon").innerHTML = iconSvg;
  document.getElementById("res-decision-text").textContent = `Loan request: ${dec.toUpperCase()}`;
  document.getElementById("res-decision-reason").textContent = r.loanEvaluation.reason;

  document.getElementById("res-dec-dscr").textContent = r.loanEvaluation.dscr;
  document.getElementById("res-dec-ltv").textContent = Math.round(r.loanEvaluation.ltv * 100) + "%";
  document.getElementById("res-dec-rate").textContent = (r.loanEvaluation.interestRate * 100).toFixed(2) + "%";
  document.getElementById("res-dec-cap").textContent = formatCurrency(r.loanEvaluation.maxCapacity);

  // Initialize and draw charts
  drawAssessmentCharts(r);
}

function renderRatiosGrid(ratios) {
  const ratioItems = [
    { name: "Current Ratio", key: "currentRatio", type: "ratio", format: v => v.toFixed(2), benchmark: "1.50 - 2.50", good: v => v >= 1.8, poor: v => v < 1.0 },
    { name: "Quick Ratio", key: "quickRatio", type: "ratio", format: v => v.toFixed(2), benchmark: "1.00 - 1.50", good: v => v >= 1.0, poor: v => v < 0.5 },
    { name: "Debt-to-Assets", key: "debtToAssets", type: "percentage", format: v => (v * 100).toFixed(1) + "%", benchmark: "30% - 50%", good: v => v <= 0.45, poor: v => v > 0.70 },
    { name: "Return on Assets (ROA)", key: "roa", type: "percentage", format: v => (v * 100).toFixed(2) + "%", benchmark: "6.0% - 10.0%", good: v => v >= 0.08, poor: v => v <= 0.0 },
    { name: "Interest Coverage Ratio", key: "interestCoverage", type: "ratio", format: v => v === 999 ? "∞" : v.toFixed(2), benchmark: "> 3.50", good: v => v >= 4.5, poor: v => v < 1.5 },
    { name: "Asset Turnover", key: "assetTurnover", type: "ratio", format: v => v.toFixed(2), benchmark: "1.0 - 1.5", good: v => v >= 1.2, poor: v => v < 0.5 }
  ];

  const container = document.getElementById("res-ratios-grid");
  container.innerHTML = "";

  ratioItems.forEach(item => {
    const val = ratios[item.key];
    const isGood = item.good(val);
    const isPoor = item.poor(val);
    const statusClass = isGood ? "good" : (isPoor ? "poor" : "average");

    const card = document.createElement("div");
    card.className = "ratio-value-card";
    card.innerHTML = `
      <span class="ratio-name">${item.name}</span>
      <span class="ratio-val">${item.format(val)}</span>
      <span class="ratio-bench">Benchmark: ${item.benchmark}</span>
      <span class="ratio-status-indicator ${statusClass}"></span>
    `;
    container.appendChild(card);
  });
}

function getRiskClass(rating) {
  if (["AAA", "AA", "A"].includes(rating)) return "safe";
  if (["BBB", "BB", "B"].includes(rating)) return "warning";
  return "danger";
}

/* ==========================================================================
   6. Stress Testing Simulation Manager
   ========================================================================== */

function setupStressHandlers() {
  const revSlider = document.getElementById("stress-revenue");
  const rateSlider = document.getElementById("stress-rate");
  const collSlider = document.getElementById("stress-collateral");

  if (!revSlider) return;

  const updateSimulation = () => {
    if (!currentAssessment) return;

    const revShock = parseFloat(revSlider.value) / 100; // negative, e.g. -0.2
    const rateSpike = parseFloat(rateSlider.value) / 100; // positive, e.g. +0.03
    const collHaircut = parseFloat(collSlider.value) / 100; // negative, e.g. -0.15

    // Display values
    document.getElementById("val-stress-rev").textContent = `${revSlider.value}%`;
    document.getElementById("val-stress-rate").textContent = `+${rateSlider.value}%`;
    document.getElementById("val-stress-coll").textContent = `${collSlider.value}%`;

    // Apply macro factors to baseline company financials to calculate stressed assessment
    const baseline = currentAssessment;
    const stressedCompany = {
      ...baseline,
      financials: {
        ...baseline.financials,
        // Revenue drops
        sales: Math.max(0, baseline.financials.sales * (1 + revShock)),
        // EBIT drops proportionally to sales, plus leverage drops
        ebit: Math.max(0, baseline.financials.ebit * (1 + revShock * 1.5)),
        netIncome: baseline.financials.netIncome + (baseline.financials.sales * revShock),
        // Cash reduces due to net income losses
        cash: Math.max(100000, baseline.financials.cash + (baseline.financials.sales * revShock * 0.5)),
        // Volatility increases under stress
        assetVolatility: Math.min(0.60, baseline.financials.assetVolatility * (1 + Math.abs(revShock)))
      },
      loanRequest: {
        ...baseline.loanRequest,
        collateralValue: Math.max(0, baseline.loanRequest.collateralValue * (1 + collHaircut))
      }
    };

    // Calculate stressed results
    stressedAssessment = runFullAssessment(stressedCompany);

    // Dynamic adjustment of suggested interest rate based on rating + interest rate spike
    stressedAssessment.loanEvaluation.interestRate += rateSpike;
    // Re-evaluate DSCR under stressed EBIT & stressed rate
    const newAmort = stressedCompany.loanRequest.amount / stressedCompany.loanRequest.term;
    const newInterest = stressedCompany.loanRequest.amount * stressedAssessment.loanEvaluation.interestRate;
    stressedAssessment.loanEvaluation.dscr = stressedCompany.financials.ebit / (newAmort + newInterest);

    // Re-run decision rules
    if (stressedAssessment.ratingInfo.rating === "D" || stressedAssessment.ratingInfo.rating === "CCC" || stressedAssessment.loanEvaluation.dscr < 1.0 || stressedAssessment.loanEvaluation.ltv > 0.95) {
      stressedAssessment.loanEvaluation.decision = "Rejected";
      stressedAssessment.loanEvaluation.reason = "Stressed parameters violate safety margins. High default probability in adverse conditions.";
    }

    renderStressComparison();
    updateStressCharts();
  };

  revSlider.addEventListener("input", updateSimulation);
  rateSlider.addEventListener("input", updateSimulation);
  collSlider.addEventListener("input", updateSimulation);
}

function initStressSimulation() {
  if (!currentAssessment) return;
  
  document.getElementById("stress-comp-name").textContent = currentAssessment.name;

  // Reset sliders to 0
  document.getElementById("stress-revenue").value = 0;
  document.getElementById("stress-rate").value = 0;
  document.getElementById("stress-collateral").value = 0;

  // Trigger slider initial input to build baseline simulation
  document.getElementById("stress-revenue").dispatchEvent(new Event("input"));
}

function renderStressComparison() {
  const base = currentAssessment;
  const stress = stressedAssessment;

  if (!base || !stress) return;

  // Render baseline vs stressed metrics table
  const tbody = document.getElementById("stress-metric-table");
  tbody.innerHTML = `
    <div class="stress-metric-row">
      <div class="stress-metric-label">Credit Score / Rating</div>
      <div class="stress-metric-baseline">${base.ratingInfo.score} (${base.ratingInfo.rating})</div>
      <div class="stress-metric-stressed ${getRiskClass(stress.ratingInfo.rating)}">${stress.ratingInfo.score} (${stress.ratingInfo.rating})</div>
    </div>
    <div class="stress-metric-row">
      <div class="stress-metric-label">Default Probability</div>
      <div class="stress-metric-baseline">${(base.ratingInfo.defaultProb * 100).toFixed(2)}%</div>
      <div class="stress-metric-stressed ${getRiskClass(stress.ratingInfo.rating)}">${(stress.ratingInfo.defaultProb * 100).toFixed(2)}%</div>
    </div>
    <div class="stress-metric-row">
      <div class="stress-metric-label">Altman Z-Score</div>
      <div class="stress-metric-baseline">${base.zScore.score}</div>
      <div class="stress-metric-stressed ${stress.zScore.zone}">${stress.zScore.score}</div>
    </div>
    <div class="stress-metric-row">
      <div class="stress-metric-label">Debt Coverage (DSCR)</div>
      <div class="stress-metric-baseline">${base.loanEvaluation.dscr}x</div>
      <div class="stress-metric-stressed ${stress.loanEvaluation.dscr >= 1.25 ? 'safe' : (stress.loanEvaluation.dscr >= 1.0 ? 'warning' : 'danger')}">${stress.loanEvaluation.dscr.toFixed(2)}x</div>
    </div>
    <div class="stress-metric-row">
      <div class="stress-metric-label">Loan-to-Value (LTV)</div>
      <div class="stress-metric-baseline">${Math.round(base.loanEvaluation.ltv * 100)}%</div>
      <div class="stress-metric-stressed ${stress.loanEvaluation.ltv <= 0.8 ? 'safe' : (stress.loanEvaluation.ltv <= 0.95 ? 'warning' : 'danger')}">${Math.round(stress.loanEvaluation.ltv * 100)}%</div>
    </div>
    <div class="stress-metric-row">
      <div class="stress-metric-label">Risk-Adjusted Rate</div>
      <div class="stress-metric-baseline">${(base.loanEvaluation.interestRate * 100).toFixed(2)}%</div>
      <div class="stress-metric-stressed ${getRiskClass(stress.ratingInfo.rating)}">${(stress.loanEvaluation.interestRate * 100).toFixed(2)}%</div>
    </div>
  `;

  // Stressed Loan Decision Alert Box
  const decBox = document.getElementById("stress-decision-alert");
  const dec = stress.loanEvaluation.decision;
  decBox.className = "model-interpretation " + dec.toLowerCase();
  decBox.textContent = `STRESSED DECISION: ${dec.toUpperCase()} - ${stress.loanEvaluation.reason}`;
}

/* ==========================================================================
   7. Charting Integrations (Chart.js)
   ========================================================================== */

/**
 * Recreate all active charts (called on dark mode switch to reset text colors)
 */
function recreateCharts() {
  if (currentAssessment) {
    drawAssessmentCharts(currentAssessment);
    if (stressedAssessment) {
      updateStressCharts();
    }
  }
  renderPortfolioCharts();
}

function getThemeChartColors() {
  const isDark = document.documentElement.getAttribute("color-scheme") === "dark";
  return {
    gridColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(15, 23, 42, 0.08)",
    textColor: isDark ? "#94a3b8" : "#475569",
    tooltipBg: isDark ? "rgba(15, 23, 42, 0.9)" : "rgba(255, 255, 255, 0.9)",
    tooltipBorder: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(15, 23, 42, 0.1)"
  };
}

/**
 * Draw radar and probability gauge charts for a company assessment
 */
function drawAssessmentCharts(comp) {
  const ctxRadar = document.getElementById("chart-radar").getContext("2d");
  const ctxGauge = document.getElementById("chart-gauge").getContext("2d");
  const colors = getThemeChartColors();

  // Normalize current company ratios against benchmarks (0-10 scale)
  const normVal = (val, bench, invert = false) => {
    if (bench === 0) return 0;
    let ratio = val / bench;
    if (invert) ratio = bench / (val || 0.01);
    return Math.min(10, Math.max(0, parseFloat((ratio * 5).toFixed(1))));
  };

  const compData = [
    normVal(comp.ratios.currentRatio, INDUSTRY_BENCHMARKS.currentRatio),
    normVal(INDUSTRY_BENCHMARKS.debtToAssets, comp.ratios.debtToAssets), // Invert since lower debt is better
    normVal(comp.ratios.roa, INDUSTRY_BENCHMARKS.roa),
    normVal(comp.ratios.interestCoverage, INDUSTRY_BENCHMARKS.interestCoverage),
    normVal(comp.ratios.assetTurnover, INDUSTRY_BENCHMARKS.assetTurnover)
  ];

  // Benchmark is always 5 on normalized scale
  const benchData = [5, 5, 5, 5, 5];

  // 1. Radar Chart
  if (charts.radar) charts.radar.destroy();
  charts.radar = new Chart(ctxRadar, {
    type: "radar",
    data: {
      labels: ["Liquidity (CR)", "Leverage (1/DTA)", "Profitability (ROA)", "Solvency (ICR)", "Efficiency (AT)"],
      datasets: [
        {
          label: "Company Metric",
          data: compData,
          backgroundColor: "rgba(99, 102, 241, 0.2)",
          borderColor: "rgba(99, 102, 241, 1)",
          pointBackgroundColor: "rgba(99, 102, 241, 1)",
          pointHoverBorderColor: "rgba(99, 102, 241, 1)",
          borderWidth: 2
        },
        {
          label: "Industry Average",
          data: benchData,
          backgroundColor: "rgba(6, 182, 212, 0.1)",
          borderColor: "rgba(6, 182, 212, 0.8)",
          pointBackgroundColor: "rgba(6, 182, 212, 1)",
          borderDash: [5, 5],
          borderWidth: 1.5
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          grid: { color: colors.gridColor },
          angleLines: { color: colors.gridColor },
          pointLabels: {
            color: colors.textColor,
            font: { family: "Plus Jakarta Sans", size: 11, weight: "500" }
          },
          ticks: { display: false, stepSize: 2 },
          suggestedMin: 0,
          suggestedMax: 10
        }
      },
      plugins: {
        legend: {
          position: "bottom",
          labels: { color: colors.textColor, font: { family: "Plus Jakarta Sans" } }
        }
      }
    }
  });

  // 2. Default Probability Radial Gauge Chart
  const pdPercentage = Math.min(100, comp.ratingInfo.defaultProb * 100);
  
  if (charts.gauge) charts.gauge.destroy();
  charts.gauge = new Chart(ctxGauge, {
    type: "doughnut",
    data: {
      datasets: [
        {
          data: [pdPercentage, 100 - pdPercentage],
          backgroundColor: [
            pdPercentage > 10 ? "rgba(244, 63, 94, 0.85)" : (pdPercentage > 2 ? "rgba(251, 191, 36, 0.85)" : "rgba(45, 212, 191, 0.85)"),
            colors.gridColor
          ],
          borderWidth: 0,
          circumference: 180,
          rotation: 270,
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "80%",
      plugins: {
        tooltip: { enabled: false },
        legend: { display: false }
      }
    }
  });

  // Set the text indicator inside the gauge
  document.getElementById("gauge-value").textContent = pdPercentage.toFixed(2) + "%";
}

/**
 * Draw/Update the stress testing comparison charts
 */
function updateStressCharts() {
  const ctxStress = document.getElementById("chart-stress-comparison").getContext("2d");
  const colors = getThemeChartColors();

  const basePD = currentAssessment.ratingInfo.defaultProb * 100;
  const stressPD = stressedAssessment.ratingInfo.defaultProb * 100;

  if (charts.stressLine) charts.stressLine.destroy();
  charts.stressLine = new Chart(ctxStress, {
    type: "bar",
    data: {
      labels: ["Baseline Default Risk", "Stressed Default Risk"],
      datasets: [{
        data: [basePD, stressPD],
        backgroundColor: [
          "rgba(99, 102, 241, 0.8)", // Indigo baseline
          stressPD > 10 ? "rgba(244, 63, 94, 0.85)" : (stressPD > 2 ? "rgba(251, 191, 36, 0.85)" : "rgba(45, 212, 191, 0.85)")
        ],
        borderColor: [
          "rgba(99, 102, 241, 1)",
          stressPD > 10 ? "rgba(244, 63, 94, 1)" : (stressPD > 2 ? "rgba(251, 191, 36, 1)" : "rgba(45, 212, 191, 1)")
        ],
        borderWidth: 1.5,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          grid: { color: colors.gridColor },
          ticks: { 
            color: colors.textColor,
            callback: value => value + "%"
          },
          title: {
            display: true,
            text: "Probability of Default (1-Year)",
            color: colors.textColor
          },
          suggestedMax: Math.max(10, stressPD * 1.2)
        },
        x: {
          grid: { display: false },
          ticks: { color: colors.textColor }
        }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });
}

/**
 * Render portfolio overview analysis charts (distribution of ratings)
 */
function renderPortfolioCharts() {
  const canvas = document.getElementById("chart-portfolio-dist");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const colors = getThemeChartColors();

  // Aggregate ratings count
  const ratingCounts = {
    "AAA/AA/A": 0,
    "BBB/BB/B": 0,
    "CCC/D": 0
  };

  portfolio.forEach(comp => {
    const assessment = runFullAssessment(comp);
    const rating = assessment.ratingInfo.rating;
    if (["AAA", "AA", "A"].includes(rating)) ratingCounts["AAA/AA/A"]++;
    else if (["BBB", "BB", "B"].includes(rating)) ratingCounts["BBB/BB/B"]++;
    else ratingCounts["CCC/D"]++;
  });

  if (charts.portfolioDist) charts.portfolioDist.destroy();
  charts.portfolioDist = new Chart(ctx, {
    type: "pie",
    data: {
      labels: ["Low Risk (AAA-A)", "Moderate Risk (BBB-B)", "High Risk (CCC-D)"],
      datasets: [{
        data: [ratingCounts["AAA/AA/A"], ratingCounts["BBB/BB/B"], ratingCounts["CCC/D"]],
        backgroundColor: [
          "rgba(45, 212, 191, 0.75)",
          "rgba(251, 191, 36, 0.75)",
          "rgba(244, 63, 94, 0.75)"
        ],
        borderColor: [
          "rgba(45, 212, 191, 1)",
          "rgba(251, 191, 36, 1)",
          "rgba(244, 63, 94, 1)"
        ],
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "right",
          labels: { color: colors.textColor, font: { family: "Plus Jakarta Sans" } }
        }
      }
    }
  });
}

/* ==========================================================================
   8. Utility Functions & Printers
   ========================================================================== */

function formatCurrency(val) {
  if (val >= 1000000) {
    return "$" + (val / 1000000).toFixed(1) + "M";
  } else if (val >= 1000) {
    return "$" + (val / 1000).toFixed(0) + "k";
  }
  return "$" + val;
}

function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  
  let iconSvg = "";
  if (type === "success") {
    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="18" height="18"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;
  } else if (type === "error") {
    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="18" height="18"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;
  } else {
    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="18" height="18"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;
  }

  toast.innerHTML = `
    ${iconSvg}
    <div class="toast-content">${message}</div>
    <button class="toast-close" onclick="this.parentElement.remove()">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="14" height="14"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
    </button>
  `;

  container.appendChild(toast);

  // Auto remove toast after 4s
  setTimeout(() => {
    toast.style.opacity = 0;
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

/**
 * Triggers standard browser print command targeting the Credit Memo formatting
 */
function printCreditReport() {
  if (!currentAssessment) {
    showToast("Please assess a company first before printing.", "warning");
    return;
  }
  
  // Set results section to display: block in print CSS media query
  const resSec = document.getElementById("section-results");
  resSec.classList.add("print-target");

  window.print();

  // Remove target attribute after printing completes
  resSec.classList.remove("print-target");
}
