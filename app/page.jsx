"use client";

import { useState, useEffect, useCallback, useRef } from "react";

/* ============================================================
   MISSIES MET HET GEZIN — v2 (Nederlands) — Romane & Théo
   Gedeelde opslag : API /api/state (Upstash Redis)
   ============================================================ */

const PARENT_PIN = process.env.NEXT_PUBLIC_PARENT_PIN || "180586";
const AVATARS = ["🦊", "🐯", "🐰", "🐼", "🦁", "🐨", "🐸", "🦄", "🐙", "🐶"];

// Versie van de inhoud (missies/beloningen/minpunten). Bij een verhoging
// worden de standaardlijsten van Romane & Théo opnieuw opgebouwd terwijl de
// verdiende punten behouden blijven.
const CONTENT_VERSION = 2;

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// Lokale datum in formaat YYYY-MM-DD (tijdzone van het toestel)
const getToday = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

// Maandag (1) tot vrijdag (5) = schooldag
const isSchoolDay = () => {
  const day = new Date().getDay();
  return day >= 1 && day <= 5;
};

const nlDate = (iso) => {
  try {
    const [, m, d] = iso.split("-");
    return `${d}/${m}`;
  } catch {
    return iso;
  }
};

/* ---------- Toegang tot de gedeelde opslag (API) ---------- */
async function readState() {
  const res = await fetch("/api/state", { cache: "no-store" });
  if (!res.ok) throw new Error("read failed");
  const json = await res.json();
  return json && json.value ? json.value : null;
}

async function writeState(data) {
  const res = await fetch("/api/state", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("write failed");
}

/* ---------- Standaardgegevens : Romane & Théo (Nederlands) ---------- */
/* Vlaggen per missie :
     schoolOnly  → alleen zichtbaar op schooldagen (ma–vr)
     homeOnly    → alleen zichtbaar buiten school (weekend/vakantie)
     repeatable  → mag meerdere keren per dag afgevinkt worden (teller) */
const defaultData = () => ({
  lastReset: getToday(),
  contentVersion: CONTENT_VERSION,
  children: [
    {
      id: "romane",
      name: "Romane",
      avatar: "🦊",
      points: 0,
      totalPoints: 0,
      completedToday: {},
      missions: [
        { id: uid(), emoji: "🏃", label: "Me meteen klaarmaken om te vertrekken (schoenen en jas aan)", points: 10, schoolOnly: false, homeOnly: false, repeatable: false },
        { id: uid(), emoji: "🙂", label: "Niet mopperen", points: 10, schoolOnly: false, homeOnly: false, repeatable: false },
        { id: uid(), emoji: "🧸", label: "Mijn kamer opruimen", points: 10, schoolOnly: false, homeOnly: false, repeatable: false },
        { id: uid(), emoji: "🪥", label: "3 minuten mijn tanden poetsen", points: 10, schoolOnly: false, homeOnly: false, repeatable: false },
        { id: uid(), emoji: "🧻", label: "Handdoeken aan het handdoekenrek hangen", points: 5, schoolOnly: false, homeOnly: false, repeatable: false },
        { id: uid(), emoji: "🌙", label: "Zonder mopperen naar bed gaan", points: 10, schoolOnly: false, homeOnly: false, repeatable: false },
        { id: uid(), emoji: "🧹", label: "Meehelpen met een huishoudelijke taak", points: 5, schoolOnly: false, homeOnly: false, repeatable: true },
        { id: uid(), emoji: "🧩", label: "Speelgoed opruimen na het spelen", points: 10, schoolOnly: false, homeOnly: false, repeatable: true },
        { id: uid(), emoji: "🥪", label: "Boterhammen klaarmaken voor school of stage", points: 20, schoolOnly: false, homeOnly: false, repeatable: false },
        { id: uid(), emoji: "🥐", label: "Zelf mijn boterhammen smeren (ontbijt en lunch)", points: 10, schoolOnly: false, homeOnly: true, repeatable: false },
      ],
      rewards: [
        { id: uid(), emoji: "🍨", label: "Een dessert kiezen", cost: 60 },
        { id: uid(), emoji: "📺", label: "20 min extra tv", cost: 120 },
        { id: uid(), emoji: "📖", label: "10 min extra voorlezen in bed", cost: 60 },
        { id: uid(), emoji: "🎬", label: "De film van de avond kiezen", cost: 80 },
      ],
      penalties: [
        { id: uid(), emoji: "😤", label: "Gemopperd", points: 5 },
        { id: uid(), emoji: "🛏️", label: "Discussie bij het slapengaan", points: 5 },
        { id: uid(), emoji: "🌪️", label: "Kamer niet opgeruimd", points: 5 },
        { id: uid(), emoji: "🧩", label: "Speelgoed niet opgeruimd", points: 5 },
      ],
      penaltiesToday: [],
      history: [],
    },
    {
      id: "theo",
      name: "Théo",
      avatar: "🐯",
      points: 0,
      totalPoints: 0,
      completedToday: {},
      missions: [
        { id: uid(), emoji: "🏃", label: "Me meteen klaarmaken om te vertrekken (schoenen en jas aan)", points: 10, schoolOnly: false, homeOnly: false, repeatable: false },
        { id: uid(), emoji: "💛", label: "Lief zijn voor Romane", points: 10, schoolOnly: false, homeOnly: false, repeatable: false },
        { id: uid(), emoji: "✏️", label: "Niet mopperen om mijn huiswerk te maken", points: 10, schoolOnly: true, homeOnly: false, repeatable: false },
        { id: uid(), emoji: "👕", label: "Mijn kleren opruimen", points: 10, schoolOnly: false, homeOnly: false, repeatable: false },
        { id: uid(), emoji: "🪥", label: "3 minuten mijn tanden poetsen", points: 10, schoolOnly: false, homeOnly: false, repeatable: false },
        { id: uid(), emoji: "🧻", label: "Handdoeken aan het handdoekenrek hangen", points: 5, schoolOnly: false, homeOnly: false, repeatable: false },
        { id: uid(), emoji: "🌙", label: "Zonder mopperen naar bed gaan", points: 10, schoolOnly: false, homeOnly: false, repeatable: false },
        { id: uid(), emoji: "🧹", label: "Meehelpen met een huishoudelijke taak", points: 5, schoolOnly: false, homeOnly: false, repeatable: true },
        { id: uid(), emoji: "🧩", label: "Speelgoed opruimen na het spelen", points: 10, schoolOnly: false, homeOnly: false, repeatable: true },
        { id: uid(), emoji: "🥪", label: "Boterhammen klaarmaken voor school of stage", points: 20, schoolOnly: false, homeOnly: false, repeatable: false },
        { id: uid(), emoji: "🥐", label: "Zelf mijn boterhammen smeren (ontbijt en lunch)", points: 10, schoolOnly: false, homeOnly: true, repeatable: false },
      ],
      rewards: [
        { id: uid(), emoji: "🍨", label: "Een dessert kiezen", cost: 60 },
        { id: uid(), emoji: "🎮", label: "15 min extra spelen", cost: 150 },
        { id: uid(), emoji: "🌙", label: "15 min later naar bed dan Romane", cost: 100 },
        { id: uid(), emoji: "🎬", label: "De film van de avond kiezen", cost: 80 },
      ],
      penalties: [
        { id: uid(), emoji: "🙅", label: "Niet lief voor Romane", points: 10 },
        { id: uid(), emoji: "😤", label: "Gemopperd om het huiswerk", points: 5 },
        { id: uid(), emoji: "👕", label: "Kleren rondgeslingerd", points: 5 },
        { id: uid(), emoji: "🧩", label: "Speelgoed niet opgeruimd", points: 5 },
      ],
      penaltiesToday: [],
      history: [],
    },
  ],
});

/* ---------- Dagelijkse reset (de punten blijven behouden) ---------- */
const applyDailyReset = (data) => {
  const today = getToday();
  if (data.lastReset === today) return { data, changed: false };
  return {
    data: {
      ...data,
      lastReset: today,
      children: data.children.map((c) => ({ ...c, completedToday: {}, penaltiesToday: [] })),
    },
    changed: true,
  };
};

/* Migratie : zorgt dat de minpunt-velden bestaan op reeds opgeslagen gegevens */
const normalizeData = (data) => {
  data.children.forEach((c) => {
    if (!Array.isArray(c.penalties)) c.penalties = [];
    if (!Array.isArray(c.penaltiesToday)) c.penaltiesToday = [];
    if (!c.completedToday || typeof c.completedToday !== "object") c.completedToday = {};
    c.missions.forEach((m) => {
      if (typeof m.schoolOnly !== "boolean") m.schoolOnly = false;
      if (typeof m.homeOnly !== "boolean") m.homeOnly = false;
      if (typeof m.repeatable !== "boolean") m.repeatable = false;
    });
  });
  return data;
};

/* Inhoudsmigratie : bij een nieuwe CONTENT_VERSION worden de missies,
   beloningen en minpunten van Romane & Théo opnieuw opgebouwd uit de
   Nederlandse standaardlijsten. Punten, totaal en geschiedenis blijven. */
const applyContentMigration = (data) => {
  if (data.contentVersion === CONTENT_VERSION) return { data, changed: false };
  const defaults = defaultData();
  const byId = {};
  defaults.children.forEach((c) => {
    byId[c.id] = c;
  });
  data.children = data.children.map((c) => {
    const def = byId[c.id];
    if (!def) return c; // zelf toegevoegd kind : ongewijzigd laten
    return {
      ...c,
      avatar: c.avatar || def.avatar,
      missions: def.missions,
      rewards: def.rewards,
      penalties: def.penalties,
      completedToday: {},
      penaltiesToday: [],
    };
  });
  data.contentVersion = CONTENT_VERSION;
  return { data, changed: true };
};

/* ============================================================ */
export default function MissiesMetHetGezin() {
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [activeChildId, setActiveChildId] = useState(null);
  const [parentMode, setParentMode] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [pinValue, setPinValue] = useState("");
  const [pinError, setPinError] = useState(false);
  const [takeoff, setTakeoff] = useState(null); // { childName, reward }
  const [newMission, setNewMission] = useState({ emoji: "⭐", label: "", points: 5, schoolOnly: false, homeOnly: false, repeatable: false });
  const [newReward, setNewReward] = useState({ emoji: "🎁", label: "", cost: 50 });
  const [newPenalty, setNewPenalty] = useState({ emoji: "⚠️", label: "", points: 5 });
  const [newChild, setNewChild] = useState({ name: "", avatar: "🐰" });
  const saveTimer = useRef(null);

  /* ---------- Opslaan (licht uitgesteld om te groeperen) ---------- */
  const persist = useCallback((d) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await writeState(d);
      } catch (e) {
        console.error("Fout bij het opslaan", e);
      }
    }, 300);
  }, []);

  /* ---------- Laden ---------- */
  const load = useCallback(async () => {
    try {
      let loaded = null;
      try {
        loaded = await readState();
      } catch {
        loaded = null; // ontbrekende sleutel of netwerkfout : standaardgegevens
      }
      let d = normalizeData(loaded || defaultData());
      const { data: migrated, changed: contentChanged } = applyContentMigration(d);
      const { data: resetData, changed: resetChanged } = applyDailyReset(migrated);
      setData(resetData);
      setActiveChildId((prev) => prev || (resetData.children[0] && resetData.children[0].id) || null);
      if (!loaded || contentChanged || resetChanged) persist(resetData);
      setLoadError(false);
    } catch (e) {
      console.error("Fout bij het laden", e);
      setLoadError(true);
    }
  }, [persist]);

  useEffect(() => {
    load();
  }, [load]);

  /* ---------- Opnieuw synchroniseren wanneer de app weer zichtbaar wordt ---------- */
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [load]);

  const update = (fn) => {
    setData((prev) => {
      const next = fn(structuredClone(prev));
      persist(next);
      return next;
    });
  };

  const updateChild = (childId, fn) =>
    update((d) => {
      const c = d.children.find((x) => x.id === childId);
      if (c) fn(c);
      return d;
    });

  /* ---------- Acties kind ---------- */
  // Missie die één keer per dag telt (aan/uit)
  const toggleMission = (childId, mission) => {
    updateChild(childId, (c) => {
      if (c.completedToday[mission.id]) {
        delete c.completedToday[mission.id];
        c.points = Math.max(0, c.points - mission.points);
        c.totalPoints = Math.max(0, c.totalPoints - mission.points);
      } else {
        c.completedToday[mission.id] = true;
        c.points += mission.points;
        c.totalPoints += mission.points;
      }
    });
  };

  // Herhaalbare missie (meerdere keren per dag) : teller +1
  const incMission = (childId, mission) => {
    updateChild(childId, (c) => {
      const n = Number(c.completedToday[mission.id]) || 0;
      c.completedToday[mission.id] = n + 1;
      c.points += mission.points;
      c.totalPoints += mission.points;
    });
  };

  // Herhaalbare missie : teller −1
  const decMission = (childId, mission) => {
    updateChild(childId, (c) => {
      const n = Number(c.completedToday[mission.id]) || 0;
      if (n <= 0) return;
      if (n - 1 <= 0) delete c.completedToday[mission.id];
      else c.completedToday[mission.id] = n - 1;
      c.points = Math.max(0, c.points - mission.points);
      c.totalPoints = Math.max(0, c.totalPoints - mission.points);
    });
  };

  const redeemReward = (child, reward) => {
    if (child.points < reward.cost) return;
    updateChild(child.id, (c) => {
      c.points -= reward.cost;
      c.history.unshift({ date: getToday(), emoji: reward.emoji, label: reward.label, cost: reward.cost });
      if (c.history.length > 30) c.history.length = 30;
    });
    setTakeoff({ childName: child.name, reward });
    setTimeout(() => setTakeoff(null), 3200);
  };

  /* ---------- Acties ouders ---------- */
  const adjustPoints = (childId, delta) =>
    updateChild(childId, (c) => {
      c.points = Math.max(0, c.points + delta);
      if (delta > 0) c.totalPoints += delta;
    });

  /* Minpunten : mogen nu door de ouders én door de kinderen zelf toegepast
     worden ; ze halen punten van het saldo af */
  const applyPenalty = (childId, penalty) =>
    updateChild(childId, (c) => {
      c.points = Math.max(0, c.points - penalty.points);
      c.penaltiesToday.push({ id: uid(), emoji: penalty.emoji, label: penalty.label, points: penalty.points });
    });

  const undoPenalty = (childId, appliedId) =>
    updateChild(childId, (c) => {
      const p = c.penaltiesToday.find((x) => x.id === appliedId);
      if (!p) return;
      c.points += p.points;
      c.penaltiesToday = c.penaltiesToday.filter((x) => x.id !== appliedId);
    });

  const addPenalty = (childId) => {
    if (!newPenalty.label.trim()) return;
    updateChild(childId, (c) => {
      c.penalties.push({
        id: uid(),
        emoji: newPenalty.emoji || "⚠️",
        label: newPenalty.label.trim(),
        points: Math.max(1, Number(newPenalty.points) || 5),
      });
    });
    setNewPenalty({ emoji: "⚠️", label: "", points: 5 });
  };

  const removePenalty = (childId, penaltyId) =>
    updateChild(childId, (c) => {
      c.penalties = c.penalties.filter((p) => p.id !== penaltyId);
    });

  const addMission = (childId) => {
    if (!newMission.label.trim()) return;
    updateChild(childId, (c) => {
      c.missions.push({
        id: uid(),
        emoji: newMission.emoji || "⭐",
        label: newMission.label.trim(),
        points: Math.max(1, Number(newMission.points) || 5),
        schoolOnly: !!newMission.schoolOnly,
        homeOnly: !!newMission.homeOnly,
        repeatable: !!newMission.repeatable,
      });
    });
    setNewMission({ emoji: "⭐", label: "", points: 5, schoolOnly: false, homeOnly: false, repeatable: false });
  };

  const removeMission = (childId, missionId) =>
    updateChild(childId, (c) => {
      c.missions = c.missions.filter((m) => m.id !== missionId);
      delete c.completedToday[missionId];
    });

  const addReward = (childId) => {
    if (!newReward.label.trim()) return;
    updateChild(childId, (c) => {
      c.rewards.push({
        id: uid(),
        emoji: newReward.emoji || "🎁",
        label: newReward.label.trim(),
        cost: Math.max(1, Number(newReward.cost) || 50),
      });
    });
    setNewReward({ emoji: "🎁", label: "", cost: 50 });
  };

  const removeReward = (childId, rewardId) =>
    updateChild(childId, (c) => {
      c.rewards = c.rewards.filter((r) => r.id !== rewardId);
    });

  const addChild = () => {
    if (!newChild.name.trim()) return;
    update((d) => {
      d.children.push({
        id: uid(),
        name: newChild.name.trim(),
        avatar: newChild.avatar,
        points: 0,
        totalPoints: 0,
        completedToday: {},
        missions: [],
        rewards: [],
        penalties: [],
        penaltiesToday: [],
        history: [],
      });
      return d;
    });
    setNewChild({ name: "", avatar: "🐰" });
  };

  const removeChild = (childId) => {
    update((d) => {
      d.children = d.children.filter((c) => c.id !== childId);
      return d;
    });
    setActiveChildId((prev) => (prev === childId ? null : prev));
  };

  /* ---------- Weergave ---------- */
  if (loadError)
    return (
      <Shell>
        <div className="card center-card">
          <div style={{ fontSize: 44 }}>🛰️</div>
          <p>De gegevens konden niet geladen worden. Controleer de verbinding en probeer opnieuw.</p>
          <button className="btn btn-primary" onClick={load}>Opnieuw proberen</button>
        </div>
      </Shell>
    );

  if (!data)
    return (
      <Shell>
        <div className="loading">
          <div className="loading-rocket">🚀</div>
          <p>De raket wordt klaargemaakt…</p>
        </div>
      </Shell>
    );

  const activeChild = data.children.find((c) => c.id === activeChildId) || data.children[0];

  return (
    <Shell>
      {/* Kop */}
      <header className="topbar">
        <h1>
          Familie<span className="accent">missies</span>
        </h1>
        <button
          className="gear"
          aria-label={parentMode ? "Oudermodus verlaten" : "Oudermodus"}
          onClick={() => {
            if (parentMode) {
              setParentMode(false);
            } else {
              setPinValue("");
              setPinError(false);
              setPinOpen(true);
            }
          }}
        >
          {parentMode ? "✖" : "⚙️"}
        </button>
      </header>

      {/* Kindkeuze */}
      <div className="child-tabs" role="tablist">
        {data.children.map((c) => (
          <button
            key={c.id}
            role="tab"
            aria-selected={activeChild && c.id === activeChild.id}
            className={"child-tab" + (activeChild && c.id === activeChild.id ? " active" : "")}
            onClick={() => setActiveChildId(c.id)}
          >
            <span className="child-avatar">{c.avatar}</span>
            <span className="child-name">{c.name}</span>
            <span className="child-pts">⭐ {c.points}</span>
          </button>
        ))}
      </div>

      {parentMode ? (
        <ParentPanel
          data={data}
          activeChild={activeChild}
          adjustPoints={adjustPoints}
          addMission={addMission}
          removeMission={removeMission}
          addReward={addReward}
          removeReward={removeReward}
          applyPenalty={applyPenalty}
          undoPenalty={undoPenalty}
          addPenalty={addPenalty}
          removePenalty={removePenalty}
          addChild={addChild}
          removeChild={removeChild}
          newMission={newMission}
          setNewMission={setNewMission}
          newReward={newReward}
          setNewReward={setNewReward}
          newPenalty={newPenalty}
          setNewPenalty={setNewPenalty}
          newChild={newChild}
          setNewChild={setNewChild}
        />
      ) : activeChild ? (
        <ChildView
          child={activeChild}
          toggleMission={toggleMission}
          incMission={incMission}
          decMission={decMission}
          redeemReward={redeemReward}
          applyPenalty={applyPenalty}
        />
      ) : (
        <div className="card center-card">
          <div style={{ fontSize: 44 }}>👨‍🚀</div>
          <p>Voeg een kind toe in de oudermodus om het avontuur te starten.</p>
        </div>
      )}

      {/* Toetsenblok oudercode */}
      {pinOpen && (
        <div className="pin-overlay">
          <div className={"pin-box" + (pinError ? " shake" : "")}>
            <h2>Oudercode 🔒</h2>
            <div className="pin-dots" aria-label={`${pinValue.length} cijfers ingevoerd`}>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <span key={i} className={"pin-dot" + (i < pinValue.length ? " filled" : "")} />
              ))}
            </div>
            {pinError && <p className="pin-error">Verkeerde code, probeer opnieuw.</p>}
            <div className="pin-pad">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "✖"].map((k) => (
                <button
                  key={k}
                  className={"pin-key" + (k === "✖" ? " pin-cancel" : "")}
                  onClick={() => {
                    if (k === "✖") {
                      setPinOpen(false);
                      return;
                    }
                    if (k === "⌫") {
                      setPinValue((v) => v.slice(0, -1));
                      setPinError(false);
                      return;
                    }
                    const next = (pinValue + k).slice(0, 6);
                    setPinValue(next);
                    if (next.length === 6) {
                      if (next === PARENT_PIN) {
                        setPinOpen(false);
                        setParentMode(true);
                      } else {
                        setPinError(true);
                        setTimeout(() => setPinValue(""), 350);
                      }
                    }
                  }}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Lanceeranimatie */}
      {takeoff && (
        <div className="takeoff-overlay" onClick={() => setTakeoff(null)}>
          <div className="takeoff-rocket">🚀</div>
          <div className="takeoff-msg">
            <div className="takeoff-emoji">{takeoff.reward.emoji}</div>
            <h2>Goed gedaan {takeoff.childName}!</h2>
            <p>Beloning vrijgespeeld: {takeoff.reward.label}</p>
          </div>
          <div className="takeoff-stars">
            {"✦✧⭐✦✧⭐✦✧".split("").map((s, i) => (
              <span key={i} style={{ animationDelay: `${i * 0.15}s` }}>{s}</span>
            ))}
          </div>
        </div>
      )}
    </Shell>
  );
}

/* ============================================================
   Kindweergave : raket, missies van vandaag, winkel, geschiedenis
   ============================================================ */
function ChildView({ child, toggleMission, incMission, decMission, redeemReward, applyPenalty }) {
  const school = isSchoolDay();
  const isVisible = (m) => (!m.schoolOnly || school) && (!m.homeOnly || !school);
  const todaysMissions = child.missions.filter(isVisible);
  const doneCount = todaysMissions.filter((m) =>
    m.repeatable ? (Number(child.completedToday[m.id]) || 0) > 0 : !!child.completedToday[m.id]
  ).length;

  // Raketdoel : de goedkoopste beloning
  const target = child.rewards.length
    ? [...child.rewards].sort((a, b) => a.cost - b.cost)[0]
    : null;
  const progress = target ? Math.min(1, child.points / target.cost) : 0;

  return (
    <div className="child-view">
      {/* Voortgangsraket */}
      <section className="card rocket-card">
        <div className="rocket-track">
          <div className="rocket-goal">{target ? target.emoji : "🪐"}</div>
          <div className="rocket-line">
            <div className="rocket-fill" style={{ height: `${progress * 100}%` }} />
            <div className="rocket-ship" style={{ bottom: `calc(${progress * 100}% - 14px)` }}>🚀</div>
          </div>
        </div>
        <div className="rocket-info">
          <div className="pts-big">
            ⭐ {child.points}
            <span className="pts-label">punten</span>
          </div>
          {target ? (
            progress >= 1 ? (
              <p className="rocket-text ready">Klaar om te lanceren! Ga naar de winkel 🎉</p>
            ) : (
              <p className="rocket-text">
                Nog <strong>{target.cost - child.points}</strong> punten tot{" "}
                <strong>{target.emoji} {target.label}</strong>
              </p>
            )
          ) : (
            <p className="rocket-text">Nog geen beloningen.</p>
          )}
          <p className="total-line">Totaal verdiend sinds het begin: 🏆 {child.totalPoints}</p>
        </div>
      </section>

      {/* Missies van vandaag */}
      <section>
        <h2 className="section-title">
          Missies van vandaag
          <span className="section-count">{doneCount}/{todaysMissions.length}</span>
        </h2>
        {todaysMissions.length === 0 && (
          <div className="card center-card"><p>Geen missies vandaag. Rust maar uit, astronaut! 🛌</p></div>
        )}
        <div className="mission-grid">
          {todaysMissions.map((m) => {
            if (m.repeatable) {
              const count = Number(child.completedToday[m.id]) || 0;
              return (
                <div key={m.id} className={"mission-card repeat" + (count > 0 ? " done" : "")}>
                  <button
                    className="mission-main"
                    onClick={() => incMission(child.id, m)}
                    aria-label={`${m.label} — nog een keer`}
                  >
                    <span className="mission-emoji">{m.emoji}</span>
                    <span className="mission-label">{m.label}</span>
                    <span className="mission-pts">+{m.points} ⭐ per keer</span>
                  </button>
                  <div className="repeat-controls">
                    <button
                      className="repeat-btn"
                      onClick={() => decMission(child.id, m)}
                      disabled={count === 0}
                      aria-label="Eén minder"
                    >
                      −
                    </button>
                    <span className="repeat-count" aria-label={`${count} keer gedaan`}>×{count}</span>
                    <button
                      className="repeat-btn plus"
                      onClick={() => incMission(child.id, m)}
                      aria-label="Eén meer"
                    >
                      +
                    </button>
                  </div>
                  <span className="mission-tag repeat-tag">meerdere keren</span>
                </div>
              );
            }
            const done = !!child.completedToday[m.id];
            return (
              <button
                key={m.id}
                className={"mission-card" + (done ? " done" : "")}
                onClick={() => toggleMission(child.id, m)}
                aria-pressed={done}
              >
                <span className="mission-emoji">{done ? "✅" : m.emoji}</span>
                <span className="mission-label">{m.label}</span>
                <span className="mission-pts">{done ? "Gelukt!" : `+${m.points} ⭐`}</span>
                {m.schoolOnly && <span className="mission-tag">school</span>}
                {m.homeOnly && <span className="mission-tag home-tag">thuis</span>}
              </button>
            );
          })}
        </div>
      </section>

      {/* Ik geef mezelf minpunten */}
      {child.penalties && child.penalties.length > 0 && (
        <section>
          <h2 className="section-title">Oeps, ik geef mezelf minpunten</h2>
          <div className="penalty-grid">
            {child.penalties.map((p) => (
              <button
                key={p.id}
                className="penalty-btn"
                onClick={() => applyPenalty(child.id, p)}
                aria-label={`${p.label} — ${p.points} punten eraf`}
              >
                <span className="penalty-emoji">{p.emoji}</span>
                <span className="penalty-label">{p.label}</span>
                <span className="penalty-pts">−{p.points} ⭐</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Minpunten van vandaag */}
      {child.penaltiesToday && child.penaltiesToday.length > 0 && (
        <section>
          <h2 className="section-title">Oeps van vandaag</h2>
          <div className="card oops-card">
            {child.penaltiesToday.map((p) => (
              <div key={p.id} className="history-row">
                <span>{p.emoji} {p.label}</span>
                <span className="oops-pts">−{p.points} ⭐</span>
              </div>
            ))}
            <p className="oops-note">Morgen is een nieuwe dag om weer sterren te verdienen! 💪</p>
          </div>
        </section>
      )}

      {/* Winkel */}
      <section>
        <h2 className="section-title">Beloningswinkel</h2>
        <div className="reward-list">
          {child.rewards.map((r) => {
            const ok = child.points >= r.cost;
            return (
              <div key={r.id} className="reward-row card">
                <span className="reward-emoji">{r.emoji}</span>
                <div className="reward-main">
                  <span className="reward-label">{r.label}</span>
                  <span className="reward-cost">⭐ {r.cost} punten</span>
                </div>
                <button
                  className={"btn " + (ok ? "btn-primary" : "btn-disabled")}
                  disabled={!ok}
                  onClick={() => redeemReward(child, r)}
                >
                  {ok ? "Lanceren 🚀" : `Nog ${r.cost - child.points}`}
                </button>
              </div>
            );
          })}
          {child.rewards.length === 0 && (
            <div className="card center-card"><p>De winkel is nog leeg.</p></div>
          )}
        </div>
      </section>

      {/* Geschiedenis */}
      {child.history.length > 0 && (
        <section>
          <h2 className="section-title">Verdiende beloningen</h2>
          <div className="card history-card">
            {child.history.slice(0, 6).map((h, i) => (
              <div key={i} className="history-row">
                <span>{h.emoji} {h.label}</span>
                <span className="history-date">{nlDate(h.date)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* ============================================================
   Oudermodus
   ============================================================ */
function ParentPanel(props) {
  const {
    data, activeChild, adjustPoints, addMission, removeMission, addReward, removeReward,
    applyPenalty, undoPenalty, addPenalty, removePenalty,
    addChild, removeChild, newMission, setNewMission, newReward, setNewReward,
    newPenalty, setNewPenalty, newChild, setNewChild,
  } = props;

  const missionTags = (m) => {
    const t = [];
    if (m.schoolOnly) t.push("school");
    if (m.homeOnly) t.push("buiten school");
    if (m.repeatable) t.push("meerdere keren/dag");
    return t.length ? " · " + t.join(" · ") : "";
  };

  return (
    <div className="parent-panel">
      <div className="card parent-banner">
        <span>🛠️ Oudermodus — gekozen kind: <strong>{activeChild ? `${activeChild.avatar} ${activeChild.name}` : "geen"}</strong></span>
      </div>

      {activeChild && (
        <>
          {/* Punten aanpassen */}
          <section className="card">
            <h3>Punten van {activeChild.name}: ⭐ {activeChild.points}</h3>
            <div className="row">
              {[-10, -5, +5, +10].map((d) => (
                <button key={d} className="btn btn-ghost" onClick={() => adjustPoints(activeChild.id, d)}>
                  {d > 0 ? `+${d}` : d}
                </button>
              ))}
            </div>
          </section>

          {/* Missies */}
          <section className="card">
            <h3>Missies van {activeChild.name}</h3>
            {activeChild.missions.map((m) => (
              <div key={m.id} className="edit-row">
                <span>{m.emoji} {m.label} — {m.points} ptn{missionTags(m)}</span>
                <button className="btn btn-danger" onClick={() => removeMission(activeChild.id, m.id)}>Verwijderen</button>
              </div>
            ))}
            <div className="add-block">
              <div className="row">
                <input
                  className="input input-emoji"
                  value={newMission.emoji}
                  maxLength={4}
                  onChange={(e) => setNewMission({ ...newMission, emoji: e.target.value })}
                  aria-label="Emoji van de missie"
                />
                <input
                  className="input grow"
                  placeholder="Nieuwe missie…"
                  value={newMission.label}
                  onChange={(e) => setNewMission({ ...newMission, label: e.target.value })}
                />
              </div>
              <div className="row">
                <label className="inline-label">
                  Punten
                  <input
                    className="input input-num"
                    type="number"
                    min="1"
                    value={newMission.points}
                    onChange={(e) => setNewMission({ ...newMission, points: e.target.value })}
                  />
                </label>
                <button className="btn btn-primary" onClick={() => addMission(activeChild.id)}>Toevoegen</button>
              </div>
              <div className="row">
                <label className="inline-label check">
                  <input
                    type="checkbox"
                    checked={newMission.schoolOnly}
                    onChange={(e) => setNewMission({ ...newMission, schoolOnly: e.target.checked, homeOnly: e.target.checked ? false : newMission.homeOnly })}
                  />
                  Alleen op schooldagen
                </label>
                <label className="inline-label check">
                  <input
                    type="checkbox"
                    checked={newMission.homeOnly}
                    onChange={(e) => setNewMission({ ...newMission, homeOnly: e.target.checked, schoolOnly: e.target.checked ? false : newMission.schoolOnly })}
                  />
                  Alleen buiten school
                </label>
                <label className="inline-label check">
                  <input
                    type="checkbox"
                    checked={newMission.repeatable}
                    onChange={(e) => setNewMission({ ...newMission, repeatable: e.target.checked })}
                  />
                  Meerdere keren per dag
                </label>
              </div>
            </div>
          </section>

          {/* Beloningen */}
          <section className="card">
            <h3>Beloningen van {activeChild.name}</h3>
            {activeChild.rewards.map((r) => (
              <div key={r.id} className="edit-row">
                <span>{r.emoji} {r.label} — {r.cost} ptn</span>
                <button className="btn btn-danger" onClick={() => removeReward(activeChild.id, r.id)}>Verwijderen</button>
              </div>
            ))}
            <div className="add-block">
              <div className="row">
                <input
                  className="input input-emoji"
                  value={newReward.emoji}
                  maxLength={4}
                  onChange={(e) => setNewReward({ ...newReward, emoji: e.target.value })}
                  aria-label="Emoji van de beloning"
                />
                <input
                  className="input grow"
                  placeholder="Nieuwe beloning…"
                  value={newReward.label}
                  onChange={(e) => setNewReward({ ...newReward, label: e.target.value })}
                />
              </div>
              <div className="row">
                <label className="inline-label">
                  Kosten
                  <input
                    className="input input-num"
                    type="number"
                    min="1"
                    value={newReward.cost}
                    onChange={(e) => setNewReward({ ...newReward, cost: e.target.value })}
                  />
                </label>
                <button className="btn btn-primary" onClick={() => addReward(activeChild.id)}>Toevoegen</button>
              </div>
            </div>
          </section>

          {/* Minpunten */}
          <section className="card penalty-card">
            <h3>Minpunten van {activeChild.name}</h3>
            <p className="penalty-hint">
              Eén tik haalt de punten eraf. De kinderen kunnen zichzelf ook minpunten geven vanuit hun
              eigen scherm. Gebruik met mate — geslaagde missies blijven de belangrijkste motor!
            </p>
            <div className="penalty-grid">
              {activeChild.penalties.map((p) => (
                <button key={p.id} className="penalty-btn" onClick={() => applyPenalty(activeChild.id, p)}>
                  <span className="penalty-emoji">{p.emoji}</span>
                  <span className="penalty-label">{p.label}</span>
                  <span className="penalty-pts">−{p.points} ⭐</span>
                </button>
              ))}
            </div>
            {activeChild.penaltiesToday.length > 0 && (
              <div className="penalty-applied">
                <h4>Vandaag toegepast</h4>
                {activeChild.penaltiesToday.map((p) => (
                  <div key={p.id} className="edit-row">
                    <span>{p.emoji} {p.label} — −{p.points} ptn</span>
                    <button className="btn btn-ghost" onClick={() => undoPenalty(activeChild.id, p.id)}>Ongedaan maken</button>
                  </div>
                ))}
              </div>
            )}
            <div className="add-block">
              <div className="row">
                <input
                  className="input input-emoji"
                  value={newPenalty.emoji}
                  maxLength={4}
                  onChange={(e) => setNewPenalty({ ...newPenalty, emoji: e.target.value })}
                  aria-label="Emoji van het minpunt"
                />
                <input
                  className="input grow"
                  placeholder="Nieuw minpunt…"
                  value={newPenalty.label}
                  onChange={(e) => setNewPenalty({ ...newPenalty, label: e.target.value })}
                />
              </div>
              <div className="row">
                <label className="inline-label">
                  Punten eraf
                  <input
                    className="input input-num"
                    type="number"
                    min="1"
                    value={newPenalty.points}
                    onChange={(e) => setNewPenalty({ ...newPenalty, points: e.target.value })}
                  />
                </label>
                <button className="btn btn-primary" onClick={() => addPenalty(activeChild.id)}>Toevoegen</button>
              </div>
              {activeChild.penalties.length > 0 && (
                <details className="penalty-manage">
                  <summary>Lijst beheren</summary>
                  {activeChild.penalties.map((p) => (
                    <div key={p.id} className="edit-row">
                      <span>{p.emoji} {p.label} — −{p.points} ptn</span>
                      <button className="btn btn-danger" onClick={() => removePenalty(activeChild.id, p.id)}>Verwijderen</button>
                    </div>
                  ))}
                </details>
              )}
            </div>
          </section>
        </>
      )}

      {/* Beheer van de kinderen */}
      <section className="card">
        <h3>Kinderen</h3>
        {data.children.map((c) => (
          <div key={c.id} className="edit-row">
            <span>{c.avatar} {c.name} — ⭐ {c.points} (totaal {c.totalPoints})</span>
            <button className="btn btn-danger" onClick={() => removeChild(c.id)}>Verwijderen</button>
          </div>
        ))}
        <div className="add-block">
          <div className="row">
            <input
              className="input grow"
              placeholder="Voornaam…"
              value={newChild.name}
              onChange={(e) => setNewChild({ ...newChild, name: e.target.value })}
            />
            <button className="btn btn-primary" onClick={addChild}>Toevoegen</button>
          </div>
          <div className="row avatar-row">
            {AVATARS.map((a) => (
              <button
                key={a}
                className={"avatar-pick" + (newChild.avatar === a ? " picked" : "")}
                onClick={() => setNewChild({ ...newChild, avatar: a })}
                aria-label={`Kies avatar ${a}`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>
      </section>

      <p className="parent-note">
        ℹ️ De missies worden elke dag opnieuw ingesteld; de punten blijven behouden. De missies met
        « school » verschijnen alleen van maandag tot vrijdag, die met « buiten school » alleen in het
        weekend en de vakantie. Missies « meerdere keren per dag » kunnen vaker afgevinkt worden. De
        gegevens worden gedeeld tussen alle toestellen die de gepubliceerde link gebruiken — houd hem privé.
      </p>
    </div>
  );
}

/* ============================================================
   Globale omhulling + stijlen
   ============================================================ */
function Shell({ children }) {
  return (
    <div className="app">
      <style>{CSS}</style>
      <div className="stars" aria-hidden="true" />
      <div className="content">{children}</div>
    </div>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&display=swap');

* { box-sizing: border-box; margin: 0; padding: 0; }

.app {
  min-height: 100vh;
  font-family: 'Fredoka', 'Comic Sans MS', sans-serif;
  background: linear-gradient(180deg, #171738 0%, #24246B 55%, #3A2E7E 100%);
  color: #FFFFFF;
  position: relative;
  overflow-x: hidden;
}

/* Sterrenhemel */
.stars {
  position: fixed; inset: 0; pointer-events: none; opacity: .8;
  background-image:
    radial-gradient(1.5px 1.5px at 20% 30%, #FFD166 50%, transparent 51%),
    radial-gradient(1px 1px at 70% 15%, #fff 50%, transparent 51%),
    radial-gradient(1.5px 1.5px at 85% 45%, #fff 50%, transparent 51%),
    radial-gradient(1px 1px at 40% 70%, #FFD166 50%, transparent 51%),
    radial-gradient(1.5px 1.5px at 10% 85%, #fff 50%, transparent 51%),
    radial-gradient(1px 1px at 60% 90%, #fff 50%, transparent 51%),
    radial-gradient(1px 1px at 90% 75%, #FFD166 50%, transparent 51%),
    radial-gradient(1.2px 1.2px at 30% 10%, #fff 50%, transparent 51%);
}

.content { position: relative; max-width: 760px; margin: 0 auto; padding: 16px 16px 48px; }

/* Kop */
.topbar { display: flex; align-items: center; justify-content: space-between; padding: 8px 4px 16px; }
.topbar h1 { font-size: clamp(24px, 5vw, 34px); font-weight: 700; letter-spacing: .5px; }
.topbar .accent { color: #FFD166; }
.gear {
  background: rgba(255,255,255,.12); border: none; border-radius: 50%;
  width: 46px; height: 46px; font-size: 20px; cursor: pointer; color: #fff;
}
.gear:focus-visible, .btn:focus-visible, .child-tab:focus-visible, .mission-card:focus-visible, .mission-main:focus-visible, .repeat-btn:focus-visible, .avatar-pick:focus-visible, .penalty-btn:focus-visible {
  outline: 3px solid #FFD166; outline-offset: 2px;
}

/* Kindtabs */
.child-tabs { display: flex; gap: 10px; margin-bottom: 18px; flex-wrap: wrap; }
.child-tab {
  flex: 1; min-width: 130px; display: flex; align-items: center; gap: 8px; justify-content: center;
  background: rgba(255,255,255,.10); border: 2px solid transparent; border-radius: 18px;
  padding: 10px 14px; cursor: pointer; color: #fff; font-family: inherit; font-size: 16px;
  transition: transform .15s ease, background .15s ease;
}
.child-tab.active { background: #FFFFFF; color: #2B2B4A; border-color: #FFD166; transform: scale(1.03); }
.child-avatar { font-size: 24px; }
.child-name { font-weight: 600; }
.child-pts { font-size: 13px; opacity: .85; }

/* Algemene kaarten */
.card {
  background: #FFFFFF; color: #2B2B4A; border-radius: 22px; padding: 16px 18px;
  box-shadow: 0 6px 20px rgba(0,0,0,.20);
}
.center-card { text-align: center; display: grid; gap: 10px; justify-items: center; }

/* Raket */
.rocket-card { display: flex; gap: 18px; align-items: stretch; margin-bottom: 22px; }
.rocket-track { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.rocket-goal { font-size: 26px; }
.rocket-line {
  position: relative; width: 14px; flex: 1; min-height: 130px;
  background: #E8E6F5; border-radius: 10px; overflow: visible;
}
.rocket-fill {
  position: absolute; bottom: 0; left: 0; right: 0;
  background: linear-gradient(180deg, #FFD166, #FF6B6B); border-radius: 10px;
  transition: height .5s ease;
}
.rocket-ship {
  position: absolute; left: 50%; transform: translateX(-50%) rotate(-45deg);
  font-size: 26px; transition: bottom .5s ease;
}
.rocket-info { flex: 1; display: grid; gap: 8px; align-content: center; }
.pts-big { font-size: 38px; font-weight: 700; color: #2B2B4A; display: flex; align-items: baseline; gap: 8px; }
.pts-label { font-size: 15px; font-weight: 500; color: #7A7794; }
.rocket-text { font-size: 16px; color: #4A4766; }
.rocket-text.ready { color: #1FA97C; font-weight: 600; }
.total-line { font-size: 13px; color: #8A87A6; }

/* Secties */
.section-title {
  font-size: 20px; font-weight: 700; margin: 6px 4px 12px;
  display: flex; align-items: center; gap: 10px;
}
.section-count {
  font-size: 13px; font-weight: 600; background: rgba(255,255,255,.15);
  border-radius: 999px; padding: 3px 10px;
}

/* Missies */
.mission-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; margin-bottom: 24px; }
.mission-card {
  position: relative; background: #FFFFFF; color: #2B2B4A; border: 3px solid transparent;
  border-radius: 20px; padding: 16px 12px; cursor: pointer; font-family: inherit;
  display: grid; gap: 6px; justify-items: center; text-align: center;
  box-shadow: 0 6px 16px rgba(0,0,0,.18);
  transition: transform .15s ease, background .2s ease, border-color .2s ease;
}
.mission-card:active { transform: scale(.96); }
.mission-card.done { background: #E4FBF2; border-color: #3EDBB6; }
.mission-emoji { font-size: 34px; }
.mission-card.done .mission-emoji { animation: pop .4s ease; }
.mission-label { font-size: 15px; font-weight: 600; line-height: 1.2; }
.mission-pts { font-size: 13px; font-weight: 600; color: #FF6B6B; }
.mission-card.done .mission-pts { color: #1FA97C; }
.mission-tag {
  position: absolute; top: 8px; right: 10px; font-size: 10px; font-weight: 600;
  background: #EEE9FF; color: #6C63FF; border-radius: 999px; padding: 2px 8px;
}
.mission-tag.home-tag { background: #FFF1E0; color: #E08A00; }
.mission-tag.repeat-tag { position: static; margin-top: 2px; background: #E4FBF2; color: #1FA97C; }
@keyframes pop { 0% { transform: scale(.4); } 60% { transform: scale(1.25); } 100% { transform: scale(1); } }

/* Herhaalbare missie */
.mission-card.repeat { cursor: default; padding-top: 14px; }
.mission-main {
  background: transparent; border: none; font-family: inherit; color: inherit;
  cursor: pointer; display: grid; gap: 6px; justify-items: center; text-align: center; width: 100%;
}
.mission-main:active { transform: scale(.96); }
.repeat-controls { display: flex; align-items: center; gap: 12px; margin-top: 4px; }
.repeat-btn {
  font-family: inherit; font-size: 22px; font-weight: 700; line-height: 1;
  width: 38px; height: 38px; border-radius: 50%; border: none; cursor: pointer;
  background: #EEE9FF; color: #4A3FBF; transition: transform .12s ease;
}
.repeat-btn.plus { background: #FF6B6B; color: #fff; }
.repeat-btn:active { transform: scale(.9); }
.repeat-btn:disabled { background: #E8E6F5; color: #B7B4CC; cursor: not-allowed; }
.repeat-count { font-size: 20px; font-weight: 700; min-width: 40px; color: #2B2B4A; }

/* Winkel */
.reward-list { display: grid; gap: 10px; margin-bottom: 24px; }
.reward-row { display: flex; align-items: center; gap: 12px; }
.reward-emoji { font-size: 30px; }
.reward-main { flex: 1; display: grid; }
.reward-label { font-weight: 600; }
.reward-cost { font-size: 13px; color: #7A7794; }

/* Knoppen */
.btn {
  font-family: inherit; font-size: 15px; font-weight: 600; border: none;
  border-radius: 14px; padding: 10px 16px; cursor: pointer; transition: transform .12s ease;
}
.btn:active { transform: scale(.95); }
.btn-primary { background: #FF6B6B; color: #fff; }
.btn-ghost { background: #EEE9FF; color: #4A3FBF; }
.btn-danger { background: #FFE3E3; color: #C0392B; font-size: 13px; padding: 6px 12px; }
.btn-disabled { background: #E8E6F5; color: #9A97B5; cursor: not-allowed; }

/* Geschiedenis */
.history-card { display: grid; gap: 8px; }
.history-row { display: flex; justify-content: space-between; font-size: 15px; }
.history-date { color: #8A87A6; font-size: 13px; }

/* Oudermodus */
.parent-panel { display: grid; gap: 14px; }
.parent-banner { background: #FFF6DE; }
.parent-panel h3 { font-size: 17px; margin-bottom: 10px; }
.edit-row {
  display: flex; justify-content: space-between; align-items: center; gap: 10px;
  padding: 8px 0; border-bottom: 1px dashed #E4E1F2; font-size: 15px;
}
.add-block { margin-top: 12px; display: grid; gap: 8px; }
.row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.grow { flex: 1; }
.input {
  font-family: inherit; font-size: 15px; padding: 9px 12px;
  border: 2px solid #E4E1F2; border-radius: 12px; min-width: 0;
}
.input:focus { outline: none; border-color: #6C63FF; }
.input-emoji { width: 58px; text-align: center; }
.input-num { width: 74px; }
.inline-label { display: flex; align-items: center; gap: 6px; font-size: 14px; color: #4A4766; }
.inline-label.check { gap: 8px; }
.avatar-row { margin-top: 4px; }
.avatar-pick {
  font-size: 24px; background: #F2F0FA; border: 2px solid transparent;
  border-radius: 12px; padding: 6px 10px; cursor: pointer;
}
.avatar-pick.picked { border-color: #6C63FF; background: #EEE9FF; }
.parent-note { font-size: 13px; opacity: .8; line-height: 1.5; padding: 0 6px; }

/* Laden */
.loading { display: grid; justify-items: center; gap: 12px; padding: 80px 0; font-size: 17px; }
.loading-rocket { font-size: 52px; animation: hover 1.2s ease-in-out infinite alternate; }
@keyframes hover { from { transform: translateY(0) rotate(-45deg); } to { transform: translateY(-12px) rotate(-45deg); } }

/* Lancering */
.takeoff-overlay {
  position: fixed; inset: 0; z-index: 50; display: grid; place-items: center;
  background: rgba(17, 17, 46, .92); animation: fadein .3s ease;
}
.takeoff-rocket {
  position: absolute; bottom: -80px; left: 50%; font-size: 74px;
  transform: translateX(-50%) rotate(-45deg);
  animation: launch 2.6s cubic-bezier(.45,.05,.55,1) forwards;
}
.takeoff-msg { text-align: center; display: grid; gap: 8px; padding: 0 24px; animation: fadein .6s ease .4s both; }
.takeoff-emoji { font-size: 56px; }
.takeoff-msg h2 { font-size: 30px; color: #FFD166; }
.takeoff-msg p { font-size: 18px; }
.takeoff-stars { position: absolute; inset: 0; pointer-events: none; }
.takeoff-stars span {
  position: absolute; font-size: 20px; color: #FFD166; opacity: 0;
  animation: twinkle 1.6s ease infinite;
}
.takeoff-stars span:nth-child(1) { top: 15%; left: 12%; }
.takeoff-stars span:nth-child(2) { top: 25%; left: 80%; }
.takeoff-stars span:nth-child(3) { top: 60%; left: 8%; }
.takeoff-stars span:nth-child(4) { top: 72%; left: 85%; }
.takeoff-stars span:nth-child(5) { top: 8%;  left: 50%; }
.takeoff-stars span:nth-child(6) { top: 85%; left: 40%; }
.takeoff-stars span:nth-child(7) { top: 40%; left: 92%; }
.takeoff-stars span:nth-child(8) { top: 50%; left: 20%; }
@keyframes launch {
  0% { bottom: -80px; }
  100% { bottom: 110%; }
}
@keyframes twinkle { 0%, 100% { opacity: 0; transform: scale(.6); } 50% { opacity: 1; transform: scale(1.2); } }
@keyframes fadein { from { opacity: 0; } to { opacity: 1; } }

/* Minpunten */
.penalty-card { border: 2px solid #FFD9D9; }
.penalty-hint { font-size: 13px; color: #8A87A6; margin-bottom: 10px; line-height: 1.4; }
.penalty-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; margin-bottom: 24px; }
.penalty-btn {
  font-family: inherit; background: #FFF1F1; border: 2px solid #FFD9D9; border-radius: 16px;
  padding: 12px 10px; cursor: pointer; display: grid; gap: 4px; justify-items: center;
  text-align: center; color: #2B2B4A; transition: transform .12s ease;
}
.penalty-btn:active { transform: scale(.95); background: #FFE3E3; }
.penalty-emoji { font-size: 26px; }
.penalty-label { font-size: 13px; font-weight: 600; line-height: 1.2; }
.penalty-pts { font-size: 13px; font-weight: 700; color: #C0392B; }
.penalty-applied { margin-top: 10px; }
.penalty-applied h4 { font-size: 14px; color: #4A4766; margin-bottom: 4px; }
.penalty-manage summary { cursor: pointer; font-size: 14px; color: #6C63FF; font-weight: 600; padding: 4px 0; }
.penalty-card .penalty-grid { margin-bottom: 8px; }

/* Oeps-kaart (kindweergave) */
.oops-card { display: grid; gap: 8px; border: 2px solid #FFD9D9; margin-bottom: 24px; }
.oops-pts { color: #C0392B; font-weight: 700; }
.oops-note { font-size: 13px; color: #8A87A6; margin-top: 4px; }

/* Toetsenblok oudercode */
.pin-overlay {
  position: fixed; inset: 0; z-index: 60; display: grid; place-items: center;
  background: rgba(17, 17, 46, .88); animation: fadein .25s ease;
}
.pin-box {
  background: #FFFFFF; color: #2B2B4A; border-radius: 24px; padding: 24px 26px;
  display: grid; gap: 14px; justify-items: center; box-shadow: 0 10px 32px rgba(0,0,0,.35);
}
.pin-box h2 { font-size: 20px; }
.pin-dots { display: flex; gap: 10px; }
.pin-dot {
  width: 14px; height: 14px; border-radius: 50%;
  border: 2px solid #6C63FF; background: transparent; transition: background .15s ease;
}
.pin-dot.filled { background: #6C63FF; }
.pin-error { font-size: 13px; color: #C0392B; font-weight: 600; }
.pin-pad { display: grid; grid-template-columns: repeat(3, 64px); gap: 10px; }
.pin-key {
  font-family: inherit; font-size: 20px; font-weight: 600;
  background: #F2F0FA; color: #2B2B4A; border: none; border-radius: 16px;
  height: 56px; cursor: pointer; transition: transform .1s ease;
}
.pin-key:active { transform: scale(.92); background: #E4E1F2; }
.pin-cancel { background: #FFE3E3; color: #C0392B; font-size: 16px; }
.pin-box.shake { animation: shake .35s ease; }
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-8px); }
  50% { transform: translateX(8px); }
  75% { transform: translateX(-5px); }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; }
}

@media (max-width: 480px) {
  .rocket-card { flex-direction: row; }
  .pts-big { font-size: 30px; }
}
`;
