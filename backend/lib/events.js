import { EventEmitter } from 'events';

// Global event bus for broadcasting backend updates (worker cycles, mutations, settings)
// to active SSE connections without polling overhead.
export const eventBus = new EventEmitter();
eventBus.setMaxListeners(100);
