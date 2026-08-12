"use client";

import { useEffect, useState } from "react";

export type OfflineSnapshotKind = "passport" | "missions";
type Snapshot = {
  kind: OfflineSnapshotKind;
  payload: unknown;
  savedAt: number;
};

const databaseName = "kinavela-offline-v1";
const storeName = "snapshots";
const snapshotMaxAgeMs = 30 * 24 * 60 * 60 * 1000;

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore(storeName, { keyPath: "kind" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveOfflineSnapshot(
  kind: OfflineSnapshotKind,
  payload: unknown,
) {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const request = database
      .transaction(storeName, "readwrite")
      .objectStore(storeName)
      .put({ kind, payload, savedAt: Date.now() } satisfies Snapshot);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  database.close();
}

export async function readOfflineSnapshots() {
  const database = await openDatabase();
  const snapshots = await new Promise<Snapshot[]>((resolve, reject) => {
    const request = database
      .transaction(storeName, "readonly")
      .objectStore(storeName)
      .getAll();
    request.onsuccess = () => {
      const now = Date.now();
      const snapshots = (request.result as Snapshot[]).filter((snapshot) => {
        if (now - snapshot.savedAt <= snapshotMaxAgeMs) return true;
        database
          .transaction(storeName, "readwrite")
          .objectStore(storeName)
          .delete(snapshot.kind);
        return false;
      });
      resolve(snapshots);
    };
    request.onerror = () => reject(request.error);
  });
  database.close();
  return snapshots;
}

export async function clearOfflineSnapshots() {
  if (typeof indexedDB === "undefined") return;
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const request = database
      .transaction(storeName, "readwrite")
      .objectStore(storeName)
      .clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  database.close();
}

export function OfflineSnapshotButton({
  kind,
  payload,
  label,
}: {
  kind: OfflineSnapshotKind;
  payload: unknown;
  label: string;
}) {
  const [saved, setSaved] = useState(false);
  async function save() {
    try {
      await saveOfflineSnapshot(kind, payload);
      setSaved(true);
    } catch {
      setSaved(false);
    }
  }
  return (
    <button className="button button-secondary" type="button" onClick={save}>
      {saved ? "Saved offline" : label}
    </button>
  );
}

export function OfflineDashboard() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    readOfflineSnapshots()
      .then((value) => {
        setSnapshots(value);
        setReady(true);
      })
      .catch(() => setReady(true));
  }, []);
  if (!ready)
    return <p className="offline-muted">Loading offline snapshots…</p>;
  const passport = snapshots.find((snapshot) => snapshot.kind === "passport");
  const missions = snapshots.find((snapshot) => snapshot.kind === "missions");
  const passportPayload = passport?.payload as
    | {
        passport?: { child_nickname?: string; entry_count?: number };
        entries?: Array<{ title?: string; description?: string }>;
      }
    | undefined;
  const missionPayload = Array.isArray(missions?.payload)
    ? (missions.payload as Array<{ title?: string; summary?: string }>)
    : [];
  return (
    <div className="offline-snapshot-grid">
      {passportPayload && (
        <section className="offline-card">
          <p className="eyebrow">ROOTS PASSPORT</p>
          <h2>
            {passportPayload.passport?.child_nickname ?? "Saved Passport"}
          </h2>
          <p>
            {passportPayload.passport?.entry_count ??
              passportPayload.entries?.length ??
              0}{" "}
            saved entries.
          </p>
          <ul>
            {(passportPayload.entries ?? [])
              .slice(0, 12)
              .map((entry, index) => (
                <li key={`${entry.title}-${index}`}>
                  <strong>{entry.title}</strong>
                  {entry.description && <span>{entry.description}</span>}
                </li>
              ))}
          </ul>
        </section>
      )}
      {missions && (
        <section className="offline-card">
          <p className="eyebrow">MISSIONS</p>
          <h2>Saved cultural missions</h2>
          <ul>
            {missionPayload.slice(0, 20).map((mission, index) => (
              <li key={`${mission.title}-${index}`}>
                <strong>{mission.title}</strong>
                {mission.summary && <span>{mission.summary}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
      {!passport && !missions && (
        <p className="offline-muted">
          No offline snapshots saved yet. Open your Passport or Missions page
          while online and choose Save offline.
        </p>
      )}
    </div>
  );
}
