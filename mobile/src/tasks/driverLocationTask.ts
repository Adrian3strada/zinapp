import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { deliveryApi } from '../services/api';

export const DRIVER_LOCATION_TASK = 'driver-background-location';

TaskManager.defineTask(DRIVER_LOCATION_TASK, async ({ data, error }) => {
  if (error) return;
  const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations;
  const loc = locations?.[0];
  if (!loc) return;

  try {
    await deliveryApi.updateLocation(loc.coords.latitude, loc.coords.longitude);
  } catch {
    // Sin red momentánea en segundo plano
  }
});
