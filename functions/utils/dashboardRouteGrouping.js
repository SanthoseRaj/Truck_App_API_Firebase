const { normalizeDestination } = require('./destination');
const { normalizeStop, getNextStopForDestination, toApiStop } = require('./workflow');

const stopRoleLabels = {
  yard: 'Yard',
  port: 'Port Loading',
  portLoading: 'Port Loading',
  clearence: 'Custom Clearence',
  dubai: 'Dubai',
  freezone: 'Free Zone',
};

const getOriginStop = (truckEntry) => normalizeStop(truckEntry.originStop) || 'yard';

const getDashboardRouteKeyForTruckEntry = (truckEntry) => {
  const destination = normalizeDestination(truckEntry.destination);
  const currentStop = normalizeStop(truckEntry.currentStop, destination);

  if (currentStop === 'yard') return 'yardToPortLoading';
  if (currentStop === 'port') return destination === 'freezone' ? 'portToFreezone' : 'portToClearence';

  if (currentStop === 'clearence') {
    return destination === 'freezone' ? 'portToFreezone' : 'clearenceToDubai';
  }

  if (currentStop === 'dubai') return 'dubaiToYard';
  if (currentStop === 'freezone') return 'freezoneToPortLoading';

  return null;
};

const getDashboardRouteLabelsForTruckEntry = (truckEntry) => {
  const routeKey = getDashboardRouteKeyForTruckEntry(truckEntry);

  if (routeKey === 'portToFreezone') return { from: 'Port Loading', to: 'Free Zone' };
  if (routeKey === 'clearenceToDubai') return { from: 'Custom Clearence', to: 'Dubai' };
  if (routeKey === 'dubaiToYard') return { from: 'Dubai', to: 'Yard' };
  if (routeKey === 'freezoneToPortLoading') return { from: 'Free Zone', to: 'Port Loading' };

  const destination = normalizeDestination(truckEntry.destination);
  const currentStop = normalizeStop(truckEntry.currentStop, destination);
  const nextStop = normalizeStop(
    truckEntry.nextStop || getNextStopForDestination(currentStop, destination, getOriginStop(truckEntry)),
    destination
  );
  const from = stopRoleLabels[currentStop];
  const to = stopRoleLabels[toApiStop(nextStop)] || stopRoleLabels[nextStop];

  return from && to ? { from, to } : null;
};

const getDashboardCountRouteKeyForTruckEntry = (truckEntry) => {
  if (truckEntry.workflowStatus === 'completed') {
    return null;
  }

  return getDashboardRouteKeyForTruckEntry(truckEntry);
};

module.exports = {
  getDashboardRouteKeyForTruckEntry,
  getDashboardRouteLabelsForTruckEntry,
  getDashboardCountRouteKeyForTruckEntry,
};
