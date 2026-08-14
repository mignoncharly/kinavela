"use client";

import {
  Check,
  Clock3,
  HeartHandshake,
  ListChecks,
  LockKeyhole,
  PackageCheck,
  Play,
  Quote,
  UsersRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type {
  CulturalMission,
  VillageMission,
} from "@/lib/validation/missions";

import type { MissionCopy } from "@/features/missions/copy";

async function missionAction(body: object) {
  return fetch("/api/missions/actions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function MissionCard({
  mission,
  villageMissionId,
  copy,
}: {
  mission: CulturalMission | VillageMission;
  villageMissionId?: string;
  copy: MissionCopy;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const completed = new Set(mission.completed_step_ids);
  const isComplete = mission.progress_status === "completed";

  async function start() {
    setBusy("start");
    setError(false);
    const response = await missionAction({
      action: "start",
      mission_id: mission.mission_id,
      village_mission_id: villageMissionId ?? null,
    });
    if (!response.ok) {
      setBusy(null);
      setError(true);
      return;
    }
    setBusy(null);
    router.refresh();
  }

  async function completeStep(stepId: string) {
    if (!mission.progress_id || completed.has(stepId) || isComplete) return;
    setBusy(stepId);
    setError(false);
    const response = await missionAction({
      action: "complete_step",
      mission_id: mission.mission_id,
      step_id: stepId,
      village_mission_id: villageMissionId ?? null,
    });
    if (!response.ok) {
      setBusy(null);
      setError(true);
      return;
    }
    setBusy(null);
    router.refresh();
  }

  return (
    <article className="mission-card">
      <div className="mission-card-heading">
        <div>
          <p className="mission-category">
            {copy.categories[mission.category]}
          </p>
          <h3>{mission.title}</h3>
        </div>
        {isComplete ? <Check aria-label={copy.completed} /> : <ListChecks />}
      </div>
      <p className="mission-summary">{mission.summary}</p>
      <p className="mission-description">{mission.description}</p>
      <div className="mission-meta">
        <span>
          <Clock3 size={15} /> {mission.estimated_minutes} {copy.minutes}
        </span>
        <span>
          <LockKeyhole size={15} /> {mission.min_age}–{mission.max_age}{" "}
          {copy.years}
        </span>
        {mission.country_name && <span>{mission.country_name}</span>}
        <span>{copy.scopes[mission.context_scope]}</span>
      </div>
      <div className="mission-context">
        <UsersRound size={17} aria-hidden="true" />
        <div>
          <strong>{copy.context}</strong>
          <p>{mission.cultural_context}</p>
        </div>
      </div>
      <details className="mission-preparation">
        <summary>{copy.prepare}</summary>
        <div className="mission-preparation-grid">
          <section>
            <h4>
              <PackageCheck size={16} aria-hidden="true" /> {copy.materials}
            </h4>
            <ul>
              {mission.materials.map((material) => (
                <li key={material}>{material}</li>
              ))}
            </ul>
          </section>
          <section>
            <h4>
              <HeartHandshake size={16} aria-hidden="true" /> {copy.guidance}
            </h4>
            <p>{mission.guardian_guidance}</p>
          </section>
          <section>
            <h4>
              <Quote size={16} aria-hidden="true" /> {copy.attribution}
            </h4>
            <p>{mission.respectful_attribution}</p>
          </section>
        </div>
      </details>
      <ol className="mission-steps">
        {mission.steps.map((step) => {
          const done = completed.has(step.step_id);
          return (
            <li className={done ? "is-complete" : undefined} key={step.step_id}>
              <button
                aria-pressed={done}
                className="mission-step-button"
                disabled={
                  !mission.progress_id || done || isComplete || busy !== null
                }
                type="button"
                onClick={() => completeStep(step.step_id)}
              >
                <span className="mission-step-marker">
                  {done ? <Check size={14} /> : step.position}
                </span>
                <span>
                  <strong>{step.title}</strong>
                  <small>{step.description}</small>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      {!mission.progress_id && (
        <button
          className="button button-primary"
          disabled={busy !== null}
          type="button"
          onClick={start}
        >
          <Play size={16} /> {busy === "start" ? copy.starting : copy.start}
        </button>
      )}
      {mission.progress_id && !isComplete && (
        <p className="mission-progress-note">{copy.progressNote}</p>
      )}
      {isComplete && (
        <div className="mission-complete-note">
          <strong>{copy.completedBody}</strong>
          <p>
            {copy.reflection}: {mission.passport_reflection_prompt}
          </p>
        </div>
      )}
      {error && (
        <p className="form-error" role="alert">
          {copy.actionError}
        </p>
      )}
    </article>
  );
}

export function MissionBoard({
  missions,
  villageMissions = [],
  villageId,
  canAssign = false,
  copy,
}: {
  missions: CulturalMission[];
  villageMissions?: VillageMission[];
  villageId?: string;
  canAssign?: boolean;
  copy: MissionCopy;
}) {
  const router = useRouter();
  const assignedIds = new Set(villageMissions.map((item) => item.mission_id));
  const available = missions.filter(
    (item) => !assignedIds.has(item.mission_id),
  );
  const [selectedMission, setSelectedMission] = useState(
    available[0]?.mission_id ?? "",
  );
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState(false);

  async function assign() {
    if (!villageId || !selectedMission) return;
    setAssigning(true);
    setError(false);
    const response = await missionAction({
      action: "assign",
      village_id: villageId,
      mission_id: selectedMission,
    });
    if (!response.ok) {
      setAssigning(false);
      setError(true);
      return;
    }
    router.refresh();
  }

  return (
    <div className="mission-board">
      {villageId && canAssign && available.length > 0 && (
        <div className="mission-assign-panel">
          <label>
            {copy.assignLabel}
            <select
              value={selectedMission}
              onChange={(event) => setSelectedMission(event.target.value)}
            >
              {available.map((mission) => (
                <option key={mission.mission_id} value={mission.mission_id}>
                  {mission.title}
                </option>
              ))}
            </select>
          </label>
          <button
            className="button button-secondary"
            disabled={assigning}
            type="button"
            onClick={assign}
          >
            {assigning ? copy.assigning : copy.assign}
          </button>
        </div>
      )}
      {error && (
        <p className="form-error" role="alert">
          {copy.actionError}
        </p>
      )}
      {villageId && villageMissions.length > 0 && (
        <>
          <h3 className="mission-section-title">{copy.villageMissions}</h3>
          <div className="mission-grid">
            {villageMissions.map((mission) => (
              <MissionCard
                key={mission.village_mission_id}
                mission={mission}
                villageMissionId={mission.village_mission_id}
                copy={copy}
              />
            ))}
          </div>
        </>
      )}
      {!villageId && (
        <div className="mission-grid">
          {missions.map((mission) => (
            <MissionCard
              key={mission.mission_id}
              mission={mission}
              copy={copy}
            />
          ))}
        </div>
      )}
      {villageId && villageMissions.length === 0 && (
        <p className="muted-copy">{copy.noVillageMissions}</p>
      )}
      {!villageId && missions.length === 0 && (
        <p className="muted-copy">{copy.noMissions}</p>
      )}
    </div>
  );
}
