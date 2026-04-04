const STATUS = {
  OK: 'ok',
  DUE_SOON: 'due_soon',
  DUE: 'due',
  OVERDUE: 'overdue',
};

const STATUS_RANK = [STATUS.OK, STATUS.DUE_SOON, STATUS.DUE, STATUS.OVERDUE];

function worstStatus(...statuses) {
  return STATUS_RANK[Math.max(...statuses.map(s => STATUS_RANK.indexOf(s)))];
}

function daysBetween(isoDateStr, today = new Date()) {
  if (!isoDateStr) return null;
  const past = new Date(isoDateStr);
  return Math.floor((today - past) / (1000 * 60 * 60 * 24));
}

function milesStatus(milesSince, threshold, warnFraction = 0.10) {
  if (milesSince >= threshold * 1.15)               return STATUS.OVERDUE;
  if (milesSince >= threshold)                       return STATUS.DUE;
  if (milesSince >= threshold * (1 - warnFraction)) return STATUS.DUE_SOON;
  return STATUS.OK;
}

function daysStatus(daysSince, threshold, warnFraction = 0.10) {
  if (daysSince === null)                             return STATUS.DUE; // never serviced
  if (daysSince > threshold * 1.15)                  return STATUS.OVERDUE;
  if (daysSince >= threshold)                         return STATUS.DUE;
  if (daysSince >= threshold * (1 - warnFraction))   return STATUS.DUE_SOON;
  return STATUS.OK;
}

// Core function: compute status for one maintenance item.
// rule       — from maintenanceRules.js
// serviceLog — stored log { lastServiceDate, lastServiceMileage, lastServiceRideCount,
//                           lastServiceHours, lastChainReplacements, userInterval }
// bikeState  — { currentMileage, currentRideCount, rideHours, chainReplacements }
function getItemStatus(rule, serviceLog, bikeState, opts = {}) {
  const warnFraction    = opts.warnFraction  ?? 0.10;
  const customInterval  = opts.customInterval ?? null; // { value, unit } from bikeData.customIntervals
  const { trigger } = rule;
  const log = serviceLog || {};
  const state = bikeState || {};

  const currentMileage     = state.currentMileage     || 0;
  const currentRideCount   = state.currentRideCount   || 0;
  const rideHours          = state.rideHours          || 0;
  const chainReplacements  = state.chainReplacements  || 0;

  const lastMileage        = log.lastServiceMileage        || 0;
  const lastRideCount      = log.lastServiceRideCount      || 0;
  const lastHours          = log.lastServiceHours          || 0;
  const lastChainRepl      = log.lastChainReplacements     || 0;
  const lastDate           = log.lastServiceDate           || null;
  const userInterval       = log.userInterval              || null;

  const milesSince  = currentMileage    - lastMileage;
  const ridesSince  = currentRideCount  - lastRideCount;
  const hoursSince  = rideHours         - lastHours;
  const chainsSince = chainReplacements - lastChainRepl;
  const daysSince   = daysBetween(lastDate);

  switch (trigger.type) {
    case 'miles': {
      // Custom interval overrides the rule; firstAt only applies if never serviced
      const hasBeenServiced = !!lastDate;
      const ruleDefault = (!hasBeenServiced && trigger.firstAt)
        ? trigger.firstAt
        : (trigger.thenEvery || trigger.every);
      const threshold = (customInterval?.unit === 'miles') ? customInterval.value : ruleDefault;
      const remaining = Math.max(0, threshold - milesSince);
      return {
        status: milesStatus(milesSince, threshold, warnFraction),
        milesSince: Math.round(milesSince),
        threshold,
        remaining: Math.round(remaining),
      };
    }

    case 'rides': {
      const threshold = (customInterval?.unit === 'rides') ? customInterval.value : trigger.every;
      const remaining = Math.max(0, threshold - ridesSince);
      let status = STATUS.OK;
      if (ridesSince >= threshold)          status = STATUS.DUE;
      else if (ridesSince >= threshold - 1) status = STATUS.DUE_SOON;
      return { status, ridesSince, threshold, remaining };
    }

    case 'days': {
      const threshold = (customInterval?.unit === 'days') ? customInterval.value : trigger.every;
      const d = daysSince !== null ? daysSince : Infinity;
      const remaining = Math.max(0, threshold - (d === Infinity ? threshold : d));
      return {
        status: daysStatus(daysSince, threshold, warnFraction),
        daysSince: daysSince !== null ? daysSince : null,
        threshold,
        remaining,
      };
    }

    case 'miles_or_days': {
      const milesThresh = (customInterval?.unit === 'miles') ? customInterval.value : trigger.miles;
      const daysThresh  = (customInterval?.unit === 'days')  ? customInterval.value : trigger.days;
      const mStat = milesStatus(milesSince, milesThresh, warnFraction);
      const dStat = daysStatus(daysSince, daysThresh, warnFraction);
      return {
        status: worstStatus(mStat, dStat),
        milesSince: Math.round(milesSince),
        milesThreshold: milesThresh,
        milesRemaining: Math.max(0, Math.round(milesThresh - milesSince)),
        daysSince,
        daysThreshold: daysThresh,
        daysRemaining: daysSince !== null ? Math.max(0, daysThresh - daysSince) : 0,
      };
    }

    case 'chain_replacements': {
      const threshold = (customInterval?.unit === 'chains') ? customInterval.value : trigger.every;
      const remaining = Math.max(0, threshold - chainsSince);
      let status = STATUS.OK;
      if (chainsSince >= threshold)          status = STATUS.DUE;
      else if (chainsSince >= threshold - 1) status = STATUS.DUE_SOON;
      return { status, chainsSince, threshold, remaining };
    }

    case 'hours_or_days': {
      // custom interval > log userInterval > rule default
      const hoursThreshold = (customInterval?.unit === 'hours') ? customInterval.value
                           : (userInterval || trigger.hours);
      const hStat = hoursSince >= hoursThreshold * 1.15               ? STATUS.OVERDUE
                  : hoursSince >= hoursThreshold                       ? STATUS.DUE
                  : hoursSince >= hoursThreshold * (1 - warnFraction)  ? STATUS.DUE_SOON
                  : STATUS.OK;
      const dStat = daysStatus(daysSince, trigger.days, warnFraction);
      return {
        status: worstStatus(hStat, dStat),
        hoursSince: Math.round(hoursSince * 10) / 10,
        hoursThreshold,
        hoursRemaining: Math.max(0, Math.round((hoursThreshold - hoursSince) * 10) / 10),
        daysSince,
        daysThreshold: trigger.days,
        daysRemaining: daysSince !== null ? Math.max(0, trigger.days - daysSince) : 0,
        isUserDefined: !!(customInterval || userInterval),
      };
    }

    case 'hours_user_defined': {
      const interval = (customInterval?.unit === 'hours') ? customInterval.value
                     : (userInterval || trigger.suggestedMin);
      const hStat = hoursSince >= interval * 1.15              ? STATUS.OVERDUE
                  : hoursSince >= interval                      ? STATUS.DUE
                  : hoursSince >= interval * (1 - warnFraction) ? STATUS.DUE_SOON
                  : STATUS.OK;
      return {
        status: hStat,
        hoursSince: Math.round(hoursSince * 10) / 10,
        interval,
        remaining: Math.max(0, Math.round((interval - hoursSince) * 10) / 10),
        isUserDefined: !!(customInterval || userInterval),
        suggestedMin: trigger.suggestedMin,
        suggestedMax: trigger.suggestedMax,
      };
    }

    default:
      return { status: STATUS.OK };
  }
}

// Summarize overall health of a bike: counts by status
function getBikeSummary(sections) {
  const counts = { ok: 0, due_soon: 0, due: 0, overdue: 0 };
  for (const section of sections) {
    for (const item of section.items) {
      counts[item.status.status] = (counts[item.status.status] || 0) + 1;
    }
  }
  const urgent = counts.overdue + counts.due;
  const soon   = counts.due_soon;
  let overall  = STATUS.OK;
  if (counts.overdue > 0) overall = STATUS.OVERDUE;
  else if (counts.due > 0) overall = STATUS.DUE;
  else if (counts.due_soon > 0) overall = STATUS.DUE_SOON;
  return { overall, urgent, soon, counts };
}

module.exports = { getItemStatus, getBikeSummary, STATUS };
