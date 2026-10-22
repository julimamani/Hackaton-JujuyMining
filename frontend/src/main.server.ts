import { BootstrapContext, bootstrapApplication } from '@angular/platform-browser';
//import { App } from './app/app';
import { Dashboard } from './app/components/dashboard/dashboard';
import { config } from './app/app.config.server';

const bootstrap = (context: BootstrapContext) =>
    bootstrapApplication(Dashboard, config, context);

export default bootstrap;
