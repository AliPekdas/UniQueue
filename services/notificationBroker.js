/**
 * Observer-pattern notification broker (async, non-blocking).
 */
class NotificationBroker {
  constructor() {
    this._observers = [];
  }

  subscribe(handler) {
    if (typeof handler === 'function') this._observers.push(handler);
    return () => {
      this._observers = this._observers.filter((h) => h !== handler);
    };
  }

  dispatch(payload) {
    setImmediate(() => {
      for (const observer of this._observers) {
        Promise.resolve(observer(payload)).catch((err) => {
          console.error('[NotificationBroker]', err.message);
        });
      }
    });
  }
}

const broker = new NotificationBroker();
broker.subscribe((payload) => {
  console.log(`[NOTIFY] ${payload.type} → user ${payload.userId}: ${payload.message}`);
});

module.exports = { NotificationBroker, broker };
