// Maintenance rules for each bike type.
//
// Trigger types:
//   { type: 'miles', every: N }                          — repeat every N miles
//   { type: 'miles', firstAt: N, thenEvery: M }          — first at N miles, then every M
//   { type: 'rides', every: N }                          — every N rides
//   { type: 'days', every: N }                           — every N calendar days
//   { type: 'miles_or_days', miles: N, days: D }         — whichever comes first
//   { type: 'chain_replacements', every: N }             — every N chain changes
//   { type: 'hours_or_days', hours: N, days: D }         — whichever comes first
//   { type: 'hours_user_defined', suggestedMin, suggestedMax } — user sets their own interval
//
// Optional item flags:
//   padType: 'resin' | 'metal'     — shown only if bike is configured with this pad type
//   brakeType: 'hydraulic' | 'mechanical' | 'rim'  — shown only if configured
//   tubelessOnly: true             — shown only if bike is marked tubeless

const RULES = {
  road: {
    label: 'Road Bike',
    sections: [
      {
        id: 'brake_system',
        label: 'Brake System',
        items: [
          { id: 'brake_resin_clean',   label: 'Resin Pads',   action: 'Clean',   padType: 'resin',       trigger: { type: 'miles', every: 150 } },
          { id: 'brake_resin_check',   label: 'Resin Pads',   action: 'Check',   padType: 'resin',       trigger: { type: 'miles', firstAt: 500,  thenEvery: 500 } },
          { id: 'brake_resin_replace', label: 'Resin Pads',   action: 'Replace', padType: 'resin',       trigger: { type: 'miles', every: 700 } },
          { id: 'brake_metal_clean',   label: 'Metal Pads',   action: 'Clean',   padType: 'metal',       trigger: { type: 'miles', every: 150 } },
          { id: 'brake_metal_check',   label: 'Metal Pads',   action: 'Check',   padType: 'metal',       trigger: { type: 'miles', firstAt: 1000, thenEvery: 1000 } },
          { id: 'brake_metal_replace', label: 'Metal Pads',   action: 'Replace', padType: 'metal',       trigger: { type: 'miles', every: 1200 } },
          { id: 'rim_brakes_replace',  label: 'Rim Brakes',   action: 'Replace', brakeType: 'rim',       trigger: { type: 'miles_or_days', miles: 500, days: 1095 } },
          { id: 'hydraulics_bleed',    label: 'Hydraulics',   action: 'Bleed',   brakeType: 'hydraulic', trigger: { type: 'days', every: 365 } },
          { id: 'mech_brakes_replace', label: 'Mech Brakes',  action: 'Replace', brakeType: 'mechanical',trigger: { type: 'miles', every: 2000 } },
        ],
      },
      {
        id: 'drivetrain',
        label: 'Drive Train',
        items: [
          { id: 'chain_clean',          label: 'Chain',        action: 'Clean',      trigger: { type: 'rides', every: 3 } },
          { id: 'chain_check',          label: 'Chain',        action: 'Check wear', trigger: { type: 'miles', firstAt: 2000, thenEvery: 2000 } },
          { id: 'chain_replace',        label: 'Chain',        action: 'Replace',    trigger: { type: 'miles', every: 3000 } },
          { id: 'wire_housing_replace', label: 'Wire/Housing', action: 'Replace',    trigger: { type: 'miles', every: 2000 } },
          { id: 'cassette_replace',     label: 'Cassette',     action: 'Replace',    trigger: { type: 'chain_replacements', every: 3 } },
        ],
      },
      {
        id: 'tires',
        label: 'Tires',
        items: [
          { id: 'tires_check',  label: 'Tires',            action: 'Inspect',     trigger: { type: 'miles', firstAt: 1000, thenEvery: 500 } },
          { id: 'sealant_add',  label: 'Tubeless Sealant', action: 'Add/top up',  tubelessOnly: true, trigger: { type: 'days', every: 180 } },
        ],
      },
      {
        id: 'bike',
        label: 'Full Bike',
        items: [
          { id: 'bike_overhaul', label: 'Full Overhaul', action: 'Service', trigger: { type: 'days', every: 365 } },
        ],
      },
    ],
  },

  mtb: {
    label: 'Mountain Bike',
    sections: [
      {
        id: 'brake_system',
        label: 'Brake System',
        items: [
          { id: 'brake_resin_clean',    label: 'Resin Pads',  action: 'Clean',   padType: 'resin', trigger: { type: 'miles', every: 150 } },
          { id: 'brake_resin_inspect',  label: 'Resin Pads',  action: 'Inspect', padType: 'resin', trigger: { type: 'miles', firstAt: 400, thenEvery: 50 } },
          { id: 'brake_resin_replace',  label: 'Resin Pads',  action: 'Replace', padType: 'resin', trigger: { type: 'miles', every: 700 } },
          { id: 'brake_metal_clean',    label: 'Metal Pads',  action: 'Clean',   padType: 'metal', trigger: { type: 'miles', every: 150 } },
          { id: 'brake_metal_inspect',  label: 'Metal Pads',  action: 'Inspect', padType: 'metal', trigger: { type: 'miles', firstAt: 500, thenEvery: 50 } },
          { id: 'brake_metal_replace',  label: 'Metal Pads',  action: 'Replace', padType: 'metal', trigger: { type: 'miles', every: 1000 } },
          { id: 'hydraulics_bleed',     label: 'Hydraulics',  action: 'Bleed',   brakeType: 'hydraulic', trigger: { type: 'days', every: 180 } },
        ],
      },
      {
        id: 'drivetrain',
        label: 'Drive Train',
        items: [
          { id: 'chain_clean',          label: 'Chain',        action: 'Clean',      trigger: { type: 'rides', every: 2 } },
          { id: 'chain_check',          label: 'Chain',        action: 'Check wear', trigger: { type: 'miles', firstAt: 1500, thenEvery: 300 } },
          { id: 'chain_replace',        label: 'Chain',        action: 'Replace',    trigger: { type: 'miles_or_days', miles: 2500, days: 365 } },
          { id: 'wire_housing_replace', label: 'Wire/Housing', action: 'Replace',    trigger: { type: 'miles', every: 2000 } },
          { id: 'cassette_replace',     label: 'Cassette',     action: 'Replace',    trigger: { type: 'chain_replacements', every: 3 } },
          { id: 'chainring_check',      label: 'Chainring',    action: 'Check wear', trigger: { type: 'chain_replacements', every: 3 } },
          { id: 'chainring_replace',    label: 'Chainring',    action: 'Replace',    trigger: { type: 'chain_replacements', every: 4 } },
        ],
      },
      {
        id: 'tires',
        label: 'Tires',
        items: [
          { id: 'tires_check', label: 'Tires',            action: 'Inspect',    trigger: { type: 'miles', firstAt: 500, thenEvery: 100 } },
          { id: 'sealant_add', label: 'Tubeless Sealant', action: 'Add/top up', trigger: { type: 'days', every: 180 } },
        ],
      },
      {
        id: 'suspension',
        label: 'Suspension',
        items: [
          { id: 'fork_pressure',          label: 'Fork',               action: 'Check air pressure',      trigger: { type: 'days', every: 30 } },
          { id: 'fork_lower_service',     label: 'Fork Lower Legs',    action: 'Service',                 trigger: { type: 'hours_user_defined', suggestedMin: 30, suggestedMax: 100 } },
          { id: 'fork_full_service',      label: 'Fork',               action: 'Full service',            trigger: { type: 'hours_or_days', hours: 100, days: 365 } },
          { id: 'rear_shock_pressure',    label: 'Rear Shock',         action: 'Check air pressure',      trigger: { type: 'days', every: 30 } },
          { id: 'rear_shock_air_service', label: 'Rear Shock Air Can', action: 'Service',                 trigger: { type: 'hours_user_defined', suggestedMin: 30, suggestedMax: 100 } },
          { id: 'rear_shock_full_service',label: 'Rear Shock',         action: 'Full service (damper/can)',trigger: { type: 'hours_or_days', hours: 100, days: 365 } },
        ],
      },
      {
        id: 'bike',
        label: 'Full Bike',
        items: [
          { id: 'bike_overhaul', label: 'Full Service', action: 'Service', trigger: { type: 'days', every: 365 } },
        ],
      },
    ],
  },

  gravel: {
    label: 'Gravel Bike',
    sections: [
      {
        id: 'brake_system',
        label: 'Brake System',
        items: [
          { id: 'brake_resin_clean',   label: 'Resin Pads',  action: 'Clean',   padType: 'resin',       trigger: { type: 'miles', every: 150 } },
          { id: 'brake_resin_check',   label: 'Resin Pads',  action: 'Check',   padType: 'resin',       trigger: { type: 'miles', firstAt: 300,  thenEvery: 300 } },
          { id: 'brake_resin_replace', label: 'Resin Pads',  action: 'Replace', padType: 'resin',       trigger: { type: 'miles', every: 500 } },
          { id: 'brake_metal_clean',   label: 'Metal Pads',  action: 'Clean',   padType: 'metal',       trigger: { type: 'miles', every: 150 } },
          { id: 'brake_metal_check',   label: 'Metal Pads',  action: 'Check',   padType: 'metal',       trigger: { type: 'miles', firstAt: 800,  thenEvery: 800 } },
          { id: 'brake_metal_replace', label: 'Metal Pads',  action: 'Replace', padType: 'metal',       trigger: { type: 'miles', every: 1000 } },
          { id: 'hydraulics_bleed',    label: 'Hydraulics',  action: 'Bleed',   brakeType: 'hydraulic', trigger: { type: 'days', every: 365 } },
          { id: 'mech_brakes_replace', label: 'Mech Brakes', action: 'Replace', brakeType: 'mechanical',trigger: { type: 'miles', every: 2000 } },
        ],
      },
      {
        id: 'drivetrain',
        label: 'Drive Train',
        items: [
          { id: 'chain_clean',          label: 'Chain',        action: 'Clean',      trigger: { type: 'rides', every: 2 } },
          { id: 'chain_check',          label: 'Chain',        action: 'Check wear', trigger: { type: 'miles', firstAt: 2000, thenEvery: 2000 } },
          { id: 'chain_replace',        label: 'Chain',        action: 'Replace',    trigger: { type: 'miles', every: 3000 } },
          { id: 'wire_housing_replace', label: 'Wire/Housing', action: 'Replace',    trigger: { type: 'miles', every: 2000 } },
          { id: 'cassette_replace',     label: 'Cassette',     action: 'Replace',    trigger: { type: 'chain_replacements', every: 3 } },
        ],
      },
      {
        id: 'tires',
        label: 'Tires',
        items: [
          { id: 'tires_check', label: 'Tires',            action: 'Inspect',    trigger: { type: 'miles', firstAt: 1000, thenEvery: 500 } },
          { id: 'sealant_add', label: 'Tubeless Sealant', action: 'Add/top up', tubelessOnly: true, trigger: { type: 'days', every: 180 } },
        ],
      },
      {
        id: 'bike',
        label: 'Full Bike',
        items: [
          { id: 'bike_overhaul', label: 'Full Overhaul', action: 'Service', trigger: { type: 'days', every: 365 } },
        ],
      },
    ],
  },
};

module.exports = RULES;
