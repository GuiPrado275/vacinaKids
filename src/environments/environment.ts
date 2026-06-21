// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  // Cole aqui o bloco "firebaseConfig" que aparece em:
  // Firebase Console > Project settings > Your apps > (ícone </>) > SDK setup and configuration
  firebase: {
    apiKey: 'AIzaSyDL6elHWJ9ZIGoD9vqLw1mL0oGImV4fAHA',
    authDomain: 'vacina-kids-107ca.firebaseapp.com',
    projectId: 'vacina-kids-107ca',
    storageBucket: 'vacina-kids-107ca.firebasestorage.app',
    messagingSenderId: '418110739899',
    appId: '1:418110739899:web:0c3a5695a4165bc5c1209e',
  },
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
