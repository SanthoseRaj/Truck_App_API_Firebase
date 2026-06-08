const STOPS = [
  'Yard',
  'Port Loading',
  'Custom Clearence',
  'Dubai',
  'Free Zone',
];

const STOP_ROLE_MAP = {
  Yard: 'yard',
  'Port Loading': 'port',
  'Custom Clearence': 'clearence',
  Dubai: 'dubai',
  'Free Zone': 'freezone',
};

const ROUTE_MARKERS = [
  { stop: 'Yard', lat: 25.2048, lng: 55.2708, order: 1 },
  { stop: 'Port Loading', lat: 25.2697, lng: 55.289, order: 2 },
  { stop: 'Custom Clearence', lat: 25.276987, lng: 55.296249, order: 3 },
  { stop: 'Dubai', lat: 25.0657, lng: 55.1713, order: 4 },
  { stop: 'Free Zone', lat: 25.1124, lng: 55.1389, order: 5 },
];

const ROUTE_LINES = [
  { from: 'Yard', to: 'Port Loading' },
  { from: 'Yard', to: 'Free Zone' },
  { from: 'Port Loading', to: 'Custom Clearence' },
  { from: 'Port Loading', to: 'Free Zone' },
  { from: 'Free Zone', to: 'Dubai' },
  { from: 'Custom Clearence', to: 'Dubai' },
];

module.exports = {
  STOPS,
  STOP_ROLE_MAP,
  ROUTE_MARKERS,
  ROUTE_LINES,
};
