import { useState, useEffect, useCallback, useRef } from "react";

/* ============================================================
   MISSIONS EN FAMILLE — v1 personnalisée Romane & Théo
   Stockage partagé : clé "missions-famille-v1" (shared: true)
   ============================================================ */

const STORAGE_KEY = "missions-famille-v1";
const PARENT_PIN = "180586";
const AVATARS = ["🦊", "🐯", "🐰", "🐼", "🦁", "🐨", "🐸", "🦄", "🐙", "🐶"];

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// Date locale au format YYYY-MM-DD (fuseau de l'appareil)
const getToday = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

// Lundi (1) à vendredi (5) = jour d'école
const isSchoolDay = () => {
  const day = new Date().getDay();
  return day >= 1 && day <= 5;
};

const frDate = (iso) => {
  try {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}`;
  } catch {
    return iso;
  }
};

/* ---------- Données par défaut : Romane & Théo ---------- */
const defaultData = () => ({
  lastReset: getToday(),
  children: [
    {
      id: "romane",
      name: "Romane",
      avatar: "🦊",
      points: 0,
      totalPoints: 0,
      completedToday: {},
      missions: [
        { id: uid(), emoji: "🌙", label: "Aller me coucher sans discuter", points: 10, schoolOnly: false },
        { id: uid(), emoji: "🧸", label: "Ranger ma chambre", points: 10, schoolOnly: false },
        { id: uid(), emoji: "🍽️", label: "Participer à une tâche ménagère", points: 5, schoolOnly: false },
        { id: uid(), emoji: "🥪", label: "Sortir ma boîte à tartines", points: 5, schoolOnly: true },
      ],
      rewards: [
        { id: uid(), emoji: "📺", label: "+20 min de télé", cost: 120 },
        { id: uid(), emoji: "📖", label: "+10 min d'histoire au lit", cost: 60 },
        { id: uid(), emoji: "🎬", label: "Choisir le film du soir", cost: 80 },
      ],
      penalties: [
        { id: uid(), emoji: "🛏️", label: "Discussions au coucher", points: 5 },
        { id: uid(), emoji: "🌪️", label: "Chambre laissée en désordre", points: 5 },
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
        { id: uid(), emoji: "💛", label: "Être gentil avec Romane", points: 10, schoolOnly: false },
        { id: uid(), emoji: "👕", label: "Ranger mes vêtements", points: 10, schoolOnly: false },
        { id: uid(), emoji: "✏️", label: "Faire mes devoirs sans râler", points: 10, schoolOnly: true },
        { id: uid(), emoji: "🍽️", label: "Participer à une tâche ménagère", points: 5, schoolOnly: false },
        { id: uid(), emoji: "🥪", label: "Sortir ma boîte à tartines", points: 5, schoolOnly: true },
      ],
      rewards: [
        { id: uid(), emoji: "🎮", label: "+15 min de jeu", cost: 150 },
        { id: uid(), emoji: "🌙", label: "Me coucher 15 min après Romane", cost: 100 },
        { id: uid(), emoji: "🎬", label: "Choisir le film du soir", cost: 80 },
      ],
      penalties: [
        { id: uid(), emoji: "🙅", label: "Pas gentil avec Romane", points: 10 },
        { id: uid(), emoji: "😤", label: "A râlé pour les devoirs", points: 5 },
        { id: uid(), emoji: "👕", label: "Vêtements étalés", points: 5 },
      ],
      penaltiesToday: [],
      history: [],
    },
  ],
});

/* ---------- Remise à zéro quotidienne (les points restent) ---------- */
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

/* Migration : garantit les champs pénalités sur des données déjà enregistrées */
const normalizeData = (data) => {
  data.children.forEach((c) => {
    if (!Array.isArray(c.penalties)) c.penalties = [];
    if (!Array.isArray(c.penaltiesToday)) c.penaltiesToday = [];
  });
  return data;
};

/* ============================================================ */
export default function MissionsEnFamille() {
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [activeChildId, setActiveChildId] = useState(null);
  const [parentMode, setParentMode] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [pinValue, setPinValue] = useState("");
  const [pinError, setPinError] = useState(false);
  const [takeoff, setTakeoff] = useState(null); // { childName, reward }
  const [newMission, setNewMission] = useState({ emoji: "⭐", label: "", points: 5, schoolOnly: false });
  const [newReward, setNewReward] = useState({ emoji: "🎁", label: "", cost: 50 });
  const [newPenalty, setNewPenalty] = useState({ emoji: "⚠️", label: "", points: 5 });
  const [newChild, setNewChild] = useState({ name: "", avatar: "🐰" });
  const saveTimer = useRef(null);

  /* ---------- Chargement ---------- */
  const load = useCallback(async () => {
    try {
      let loaded = null;
      try {
        const res = await window.storage.get(STORAGE_KEY, true);
        if (res && res.value) loaded = JSON.parse(res.value);
      } catch {
        loaded = null; // clé absente : première utilisation
      }
      let d = normalizeData(loaded || defaultData());
      const { data: resetData } = applyDailyReset(d);
      setData(resetData);
      setActiveChildId((prev) => prev || (resetData.children[0] && resetData.children[0].id) || null);
      if (!loaded) persist(resetData);
      else if (resetData.lastReset !== d.lastReset) persist(resetData);
      setLoadError(false);
    } catch (e) {
      console.error("Erreur de chargement", e);
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /* ---------- Re-synchronisation quand l'app redevient visible ---------- */
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [load]);

  /* ---------- Sauvegarde (légèrement différée pour regrouper) ---------- */
  const persist = (d) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await window.storage.set(STORAGE_KEY, JSON.stringify(d), true);
      } catch (e) {
        console.error("Erreur de sauvegarde", e);
      }
    }, 300);
  };

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

  /* ---------- Actions enfant ---------- */
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

  /* ---------- Actions parents ---------- */
  const adjustPoints = (childId, delta) =>
    updateChild(childId, (c) => {
      c.points = Math.max(0, c.points + delta);
      if (delta > 0) c.totalPoints += delta;
    });

  /* Pénalités : appliquées par les parents, retirent des points du solde */
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
      });
    });
    setNewMission({ emoji: "⭐", label: "", points: 5, schoolOnly: false });
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

  /* ---------- Rendu ---------- */
  if (loadError)
    return (
      <Shell>
        <div className="card center-card">
          <div style={{ fontSize: 44 }}>🛰️</div>
          <p>Impossible de charger les données. Vérifie la connexion, puis réessaie.</p>
          <button className="btn btn-primary" onClick={load}>Réessayer</button>
        </div>
      </Shell>
    );

  if (!data)
    return (
      <Shell>
        <div className="loading">
          <div className="loading-rocket">🚀</div>
          <p>Préparation de la fusée…</p>
        </div>
      </Shell>
    );

  const activeChild = data.children.find((c) => c.id === activeChildId) || data.children[0];

  return (
    <Shell>
      {/* En-tête */}
      <header className="topbar">
        <h1>
          Missions <span className="accent">en famille</span>
        </h1>
        <button
          className="gear"
          aria-label={parentMode ? "Quitter le mode parents" : "Mode parents"}
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

      {/* Sélecteur d'enfant */}
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
        <ChildView child={activeChild} toggleMission={toggleMission} redeemReward={redeemReward} />
      ) : (
        <div className="card center-card">
          <div style={{ fontSize: 44 }}>👨‍🚀</div>
          <p>Ajoute un enfant dans le mode parents pour commencer l'aventure.</p>
        </div>
      )}

      {/* Clavier code parents */}
      {pinOpen && (
        <div className="pin-overlay">
          <div className={"pin-box" + (pinError ? " shake" : "")}>
            <h2>Code parents 🔒</h2>
            <div className="pin-dots" aria-label={`${pinValue.length} chiffres saisis`}>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <span key={i} className={"pin-dot" + (i < pinValue.length ? " filled" : "")} />
              ))}
            </div>
            {pinError && <p className="pin-error">Mauvais code, réessaie.</p>}
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

      {/* Animation de décollage */}
      {takeoff && (
        <div className="takeoff-overlay" onClick={() => setTakeoff(null)}>
          <div className="takeoff-rocket">🚀</div>
          <div className="takeoff-msg">
            <div className="takeoff-emoji">{takeoff.reward.emoji}</div>
            <h2>Bravo {takeoff.childName} !</h2>
            <p>Récompense débloquée : {takeoff.reward.label}</p>
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
   Vue enfant : fusée, missions du jour, boutique, historique
   ============================================================ */
function ChildView({ child, toggleMission, redeemReward }) {
  const school = isSchoolDay();
  const todaysMissions = child.missions.filter((m) => !m.schoolOnly || school);
  const doneCount = todaysMissions.filter((m) => child.completedToday[m.id]).length;

  // Objectif de la fusée : la récompense la moins chère
  const target = child.rewards.length
    ? [...child.rewards].sort((a, b) => a.cost - b.cost)[0]
    : null;
  const progress = target ? Math.min(1, child.points / target.cost) : 0;

  return (
    <div className="child-view">
      {/* Fusée de progression */}
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
            <span className="pts-label">points</span>
          </div>
          {target ? (
            progress >= 1 ? (
              <p className="rocket-text ready">Prêt à décoller ! Va dans la boutique 🎉</p>
            ) : (
              <p className="rocket-text">
                Encore <strong>{target.cost - child.points}</strong> points avant{" "}
                <strong>{target.emoji} {target.label}</strong>
              </p>
            )
          ) : (
            <p className="rocket-text">Aucune récompense pour l'instant.</p>
          )}
          <p className="total-line">Total gagné depuis le début : 🏆 {child.totalPoints}</p>
        </div>
      </section>

      {/* Missions du jour */}
      <section>
        <h2 className="section-title">
          Missions du jour
          <span className="section-count">{doneCount}/{todaysMissions.length}</span>
        </h2>
        {todaysMissions.length === 0 && (
          <div className="card center-card"><p>Pas de mission aujourd'hui. Repos, astronaute ! 🛌</p></div>
        )}
        <div className="mission-grid">
          {todaysMissions.map((m) => {
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
                <span className="mission-pts">{done ? "Gagné !" : `+${m.points} ⭐`}</span>
                {m.schoolOnly && <span className="mission-tag">école</span>}
              </button>
            );
          })}
        </div>
      </section>

      {/* Points négatifs du jour */}
      {child.penaltiesToday && child.penaltiesToday.length > 0 && (
        <section>
          <h2 className="section-title">Oups du jour</h2>
          <div className="card oops-card">
            {child.penaltiesToday.map((p) => (
              <div key={p.id} className="history-row">
                <span>{p.emoji} {p.label}</span>
                <span className="oops-pts">−{p.points} ⭐</span>
              </div>
            ))}
            <p className="oops-note">Demain est un nouveau jour pour regagner des étoiles ! 💪</p>
          </div>
        </section>
      )}

      {/* Boutique */}
      <section>
        <h2 className="section-title">Boutique de récompenses</h2>
        <div className="reward-list">
          {child.rewards.map((r) => {
            const ok = child.points >= r.cost;
            return (
              <div key={r.id} className="reward-row card">
                <span className="reward-emoji">{r.emoji}</span>
                <div className="reward-main">
                  <span className="reward-label">{r.label}</span>
                  <span className="reward-cost">⭐ {r.cost} points</span>
                </div>
                <button
                  className={"btn " + (ok ? "btn-primary" : "btn-disabled")}
                  disabled={!ok}
                  onClick={() => redeemReward(child, r)}
                >
                  {ok ? "Décoller 🚀" : `Encore ${r.cost - child.points}`}
                </button>
              </div>
            );
          })}
          {child.rewards.length === 0 && (
            <div className="card center-card"><p>La boutique est vide pour l'instant.</p></div>
          )}
        </div>
      </section>

      {/* Historique */}
      {child.history.length > 0 && (
        <section>
          <h2 className="section-title">Récompenses gagnées</h2>
          <div className="card history-card">
            {child.history.slice(0, 6).map((h, i) => (
              <div key={i} className="history-row">
                <span>{h.emoji} {h.label}</span>
                <span className="history-date">{frDate(h.date)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* ============================================================
   Mode parents
   ============================================================ */
function ParentPanel(props) {
  const {
    data, activeChild, adjustPoints, addMission, removeMission, addReward, removeReward,
    applyPenalty, undoPenalty, addPenalty, removePenalty,
    addChild, removeChild, newMission, setNewMission, newReward, setNewReward,
    newPenalty, setNewPenalty, newChild, setNewChild,
  } = props;

  return (
    <div className="parent-panel">
      <div className="card parent-banner">
        <span>🛠️ Mode parents — enfant sélectionné : <strong>{activeChild ? `${activeChild.avatar} ${activeChild.name}` : "aucun"}</strong></span>
      </div>

      {activeChild && (
        <>
          {/* Ajuster les points */}
          <section className="card">
            <h3>Points de {activeChild.name} : ⭐ {activeChild.points}</h3>
            <div className="row">
              {[-10, -5, +5, +10].map((d) => (
                <button key={d} className="btn btn-ghost" onClick={() => adjustPoints(activeChild.id, d)}>
                  {d > 0 ? `+${d}` : d}
                </button>
              ))}
            </div>
          </section>

          {/* Missions */}
          <section className="card">
            <h3>Missions de {activeChild.name}</h3>
            {activeChild.missions.map((m) => (
              <div key={m.id} className="edit-row">
                <span>{m.emoji} {m.label} — {m.points} pts{m.schoolOnly ? " · école" : ""}</span>
                <button className="btn btn-danger" onClick={() => removeMission(activeChild.id, m.id)}>Retirer</button>
              </div>
            ))}
            <div className="add-block">
              <div className="row">
                <input
                  className="input input-emoji"
                  value={newMission.emoji}
                  maxLength={4}
                  onChange={(e) => setNewMission({ ...newMission, emoji: e.target.value })}
                  aria-label="Émoji de la mission"
                />
                <input
                  className="input grow"
                  placeholder="Nouvelle mission…"
                  value={newMission.label}
                  onChange={(e) => setNewMission({ ...newMission, label: e.target.value })}
                />
              </div>
              <div className="row">
                <label className="inline-label">
                  Points
                  <input
                    className="input input-num"
                    type="number"
                    min="1"
                    value={newMission.points}
                    onChange={(e) => setNewMission({ ...newMission, points: e.target.value })}
                  />
                </label>
                <label className="inline-label check">
                  <input
                    type="checkbox"
                    checked={newMission.schoolOnly}
                    onChange={(e) => setNewMission({ ...newMission, schoolOnly: e.target.checked })}
                  />
                  Jours d'école seulement
                </label>
                <button className="btn btn-primary" onClick={() => addMission(activeChild.id)}>Ajouter</button>
              </div>
            </div>
          </section>

          {/* Récompenses */}
          <section className="card">
            <h3>Récompenses de {activeChild.name}</h3>
            {activeChild.rewards.map((r) => (
              <div key={r.id} className="edit-row">
                <span>{r.emoji} {r.label} — {r.cost} pts</span>
                <button className="btn btn-danger" onClick={() => removeReward(activeChild.id, r.id)}>Retirer</button>
              </div>
            ))}
            <div className="add-block">
              <div className="row">
                <input
                  className="input input-emoji"
                  value={newReward.emoji}
                  maxLength={4}
                  onChange={(e) => setNewReward({ ...newReward, emoji: e.target.value })}
                  aria-label="Émoji de la récompense"
                />
                <input
                  className="input grow"
                  placeholder="Nouvelle récompense…"
                  value={newReward.label}
                  onChange={(e) => setNewReward({ ...newReward, label: e.target.value })}
                />
              </div>
              <div className="row">
                <label className="inline-label">
                  Coût
                  <input
                    className="input input-num"
                    type="number"
                    min="1"
                    value={newReward.cost}
                    onChange={(e) => setNewReward({ ...newReward, cost: e.target.value })}
                  />
                </label>
                <button className="btn btn-primary" onClick={() => addReward(activeChild.id)}>Ajouter</button>
              </div>
            </div>
          </section>
          {/* Points négatifs */}
          <section className="card penalty-card">
            <h3>Points négatifs de {activeChild.name}</h3>
            <p className="penalty-hint">
              Un tap retire les points. À utiliser avec parcimonie — les missions réussies restent le
              moteur principal !
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
                <h4>Appliqués aujourd'hui</h4>
                {activeChild.penaltiesToday.map((p) => (
                  <div key={p.id} className="edit-row">
                    <span>{p.emoji} {p.label} — −{p.points} pts</span>
                    <button className="btn btn-ghost" onClick={() => undoPenalty(activeChild.id, p.id)}>Annuler</button>
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
                  aria-label="Émoji du point négatif"
                />
                <input
                  className="input grow"
                  placeholder="Nouveau point négatif…"
                  value={newPenalty.label}
                  onChange={(e) => setNewPenalty({ ...newPenalty, label: e.target.value })}
                />
              </div>
              <div className="row">
                <label className="inline-label">
                  Points retirés
                  <input
                    className="input input-num"
                    type="number"
                    min="1"
                    value={newPenalty.points}
                    onChange={(e) => setNewPenalty({ ...newPenalty, points: e.target.value })}
                  />
                </label>
                <button className="btn btn-primary" onClick={() => addPenalty(activeChild.id)}>Ajouter</button>
              </div>
              {activeChild.penalties.length > 0 && (
                <details className="penalty-manage">
                  <summary>Gérer la liste</summary>
                  {activeChild.penalties.map((p) => (
                    <div key={p.id} className="edit-row">
                      <span>{p.emoji} {p.label} — −{p.points} pts</span>
                      <button className="btn btn-danger" onClick={() => removePenalty(activeChild.id, p.id)}>Retirer</button>
                    </div>
                  ))}
                </details>
              )}
            </div>
          </section>
        </>
      )}

      {/* Gestion des enfants */}
      <section className="card">
        <h3>Enfants</h3>
        {data.children.map((c) => (
          <div key={c.id} className="edit-row">
            <span>{c.avatar} {c.name} — ⭐ {c.points} (total {c.totalPoints})</span>
            <button className="btn btn-danger" onClick={() => removeChild(c.id)}>Retirer</button>
          </div>
        ))}
        <div className="add-block">
          <div className="row">
            <input
              className="input grow"
              placeholder="Prénom…"
              value={newChild.name}
              onChange={(e) => setNewChild({ ...newChild, name: e.target.value })}
            />
            <button className="btn btn-primary" onClick={addChild}>Ajouter</button>
          </div>
          <div className="row avatar-row">
            {AVATARS.map((a) => (
              <button
                key={a}
                className={"avatar-pick" + (newChild.avatar === a ? " picked" : "")}
                onClick={() => setNewChild({ ...newChild, avatar: a })}
                aria-label={`Choisir l'avatar ${a}`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>
      </section>

      <p className="parent-note">
        ℹ️ Les missions se réinitialisent chaque jour ; les points sont conservés. Les missions « école »
        n'apparaissent que du lundi au vendredi. Les données sont partagées entre tous les appareils qui
        utilisent le lien publié — gardez-le privé.
      </p>
    </div>
  );
}

/* ============================================================
   Habillage global + styles
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

/* Ciel étoilé */
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

/* En-tête */
.topbar { display: flex; align-items: center; justify-content: space-between; padding: 8px 4px 16px; }
.topbar h1 { font-size: clamp(24px, 5vw, 34px); font-weight: 700; letter-spacing: .5px; }
.topbar .accent { color: #FFD166; }
.gear {
  background: rgba(255,255,255,.12); border: none; border-radius: 50%;
  width: 46px; height: 46px; font-size: 20px; cursor: pointer; color: #fff;
}
.gear:focus-visible, .btn:focus-visible, .child-tab:focus-visible, .mission-card:focus-visible, .avatar-pick:focus-visible {
  outline: 3px solid #FFD166; outline-offset: 2px;
}

/* Onglets enfants */
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

/* Cartes génériques */
.card {
  background: #FFFFFF; color: #2B2B4A; border-radius: 22px; padding: 16px 18px;
  box-shadow: 0 6px 20px rgba(0,0,0,.20);
}
.center-card { text-align: center; display: grid; gap: 10px; justify-items: center; }

/* Fusée */
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

/* Sections */
.section-title {
  font-size: 20px; font-weight: 700; margin: 6px 4px 12px;
  display: flex; align-items: center; gap: 10px;
}
.section-count {
  font-size: 13px; font-weight: 600; background: rgba(255,255,255,.15);
  border-radius: 999px; padding: 3px 10px;
}

/* Missions */
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
@keyframes pop { 0% { transform: scale(.4); } 60% { transform: scale(1.25); } 100% { transform: scale(1); } }

/* Boutique */
.reward-list { display: grid; gap: 10px; margin-bottom: 24px; }
.reward-row { display: flex; align-items: center; gap: 12px; }
.reward-emoji { font-size: 30px; }
.reward-main { flex: 1; display: grid; }
.reward-label { font-weight: 600; }
.reward-cost { font-size: 13px; color: #7A7794; }

/* Boutons */
.btn {
  font-family: inherit; font-size: 15px; font-weight: 600; border: none;
  border-radius: 14px; padding: 10px 16px; cursor: pointer; transition: transform .12s ease;
}
.btn:active { transform: scale(.95); }
.btn-primary { background: #FF6B6B; color: #fff; }
.btn-ghost { background: #EEE9FF; color: #4A3FBF; }
.btn-danger { background: #FFE3E3; color: #C0392B; font-size: 13px; padding: 6px 12px; }
.btn-disabled { background: #E8E6F5; color: #9A97B5; cursor: not-allowed; }

/* Historique */
.history-card { display: grid; gap: 8px; }
.history-row { display: flex; justify-content: space-between; font-size: 15px; }
.history-date { color: #8A87A6; font-size: 13px; }

/* Mode parents */
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

/* Chargement */
.loading { display: grid; justify-items: center; gap: 12px; padding: 80px 0; font-size: 17px; }
.loading-rocket { font-size: 52px; animation: hover 1.2s ease-in-out infinite alternate; }
@keyframes hover { from { transform: translateY(0) rotate(-45deg); } to { transform: translateY(-12px) rotate(-45deg); } }

/* Décollage */
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

/* Points négatifs */
.penalty-card { border: 2px solid #FFD9D9; }
.penalty-hint { font-size: 13px; color: #8A87A6; margin-bottom: 10px; line-height: 1.4; }
.penalty-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; margin-bottom: 8px; }
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

/* Carte Oups (vue enfant) */
.oops-card { display: grid; gap: 8px; border: 2px solid #FFD9D9; margin-bottom: 24px; }
.oops-pts { color: #C0392B; font-weight: 700; }
.oops-note { font-size: 13px; color: #8A87A6; margin-top: 4px; }

/* Clavier code parents */
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
