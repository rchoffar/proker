import { migrate } from './db-migrate.mjs';

// Only the deployment build calls this script. Plain npm run build never migrates.
// A missing connection or failed migration must block publication, even if Vercel's
// automatic system environment variables are disabled on a newly created project.
await migrate();
