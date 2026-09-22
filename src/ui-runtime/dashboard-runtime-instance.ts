/**
 * Runtime Singleton — stable instance for React app lifecycle.
 *
 * UI imports this, NEVER creates a new runtime on each render.
 * The controller's subscribe() API drives reactive state updates.
 */

import { createDashboardRuntime } from '../runtime/dashboard-runtime';

export const dashboardRuntime = createDashboardRuntime();
