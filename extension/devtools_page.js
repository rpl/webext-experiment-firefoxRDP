console.log("Loading 'test experiments.firefoxRDP extension' devtools page");

const fxrdp = browser.experiments.firefoxRDP;

fxrdp.onRDPEvent.addListener((...args) => {
  console.log("devtools page - firefoxRDP.onRDPEvent", args);
});


// In a devtools context (e.g. a devtools page or a devtools panel), the current target
// is going to be the default connection (and the target can omitted)
fxrdp.connect()
     .then(async ([connId, form, traits]) => {
       console.log("devtools page - firefoxRDP.connect", connId, form, traits);

       // In a devtools context the RDP connection id can be omitted and the default target
       // connection will be used.
       fxrdp.subscribeEvents(["tabNavigated"]);
     });
