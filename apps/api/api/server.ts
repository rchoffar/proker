import { createRelay } from '../src/server.js';

const { httpServer } = await createRelay();
export default httpServer;
