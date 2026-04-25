import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore,
  collection as fireCollection,
  doc as fireDoc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

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
const firestore = getFirestore(app);

function wrapDocReference(docRef) {
  return {
    get: () => getDoc(docRef),
    set: (data) => setDoc(docRef, data),
    delete: () => deleteDoc(docRef),
    collection: (name) => wrapCollection(fireCollection(docRef, name)),
    ref: docRef
  };
}

function wrapCollection(collectionRef) {
  return {
    get: () => getDocs(collectionRef),
    doc: (id) => wrapDocReference(fireDoc(collectionRef, String(id))),
    collection: (name) => wrapCollection(fireCollection(collectionRef, name))
  };
}

function wrapBatch(batch) {
  return {
    set: (docRef, data) => {
      const target = docRef && docRef.ref ? docRef.ref : docRef;
      batch.set(target, data);
      return this;
    },
    delete: (docRef) => {
      const target = docRef && docRef.ref ? docRef.ref : docRef;
      batch.delete(target);
      return this;
    },
    commit: () => batch.commit()
  };
}

const db = {
  collection: (name) => wrapCollection(fireCollection(firestore, name)),
  batch: () => wrapBatch(writeBatch(firestore)),
  doc: (pathOrRef, id) => {
    if (id !== undefined) {
      return wrapDocReference(fireDoc(pathOrRef, String(id)));
    }
    return wrapDocReference(fireDoc(firestore, pathOrRef));
  }
};

export { auth, db };
