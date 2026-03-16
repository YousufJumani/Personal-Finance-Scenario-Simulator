function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function clamp(value, lo, hi) {
  return Math.max(lo, Math.min(hi, value));
}

function formatMonths(months) {
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (years === 0) return `${rem} month${rem !== 1 ? "s" : ""}`;
  if (rem === 0) return `${years} year${years !== 1 ? "s" : ""}`;
  return `${years}y ${rem}m`;
}

function buildProjection(currentSavings, monthlyContribution, monthlyRate, months) {
  let balance = currentSavings;
  const snapshots = [];

  for (let month = 1; month <= months; month += 1) {
    balance = balance * (1 + monthlyRate) + monthlyContribution;
    if (month % 6 === 0 || month === 1) {
      snapshots.push({ month, balance: Math.round(balance) });
    }
  }

  return snapshots;
}

function renderFinance(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const result = document.querySelector("#finance-result");
  const data = new FormData(form);

  const income = Math.max(0, Number(data.get("income")) || 0);
  const fixedExpenses = Math.max(0, Number(data.get("fixedExpenses")) || 0);
  const flexExpenses = Math.max(0, Number(data.get("flexExpenses")) || 0);
  const currentSavings = Math.max(0, Number(data.get("currentSavings")) || 0);
  const goalSavings = Math.max(1, Number(data.get("goalSavings")) || 1);
  const emergencyMonths = Math.max(1, Math.min(24, Number(data.get("emergencyMonths")) || 6));
  const annualRate = Math.max(0, Number(data.get("returnRate")) || 0) / 100;

  if (income === 0) {
    result.innerHTML = `<div class="alert-banner warn-banner"><span class="banner-icon">\u26a0\ufe0f</span><div><strong>Income is zero.</strong><p>Enter a monthly income to run the simulation.</p></div></div>`;
    return;
  }

  if (currentSavings >= goalSavings) {
    result.innerHTML = `<div class="alert-banner success-banner"><span class="banner-icon">\ud83c\udfaf</span><div><strong>Goal already reached!</strong><p>Your savings of ${formatCurrency(currentSavings)} already meets your goal of ${formatCurrency(goalSavings)}. Consider raising your target or investing the surplus.</p></div></div>`;
    return;
  }

  const monthlyContribution = income - fixedExpenses - flexExpenses;
  const monthlyBurn = fixedExpenses + flexExpenses;
  const emergencyTarget = monthlyBurn * emergencyMonths;
  const emergencyRunway = monthlyBurn > 0 ? currentSavings / monthlyBurn : Infinity;
  const savingsRate = (monthlyContribution / income) * 100;
  const goalProgress = clamp((currentSavings / goalSavings) * 100, 0, 100);

  if (monthlyContribution <= 0) {
    result.innerHTML = `<div class="alert-banner warn-banner"><span class="banner-icon">\u26a0\ufe0f</span><div><strong>Expenses exceed income by ${formatCurrency(Math.abs(monthlyContribution))}/month.</strong><p>Reduce expenses or increase income. No savings progress is possible in this scenario.</p></div></div>`;
    return;
  }

  let monthsToGoal = null;
  let rollingBalance = currentSavings;
  const monthlyRate = annualRate / 12;
  for (let month = 1; month <= 360; month += 1) {
    rollingBalance = rollingBalance * (1 + monthlyRate) + monthlyContribution;
    if (rollingBalance >= goalSavings) {
      monthsToGoal = month;
      break;
    }
  }

  const projection = buildProjection(currentSavings, monthlyContribution, monthlyRate, 36);
  const maxBar = Math.max(...projection.map((s) => s.balance), goalSavings);
  const savingsGrade = savingsRate >= 20
    ? { label: "Strong", cls: "good" }
    : savingsRate >= 10
    ? { label: "Moderate", cls: "avg" }
    : { label: "Low", cls: "warn" };
  const emergencyOk = emergencyRunway !== Infinity && emergencyRunway >= emergencyMonths;
  const fixedPct = clamp((fixedExpenses / income) * 100, 0, 100);
  const flexPct  = clamp((flexExpenses  / income) * 100, 0, 100);
  const savePct  = clamp((monthlyContribution / income) * 100, 0, 100);

  result.innerHTML = `
    <div class="kpis">
      <article class="kpi kpi-accent">
        <div class="kpi-icon">\ud83d\udcb0</div>
        <div class="kpi-label">Monthly savings</div>
        <div class="kpi-value">${formatCurrency(monthlyContribution)}</div>
        <span class="kpi-badge ${savingsGrade.cls}">${savingsGrade.label} &middot; ${savingsRate.toFixed(1)}%</span>
      </article>
      <article class="kpi">
        <div class="kpi-icon">\ud83c\udfaf</div>
        <div class="kpi-label">Time to goal</div>
        <div class="kpi-value ${monthsToGoal ? "good" : "warn"}">${monthsToGoal ? formatMonths(monthsToGoal) : "30+ years"}</div>
        <span class="kpi-badge note">${monthsToGoal ? "at current rate" : "raise savings rate"}</span>
      </article>
      <article class="kpi">
        <div class="kpi-icon">\ud83d\udee1\ufe0f</div>
        <div class="kpi-label">Emergency runway</div>
        <div class="kpi-value">${emergencyRunway === Infinity ? "\u221e" : emergencyRunway.toFixed(1) + " mo"}</div>
        <span class="kpi-badge ${emergencyOk ? "good" : "warn"}">${emergencyOk ? "Funded \u2713" : "Build this first"}</span>
      </article>
      <article class="kpi">
        <div class="kpi-icon">\ud83d\udcca</div>
        <div class="kpi-label">Total expenses</div>
        <div class="kpi-value">${formatCurrency(monthlyBurn)}</div>
        <span class="kpi-badge note">of ${formatCurrency(income)} income</span>
      </article>
    </div>

    <div class="progress-section">
      <div class="progress-header">
        <span class="section-label">Savings goal progress</span>
        <span class="progress-nums">${formatCurrency(currentSavings)} <span class="note">of</span> ${formatCurrency(goalSavings)}</span>
      </div>
      <div class="progress-track">
        <div class="progress-fill" style="width:${goalProgress.toFixed(1)}%"></div>
      </div>
      <div class="progress-pct">${goalProgress.toFixed(1)}% complete</div>
    </div>

    <div class="budget-section">
      <div class="section-label">Budget breakdown</div>
      <div class="budget-bar">
        <div class="bb-fixed" style="width:${fixedPct.toFixed(1)}%" title="Fixed expenses: ${formatCurrency(fixedExpenses)}"></div>
        <div class="bb-flex"  style="width:${flexPct.toFixed(1)}%"  title="Flexible expenses: ${formatCurrency(flexExpenses)}"></div>
        <div class="bb-save"  style="width:${savePct.toFixed(1)}%"  title="Savings: ${formatCurrency(monthlyContribution)}"></div>
      </div>
      <div class="bb-legend">
        <span><span class="dot dot-fixed"></span>Fixed ${formatCurrency(fixedExpenses)}</span>
        <span><span class="dot dot-flex"></span>Flexible ${formatCurrency(flexExpenses)}</span>
        <span><span class="dot dot-save"></span>Savings ${formatCurrency(monthlyContribution)}</span>
      </div>
    </div>

    <div class="section-label" style="margin-top:18px">3-Year Projection</div>
    <div class="timeline">
      ${projection.map((s) => {
        const pct = clamp((s.balance / maxBar) * 100, 1, 100);
        return `<div class="row">
          <span class="row-month">Month ${s.month}</span>
          <div class="row-track"><div class="row-bar" style="width:${pct.toFixed(1)}%"></div></div>
          <strong class="row-val">${formatCurrency(s.balance)}</strong>
        </div>`;
      }).join("")}
    </div>
  `;
}

const form = document.querySelector("#finance-form");
form.addEventListener("submit", renderFinance);
form.requestSubmit();
