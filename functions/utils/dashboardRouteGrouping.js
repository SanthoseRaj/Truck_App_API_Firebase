const { normalizeDestination } = require('./destination');
const { normalizeStop, getNextStopForDestination, getReturnRouteForDestination } = require('./workflow');

const stopRoleLabels = {
  yard: 'Yard',
  gate: 'Gate',
  port: 'Port Loading',
  clearence: 'Custom Clearence',
  dubai: 'Dubai',
  freezone: 'Free Zone',
};

const routeKeys = {
  yard: 'yardToGate',
  gate: 'gateToPort',
  port: 'portToClearence',
};

const getOriginStop = (truckEntry) => truckEntry.originStop || 'yard';

const getDashboardRouteKeyForTruckEntry = (truckEntry) => {
  const destination = normalizeDestination(truckEntry.destination);
  const currentStop = normalizeStop(truckEntry.currentStop, destination);

  if (currentStop === 'clearence') {
    return destination === 'freezone' ? 'clearenceToFreezone' : 'clearenceToDubai';
  }

  if (currentStop === 'dubai') return 'dubaiToYard';
  if (currentStop === 'freezone') return 'freezoneToGate';

  return routeKeys[currentStop] || null;
};

const getDashboardRouteLabelsForTruckEntry = (truckEntry) => {
  const routeKey = getDashboardRouteKeyForTruckEntry(truckEntry);

  if (routeKey === 'clearenceToDubai') return { from: 'Custom Clearence', to: 'Dubai' };
  if (routeKey === 'clearenceToFreezone') return { from: 'Custom Clearence', to: 'Free Zone' };
  if (routeKey === 'dubaiToYard') return { from: 'Dubai', to: 'Yard' };
  if (routeKey === 'freezoneToGate') return { from: 'Free Zone', to: 'Gate' };

  const destination = normalizeDestination(truckEntry.destination);
  const currentStop = normalizeStop(truckEntry.currentStop, destination);
  const nextStop = normalizeStop(
    truckEntry.nextStop || getNextStopForDestination(currentStop, destination, getOriginStop(truckEntry)),
    destination
  );
  const from = stopRoleLabels[currentStop];
  const to = stopRoleLabels[nextStop];

  return from && to ? { from, to } : null;
};

const getDashboardCountRouteKeyForTruckEntry = (truckEntry) => {
  if (truckEntry.workflowStatus === 'completed') {
    return getReturnRouteForDestination(normalizeDestination(truckEntry.destination));
  }

  return getDashboardRouteKeyForTruckEntry(truckEntry);
};

module.exports = {
  getDashboardRouteKeyForTruckEntry,
  getDashboardRouteLabelsForTruckEntry,
  getDashboardCountRouteKeyForTruckEntry,
};
