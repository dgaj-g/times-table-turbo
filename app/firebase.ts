"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyCOb3wrcygqTx2Lp82qIF_qbiqQxcU-8Eg",
  authDomain: "jarlath-anya-table-turbo.firebaseapp.com",
  databaseURL:
    "https://jarlath-anya-table-turbo-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "jarlath-anya-table-turbo",
  storageBucket: "jarlath-anya-table-turbo.firebasestorage.app",
  messagingSenderId: "287018098351",
  appId: "1:287018098351:web:75b5a78449c50dec103e5a",
};

function getServices() {
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return {
    auth: getAuth(app),
    database: getDatabase(app),
  };
}

export async function getRealtimeServices() {
  const services = getServices();
  const user =
    services.auth.currentUser ??
    (await signInAnonymously(services.auth)).user;
  return { ...services, user };
}
