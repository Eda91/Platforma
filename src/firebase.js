import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";


// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyC52MoX2AtvvsrSKn4qCcU_BAZ4B9iSsoo",
  authDomain: "statistics-782f0.firebaseapp.com",
  projectId: "statistics-782f0",
  storageBucket: "statistics-782f0.firebasestorage.app",
  messagingSenderId: "706554510029",
  appId: "1:706554510029:web:f19123b9920a3b6a4b4784",
  measurementId: "G-Y727Y50X1S"
};

const app = initializeApp(firebaseConfig);

// Firestore (safe everywhere)
export const db = getFirestore(app);

// Analytics (safe check)
let analytics = null;

isSupported().then((ok) => {
  if (ok) {
    analytics = getAnalytics(app);
  }
});

export { analytics };

