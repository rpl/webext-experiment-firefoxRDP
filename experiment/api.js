const {utils: Cu} = Components;
const {Management} = Cu.import("resource://gre/modules/Extension.jsm", {});
const {gDevTools} = Cu.import("resource://devtools/client/framework/gDevTools.jsm", {});
const {devtools} = Cu.import("resource://devtools/shared/Loader.jsm", {});
const {targetFromURL} = devtools.require("devtools/client/framework/target-from-url.js");
const {ExtensionUtils} = Cu.import("resource://gre/modules/ExtensionUtils.jsm", {});
const {EventEmitter} = Cu.import("resource://devtools/shared/event-emitter.js", {});

Cu.importGlobalProperties(["URL"]);

const {
  SingletonEventManager,
  SpreadArgs,
} = ExtensionUtils;

class RDPConnection extends EventEmitter {
  constructor(rdpConnectionID, context, targetURL, rdpEvents) {
    super();

    if (rdpConnectionID === 0 && context.envType !== "devtools_parent") {
      throw new Error("Default RDP target is only supported in devtools extension pages and panels");
    }

    this.id = rdpConnectionID;
    this.context = context;
    this.targetURL = targetURL;
    this.rdpEvents = rdpEvents;

    this.subscribedEventNames = new Set();
    this.onRDPEvent = this.onRDPEvent.bind(this);
    this.context.callOnClose(this);
  }

  async connect() {
    if (this.connected) {
      throw new Error("Unable to connect twice");
    }

    if (this.id === 0 && this.context.envType === "devtools_parent") {
      this.target = await Management.global.getDevToolsTargetForContext(this.context);
    } else {
      this.target = await targetFromURL(this.targetURL);
    }

    this.connected = true;
    this.target.once("close", this.onDisconnected.bind(this));
  }

  async disconnect() {
    this.unsubscribeEvents(this.subscribedEventNames);
    this.context.forgetOnClose(this);

    if (this.id === 0 && this.context.envType === "devtools_parent") {
      // Do not destroy the connection if it is shared with the devtools context.
      return;
    }

    await this.target.destroy();
  }

  async request(rdpData) {
    return await this.target.client.request(rdpData);
  }

  getTargetInfo() {
    return [this.target.form, this.target.client.traits];
  }

  subscribeEvents(eventNames) {
    for (const eventName of eventNames) {
      if (this.subscribedEventNames.has(eventName)) {
        continue;
      }

      this.target.client.addListener(eventName, this.onRDPEvent);
    }
  }

  unsubscribeEvents(eventNames) {
    for (const eventName of eventNames) {
      if (!this.subscribedEventNames.has(eventName)) {
        continue;
      }

      this.target.client.removeListener(eventName, this.onRDPEvent);
    }
  }

  onDisconnected() {
    this.rdpEvents.emit("disconnected", this.id);
  }

  onRDPEvent(eventName, eventData) {
    this.rdpEvents.emit("rdp-event", this.id, eventName, eventData);
  }

  close() {
    this.disconnect();
  }
}

class API extends ExtensionAPI {
  getAPI(context) {
    const RDPConnections = new Map();
    let nextRDPConnectionId = 1;
    let rdpEvents = new EventEmitter();

    function getConnectionById(connId) {
      const conn = RDPConnections.get(connId);
      if (!conn) {
        throw new Error(`RDP connection id "${connId}" not found`);
      }

      return conn;
    }

    return {
      experiments: {
        firefoxRDP: {
          // API Events.
          onDisconnected: new SingletonEventManager(context, "rdp.onDisconnected", fire => {
            let listener = (event, rdpConnectionId) => {
              fire.async(rdpConnectionId);
            };

            rdpEvents.on("disconnected", listener);
            return () => {
              rdpEvents.off("disconnect", listener);
            };
          }).api(),
          onRDPEvent: new SingletonEventManager(context, "rdp.onRDPEvent", fire => {
            let listener = (event, rdpConnectionId, rdpEventName, rdpEventData) => {
              fire.async(rdpConnectionId, rdpEventName, rdpEventData);
            };

            rdpEvents.on("rdp-event", listener);
            return () => {
              rdpEvents.off("rdp-event", listener);
            };
          }).api(),

          // API Methods.
          connect(targetURL) {
            let conn;
            if (!targetURL) {
              conn = new RDPConnection(0, context, null, rdpEvents);
            } else {
              conn = new RDPConnection(nextRDPConnectionId++, context,
                                       new URL(targetURL), rdpEvents);
            }

            RDPConnections.set(conn.id, conn);
            conn.once("disconnected", () => {
              RDPConnections.delete(conn.id);
            });

            return Promise.resolve().then(async () => {
              await conn.connect();
              return new SpreadArgs([conn.id].concat(conn.getTargetInfo()));
            });
          },
          disconnect(connId) {
            try {
              const conn = getConnectionById(connId);

              return Promise.resolve().then(async () => {
                await conn.disconnect();
                return connId;
              });
            } catch (err) {
              return Promise.reject({message: err.message});
            }
          },
          getTargetInfo(connId) {
            try {
              const conn = getConnectionById(connId);
              return Promise.resolve(new SpreadArgs([conn.getTargetInfo()]));
            } catch (err) {
              return Promise.reject({message: err.message});
            }
          },
          sendRequest(connId, rdpActor, rdpRequestType, rdpRequestProperties) {
            try {
              const conn = getConnectionById(connId);
              return Promise.resolve().then(async () => {
                const rdpResult = await conn.request(Object.assign({}, rdpRequestProperties, {
                  type: rdpRequestType,
                  to: rdpActor,
                }));

                return rdpResult;
              });
            } catch (err) {
              return Promise.reject({message: err.message});
            }

          },
          subscribeEvents(connId, eventNames) {
            try {
              const conn = getConnectionById(connId);
              return Promise.resolve().then(() => {
                conn.subscribeEvents(eventNames);
              });
            } catch (err) {
              return Promise.reject({message: err.message});
            }
          },
          unsubscribeEvents(connId, eventNames) {
            try {
              const conn = getConnectionById(connId);

              return Promise.resolve().then(() => {
                conn.unsubscribeEvents(eventNames);
              });
            } catch (err) {
              return Promise.reject({message: err.message});
            }
          }
        },
      },
    };
  }
}
