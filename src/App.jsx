import React, { useState, useEffect, useCallback } from "react";
import {
  Globe, MapPin, Megaphone, Tag, Users, User, Plus, Trash2, Settings,
  RefreshCw, ChevronDown, ChevronUp, X, ExternalLink, Shield, Check, Pencil,
  EyeOff, Eye, LogOut,
} from "lucide-react";
import { supabase } from "./supabase.js";
import logoUrl from "./assets/logo.png";

/* ================= Q8_ULTRA — web app =================
   Supabase auth + Postgres. Name hiding and director
   rights are enforced by the database (RLS), not the UI.
======================================================= */

const C = {
  field: "#F4EDDE",
  card: "#FFFFFF",
  ink: "#0F1C23",
  soft: "#5A6C70",
  teal: "#2F7C71",
  tealSoft: "#78BBB1",
  gold: "#EBCC8F",
  goldDeep: "#B08A45",
  danger: "#B3402F",
};

const FONT_CSS = `
.q8-brand { font-family:'Montserrat','Arial Black',sans-serif; }
.q8-disp { font-family:'Barlow Condensed','Arial Narrow',Impact,sans-serif; }
.q8-body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; }
.q8-press { transition: transform .06s ease; }
.q8-press:active { transform: scale(.97); }
@media (prefers-reduced-motion: reduce) { .q8-press { transition: none; } }
@keyframes q8spin { from { transform: rotate(0) } to { transform: rotate(360deg) } }
`;

/* ---------- utils ---------- */
const todayISO = () => { const t = new Date(); t.setHours(0, 0, 0, 0); return t.toISOString().slice(0, 10); };
function daysTo(d) {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.round((new Date(d + "T00:00:00") - t) / 86400000);
}
function fmtDay(d) { return new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit" }); }
function fmtMon(d) { return new Date(d + "T00:00:00").toLocaleDateString("en-GB", { month: "short" }).toUpperCase(); }
function fmtYear(d) { return new Date(d + "T00:00:00").getFullYear(); }
function fmtFull(d) { return new Date(d + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" }); }
function fmtStamp(t) { return new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short" }); }
function countdown(d) {
  const n = daysTo(d);
  if (n === 0) return "RACE DAY";
  if (n === 1) return "TOMORROW";
  if (n > 0) return `IN ${n} DAYS`;
  return "FINISHED";
}

/* quick add: derive a race name from a utmb.world link */
function utmbNameFromLink(url) {
  try {
    const u = new URL(url.trim());
    if (!u.hostname.endsWith("utmb.world")) return null;
    const cap = (s) => s.split(/[-.]/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
    const sub = u.hostname.replace(".utmb.world", "");
    if (sub && sub !== "utmb" && sub !== "www" && sub !== "utmb.world") return `${cap(sub)} by UTMB`;
    const seg = u.pathname.split("/").filter(Boolean).pop();
    if (seg && !["utmb-world-series-events", "races", "en", "live"].includes(seg)) return `${cap(seg)} by UTMB`;
  } catch { /* not a URL yet — ignore */ }
  return null;
}

const DIST_PRESETS = ["10K", "21K", "42K", "50K", "100K", "100M"];

/* ---------- brand ---------- */
const LogoMark = ({ size = 34 }) => (
  <img src={logoUrl} width={size} height={size} alt="Q8_ULTRA" draggable={false}
    style={{ display: "block", flexShrink: 0, width: size, height: size }} />
);

const Wordmark = ({ size = 24 }) => (
  <span className="q8-brand" style={{ fontSize: size, fontWeight: 800, letterSpacing: "-0.01em", color: C.ink, lineHeight: 1, whiteSpace: "nowrap" }}>
    Q8_ULTRA
  </span>
);

const Arabic = ({ size = 13 }) => (
  <span dir="rtl" className="q8-body" style={{ fontSize: size, fontWeight: 700, color: C.ink, lineHeight: 1.3 }}>
    كويت ألتـرا
  </span>
);

const Eyebrow = ({ children, color = C.soft }) => (
  <div className="q8-body" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", color, textTransform: "uppercase" }}>
    {children}
  </div>
);

const Btn = ({ children, onClick, kind = "solid", small, disabled, style }) => {
  const base = {
    fontWeight: 700, borderRadius: 8, cursor: disabled ? "default" : "pointer",
    padding: small ? "7px 12px" : "12px 16px", fontSize: small ? 13 : 15,
    border: `1.5px solid ${C.ink}`, opacity: disabled ? 0.4 : 1,
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
    ...(kind === "solid" ? { background: C.ink, color: C.card } :
      kind === "accent" ? { background: C.teal, borderColor: C.teal, color: "#fff" } :
        { background: "transparent", color: C.ink }),
    ...style,
  };
  return (
    <button className="q8-body q8-press" style={base} onClick={disabled ? undefined : onClick}>
      {children}
    </button>
  );
};

const Field = ({ label, children }) => (
  <div style={{ marginBottom: 14 }}>
    <div style={{ marginBottom: 6 }}><Eyebrow>{label}</Eyebrow></div>
    {children}
  </div>
);

const inputStyle = {
  width: "100%", boxSizing: "border-box", padding: "11px 12px", fontSize: 15,
  border: `1.5px solid ${C.ink}`, borderRadius: 8, background: "#fff",
  color: C.ink, outline: "none",
};

const Sheet = ({ title, onClose, children }) => (
  <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(15,28,35,0.55)" }} onClick={onClose}>
    <div
      onClick={(e) => e.stopPropagation()}
      style={{ width: "100%", maxWidth: 448, maxHeight: "88vh", overflowY: "auto", background: C.card, borderRadius: "18px 18px 0 0", border: `1.5px solid ${C.ink}`, borderBottom: "none", padding: "18px 18px 28px" }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <span className="q8-disp" style={{ fontSize: 24, fontWeight: 800, textTransform: "uppercase", color: C.ink }}>{title}</span>
        <button className="q8-press" onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
          <X size={22} color={C.ink} />
        </button>
      </div>
      {children}
    </div>
  </div>
);

const DistChip = ({ label, active, onClick, small }) => (
  <button
    className="q8-disp q8-press"
    onClick={onClick}
    style={{
      cursor: onClick ? "pointer" : "default",
      padding: small ? "1px 8px" : "5px 14px", fontSize: small ? 13 : 17, fontWeight: 700,
      border: `1.5px solid ${C.ink}`, borderRadius: 6, letterSpacing: "0.03em",
      background: active ? C.ink : "transparent", color: active ? C.card : C.ink,
    }}
  >
    {label}
  </button>
);

const ModeBadge = ({ mode, size = 13 }) =>
  mode === "crew" ? (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: C.teal, fontSize: size, fontWeight: 600, whiteSpace: "nowrap" }}>
      <Users size={size + 1} /> open to company
    </span>
  ) : (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: C.soft, fontSize: size, fontWeight: 600, whiteSpace: "nowrap" }}>
      <User size={size + 1} /> running solo
    </span>
  );

/* ---------- event card ---------- */
function EventCard({ ev, joiners, userId, director, onJoin, onWithdraw, onDelete, onEdit, onToggleHidden, onRemoveEntry }) {
  const [open, setOpen] = useState(false);
  const mine = joiners.find((j) => j.is_self);
  const past = daysTo(ev.date) < 0;
  const canDelete = director || ev.added_by === userId;

  return (
    <div style={{ background: C.card, border: `1.5px solid ${C.ink}`, borderRadius: 12, marginBottom: 14, overflow: "hidden", opacity: past ? 0.75 : 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 12px", borderBottom: `1.5px solid ${C.ink}`, background: past ? C.soft : C.ink }}>
        <span className="q8-disp" style={{ color: C.card, fontSize: 13, fontWeight: 700, letterSpacing: "0.12em" }}>
          {ev.scope === "intl" ? (ev.country || "INTERNATIONAL").toUpperCase() : "KUWAIT"}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {ev.hidden && (
            <span className="q8-disp" style={{ display: "inline-flex", alignItems: "center", gap: 4, color: C.gold, fontSize: 12, fontWeight: 700, letterSpacing: "0.12em" }}>
              <EyeOff size={12} /> HIDDEN
            </span>
          )}
          <span className="q8-disp" style={{ color: past ? C.card : C.gold, fontSize: 13, fontWeight: 700, letterSpacing: "0.12em" }}>
            {countdown(ev.date)}
          </span>
        </span>
      </div>

      <div style={{ display: "flex" }}>
        <div style={{ width: 74, flexShrink: 0, borderRight: `1.5px solid ${C.ink}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "10px 4px" }}>
          <span className="q8-disp" style={{ fontSize: 13, fontWeight: 700, color: C.teal, letterSpacing: "0.1em" }}>{fmtMon(ev.date)}</span>
          <span className="q8-disp" style={{ fontSize: 34, fontWeight: 800, color: C.ink, lineHeight: 1 }}>{fmtDay(ev.date)}</span>
          <span className="q8-body" style={{ fontSize: 11, color: C.soft, fontWeight: 600 }}>{fmtYear(ev.date)}</span>
        </div>

        <div style={{ flex: 1, padding: "10px 12px", minWidth: 0 }}>
          <div className="q8-disp" style={{ fontSize: 21, fontWeight: 800, textTransform: "uppercase", color: C.ink, lineHeight: 1.05, display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
            {ev.name}
            {ev.link && (
              <a href={ev.link} target="_blank" rel="noreferrer" style={{ color: C.teal }} onClick={(e) => e.stopPropagation()}>
                <ExternalLink size={14} />
              </a>
            )}
          </div>
          <div className="q8-body" style={{ fontSize: 12.5, color: C.soft, margin: "3px 0 2px", display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
            <MapPin size={12} /> {ev.location}{ev.scope === "intl" && ev.country ? `, ${ev.country}` : ""} · {fmtFull(ev.date)}
          </div>
          {ev.note && <div className="q8-body" style={{ fontSize: 11.5, color: C.soft, fontStyle: "italic", marginBottom: 8 }}>{ev.note}</div>}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: ev.note ? 0 : 6 }}>
            {ev.distances.map((d) => (
              <DistChip key={d} label={d} small active={mine?.distance === d} />
            ))}
          </div>
        </div>
      </div>

      <div
        className="q8-press"
        onClick={() => setOpen(!open)}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px", borderTop: `1.5px solid ${C.ink}`, cursor: "pointer", background: "#F0EADB" }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Eyebrow color={C.ink}>Start list</Eyebrow>
          <span className="q8-disp" style={{ fontSize: 15, fontWeight: 800, color: C.teal }}>{joiners.length}</span>
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {!past && (
            <Btn small kind={mine ? "outline" : "accent"} onClick={(e) => { e.stopPropagation(); onJoin(ev, mine); }}>
              {mine ? <><Pencil size={13} /> Edit entry</> : "Join"}
            </Btn>
          )}
          {open ? <ChevronUp size={18} color={C.ink} /> : <ChevronDown size={18} color={C.ink} />}
        </span>
      </div>

      {open && (
        <div style={{ borderTop: `1.5px solid ${C.ink}`, padding: "6px 12px 10px" }}>
          {joiners.length === 0 && (
            <div className="q8-body" style={{ fontSize: 13, color: C.soft, padding: "8px 0" }}>
              Nobody on the start list yet — be the first.
            </div>
          )}
          {joiners.map((j, i) => (
            <div key={j.user_id || `hidden-${i}`} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: i < joiners.length - 1 ? "1px solid rgba(15,28,35,0.12)" : "none" }}>
              <span className="q8-disp" style={{ width: 24, fontSize: 15, fontWeight: 800, color: C.teal, flexShrink: 0 }}>{String(i + 1).padStart(2, "0")}</span>
              <span className="q8-body" style={{ flex: 1, fontSize: 14, fontWeight: 700, color: j.hidden && !j.is_self && !director ? C.soft : C.ink, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 5 }}>
                {j.display_name}{j.is_self ? " (you)" : ""}
                {j.hidden && (director || j.is_self) && <EyeOff size={12} color={C.soft} title="Hidden from members" />}
              </span>
              <DistChip label={j.distance} small />
              <ModeBadge mode={j.mode} size={11} />
              {j.is_self && !past && (
                <button className="q8-press" onClick={() => onWithdraw(ev)} title="Withdraw" style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
                  <X size={15} color={C.danger} />
                </button>
              )}
              {director && !j.is_self && j.user_id && (
                <button className="q8-press" onClick={() => onRemoveEntry(ev, j)} title="Remove from start list" style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
                  <X size={15} color={C.danger} />
                </button>
              )}
            </div>
          ))}
          {(canDelete || director) && (
            <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 16 }}>
              {director && (
                <button className="q8-body q8-press" onClick={() => onEdit(ev)} style={{ background: "none", border: "none", cursor: "pointer", color: C.ink, fontSize: 12, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <Pencil size={13} /> Edit
                </button>
              )}
              {director && (
                <button className="q8-body q8-press" onClick={() => onToggleHidden(ev)} style={{ background: "none", border: "none", cursor: "pointer", color: C.goldDeep, fontSize: 12, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4 }}>
                  {ev.hidden ? <><Eye size={13} /> Unhide</> : <><EyeOff size={13} /> Hide</>}
                </button>
              )}
              {canDelete && (
                <button className="q8-body q8-press" onClick={() => onDelete(ev)} style={{ background: "none", border: "none", cursor: "pointer", color: C.danger, fontSize: 12, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <Trash2 size={13} /> Remove race
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- main app ---------- */
export default function App() {
  const [session, setSession] = useState(undefined); // undefined = booting, null = signed out
  const [profile, setProfile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("intl");
  const [events, setEvents] = useState([]);
  const [startLists, setStartLists] = useState({});
  const [ann, setAnn] = useState([]);
  const [wall, setWall] = useState([]);
  const [showPast, setShowPast] = useState(false);
  const [toast, setToast] = useState(null);

  // auth form
  const [authMode, setAuthMode] = useState("signin"); // signin | signup
  const [authEmail, setAuthEmail] = useState("");
  const [authPw, setAuthPw] = useState("");
  const [authName, setAuthName] = useState("");
  const [authErr, setAuthErr] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [authBusy, setAuthBusy] = useState(false);

  // sheets
  const [joinTarget, setJoinTarget] = useState(null);
  const [joinDist, setJoinDist] = useState(null);
  const [joinMode, setJoinMode] = useState("crew");
  const [joinAnon, setJoinAnon] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null); // director edit mode
  const [recovery, setRecovery] = useState(false); // password-recovery flow
  const [rPw, setRPw] = useState(""); const [rPw2, setRPw2] = useState("");
  const [rBusy, setRBusy] = useState(false);

  // add-event form
  const [fName, setFName] = useState(""); const [fDate, setFDate] = useState("");
  const [fLoc, setFLoc] = useState(""); const [fCountry, setFCountry] = useState("");
  const [fDists, setFDists] = useState(""); const [fLink, setFLink] = useState("");

  // composers
  const [annDraft, setAnnDraft] = useState("");
  const [wKind, setWKind] = useState("sell"); const [wTitle, setWTitle] = useState("");
  const [wDetails, setWDetails] = useState(""); const [wPrice, setWPrice] = useState("");
  const [wContact, setWContact] = useState("");

  const [nameEdit, setNameEdit] = useState("");

  const user = session?.user || null;
  const director = !!profile?.is_director;

  const notify = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2600); };
  const fail = (error, fallbackMsg) => notify(error?.message || fallbackMsg || "Something went wrong — try again.");

  /* ----- session bootstrap ----- */
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s ?? null);
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const loadProfile = useCallback(async (u) => {
    const { data, error } = await supabase.from("profiles").select("*").eq("id", u.id).maybeSingle();
    if (error) { fail(error); return; }
    if (data) { setProfile(data); setNameEdit(data.name); return; }
    // rare race: trigger not finished yet — create the profile ourselves
    const name = u.user_metadata?.name?.trim() || "Runner";
    const { data: created, error: e2 } = await supabase.from("profiles")
      .upsert({ id: u.id, name }).select().single();
    if (e2) fail(e2); else { setProfile(created); setNameEdit(created.name); }
  }, []);

  const loadAll = useCallback(async () => {
    setBusy(true);
    const [evR, slR, anR, wlR] = await Promise.all([
      supabase.from("events").select("*").order("date", { ascending: true }),
      supabase.from("start_list").select("*").order("created_at", { ascending: true }),
      supabase.from("announcements").select("*").order("created_at", { ascending: false }),
      supabase.from("wall_posts").select("*, profiles(name)").order("created_at", { ascending: false }),
    ]);
    const err = evR.error || slR.error || anR.error || wlR.error;
    if (err) fail(err);
    setEvents(evR.data || []);
    const grouped = {};
    (slR.data || []).forEach((r) => { (grouped[r.event_id] ||= []).push(r); });
    setStartLists(grouped);
    setAnn(anR.data || []);
    setWall(wlR.data || []);
    setBusy(false);
  }, []);

  useEffect(() => {
    if (user) { loadProfile(user); loadAll(); }
    else { setProfile(null); }
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ----- auth actions ----- */
  const doSignIn = async () => {
    setAuthErr(""); setAuthNotice(""); setAuthBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: authEmail.trim(), password: authPw });
    if (error) setAuthErr(error.message);
    setAuthBusy(false);
  };

  const doSignUp = async () => {
    setAuthErr(""); setAuthNotice("");
    const name = authName.trim();
    if (!name) { setAuthErr("Your name is required — it's what the crew sees."); return; }
    if (authPw.length < 6) { setAuthErr("Password must be at least 6 characters."); return; }
    setAuthBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: authEmail.trim(),
      password: authPw,
      options: { data: { name } },
    });
    if (error) setAuthErr(error.message);
    else if (!data.session) setAuthNotice("Check your email to confirm your account, then sign in.");
    setAuthBusy(false);
  };

  const doForgot = async () => {
    setAuthErr(""); setAuthNotice(""); setAuthBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(authEmail.trim(), { redirectTo: window.location.origin });
    if (error) setAuthErr(error.message);
    else setAuthNotice("Reset link sent — check your email (and spam). Open it on this device.");
    setAuthBusy(false);
  };

  const doSetNewPassword = async () => {
    setAuthErr("");
    if (rPw.length < 6) { setAuthErr("Password must be at least 6 characters."); return; }
    if (rPw !== rPw2) { setAuthErr("Passwords don't match."); return; }
    setRBusy(true);
    const { error } = await supabase.auth.updateUser({ password: rPw });
    if (error) setAuthErr(error.message);
    else { setRecovery(false); setRPw(""); setRPw2(""); notify("Password updated — you're signed in."); }
    setRBusy(false);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setSettingsOpen(false); setRecovery(false);
    setAuthMode("signin"); setAuthEmail(""); setAuthPw(""); setAuthName("");
  };

  /* ----- board actions ----- */
  const openJoin = (ev, mine) => {
    setJoinTarget(ev);
    setJoinDist(mine?.distance || ev.distances[0] || null);
    setJoinMode(mine?.mode || "crew");
    setJoinAnon(mine ? !!mine.hidden : false);
  };

  const confirmJoin = async () => {
    if (!joinTarget || !joinDist) return;
    const { error } = await supabase.from("entries").upsert(
      { event_id: joinTarget.id, user_id: user.id, distance: joinDist, mode: joinMode, hidden: joinAnon },
      { onConflict: "event_id,user_id" }
    );
    if (error) { fail(error); return; }
    setJoinTarget(null);
    notify(joinAnon ? "You're in — hidden from members." : "You're on the start list.");
    loadAll();
  };

  const withdraw = async (ev) => {
    if (!window.confirm(`Withdraw from ${ev.name}?`)) return;
    const { error } = await supabase.from("entries").delete().match({ event_id: ev.id, user_id: user.id });
    if (error) fail(error); else { notify("Withdrawn."); loadAll(); }
  };

  const resetEventForm = () => {
    setAddOpen(false); setEditingEvent(null);
    setFName(""); setFDate(""); setFLoc(""); setFCountry(""); setFDists(""); setFLink("");
  };

  const saveEvent = async () => {
    const scope = editingEvent ? editingEvent.scope : tab;
    const distances = fDists.split(/[,،]/).map((s) => s.trim().toUpperCase()).filter(Boolean);
    if (!fName.trim() || !fDate || !fLoc.trim() || distances.length === 0) { notify("Name, date, location and distances are required."); return; }
    if (scope === "intl" && !fCountry.trim()) { notify("Country is required for international races."); return; }
    const fields = {
      name: fName.trim(), date: fDate, location: fLoc.trim(),
      country: scope === "intl" ? fCountry.trim() : "", distances, link: fLink.trim(),
    };
    const { error } = editingEvent
      ? await supabase.from("events").update(fields).eq("id", editingEvent.id)
      : await supabase.from("events").insert({ ...fields, scope, added_by: user.id });
    if (error) { fail(error); return; }
    notify(editingEvent ? "Race updated." : "Race added to the board.");
    resetEventForm();
    loadAll();
  };

  const openEdit = (ev) => {
    setEditingEvent(ev);
    setFName(ev.name); setFDate(ev.date); setFLoc(ev.location); setFCountry(ev.country || "");
    setFDists((ev.distances || []).join(", ")); setFLink(ev.link || "");
    setAddOpen(true);
  };

  const toggleHidden = async (ev) => {
    const { error } = await supabase.from("events").update({ hidden: !ev.hidden }).eq("id", ev.id);
    if (error) fail(error);
    else { notify(ev.hidden ? "Race is visible to members again." : "Race hidden — members can't see it now."); loadAll(); }
  };

  const removeEntry = async (ev, j) => {
    if (!window.confirm(`Remove ${j.display_name} from ${ev.name}?`)) return;
    const { error } = await supabase.from("entries").delete().match({ event_id: ev.id, user_id: j.user_id });
    if (error) fail(error); else { notify("Removed from the start list."); loadAll(); }
  };

  const deleteEvent = async (ev) => {
    if (!window.confirm(`Remove ${ev.name} and its start list?`)) return;
    const { error } = await supabase.from("events").delete().eq("id", ev.id);
    if (error) fail(error); else { notify("Race removed."); loadAll(); }
  };

  const postAnn = async () => {
    const text = annDraft.trim();
    if (!text) return;
    const { error } = await supabase.from("announcements").insert({ text, author: user.id });
    if (error) fail(error); else { setAnnDraft(""); notify("Announcement posted."); loadAll(); }
  };

  const delAnn = async (id) => {
    if (!window.confirm("Delete this announcement?")) return;
    const { error } = await supabase.from("announcements").delete().eq("id", id);
    if (error) fail(error); else loadAll();
  };

  const postWall = async () => {
    if (!wTitle.trim()) { notify("A title is required."); return; }
    const { error } = await supabase.from("wall_posts").insert({
      kind: wKind, title: wTitle.trim(), details: wDetails.trim(),
      price: wPrice.trim(), contact: wContact.trim(), user_id: user.id,
    });
    if (error) { fail(error); return; }
    setWTitle(""); setWDetails(""); setWPrice(""); setWContact("");
    notify("Posted to the wall.");
    loadAll();
  };

  const delWall = async (id) => {
    if (!window.confirm("Delete this post?")) return;
    const { error } = await supabase.from("wall_posts").delete().eq("id", id);
    if (error) fail(error); else loadAll();
  };

  const updateName = async () => {
    const name = nameEdit.trim();
    if (!name) return;
    const { error } = await supabase.from("profiles").update({ name }).eq("id", user.id);
    if (error) fail(error);
    else { setProfile({ ...profile, name }); notify("Name updated."); loadAll(); }
  };

  /* ----- derived ----- */
  const scoped = events.filter((e) => e.scope === tab);
  const upcoming = scoped.filter((e) => daysTo(e.date) >= 0).sort((a, b) => a.date.localeCompare(b.date));
  const finished = scoped.filter((e) => daysTo(e.date) < 0).sort((a, b) => b.date.localeCompare(a.date));

  /* ----- render: splash ----- */
  if (session === undefined) {
    return (
      <div className="q8-body" style={{ minHeight: "100vh", background: C.field, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
        <style>{FONT_CSS}</style>
        <LogoMark size={110} />
        <Wordmark size={30} />
      </div>
    );
  }

  /* ----- render: auth ----- */
  if (!user) {
    return (
      <div className="q8-body" style={{ minHeight: "100vh", background: C.field, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <style>{FONT_CSS}</style>
        <div style={{ width: "100%", maxWidth: 400 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, marginBottom: 20 }}>
            <LogoMark size={140} />
            <div style={{ marginTop: 4 }}><Wordmark size={32} /></div>
            <Arabic size={16} />
            <Eyebrow>Race boards · start lists · gear wall</Eyebrow>
          </div>

          <div style={{ background: C.card, border: `1.5px solid ${C.ink}`, borderRadius: 14, padding: 22 }}>
            {authMode === "signup" && (
              <Field label="Your name (shown to the crew)">
                <input style={inputStyle} value={authName} onChange={(e) => setAuthName(e.target.value)} placeholder="e.g. Essa" autoFocus />
              </Field>
            )}
            <Field label="Email">
              <input type="email" style={inputStyle} value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} placeholder="you@example.com" autoFocus={authMode === "signin"} />
            </Field>
            {authMode !== "forgot" && (
              <Field label="Password">
                <input type="password" style={inputStyle} value={authPw} onChange={(e) => setAuthPw(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (authMode === "signin" ? doSignIn() : doSignUp())}
                  placeholder={authMode === "signup" ? "At least 6 characters" : ""} />
              </Field>
            )}
            {authMode === "signin" && (
              <div style={{ marginTop: -8, marginBottom: 12, textAlign: "right" }}>
                <button className="q8-press" onClick={() => { setAuthMode("forgot"); setAuthErr(""); setAuthNotice(""); }}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 12.5, fontWeight: 700, color: C.teal }}>
                  Forgot password?
                </button>
              </div>
            )}
            {authMode === "forgot" && (
              <div style={{ fontSize: 12.5, color: C.soft, marginTop: -6, marginBottom: 12, lineHeight: 1.45 }}>
                We'll email you a link that signs you in and lets you set a new password.
              </div>
            )}
            {authErr && <div style={{ color: C.danger, fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{authErr}</div>}
            {authNotice && <div style={{ color: C.teal, fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{authNotice}</div>}
            {authMode === "signin" ? (
              <>
                <Btn kind="accent" onClick={doSignIn} disabled={authBusy || !authEmail.trim() || !authPw} style={{ width: "100%", marginBottom: 10 }}>Sign in</Btn>
                <Btn kind="outline" small onClick={() => { setAuthMode("signup"); setAuthErr(""); setAuthNotice(""); }} style={{ width: "100%" }}>New runner? Create an account</Btn>
              </>
            ) : authMode === "signup" ? (
              <>
                <Btn kind="accent" onClick={doSignUp} disabled={authBusy || !authEmail.trim() || !authPw || !authName.trim()} style={{ width: "100%", marginBottom: 10 }}>To the start line</Btn>
                <Btn kind="outline" small onClick={() => { setAuthMode("signin"); setAuthErr(""); setAuthNotice(""); }} style={{ width: "100%" }}>Already have an account? Sign in</Btn>
              </>
            ) : (
              <>
                <Btn kind="accent" onClick={doForgot} disabled={authBusy || !authEmail.trim()} style={{ width: "100%", marginBottom: 10 }}>Send reset link</Btn>
                <Btn kind="outline" small onClick={() => { setAuthMode("signin"); setAuthErr(""); setAuthNotice(""); }} style={{ width: "100%" }}>Back to sign in</Btn>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ----- render: password recovery ----- */
  if (recovery) {
    return (
      <div className="q8-body" style={{ minHeight: "100vh", background: C.field, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <style>{FONT_CSS}</style>
        <div style={{ width: "100%", maxWidth: 400 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, marginBottom: 20 }}>
            <LogoMark size={110} />
            <div style={{ marginTop: 4 }}><Wordmark size={26} /></div>
            <Eyebrow>Set a new password</Eyebrow>
          </div>
          <div style={{ background: C.card, border: `1.5px solid ${C.ink}`, borderRadius: 14, padding: 22 }}>
            <Field label="New password">
              <input type="password" style={inputStyle} value={rPw} onChange={(e) => setRPw(e.target.value)} placeholder="At least 6 characters" autoFocus />
            </Field>
            <Field label="Repeat new password">
              <input type="password" style={inputStyle} value={rPw2} onChange={(e) => setRPw2(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && doSetNewPassword()} />
            </Field>
            {authErr && <div style={{ color: C.danger, fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{authErr}</div>}
            <Btn kind="accent" onClick={doSetNewPassword} disabled={rBusy || !rPw || !rPw2} style={{ width: "100%", marginBottom: 10 }}>Save password</Btn>
            <Btn kind="outline" small onClick={() => { setRecovery(false); setAuthErr(""); }} style={{ width: "100%" }}>Skip — keep old password</Btn>
          </div>
        </div>
      </div>
    );
  }

  /* ----- render: app ----- */
  const TabBtn = ({ id, icon: Icon, label }) => (
    <button className="q8-press" onClick={() => { setTab(id); loadAll(); }} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", padding: "8px 0 10px", position: "relative", color: tab === id ? C.ink : C.soft }}>
      {tab === id && <div style={{ position: "absolute", top: 0, left: "20%", right: "20%", height: 3, background: C.teal }} />}
      <Icon size={20} style={{ display: "block", margin: "0 auto 2px" }} />
      <span className="q8-disp" style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.12em" }}>{label}</span>
    </button>
  );

  return (
    <div className="q8-body" style={{ minHeight: "100vh", background: C.field }}>
      <style>{FONT_CSS}</style>
      <div style={{ maxWidth: 448, margin: "0 auto", minHeight: "100vh", display: "flex", flexDirection: "column" }}>

        {/* header */}
        <div style={{ position: "sticky", top: 0, zIndex: 40, background: C.field, borderBottom: `1.5px solid ${C.ink}`, padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <LogoMark size={38} />
            <div>
              <Wordmark size={19} />
              <div style={{ marginTop: 1 }}><Arabic size={11} /></div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {director && <Shield size={17} color={C.teal} title="Race director" />}
            <button className="q8-press" onClick={loadAll} style={{ background: "none", border: "none", cursor: "pointer", padding: 6 }} title="Refresh">
              <RefreshCw size={18} color={C.ink} style={busy ? { animation: "q8spin 1s linear infinite" } : {}} />
            </button>
            <button className="q8-press" onClick={() => setSettingsOpen(true)} style={{ background: "none", border: "none", cursor: "pointer", padding: 6 }} title="Settings">
              <Settings size={18} color={C.ink} />
            </button>
          </div>
        </div>

        {/* content */}
        <div style={{ flex: 1, padding: "14px 14px 96px" }}>

          {(tab === "intl" || tab === "local") && (
            <>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
                <span className="q8-disp" style={{ fontSize: 26, fontWeight: 800, textTransform: "uppercase", color: C.ink }}>
                  {tab === "intl" ? "International races" : "Local races"}
                </span>
                <Eyebrow>{upcoming.length} upcoming</Eyebrow>
              </div>

              {upcoming.length === 0 && (
                <div style={{ background: C.card, border: `1.5px dashed ${C.soft}`, borderRadius: 12, padding: 22, textAlign: "center" }}>
                  <div className="q8-disp" style={{ fontSize: 20, fontWeight: 800, color: C.ink, textTransform: "uppercase" }}>Board is empty</div>
                  <div style={{ fontSize: 13, color: C.soft, marginTop: 4 }}>Add the first {tab === "intl" ? "international" : "local"} race with the + button.</div>
                </div>
              )}

              {upcoming.map((ev) => (
                <EventCard key={ev.id} ev={ev} joiners={startLists[ev.id] || []} userId={user.id} director={director} onJoin={openJoin} onWithdraw={withdraw} onDelete={deleteEvent} onEdit={openEdit} onToggleHidden={toggleHidden} onRemoveEntry={removeEntry} />
              ))}

              {finished.length > 0 && (
                <div style={{ marginTop: 18 }}>
                  <button className="q8-press" onClick={() => setShowPast(!showPast)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 6 }}>
                    <Eyebrow color={C.ink}>Finished · {finished.length}</Eyebrow>
                    {showPast ? <ChevronUp size={14} color={C.ink} /> : <ChevronDown size={14} color={C.ink} />}
                  </button>
                  {showPast && <div style={{ marginTop: 10 }}>{finished.map((ev) => (
                    <EventCard key={ev.id} ev={ev} joiners={startLists[ev.id] || []} userId={user.id} director={director} onJoin={openJoin} onWithdraw={withdraw} onDelete={deleteEvent} onEdit={openEdit} onToggleHidden={toggleHidden} onRemoveEntry={removeEntry} />
                  ))}</div>}
                </div>
              )}
            </>
          )}

          {tab === "news" && (
            <>
              <div className="q8-disp" style={{ fontSize: 26, fontWeight: 800, textTransform: "uppercase", color: C.ink, marginBottom: 12 }}>Announcements</div>
              {director && (
                <div style={{ background: C.card, border: `1.5px solid ${C.ink}`, borderRadius: 12, padding: 12, marginBottom: 16 }}>
                  <Eyebrow color={C.teal}>Race director</Eyebrow>
                  <textarea style={{ ...inputStyle, marginTop: 8, minHeight: 70, resize: "vertical" }} placeholder="Write an announcement for the group…" value={annDraft} onChange={(e) => setAnnDraft(e.target.value)} />
                  <div style={{ marginTop: 8, textAlign: "right" }}>
                    <Btn small kind="accent" onClick={postAnn} disabled={!annDraft.trim()}><Megaphone size={14} /> Post</Btn>
                  </div>
                </div>
              )}
              {ann.length === 0 && (
                <div style={{ background: C.card, border: `1.5px dashed ${C.soft}`, borderRadius: 12, padding: 22, textAlign: "center" }}>
                  <Megaphone size={22} color={C.soft} style={{ margin: "0 auto 6px", display: "block" }} />
                  <div style={{ fontSize: 13, color: C.soft }}>No announcements yet. The race director posts here.</div>
                </div>
              )}
              {ann.map((a) => (
                <div key={a.id} style={{ background: C.card, border: `1.5px solid ${C.ink}`, borderLeft: `5px solid ${C.teal}`, borderRadius: 10, padding: "10px 12px", marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <Eyebrow color={C.teal}>Race director · {fmtStamp(a.created_at)}</Eyebrow>
                    {director && (
                      <button className="q8-press" onClick={() => delAnn(a.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
                        <Trash2 size={14} color={C.danger} />
                      </button>
                    )}
                  </div>
                  <div style={{ fontSize: 14.5, color: C.ink, whiteSpace: "pre-wrap", lineHeight: 1.45 }}>{a.text}</div>
                </div>
              ))}
            </>
          )}

          {tab === "wall" && (
            <>
              <div className="q8-disp" style={{ fontSize: 26, fontWeight: 800, textTransform: "uppercase", color: C.ink, marginBottom: 12 }}>The wall</div>
              <div style={{ background: C.card, border: `1.5px solid ${C.ink}`, borderRadius: 12, padding: 12, marginBottom: 16 }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                  <DistChip label="SELLING" active={wKind === "sell"} onClick={() => setWKind("sell")} />
                  <DistChip label="WANTED" active={wKind === "want"} onClick={() => setWKind("want")} />
                </div>
                <input style={{ ...inputStyle, marginBottom: 8 }} placeholder={wKind === "sell" ? "What are you selling? e.g. Hoka Speedgoat 6, US 10" : "What are you looking for?"} value={wTitle} onChange={(e) => setWTitle(e.target.value)} />
                <textarea style={{ ...inputStyle, marginBottom: 8, minHeight: 54, resize: "vertical" }} placeholder="Details (condition, size, notes)…" value={wDetails} onChange={(e) => setWDetails(e.target.value)} />
                <div style={{ display: "flex", gap: 8 }}>
                  <input style={{ ...inputStyle, flex: 1 }} placeholder="Price (KD)" value={wPrice} onChange={(e) => setWPrice(e.target.value)} />
                  <input style={{ ...inputStyle, flex: 2 }} placeholder="Contact (phone / IG)" value={wContact} onChange={(e) => setWContact(e.target.value)} />
                </div>
                <div style={{ marginTop: 10, textAlign: "right" }}>
                  <Btn small onClick={postWall} disabled={!wTitle.trim()}><Tag size={14} /> Post to the wall</Btn>
                </div>
              </div>

              {wall.length === 0 && (
                <div style={{ background: C.card, border: `1.5px dashed ${C.soft}`, borderRadius: 12, padding: 22, textAlign: "center" }}>
                  <Tag size={22} color={C.soft} style={{ margin: "0 auto 6px", display: "block" }} />
                  <div style={{ fontSize: 13, color: C.soft }}>Nothing on the wall. Sell a pack, find poles, pass on race entries.</div>
                </div>
              )}
              {wall.map((p) => (
                <div key={p.id} style={{ background: C.card, border: `1.5px solid ${C.ink}`, borderRadius: 12, padding: "10px 12px", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span className="q8-disp" style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.1em", padding: "2px 8px", borderRadius: 5, background: p.kind === "sell" ? C.ink : "transparent", color: p.kind === "sell" ? C.card : C.ink, border: `1.5px solid ${C.ink}` }}>
                      {p.kind === "sell" ? "SELLING" : "WANTED"}
                    </span>
                    {p.price && <span className="q8-disp" style={{ fontSize: 16, fontWeight: 800, color: C.goldDeep }}>{p.price} KD</span>}
                    <span style={{ flex: 1 }} />
                    {(director || p.user_id === user.id) && (
                      <button className="q8-press" onClick={() => delWall(p.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
                        <Trash2 size={14} color={C.danger} />
                      </button>
                    )}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>{p.title}</div>
                  {p.details && <div style={{ fontSize: 13.5, color: C.soft, marginTop: 2, whiteSpace: "pre-wrap" }}>{p.details}</div>}
                  <div style={{ fontSize: 12, color: C.soft, marginTop: 8, display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <span>{p.profiles?.name || "Member"} · {fmtStamp(p.created_at)}</span>
                    {p.contact && <span style={{ fontWeight: 700, color: C.ink }}>{p.contact}</span>}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* FAB */}
        {(tab === "intl" || tab === "local") && (
          <button className="q8-press" onClick={() => setAddOpen(true)} title="Add race" style={{ position: "fixed", right: "max(16px, calc(50% - 208px))", bottom: 84, width: 54, height: 54, borderRadius: 27, background: C.teal, border: `1.5px solid ${C.ink}`, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 45 }}>
            <Plus size={26} />
          </button>
        )}

        {/* bottom nav */}
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 45 }}>
          <div style={{ maxWidth: 448, margin: "0 auto", background: C.card, borderTop: `1.5px solid ${C.ink}`, display: "flex" }}>
            <TabBtn id="intl" icon={Globe} label="INTL" />
            <TabBtn id="local" icon={MapPin} label="LOCAL" />
            <TabBtn id="news" icon={Megaphone} label="NEWS" />
            <TabBtn id="wall" icon={Tag} label="WALL" />
          </div>
        </div>

        {/* toast */}
        {toast && (
          <div style={{ position: "fixed", bottom: 76, left: "50%", transform: "translateX(-50%)", zIndex: 60, background: C.ink, color: C.card, borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, maxWidth: "86%", textAlign: "center" }}>
            {toast}
          </div>
        )}

        {/* join sheet */}
        {joinTarget && (
          <Sheet title={joinTarget.name} onClose={() => setJoinTarget(null)}>
            <Field label="Your distance">
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {joinTarget.distances.map((d) => (
                  <DistChip key={d} label={d} active={joinDist === d} onClick={() => setJoinDist(d)} />
                ))}
              </div>
            </Field>
            <Field label="How are you running it?">
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { id: "crew", icon: Users, t: "Open to company", s: "Happy to travel, train, or run with other Q8 runners" },
                  { id: "solo", icon: User, t: "Running solo", s: "Doing this one on my own" },
                ].map((o) => (
                  <button key={o.id} className="q8-press" onClick={() => setJoinMode(o.id)} style={{ display: "flex", alignItems: "center", gap: 12, textAlign: "left", padding: "12px 14px", borderRadius: 10, cursor: "pointer", border: `1.5px solid ${C.ink}`, background: joinMode === o.id ? C.ink : "transparent", color: joinMode === o.id ? C.card : C.ink }}>
                    <o.icon size={20} color={joinMode === o.id ? C.card : o.id === "crew" ? C.teal : C.soft} />
                    <span style={{ flex: 1 }}>
                      <span className="q8-body" style={{ display: "block", fontSize: 15, fontWeight: 700 }}>{o.t}</span>
                      <span className="q8-body" style={{ display: "block", fontSize: 12, opacity: 0.75 }}>{o.s}</span>
                    </span>
                    {joinMode === o.id && <Check size={18} />}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Start-list visibility">
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { v: false, icon: Users, t: "Show my name", s: "Everyone in the group sees you're in" },
                  { v: true, icon: EyeOff, t: "Hide my name", s: "Members see \u201CPrivate runner\u201D — only the race director sees your name" },
                ].map((o) => (
                  <button key={String(o.v)} className="q8-press" onClick={() => setJoinAnon(o.v)} style={{ display: "flex", alignItems: "center", gap: 12, textAlign: "left", padding: "12px 14px", borderRadius: 10, cursor: "pointer", border: `1.5px solid ${C.ink}`, background: joinAnon === o.v ? C.ink : "transparent", color: joinAnon === o.v ? C.card : C.ink }}>
                    <o.icon size={20} color={joinAnon === o.v ? C.card : C.soft} />
                    <span style={{ flex: 1 }}>
                      <span className="q8-body" style={{ display: "block", fontSize: 15, fontWeight: 700 }}>{o.t}</span>
                      <span className="q8-body" style={{ display: "block", fontSize: 12, opacity: 0.75 }}>{o.s}</span>
                    </span>
                    {joinAnon === o.v && <Check size={18} />}
                  </button>
                ))}
              </div>
            </Field>
            <div style={{ display: "flex", gap: 10 }}>
              {(startLists[joinTarget.id] || []).some((j) => j.is_self) && (
                <Btn kind="outline" onClick={() => { const t = joinTarget; setJoinTarget(null); withdraw(t); }} style={{ flex: 1, borderColor: C.danger, color: C.danger }}>
                  Withdraw
                </Btn>
              )}
              <Btn kind="accent" onClick={confirmJoin} disabled={!joinDist} style={{ flex: 2 }}>
                Confirm entry
              </Btn>
            </div>
          </Sheet>
        )}

        {/* add / edit race sheet */}
        {addOpen && (
          <Sheet title={editingEvent ? "Edit race" : tab === "intl" ? "Add international race" : "Add local race"} onClose={resetEventForm}>
            <Field label="Race link — UTMB links auto-fill the name">
              <input style={inputStyle} value={fLink}
                onChange={(e) => {
                  const v = e.target.value;
                  setFLink(v);
                  if (!fName.trim()) { const n = utmbNameFromLink(v); if (n) setFName(n); }
                }}
                placeholder="Paste registration link (optional)" />
            </Field>
            <Field label="Race name"><input style={inputStyle} value={fName} onChange={(e) => setFName(e.target.value)} placeholder="e.g. Cappadocia Ultra-Trail" /></Field>
            <Field label="Date"><input type="date" style={inputStyle} value={fDate} min={editingEvent ? undefined : todayISO()} onChange={(e) => setFDate(e.target.value)} /></Field>
            <Field label={(editingEvent ? editingEvent.scope : tab) === "intl" ? "Location (city / area)" : "Location in Kuwait"}>
              <input style={inputStyle} value={fLoc} onChange={(e) => setFLoc(e.target.value)} placeholder={(editingEvent ? editingEvent.scope : tab) === "intl" ? "e.g. Ürgüp" : "e.g. Kabd, Salmi Road"} />
            </Field>
            {(editingEvent ? editingEvent.scope : tab) === "intl" && (
              <Field label="Country"><input style={inputStyle} value={fCountry} onChange={(e) => setFCountry(e.target.value)} placeholder="e.g. Türkiye" /></Field>
            )}
            <Field label="Distances (tap or type, comma separated)">
              <input style={inputStyle} value={fDists} onChange={(e) => setFDists(e.target.value)} placeholder="e.g. 10K, 21K, 50K, 100K" />
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                {DIST_PRESETS.map((d) => {
                  const cur = fDists.split(/[,،]/).map((s) => s.trim().toUpperCase()).filter(Boolean);
                  const on = cur.includes(d);
                  return (
                    <DistChip key={d} label={d} small active={on}
                      onClick={() => setFDists((on ? cur.filter((x) => x !== d) : [...cur, d]).join(", "))} />
                  );
                })}
              </div>
            </Field>
            <Btn kind="accent" onClick={saveEvent} style={{ width: "100%" }}>{editingEvent ? "Save changes" : "Add to the board"}</Btn>
          </Sheet>
        )}

        {/* settings sheet */}
        {settingsOpen && (
          <Sheet title="Settings" onClose={() => setSettingsOpen(false)}>
            <div style={{ marginBottom: 14 }}>
              <Eyebrow>Signed in as</Eyebrow>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.ink, marginTop: 3 }}>{user.email}</div>
            </div>
            <Field label="Your name">
              <div style={{ display: "flex", gap: 8 }}>
                <input style={{ ...inputStyle, flex: 1 }} value={nameEdit} onChange={(e) => setNameEdit(e.target.value)} />
                <Btn small onClick={updateName} disabled={!nameEdit.trim() || nameEdit.trim() === profile?.name}>Save</Btn>
              </div>
            </Field>
            <Btn small kind="outline" onClick={logout} style={{ borderColor: C.danger, color: C.danger }}><LogOut size={14} /> Log out</Btn>

            <div style={{ borderTop: "1.5px solid rgba(15,28,35,0.15)", margin: "16px 0", paddingTop: 16 }}>
              <div style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <Shield size={15} color={C.teal} /><Eyebrow color={C.ink}>Race director</Eyebrow>
              </div>
              <div style={{ fontSize: 13, color: director ? C.teal : C.soft, fontWeight: director ? 700 : 400, lineHeight: 1.5 }}>
                {director
                  ? "This is a director account — you can post announcements, add or edit any race, hide races from members, remove anything or anyone from a start list, and see hidden names."
                  : "Director rights are granted by the admin at the database level — no PIN, nothing to leak."}
              </div>
            </div>

            <div style={{ borderTop: "1.5px solid rgba(15,28,35,0.15)", marginTop: 16, paddingTop: 14, fontSize: 12, color: C.soft, lineHeight: 1.5 }}>
              Q8_ULTRA · Boards, start lists, announcements and the wall are visible to signed-in members. Hidden entries are masked by the server — members receive "Private runner", never your name.
            </div>
          </Sheet>
        )}
      </div>
    </div>
  );
}
