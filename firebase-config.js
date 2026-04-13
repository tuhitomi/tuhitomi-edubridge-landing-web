import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCQk1mGaPiiHe0D2j20h-cuUsfrG-mvMIA",
  authDomain: "edubridge-landing-web.firebaseapp.com",
  projectId: "edubridge-landing-web",
  storageBucket: "edubridge-landing-web.firebasestorage.app",
  messagingSenderId: "998209261117",
  appId: "1:998209261117:web:5b8f7e87e6dc9fb2602454",
  measurementId: "G-Y44CK7MLEV"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export { auth };
