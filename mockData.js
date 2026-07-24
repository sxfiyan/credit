/**
 * mockData.js - Preset company profiles for the Credit Scoring Engine
 */

const mockCompanies = [
  {
    id: "preset-apex-manufacturing",
    name: "Apex Manufacturing Corp",
    sector: "manufacturing",
    size: "large",
    isPublic: true,
    financials: {
      cash: 18000000,
      currentAssets: 55000000,
      currentLiabilities: 22000000,
      retainedEarnings: 45000000,
      totalAssets: 130000000,
      totalLiabilities: 35000000,
      totalDebt: 25000000,
      bookEquity: 95000000,
      marketCap: 180000000,
      sales: 160000000,
      ebit: 24000000,
      interestExpense: 1500000,
      netIncome: 16800000,
      assetVolatility: 0.12 // 12% annual asset volatility
    },
    loanRequest: {
      amount: 15000000,
      term: 5,
      collateralValue: 20000000,
      collateralType: "Commercial Property"
    }
  },
  {
    id: "preset-vanguard-tech",
    name: "Vanguard Tech Solutions",
    sector: "service",
    size: "medium",
    isPublic: true,
    financials: {
      cash: 12000000,
      currentAssets: 28000000,
      currentLiabilities: 12000000,
      retainedEarnings: 15000000,
      totalAssets: 60000000,
      totalLiabilities: 20000000,
      totalDebt: 10000000,
      bookEquity: 40000000,
      marketCap: 120000000,
      sales: 75000000,
      ebit: 9000000,
      interestExpense: 800000,
      netIncome: 6500000,
      assetVolatility: 0.28 // 28% annual volatility (higher risk, tech industry)
    },
    loanRequest: {
      amount: 8000000,
      term: 3,
      collateralValue: 4000000,
      collateralType: "Intellectual Property / AR"
    }
  },
  {
    id: "preset-midwest-logistics",
    name: "Midwest Logistics Inc",
    sector: "service",
    size: "medium",
    isPublic: false,
    financials: {
      cash: 2500000,
      currentAssets: 8500000,
      currentLiabilities: 6200000,
      retainedEarnings: 4200000,
      totalAssets: 22000000,
      totalLiabilities: 14000000,
      totalDebt: 11000000,
      bookEquity: 8000000,
      marketCap: 8000000, // Private company: market equity defaults to book equity
      sales: 28000000,
      ebit: 2100000,
      interestExpense: 950000,
      netIncome: 900000,
      assetVolatility: 0.18 // 18% annual volatility
    },
    loanRequest: {
      amount: 4000000,
      term: 4,
      collateralValue: 5000000,
      collateralType: "Fleet Vehicles"
    }
  },
  {
    id: "preset-global-retailers",
    name: "Global Retailers Group",
    sector: "service",
    size: "large",
    isPublic: false,
    financials: {
      cash: 1800000,
      currentAssets: 14000000,
      currentLiabilities: 19500000, // Negative Working Capital
      retainedEarnings: -5000000, // Accumulated losses
      totalAssets: 48000000,
      totalLiabilities: 45000000, // Highly leveraged
      totalDebt: 41000000,
      bookEquity: 3000000,
      marketCap: 3000000,
      sales: 52000000,
      ebit: 450000, // Very low earnings relative to assets & interest
      interestExpense: 3200000, // Operating profit does not cover interest!
      netIncome: -2800000,
      assetVolatility: 0.35 // 35% annual volatility
    },
    loanRequest: {
      amount: 10000000,
      term: 2,
      collateralValue: 6000000,
      collateralType: "Inventory & Warehouses"
    }
  }
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { mockCompanies };
}
