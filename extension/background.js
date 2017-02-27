console.log("Loading 'test experiments.firefoxRDP extension' background script");

const fxrdp = browser.experiments.firefoxRDP;

fxrdp.onDisconnected.addListener((msg) => {
  console.log("background firefoxRDP.onDisconnected", msg);
});

let once = false;
fxrdp.onRDPEvent.addListener((...args) => {
  // Prevent this listener to generate an infinite loop ;-)
  if (!once) {
    console.log("background firefoxRDP.onRDPEvent", args);
    once = true;
  }
});

// To be able to Use an RDP connection from an arbitrary context (e.g. a popup),
// a devtools target have to be specified using a fake URL
// (more info: http://searchfox.org/mozilla-central/rev/90d1cbb4fd3dc249cdc11fe5c3e0394d22d9c680/devtools/client/framework/target-from-url.js#12-46).

fxrdp.connect("http://fake.devtools.domain?type=process")
  .then(async ([connId, form, traits]) => {
    console.log("background firefoxRDP.connect", connId, form, traits);

    const [targetForm, targetTraits] = await fxrdp.getTargetInfo(connId);
    console.log("background firefoxRDP.getTargetInfo", targetForm, targetTraits);

    const res = await fxrdp.sendRequest(connId, "root", "requestTypes");
    console.log("background firefoxRDP.sendRequest", res);

    const {consoleActor} = targetForm;

    fxrdp.subscribeEvents(connId, ["pageError", "consoleAPICall", "logMessage"]);

    const res2 = await fxrdp.sendRequest(connId, consoleActor, "startListeners", {
      listeners: ["PageError", "ConsoleAPI"],
    });

    console.log("background firefoxRDP.startListeners", res2);

    fxrdp.disconnect(connId);
  });
