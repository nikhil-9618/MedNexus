import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import {
  Activity, AlertTriangle, Building2, ChevronRight, FlaskConical, HeartPulse,
  Pill, Radio, RefreshCw, Stethoscope, Users, X,
} from 'lucide-react';
import { adminService } from '../../services/adminService.js';
import { useAsync } from '../../hooks/useAsync.js';
import { apiError } from '../../services/api.js';
import { Loader } from '../../components/common/Loader.jsx';

/* ------------------------------------------------------------------ *
 * Layout — a fixed grid derived from the API's department order, so a
 * department always occupies the same building block between reloads.
 * Positions are pure functions of the index. No randomness anywhere.
 * ------------------------------------------------------------------ */
const COLUMNS = 5;
const SPACING = 7;

function slotFor(index) {
  const col = index % COLUMNS;
  const row = Math.floor(index / COLUMNS);
  const rows = Math.ceil(14 / COLUMNS);
  return {
    x: (col - (COLUMNS - 1) / 2) * SPACING,
    z: (row - (rows - 1) / 2) * SPACING,
  };
}

/* Staffing/queue load -> a named operational state. Pure function of real rows. */
function loadState(dept) {
  const waiting = (dept.waiting || []).length;
  const inConsult = (dept.inConsultation || []).length;
  const load = waiting + inConsult * 2;
  if (dept.code === 'EMER' && load > 0) return 'CRITICAL';
  if (waiting >= 8) return 'CRITICAL';
  if (waiting >= 5) return 'HIGH LOAD';
  if (waiting >= 2) return 'BUSY';
  if (load === 0 && (dept.completedCount || 0) === 0 && (dept.totalInDepartment || 0) === 0) return 'IDLE';
  return 'NORMAL';
}

const STATE_COLOR = {
  IDLE: '#1f3a4f',
  NORMAL: '#2f5f79',
  BUSY: '#0f8b9c',
  'HIGH LOAD': '#c98a2b',
  CRITICAL: '#c0392b',
};

const STATE_RING = {
  IDLE: 'ring-slate-600',
  NORMAL: 'ring-brand-400',
  BUSY: 'ring-brand-300',
  'HIGH LOAD': 'ring-amber-300',
  CRITICAL: 'ring-rose-400',
};

/* ------------------------------------------------------------------ *
 * 3D building blocks
 * ------------------------------------------------------------------ */

function DepartmentBlock({ dept, index, selected, onSelect }) {
  const { x, z } = slotFor(index);
  const waiting = (dept.waiting || []).length;
  const inConsult = (dept.inConsultation || []).length;
  const state = loadState(dept);
  // Height encodes the real queue depth, not a decorative value.
  const height = 1.4 + Math.min(waiting, 10) * 0.22;
  const color = STATE_COLOR[state];

  return (
    <group position={[x, 0, z]}>
      <mesh
        position={[0, height / 2, 0]}
        castShadow
        receiveShadow
        onClick={(e) => {
          e.stopPropagation();
          onSelect(dept.code);
        }}
      >
        <boxGeometry args={[4.6, height, 4.6]} />
        <meshStandardMaterial
          color={color}
          roughness={0.55}
          metalness={0.28}
          emissive={color}
          emissiveIntensity={state === 'CRITICAL' ? 0.42 : 0.14}
        />
      </mesh>

      {/* Floor plinth */}
      <mesh position={[0, 0.04, 0]} receiveShadow>
        <boxGeometry args={[5.2, 0.08, 5.2]} />
        <meshStandardMaterial color="#0c2233" roughness={0.9} />
      </mesh>

      {/* Selection ring */}
      {selected && (
        <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[3.1, 3.35, 48]} />
          <meshBasicMaterial color="#6FF7F2" side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Now serving marker */}
      {dept.nowServing && (
        <mesh position={[0, height + 0.75, 0]}>
          <sphereGeometry args={[0.34, 20, 20]} />
          <meshStandardMaterial color="#6FF7F2" emissive="#6FF7F2" emissiveIntensity={1.5} />
        </mesh>
      )}

      {/* Waiting tokens — one mesh per real waiting row, placed deterministically */}
      {(dept.waiting || []).slice(0, 15).map((w, i) => (
        <mesh
          key={w.queueId || i}
          position={[
            -1.7 + (i % 5) * 0.85,
            0.42,
            3.35 + Math.floor(i / 5) * 0.85,
          ]}
          castShadow
        >
          <capsuleGeometry args={[0.19, 0.42, 4, 10]} />
          <meshStandardMaterial
            color="#e2f4f8"
            emissive="#22C7C9"
            emissiveIntensity={0.22}
            roughness={0.4}
          />
        </mesh>
      ))}

      {/* In-consultation patients rendered inside the block footprint */}
      {(dept.inConsultation || []).slice(0, 6).map((c, i) => (
        <mesh key={c.queueId || i} position={[-1.2 + i * 0.9, height + 0.32, 0]}>
          <capsuleGeometry args={[0.2, 0.46, 4, 10]} />
          <meshStandardMaterial color="#f6d48a" emissive="#c98a2b" emissiveIntensity={0.4} />
        </mesh>
      ))}

      {/* Doctors on station — one marker per real active doctor in this department */}
      {(dept.doctors || []).slice(0, 6).map((d, i) => (
        <mesh key={d.id || i} position={[-2.05, height * 0.5, -2.05 + i * 0.62]}>
          <cylinderGeometry args={[0.16, 0.16, height * 0.9, 12]} />
          <meshStandardMaterial color="#6FF7F2" emissive="#087F8C" emissiveIntensity={0.5} />
        </mesh>
      ))}

      <Html
        center
        position={[0, height + 1.5, 0]}
        style={{ pointerEvents: 'none', transform: 'translateY(-6px)' }}
      >
        <div className="whitespace-nowrap rounded-md border border-white/15 bg-slate-950/80 px-2 py-1 text-center backdrop-blur">
          <p className="text-[10px] font-bold leading-none text-white">{dept.code}</p>
          <p className="mt-0.5 text-[9px] font-semibold leading-none text-brand-200">
            {waiting} waiting · {inConsult} in consult
          </p>
        </div>
      </Html>
    </group>
  );
}

/* ------------------------------------------------------------------ *
 * Real workflow pathways: department -> Laboratory / Pharmacy, drawn
 * only when that department actually has pending lab orders or scripts.
 * ------------------------------------------------------------------ */

function FlowPath({ from, to, color }) {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setFromPoints([
      new THREE.Vector3(from[0], 1.1, from[2]),
      new THREE.Vector3((from[0] + to[0]) / 2, 2.4, (from[2] + to[2]) / 2),
      new THREE.Vector3(to[0], 1.1, to[2]),
    ]);
    // lineDashedMaterial reads the lineDistance attribute, which only exists
    // after computeLineDistances(). Without this the dashes never render.
    new THREE.Line(g).computeLineDistances();
    return g;
  }, [from, to]);

  return (
    <line geometry={geometry}>
      <lineDashedMaterial color={color} dashSize={0.7} gapSize={0.5} transparent opacity={0.6} />
    </line>
  );
}

/* ------------------------------------------------------------------ *
 * Camera rig — lerps to the active focus target. Pure interpolation.
 * ------------------------------------------------------------------ */

function CameraRig({ focus, deptIndexByCode }) {
  const { camera } = useThree();
  const desired = useRef({ pos: new THREE.Vector3(0, 40, 34), look: new THREE.Vector3(0, 0, 0) });

  useEffect(() => {
    if (focus === 'overview' || !focus) {
      desired.current = { pos: new THREE.Vector3(0, 40, 34), look: new THREE.Vector3(0, 0, 0) };
      return;
    }
    const index = deptIndexByCode[focus];
    if (index === undefined) {
      desired.current = { pos: new THREE.Vector3(0, 40, 34), look: new THREE.Vector3(0, 0, 0) };
      return;
    }
    const { x, z } = slotFor(index);
    desired.current = {
      pos: new THREE.Vector3(x * 0.6, 17, z + 15),
      look: new THREE.Vector3(x, 1.4, z),
    };
  }, [focus, deptIndexByCode]);

  useFrame(() => {
    camera.position.lerp(desired.current.pos, 0.06);
    camera.lookAt(desired.current.look);
  });

  return null;
}

/* ------------------------------------------------------------------ *
 * Scene
 * ------------------------------------------------------------------ */

function Scene({ departments, selectedCode, onSelect, focus, deptIndexByCode, labByDept, pharmByDept }) {
  const labIndex = deptIndexByCode.LAB;
  const pharmIndex = deptIndexByCode.PHARM;

  // Only departments that genuinely produced lab orders / scripts get a pathway.
  const labPaths = departments.filter((d) => (labByDept[d.code] || 0) > 0);
  const pharmPaths = departments.filter((d) => (pharmByDept[d.code] || 0) > 0);

  return (
    <>
      <color attach="background" args={['#061320']} />
      <fog attach="fog" args={['#061320', 45, 95]} />

      <ambientLight intensity={0.55} />
      <hemisphereLight intensity={0.35} groundColor="#0b2130" />
      <directionalLight
        position={[18, 30, 16]}
        intensity={1.15}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-34}
        shadow-camera-right={34}
        shadow-camera-top={34}
        shadow-camera-bottom={-34}
      />
      <directionalLight position={[-22, 16, -14]} intensity={0.32} color="#22C7C9" />

      {/* Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[120, 120]} />
        <meshStandardMaterial color="#08202e" roughness={0.95} metalness={0.05} />
      </mesh>
      <gridHelper args={[120, 60, '#123b4f', '#0d2b3b']} position={[0, 0.02, 0]} />

      {departments.map((d, i) => (
        <DepartmentBlock
          key={d.code}
          dept={d}
          index={i}
          selected={selectedCode === d.code}
          onSelect={onSelect}
        />
      ))}

      {labIndex !== undefined &&
        labPaths.map((d) => {
          const i = deptIndexByCode[d.code];
          if (i === undefined) return null;
          const from = slotFor(i);
          const to = slotFor(labIndex);
          return (
            <FlowPath
              key={`lab-${d.code}`}
              from={[from.x, 0, from.z]}
              to={[to.x, 0, to.z]}
              color="#22C7C9"
            />
          );
        })}

      {pharmIndex !== undefined &&
        pharmPaths.map((d) => {
          const i = deptIndexByCode[d.code];
          if (i === undefined) return null;
          const from = slotFor(i);
          const to = slotFor(pharmIndex);
          return (
            <FlowPath
              key={`rx-${d.code}`}
              from={[from.x, 0, from.z]}
              to={[to.x, 0, to.z]}
              color="#6FF7F2"
            />
          );
        })}

      <CameraRig focus={focus} deptIndexByCode={deptIndexByCode} />
      <OrbitControls
        enabled
        enablePan
        maxPolarAngle={Math.PI / 2.35}
        minDistance={12}
        maxDistance={80}
        target={[0, 0, 0]}
      />
      <mesh visible={false} onClick={() => onSelect(null)}>
        <boxGeometry args={[200, 0.01, 200]} />
      </mesh>
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Page
 * ------------------------------------------------------------------ */

export default function AdminDigitalTwinPage() {
  const { data, loading, error, refetch } = useAsync(() => adminService.digitalTwin(), []);
  const [selectedCode, setSelectedCode] = useState(null);
  const [focus, setFocus] = useState('overview');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [live, setLive] = useState(true);

  const departments = useMemo(() => data?.departments || [], [data]);

  const deptIndexByCode = useMemo(() => {
    const map = {};
    departments.forEach((d, i) => {
      map[d.code] = i;
    });
    return map;
  }, [departments]);

  const summary = data?.todaySummary || {};
  const selected = departments.find((d) => d.code === selectedCode) || null;

  /* Live polling of the real endpoint — pausing only stops the view. */
  useEffect(() => {
    if (!autoRefresh || !live) return undefined;
    const id = setInterval(() => refetch(), 15000);
    return () => clearInterval(id);
  }, [autoRefresh, live, refetch]);

  /* Keyboard camera presets (spec §26) */
  useEffect(() => {
    function onKey(e) {
      if (e.target && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      const map = { 1: 'overview', 2: 'EMER', 3: 'LAB', 4: 'PHARM', 5: 'WARD', 6: 'GENMED' };
      if (e.key === 'Escape') {
        setSelectedCode(null);
        setFocus('overview');
      } else if (map[e.key]) {
        setFocus(map[e.key]);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleSelect = useCallback((code) => {
    setSelectedCode(code);
    setFocus(code || 'overview');
  }, []);

  /* Real event stream derived from queue timestamps. */
  const events = useMemo(() => {
    const rows = [];
    (data?.queues || []).forEach((q) => {
      const who = q.patient?.patientId || 'patient';
      if (q.arrivedAt) rows.push({ at: q.arrivedAt, text: `${who} joined ${q.departmentName} queue (${q.tokenCode})` });
      if (q.calledAt) rows.push({ at: q.calledAt, text: `${q.tokenCode} called — now serving at ${q.departmentName}` });
      if (q.consultationStartedAt) rows.push({ at: q.consultationStartedAt, text: `Consultation started for ${who} (${q.tokenCode})` });
      if (q.completedAt) rows.push({ at: q.completedAt, text: `${q.tokenCode} completed at ${q.departmentName}` });
    });
    return rows
      .filter((r) => r.at)
      .sort((a, b) => new Date(b.at) - new Date(a.at))
      .slice(0, 9);
  }, [data]);

  /* Lab / pharmacy demand per department — the API returns these as flat arrays. */
  const labByDept = useMemo(() => {
    const m = {};
    (data?.pendingLabOrders || []).forEach((o) => {
      if (o.departmentCode) m[o.departmentCode] = (m[o.departmentCode] || 0) + 1;
    });
    return m;
  }, [data]);

  const pharmByDept = useMemo(() => {
    const m = {};
    (data?.pendingPrescriptions || []).forEach((r) => {
      if (r.departmentCode) m[r.departmentCode] = (m[r.departmentCode] || 0) + 1;
    });
    return m;
  }, [data]);

  const totals = useMemo(() => {
    const waiting = departments.reduce((n, d) => n + (d.waiting || []).length, 0);
    const inConsult = departments.reduce((n, d) => n + (d.inConsultation || []).length, 0);
    const nowServing = departments.filter((d) => d.nowServing).length;
    const doctorsActive = departments.reduce((n, d) => n + (d.doctors || []).length, 0);
    return { waiting, inConsult, nowServing, doctorsActive };
  }, [departments]);

  const noActivity =
    !loading && totals.waiting === 0 && totals.inConsult === 0 && (data?.activeConsultations || []).length === 0;

  if (loading && !data) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <Loader label="Loading live hospital state…" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-6">
        <p className="flex items-center gap-2 font-bold text-rose-700">
          <AlertTriangle className="h-4 w-4" /> {apiError(error)}
        </p>
        <p className="mt-2 text-sm text-slate-500">
          The digital twin is restricted to administrator accounts.
        </p>
        <button onClick={() => refetch()} className="btn-secondary mt-4 px-4 py-2 text-xs">
          <RefreshCw className="mr-1.5 inline h-3.5 w-3.5" /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-600">MedNexus</p>
          <h2 className="font-display text-2xl font-bold text-slate-900">Hospital Digital Twin</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Every building, token and pathway below is read live from the MedNexus database.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setLive((v) => !v)}
            className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold ring-1 transition-colors ${
              live
                ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                : 'bg-slate-100 text-slate-500 ring-slate-200'
            }`}
          >
            <Radio className={`h-3.5 w-3.5 ${live ? 'animate-pulse' : ''}`} />
            {live ? 'LIVE' : 'PAUSED'}
          </button>
          <button
            onClick={() => { setAutoRefresh((v) => !v); }}
            className="btn-ghost px-3 py-2 text-xs"
            title="Auto-refresh every 15s"
          >
            {autoRefresh ? 'Auto' : 'Manual'}
          </button>
          <button onClick={() => refetch()} className="btn-secondary px-3.5 py-2 text-xs">
            <RefreshCw className="mr-1.5 inline h-3.5 w-3.5" /> Refresh
          </button>
        </div>
      </div>

      {/* Command HUD — all values from the API */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: Users, label: 'Waiting', value: summary.totalWaiting ?? totals.waiting, tone: 'text-brand-600', bg: 'bg-brand-50' },
          { icon: Stethoscope, label: 'In consultation', value: summary.totalInConsultation ?? totals.inConsult, tone: 'text-amber-600', bg: 'bg-amber-50' },
          { icon: Radio, label: 'Now serving', value: summary.totalNowServing ?? totals.nowServing, tone: 'text-emerald-600', bg: 'bg-emerald-50' },
          { icon: Activity, label: 'Appointments today', value: summary.appointmentsToday ?? 0, tone: 'text-violet-600', bg: 'bg-violet-50' },
          { icon: FlaskConical, label: 'Pending lab orders', value: summary.pendingLabOrders ?? 0, tone: 'text-cyan-700', bg: 'bg-cyan-50' },
          { icon: Pill, label: 'Pending prescriptions', value: summary.pendingPrescriptions ?? 0, tone: 'text-teal-700', bg: 'bg-teal-50' },
          { icon: HeartPulse, label: 'Emergency cases', value: summary.emergencyCases ?? 0, tone: 'text-rose-600', bg: 'bg-rose-50' },
          { icon: Building2, label: 'Doctors on station', value: totals.doctorsActive, tone: 'text-slate-700', bg: 'bg-slate-100' },
        ].map((s) => (
          <div key={s.label} className="card flex items-center gap-3 p-4">
            <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${s.bg} ${s.tone}`}>
              <s.icon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{s.label}</p>
              <p className="font-display text-xl font-bold text-slate-900">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* 3D + panels */}
      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <div className="relative overflow-hidden rounded-2xl ring-1 ring-slate-900/10">
          <div className="absolute left-4 top-4 z-10 flex items-center gap-2 rounded-lg border border-white/10 bg-slate-950/70 px-3 py-1.5 backdrop-blur">
            <span className={`h-2 w-2 rounded-full ${noActivity ? 'bg-slate-500' : 'bg-emerald-400'}`} />
            <p className="text-[11px] font-bold tracking-wide text-white">
              {noActivity ? 'HOSPITAL IDLE' : 'LIVE OPERATIONS'}
            </p>
          </div>

          <div className="absolute right-4 top-4 z-10 rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 backdrop-blur">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-200">Camera</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {[
                { k: '1', label: 'Overview', code: 'overview' },
                { k: '2', label: 'Emergency', code: 'EMER' },
                { k: '3', label: 'Lab', code: 'LAB' },
                { k: '4', label: 'Pharmacy', code: 'PHARM' },
                { k: '5', label: 'Ward', code: 'WARD' },
              ].map((c) => (
                <button
                  key={c.k}
                  onClick={() => setFocus(c.code)}
                  className={`rounded px-2 py-0.5 text-[10px] font-bold transition-colors ${
                    focus === c.code ? 'bg-brand-500 text-white' : 'bg-white/10 text-brand-100 hover:bg-white/20'
                  }`}
                >
                  {c.k} {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="h-[62vh] min-h-[420px] w-full">
            <Canvas
              shadows
              dpr={[1, 1.6]}
              camera={{ position: [0, 40, 34], fov: 42, near: 0.5, far: 240 }}
              gl={{ antialias: true, powerPreference: 'high-performance' }}
            >
              <Suspense fallback={null}>
                <Scene
                  departments={departments}
                  selectedCode={selectedCode}
                  onSelect={handleSelect}
                  focus={focus}
                  deptIndexByCode={deptIndexByCode}
                  labByDept={labByDept}
                  pharmByDept={pharmByDept}
                />
              </Suspense>
            </Canvas>
          </div>

          {noActivity && (
            <div className="absolute inset-x-0 bottom-6 z-10 mx-auto w-fit rounded-xl border border-white/10 bg-slate-950/85 px-5 py-3 text-center backdrop-blur">
              <p className="text-xs font-bold text-white">No active hospital activity</p>
              <p className="mt-0.5 text-[11px] text-slate-300">
                Waiting for live operational data. The environment will populate as bookings, queues
                and consultations happen.
              </p>
            </div>
          )}

          <div className="absolute bottom-4 left-4 z-10 flex flex-wrap gap-3 rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 backdrop-blur">
            {['NORMAL', 'BUSY', 'HIGH LOAD', 'CRITICAL'].map((s) => (
              <span key={s} className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-200">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: STATE_COLOR[s] }} />
                {s}
              </span>
            ))}
          </div>
        </div>

        {/* Right column: department inspector + event stream */}
        <div className="space-y-4">
          {selected ? (
            <div className="card p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-xs font-bold text-brand-600">{selected.code}</p>
                  <h3 className="font-display text-lg font-bold text-slate-900">{selected.name}</h3>
                </div>
                <button
                  onClick={() => handleSelect(null)}
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                  aria-label="Close department"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <span
                className={`mt-3 inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-[11px] font-bold text-white ring-2 ${STATE_RING[loadState(selected)]}`}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATE_COLOR[loadState(selected)] }} />
                {loadState(selected)}
              </span>

              <dl className="mt-4 space-y-2 text-sm">
                {[
                  ['Doctors on station', (selected.doctors || []).length],
                  ['Waiting', (selected.waiting || []).length],
                  ['In consultation', (selected.inConsultation || []).length],
                  ['Completed', selected.completedCount ?? 0],
                  ['Now serving', selected.nowServing ? selected.nowServing.tokenCode : '—'],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between">
                    <dt className="text-slate-500">{k}</dt>
                    <dd className="font-bold text-slate-800">{v}</dd>
                  </div>
                ))}
              </dl>

              {(selected.waiting || []).length > 0 && (
                <div className="mt-4">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Active queue</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {selected.waiting.slice(0, 14).map((w) => (
                      <span
                        key={w.queueId}
                        className="rounded-md bg-slate-100 px-2 py-1 font-mono text-[10px] font-bold text-slate-600"
                      >
                        {w.tokenCode}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {(selected.doctors || []).length > 0 && (
                <div className="mt-4">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Doctors</p>
                  <ul className="mt-2 space-y-1.5">
                    {selected.doctors.map((d) => (
                      <li key={d.id} className="flex items-center justify-between text-xs">
                        <span className="truncate text-slate-600">{d.name || d.doctorId}</span>
                        <span className="shrink-0 font-mono text-slate-500">{d.doctorId}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="card p-5">
              <p className="text-sm font-bold text-slate-900">Department control</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Select a building in the twin to inspect its live operational state.
              </p>
              <ul className="mt-3 space-y-1">
                {departments
                  .slice()
                  .sort((a, b) => (b.waiting || []).length - (a.waiting || []).length)
                  .slice(0, 6)
                  .map((d) => (
                    <li key={d.code}>
                      <button
                        onClick={() => handleSelect(d.code)}
                        className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs hover:bg-slate-50"
                      >
                        <span className="flex items-center gap-2 text-slate-600">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: STATE_COLOR[loadState(d)] }}
                          />
                          {d.name}
                        </span>
                        <span className="flex items-center gap-1 font-bold text-slate-700">
                          {(d.waiting || []).length}
                          <ChevronRight className="h-3 w-3 text-slate-500" />
                        </span>
                      </button>
                    </li>
                  ))}
              </ul>
            </div>
          )}

          <div className="card p-5">
            <p className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
              <Activity className="h-4 w-4 text-brand-600" /> Live event stream
            </p>
            {events.length === 0 ? (
              <p className="mt-2 text-xs text-slate-500">No operational events recorded yet.</p>
            ) : (
              <ul className="mt-3 space-y-2.5">
                {events.map((e, i) => (
                  <li key={`${e.at}-${i}`} className="flex gap-2.5 text-xs">
                    <span className="shrink-0 font-mono text-slate-500">
                      {new Date(e.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="text-slate-600">{e.text}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="px-1 text-[11px] leading-5 text-slate-500">
            Source: {data?.dataSource || 'MedNexus database'} · Patients are rendered as
            privacy-preserving markers; no diagnosis or clinical note is ever placed in the scene.
          </p>
        </div>
      </div>
    </div>
  );
}
