/* Muuzee Prototype User Config
   Static seed users only. New prototype registrations are stored as a localStorage overlay. */
(() => {
  "use strict";

  window.MuuzeePrototypeUserConfig = Object.freeze({
    schemaVersion:1,
    users:Object.freeze([
      Object.freeze({
        loginID:"user-001",
        email:"ashelry@example.com",
        password:"muuzee123",
        nickname:"ashelry"
      })
    ])
  });
})();
