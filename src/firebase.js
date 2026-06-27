import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDTx4qQ1vgxb_wglzpr2CbAPImgBhNVTaA",
  authDomain: "vitashield-74999.firebaseapp.com",
  projectId: "vitashield-74999",
  storageBucket: "vitashield-74999.firebasestorage.app",
  messagingSenderId: "1008843421219",
  appId: "1:1008843421219:web:3f9af82641a31874a22396",
  measurementId: "G-41L5Z298MP"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);