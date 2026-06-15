import { useEffect, useMemo, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { adminEmails, auth, db, firebaseReady, storage } from './firebase';
import { loadLocalData, loadLocalProfile, resetLocalDemo, saveLocalData, saveLocalProfile } from './localStore';
import { sampleData } from './sampleData';
import type { AppData, AttendanceLog, Bill, Booking, Branch, ContentItem, Desk, Member, Profile } from './types';
import { branchName, calculateUsage, currentMonthKey, dateLabel, diffHours, initials, money, monthName, todayKey, uid } from './utils';

const emptyData: AppData = { branches: [], members: [], desks: [], bills: [], bookings: [], content: [], attendanceLogs: [] };
const COLLECTIONS = ['branches', 'members', 'desks', 'bills', 'bookings', 'content', 'attendanceLogs'] as const;
type Page = 'dashboard' | 'members' | 'desks' | 'usage' | 'billing' | 'bookings' | 'content' | 'settings';
type MemberTab = 'home' | 'orders' | 'dashboard' | 'profile';

function App() {
  const [mode, setMode] = useState<'firebase' | 'demo'>(firebaseReady ? 'firebase' : 'demo');
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(() => mode === 'demo' ? loadLocalProfile() : null);
  const [data, setData] = useState<AppData>(() => mode === 'demo' ? loadLocalData() : emptyData);
  const [loading, setLoading] = useState(firebaseReady);
  const [message, setMessage] = useState('');

  const isFirebaseMode = mode === 'firebase' && firebaseReady && auth && db;

  useEffect(() => {
    if (!isFirebaseMode || !auth) return;
    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setLoading(false);
    });
    return () => unsub();
  }, [isFirebaseMode]);

  useEffect(() => {
    if (!isFirebaseMode || !db || !firebaseUser) {
      if (mode === 'demo') {
        setData(loadLocalData());
        setProfile(loadLocalProfile());
      }
      return;
    }
    const unsubs: Array<() => void> = [];
    const userProfileRef = doc(db, 'profiles', firebaseUser.uid);
    unsubs.push(onSnapshot(userProfileRef, (snap) => {
      setProfile(snap.exists() ? ({ uid: snap.id, ...snap.data() } as Profile) : null);
    }));
    return () => unsubs.forEach((unsub) => unsub());
  }, [isFirebaseMode, firebaseUser, mode]);

  useEffect(() => {
    if (!isFirebaseMode || !db || !firebaseUser || !profile) return;
    const unsubs: Array<() => void> = [];
    const setCollection = <T extends keyof AppData>(key: T, list: AppData[T]) => setData((prev) => ({ ...prev, [key]: list }));

    if (profile.role === 'admin' || profile.role === 'host') {
      COLLECTIONS.forEach((name) => {
        unsubs.push(onSnapshot(collection(db, name), (snap) => {
          setCollection(name, snap.docs.map((d) => ({ id: d.id, ...d.data() })) as never);
        }));
      });
    } else {
      unsubs.push(onSnapshot(collection(db, 'branches'), (snap) => setCollection('branches', snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Branch[])));
      unsubs.push(onSnapshot(query(collection(db, 'members'), where('email', '==', firebaseUser.email || '')), (snap) => setCollection('members', snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Member[])));
      unsubs.push(onSnapshot(query(collection(db, 'content'), where('status', '==', 'Published')), (snap) => setCollection('content', snap.docs.map((d) => ({ id: d.id, ...d.data() })) as ContentItem[])));
      if (profile.memberId) {
        unsubs.push(onSnapshot(query(collection(db, 'bills'), where('memberId', '==', profile.memberId)), (snap) => setCollection('bills', snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Bill[])));
        unsubs.push(onSnapshot(query(collection(db, 'bookings'), where('memberId', '==', profile.memberId)), (snap) => setCollection('bookings', snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Booking[])));
        unsubs.push(onSnapshot(query(collection(db, 'attendanceLogs'), where('memberId', '==', profile.memberId)), (snap) => setCollection('attendanceLogs', snap.docs.map((d) => ({ id: d.id, ...d.data() })) as AttendanceLog[])));
      }
    }
    return () => unsubs.forEach((unsub) => unsub());
  }, [isFirebaseMode, firebaseUser, profile]);

  useEffect(() => {
    if (!profile || profile.role !== 'member' || profile.memberId || !firebaseUser) return;
    const matchedMember = data.members.find((m) => m.email.toLowerCase() === profile.email.toLowerCase());
    if (!matchedMember) return;
    if (isFirebaseMode && db) {
      updateDoc(doc(db, 'profiles', firebaseUser.uid), { memberId: matchedMember.id }).catch(() => undefined);
    } else {
      const updated = { ...profile, memberId: matchedMember.id };
      saveLocalProfile(updated);
      setProfile(updated);
    }
  }, [profile, data.members, firebaseUser, isFirebaseMode]);

  useEffect(() => {
    if (mode === 'demo') saveLocalData(data);
  }, [data, mode]);

  const showMessage = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(''), 3200);
  };

  const localCommit = <K extends keyof AppData>(key: K, updater: (items: AppData[K]) => AppData[K]) => {
    setData((prev) => ({ ...prev, [key]: updater(prev[key]) }));
  };

  const actions = {
    async seedFirebase() {
      if (!isFirebaseMode || !db) return showMessage('Firebase is not configured yet. Demo data is already available locally.');
      const batch = writeBatch(db);
      for (const branch of sampleData.branches) batch.set(doc(db, 'branches', branch.id), branch);
      for (const member of sampleData.members) batch.set(doc(db, 'members', member.id), member);
      for (const desk of sampleData.desks) batch.set(doc(db, 'desks', desk.id), desk);
      for (const bill of sampleData.bills) batch.set(doc(db, 'bills', bill.id), bill);
      for (const booking of sampleData.bookings) batch.set(doc(db, 'bookings', booking.id), booking);
      for (const item of sampleData.content) batch.set(doc(db, 'content', item.id), item);
      for (const log of sampleData.attendanceLogs) batch.set(doc(db, 'attendanceLogs', log.id), log);
      await batch.commit();
      showMessage('Demo data added to Firestore.');
    },
    async bootstrapProfile(role: 'admin' | 'member') {
      if (!firebaseUser) return;
      if (isFirebaseMode && db) {
        const matchedMember = data.members.find((m) => m.email.toLowerCase() === firebaseUser.email?.toLowerCase());
        await setDoc(doc(db, 'profiles', firebaseUser.uid), {
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: firebaseUser.displayName || firebaseUser.email || '',
          role,
          memberId: role === 'member' ? matchedMember?.id : undefined,
          createdAt: new Date().toISOString(),
        });
      }
      showMessage(`${role === 'admin' ? 'Admin' : 'Member'} profile created.`);
    },
    async saveMember(member: Member) {
      const next = { ...member, updatedAt: new Date().toISOString() };
      if (isFirebaseMode && db) await setDoc(doc(db, 'members', next.id), next, { merge: true });
      else localCommit('members', (items) => (items.some((m) => m.id === next.id) ? items.map((m) => m.id === next.id ? next : m) : [...items, next]));
      showMessage('Member saved. User app will update automatically.');
    },
    async deleteMember(memberId: string) {
      if (isFirebaseMode && db) await deleteDoc(doc(db, 'members', memberId));
      else localCommit('members', (items) => items.filter((m) => m.id !== memberId));
      showMessage('Member removed.');
    },
    async saveDesk(desk: Desk) {
      if (isFirebaseMode && db) await setDoc(doc(db, 'desks', desk.id), desk, { merge: true });
      else localCommit('desks', (items) => (items.some((d) => d.id === desk.id) ? items.map((d) => d.id === desk.id ? desk : d) : [...items, desk]));
      showMessage('Desk status updated.');
    },
    async saveBill(bill: Bill) {
      const next = { ...bill, createdAt: bill.createdAt || new Date().toISOString() };
      if (isFirebaseMode && db) await setDoc(doc(db, 'bills', next.id), next, { merge: true });
      else localCommit('bills', (items) => (items.some((b) => b.id === next.id) ? items.map((b) => b.id === next.id ? next : b) : [...items, next]));
      showMessage('Bill saved and visible in member orders.');
    },
    async saveBooking(booking: Booking) {
      const next = { ...booking, createdAt: booking.createdAt || new Date().toISOString() };
      if (isFirebaseMode && db) await setDoc(doc(db, 'bookings', next.id), next, { merge: true });
      else localCommit('bookings', (items) => (items.some((b) => b.id === next.id) ? items.map((b) => b.id === next.id ? next : b) : [...items, next]));
      showMessage('Booking saved and visible in member app.');
    },
    async saveContent(item: ContentItem) {
      const next = { ...item, createdAt: item.createdAt || new Date().toISOString() };
      if (isFirebaseMode && db) await setDoc(doc(db, 'content', next.id), next, { merge: true });
      else localCommit('content', (items) => (items.some((c) => c.id === next.id) ? items.map((c) => c.id === next.id ? next : c) : [...items, next]));
      showMessage('Content saved. Published content appears on member home.');
    },
    async checkIn(memberId: string) {
      const now = new Date().toISOString();
      const log: AttendanceLog = { id: uid('att'), memberId, dateKey: todayKey(), monthKey: currentMonthKey(), checkInAt: now, createdAt: now };
      if (isFirebaseMode && db) await setDoc(doc(db, 'attendanceLogs', log.id), log);
      else localCommit('attendanceLogs', (items) => [...items, log]);
      showMessage('Checked in. Usage started.');
    },
    async checkOut(activeLog: AttendanceLog) {
      const now = new Date().toISOString();
      const durationHours = diffHours(activeLog.checkInAt, now);
      const next = { ...activeLog, checkOutAt: now, durationHours };
      if (isFirebaseMode && db) await updateDoc(doc(db, 'attendanceLogs', activeLog.id), { checkOutAt: now, durationHours });
      else localCommit('attendanceLogs', (items) => items.map((log) => log.id === activeLog.id ? next : log));
      showMessage(`Checked out. ${durationHours} hours added.`);
    },
    async uploadProfilePhoto(member: Member, file: File) {
      if (isFirebaseMode && storage && db && firebaseUser) {
        const fileRef = ref(storage, `profilePhotos/${firebaseUser.uid}/${Date.now()}-${file.name}`);
        await uploadBytes(fileRef, file);
        const url = await getDownloadURL(fileRef);
        await updateDoc(doc(db, 'members', member.id), { profilePhotoUrl: url, updatedAt: new Date().toISOString() });
      } else {
        const url = URL.createObjectURL(file);
        localCommit('members', (items) => items.map((m) => m.id === member.id ? { ...m, profilePhotoUrl: url } : m));
      }
      showMessage('Profile picture updated.');
    },
    resetDemo() {
      resetLocalDemo();
      setData(loadLocalData());
      showMessage('Demo data reset.');
    },
    async logout() {
      if (isFirebaseMode && auth) await signOut(auth);
      setProfile(null);
      saveLocalProfile(null);
    },
  };

  if (loading) return <Splash />;

  if (!profile) {
    return <AuthScreen
      mode={mode}
      setMode={(next) => {
        setMode(next);
        if (next === 'demo') {
          const demoProfile = loadLocalProfile();
          setProfile(demoProfile);
          setData(loadLocalData());
        }
      }}
      firebaseUser={firebaseUser}
      setLocalProfile={(p) => { saveLocalProfile(p); setProfile(p); }}
      actions={actions}
      data={data}
      showMessage={showMessage}
    />;
  }

  const isAdmin = profile.role === 'admin' || profile.role === 'host';
  return (
    <div className="app-shell">
      {message && <div className="toast">{message}</div>}
      {isAdmin ? <AdminPortal data={data} profile={profile} actions={actions} /> : <MemberApp data={data} profile={profile} actions={actions} />}
      <div className="mode-pill">{mode === 'firebase' ? 'Firebase live mode' : 'Demo/local mode'}</div>
    </div>
  );
}

function Splash() {
  return <div className="splash"><div className="logo-mark">M</div><p>Loading MOAR workspace...</p></div>;
}

function AuthScreen({ mode, setMode, firebaseUser, setLocalProfile, actions, data, showMessage }: {
  mode: 'firebase' | 'demo';
  setMode: (mode: 'firebase' | 'demo') => void;
  firebaseUser: User | null;
  setLocalProfile: (profile: Profile) => void;
  actions: any;
  data: AppData;
  showMessage: (msg: string) => void;
}) {
  const [email, setEmail] = useState('admin@moar.com');
  const [password, setPassword] = useState('123456');
  const [busy, setBusy] = useState(false);

  const loginFirebase = async (create = false) => {
    if (!firebaseReady || !auth) {
      showMessage('Firebase config is missing. Use demo mode or add .env values.');
      return;
    }
    setBusy(true);
    try {
      if (create) await createUserWithEmailAndPassword(auth, email, password);
      else await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      showMessage(err?.message || 'Firebase login failed.');
    } finally { setBusy(false); }
  };

  const useDemo = (role: 'admin' | 'member') => {
    setMode('demo');
    const member = data.members[0];
    const profile: Profile = {
      uid: role === 'admin' ? 'demo-admin' : 'demo-member',
      email: role === 'admin' ? 'admin@moar.demo' : member.email,
      displayName: role === 'admin' ? 'Admin Host' : member.fullName,
      role,
      memberId: role === 'member' ? member.id : undefined,
      createdAt: new Date().toISOString(),
    };
    setLocalProfile(profile);
  };

  if (mode === 'firebase' && firebaseUser) {
    return (
      <div className="login-page">
        <div className="login-card wide">
          <div className="brand-row"><div className="logo-mark">M</div><div><h1>Complete account setup</h1><p>{firebaseUser.email}</p></div></div>
          <div className="alert-box">
            Your Firebase account is logged in, but no role profile exists yet. Create the correct profile below. Admin creation will work only if this email is allowed in <b>firestore.rules</b>.
          </div>
          <div className="button-row">
            <button className="primary" onClick={() => actions.bootstrapProfile('admin')}>Set this account as Admin Host</button>
            <button className="secondary" onClick={() => actions.bootstrapProfile('member')}>Set this account as Member</button>
          </div>
          <button className="link-btn" onClick={() => auth && signOut(auth)}>Log out</button>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-card wide">
        <div className="brand-row"><div className="logo-mark">M</div><div><h1>MOAR Co-working Space</h1><p>Member app + Host/Admin portal with Firebase backend</p></div></div>
        <div className="login-grid">
          <div>
            <h3>Firebase Login</h3>
            {!firebaseReady && <div className="alert-box warn">Firebase is not configured yet. Add your .env file, then run again. You can still test everything in Demo mode.</div>}
            <label>Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@moar.com" />
            <label>Password</label>
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="123456" />
            <div className="button-row">
              <button className="primary" disabled={busy} onClick={() => loginFirebase(false)}>Sign in</button>
              <button className="secondary" disabled={busy} onClick={() => loginFirebase(true)}>Create account</button>
            </div>
          </div>
          <div>
            <h3>Fast Preview</h3>
            <p className="muted-text">Use this to test the full operating flow before Firebase setup. Data saves in browser localStorage.</p>
            <div className="button-stack">
              <button className="primary" onClick={() => useDemo('admin')}>Open Demo Host/Admin Panel</button>
              <button className="secondary" onClick={() => useDemo('member')}>Open Demo Member App</button>
            </div>
            <p className="tiny">Recommended Firebase admin emails: {adminEmails.join(', ')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminPortal({ data, profile, actions }: { data: AppData; profile: Profile; actions: any }) {
  const [page, setPage] = useState<Page>('dashboard');
  const pageMeta: Record<Page, [string, string]> = {
    dashboard: ['Host Dashboard', `Welcome back, ${profile.displayName || 'Admin Host'}`],
    members: ['Members', `${data.members.length} total members · all branches`],
    desks: ['Dedicated Desks', `${data.desks.length} desks across branches`],
    usage: ['Usage & Billing', `${monthName(currentMonthKey())} · member-wise usage and bill management`],
    billing: ['Billing', 'Create bills and update payment status'],
    bookings: ['Meeting Bookings', 'Manage meeting room reservations'],
    content: ['Content Management', 'Notices · Events · News & Vlog'],
    settings: ['Settings', 'Project configuration and demo tools'],
  };
  return (
    <div className="admin-layout">
      <aside className="sidebar">
        <div className="brand"><div className="logo-mark small">M</div><div><b>MOAR Host</b><span>Portal</span></div></div>
        <nav>
          {([
            ['dashboard', '▦', 'Dashboard'], ['members', '👥', 'Members'], ['desks', '▣', 'Dedicated Desks'], ['usage', '▥', 'Usage & Billing'], ['billing', '▭', 'Billing'], ['bookings', '📅', 'Meeting Bookings'], ['content', '🔔', 'Content'], ['settings', '⚙', 'Settings']
          ] as [Page, string, string][]).map(([id, icon, label]) => <button key={id} onClick={() => setPage(id)} className={page === id ? 'active' : ''}><span>{icon}</span>{label}</button>)}
        </nav>
        <div className="sidebar-user"><div className="avatar small-avatar">{initials(profile.displayName)}</div><div><b>{profile.displayName || 'Admin Host'}</b><span>Super Admin</span></div></div>
      </aside>
      <main className="admin-main">
        <header className="topbar"><div><h2>{pageMeta[page][0]}</h2><p>{pageMeta[page][1]}</p></div><div className="top-actions"><input placeholder="Search..." /><button className="icon-button">🔔</button><button className="secondary" onClick={actions.logout}>Logout</button></div></header>
        <div className="admin-content">
          {page === 'dashboard' && <DashboardPage data={data} actions={actions} />}
          {page === 'members' && <MembersPage data={data} actions={actions} />}
          {page === 'desks' && <DesksPage data={data} actions={actions} />}
          {page === 'usage' && <UsageBillingPage data={data} actions={actions} />}
          {page === 'billing' && <BillingPage data={data} actions={actions} />}
          {page === 'bookings' && <BookingsPage data={data} actions={actions} />}
          {page === 'content' && <ContentPage data={data} actions={actions} />}
          {page === 'settings' && <SettingsPage actions={actions} />}
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value, sub, tone = 'green' }: { label: string; value: string | number; sub?: string; tone?: string }) {
  return <div className="stat-card"><div><span>{label}</span><b className={tone}>{value}</b><small>{sub}</small></div><i>●</i></div>;
}

function DashboardPage({ data, actions }: { data: AppData; actions: any }) {
  const active = data.members.filter((m) => m.status === 'Active').length;
  const renewal = data.members.filter((m) => m.status === 'Renewal Due').length;
  const expired = data.members.filter((m) => m.status === 'Expired').length;
  const occupied = data.desks.filter((d) => d.status === 'Occupied').length;
  const available = data.desks.filter((d) => d.status === 'Available').length;
  const unpaid = data.bills.filter((b) => b.status === 'Unpaid');
  const paidTotal = data.bills.filter((b) => b.status === 'Paid').reduce((a, b) => a + b.amount, 0);
  const upcoming = data.bookings.filter((b) => b.status !== 'Cancelled');
  return (
    <>
      <div className="stats-grid four">
        <StatCard label="Total Members" value={data.members.length} sub="all branches" tone="blue" />
        <StatCard label="Active Members" value={active} sub="current active rate" />
        <StatCard label="Renewal Due" value={renewal} sub="needs follow-up" tone="orange" />
        <StatCard label="Expired Members" value={expired} sub="needs attention" tone="red" />
        <StatCard label="Occupied Desks" value={occupied} sub={`of ${data.desks.length} total`} tone="blue" />
        <StatCard label="Available Desks" value={available} sub="ready to assign" />
        <StatCard label="Due Bills" value={money(unpaid.reduce((a, b) => a + b.amount, 0))} sub={`${unpaid.length} unpaid bills`} tone="red" />
        <StatCard label="Upcoming Bookings" value={upcoming.length} sub="active reservations" tone="purple" />
      </div>
      <div className="panel-grid two">
        <Panel title="Desk Occupancy by Floor"><BarBlocks items={['Floor 1', 'Floor 2', 'Floor 3'].map((floor) => ({ label: floor, value: data.desks.filter((d) => d.floor === floor && d.status === 'Occupied').length, max: 6 }))} /></Panel>
        <Panel title="Total Usage Hours"><LineLike value="+12.4%" /><div className="big-number">{Math.round(data.attendanceLogs.reduce((s, l) => s + (l.durationHours || 0), 0))}h</div><p className="muted-text">tracked from check-in/check-out records</p></Panel>
      </div>
      <div className="panel-grid two bottom-panels">
        <Panel title="Renewal Alerts" action="View all →"><div className="alert-list">{data.members.filter((m) => m.status !== 'Active').map((m) => <div className="renewal-card" key={m.id}><b>{m.fullName}</b><span>{m.memberCode} · {data.desks.find((d) => d.id === m.deskId)?.code || 'No desk'}</span><em>{dateLabel(m.renewalDate)}</em></div>)}</div></Panel>
        <Panel title="Upcoming Bookings" action="View all →"><SimpleTable headers={['ID','Member','Room','Date','Status']} rows={data.bookings.slice(0, 5).map((b) => [b.bookingCode, memberName(b.memberId, data), b.roomName, dateLabel(b.date), b.status])} /></Panel>
      </div>
      {data.members.length === 0 && <button className="primary" onClick={actions.seedFirebase}>Seed Firebase Demo Data</button>}
      <Panel title="Recent Notices / Events / News"><div className="content-cards">{data.content.slice(0,3).map((c) => <SmallContent key={c.id} item={c} />)}</div></Panel>
      <p className="hint-line">Host/Admin changes are saved to the common database and appear in the member app automatically.</p>
    </>
  );
}

function MembersPage({ data, actions }: { data: AppData; actions: any }) {
  const blank: Member = { id: uid('mbr'), memberCode: `MB-${String(data.members.length + 1).padStart(3, '0')}`, fullName: '', phone: '', email: '', nid: '', company: '', branchId: data.branches[0]?.id || 'gulshan', deskId: '', membershipType: 'Dedicated Desk', status: 'Active', renewalDate: todayKey(), memberSince: todayKey(), usageLimitDays: 22, usageLimitHours: 200 };
  const [editing, setEditing] = useState<Member | null>(null);
  const [filter, setFilter] = useState('All');
  const members = data.members.filter((m) => filter === 'All' || m.status === filter);
  return (
    <div className="page-with-drawer">
      <div className="full-width">
        <div className="toolbar"><div className="tabs">{['All','Active','Renewal Due','Expired'].map((f) => <button key={f} className={filter === f ? 'selected' : ''} onClick={() => setFilter(f)}>{f}</button>)}</div><button className="primary" onClick={() => setEditing(blank)}>+ Add Member</button></div>
        <Panel title="Member List"><SimpleTable headers={['Member ID','Name','Phone','Email','Desk','Branch','Status','Renewal','Action']} rows={members.map((m) => [m.memberCode, m.fullName, m.phone, m.email, data.desks.find((d) => d.id === m.deskId)?.code || '—', branchName(m.branchId, data.branches), m.status, dateLabel(m.renewalDate), <div className="table-actions"><button onClick={() => setEditing(m)}>Edit</button><button className="danger" onClick={() => actions.deleteMember(m.id)}>Del</button></div>])} /></Panel>
      </div>
      {editing && <MemberDrawer member={editing} data={data} onClose={() => setEditing(null)} onSave={(m) => { actions.saveMember(m); setEditing(null); }} />}
    </div>
  );
}

function MemberDrawer({ member, data, onSave, onClose }: { member: Member; data: AppData; onSave: (m: Member) => void; onClose: () => void }) {
  const [form, setForm] = useState<Member>(member);
  const update = (key: keyof Member, value: string | number) => setForm((prev) => ({ ...prev, [key]: value }));
  return <aside className="drawer"><div className="drawer-head"><h3>{member.fullName ? 'Edit Member' : 'Add New Member'}</h3><button onClick={onClose}>×</button></div>
    <label>Full Name</label><input value={form.fullName} onChange={(e) => update('fullName', e.target.value)} />
    <label>Phone Number</label><input value={form.phone} onChange={(e) => update('phone', e.target.value)} />
    <label>Email Address</label><input value={form.email} onChange={(e) => update('email', e.target.value)} />
    <label>NID Number</label><input value={form.nid} onChange={(e) => update('nid', e.target.value)} />
    <label>Company</label><input value={form.company} onChange={(e) => update('company', e.target.value)} />
    <label>Branch</label><select value={form.branchId} onChange={(e) => update('branchId', e.target.value)}>{data.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
    <label>Membership Type</label><select value={form.membershipType} onChange={(e) => update('membershipType', e.target.value)}><option>Dedicated Desk</option><option>Meeting Room</option><option>Virtual Office</option></select>
    <label>Assigned Desk</label><select value={form.deskId || ''} onChange={(e) => update('deskId', e.target.value)}><option value="">No desk</option>{data.desks.map((d) => <option key={d.id} value={d.id}>{d.code} · {d.status}</option>)}</select>
    <label>Status</label><select value={form.status} onChange={(e) => update('status', e.target.value as Member['status'])}><option>Active</option><option>Renewal Due</option><option>Expired</option></select>
    <label>Renewal Date</label><input type="date" value={form.renewalDate} onChange={(e) => update('renewalDate', e.target.value)} />
    <div className="button-row sticky-bottom"><button className="secondary" onClick={onClose}>Cancel</button><button className="primary" onClick={() => onSave(form)}>Save Member</button></div>
  </aside>;
}

function DesksPage({ data, actions }: { data: AppData; actions: any }) {
  return <><div className="stats-grid five"><StatCard label="Total Desks" value={data.desks.length} /><StatCard label="Occupied" value={data.desks.filter((d) => d.status === 'Occupied').length} tone="blue" /><StatCard label="Available" value={data.desks.filter((d) => d.status === 'Available').length} /><StatCard label="Reserved" value={data.desks.filter((d) => d.status === 'Reserved').length} tone="orange" /><StatCard label="Inactive" value={data.desks.filter((d) => d.status === 'Inactive').length} tone="red" /></div>
    <div className="section-head"><div><h3>Desk Grid</h3><p>All floors · live desk status</p></div><button className="primary" onClick={() => actions.saveDesk({ id: uid('desk'), code: `DD-${data.desks.length + 1}`, floor: 'Floor 1', branchId: data.branches[0]?.id || 'gulshan', status: 'Available' })}>+ Add Desk</button></div>
    <div className="desk-grid">{data.desks.map((desk) => <DeskCard key={desk.id} desk={desk} data={data} actions={actions} />)}</div></>;
}

function DeskCard({ desk, data, actions }: { desk: Desk; data: AppData; actions: any }) {
  const member = data.members.find((m) => m.id === desk.memberId);
  const [status, setStatus] = useState(desk.status);
  useEffect(() => setStatus(desk.status), [desk.status]);
  return <div className={`desk-card ${desk.status.toLowerCase()}`}><div className="desk-head"><h3>{desk.code}</h3><span>{desk.status}</span></div><p>{desk.floor}</p><b>{member?.fullName || '—'}</b><small>{member ? `Since ${dateLabel(member.memberSince)}` : 'Ready to assign'}</small>{member && <><div className="usage-line"><span style={{ width: `${desk.usagePercent || 20}%` }} /></div><small>Renews {dateLabel(member.renewalDate)}</small></>}<div className="button-row"><select value={status} onChange={(e) => setStatus(e.target.value as Desk['status'])}><option>Available</option><option>Occupied</option><option>Reserved</option><option>Inactive</option></select><button onClick={() => actions.saveDesk({ ...desk, status })}>Update</button></div></div>;
}

function UsageBillingPage({ data, actions }: { data: AppData; actions: any }) {
  const totalHours = data.attendanceLogs.reduce((a, l) => a + (l.durationHours || 0), 0);
  const totalBills = data.bills.reduce((a, b) => a + b.amount, 0);
  const unpaid = data.bills.filter((b) => b.status === 'Unpaid').reduce((a, b) => a + b.amount, 0);
  return <><div className="stats-grid four"><StatCard label="Total Hours Used" value={`${Math.round(totalHours)}h`} tone="blue" /><StatCard label="Avg Usage/Member" value={`${Math.round(totalHours / Math.max(1, data.members.length))}h`} /><StatCard label="Total Bills" value={money(totalBills)} /><StatCard label="Due Amount" value={money(unpaid)} tone="red" /></div><div className="panel-grid two"><Panel title="Member-wise Usage Hours"><BarBlocks items={data.members.map((m) => ({ label: m.fullName.split(' ')[0], value: Math.round(calculateUsage(m, data.attendanceLogs, currentMonthKey()).totalHours), max: 200 }))} /></Panel><Panel title="Bill Summary"><ProgressRow label="Total Billed" value={totalBills} max={totalBills} tone="blue" /><ProgressRow label="Paid" value={totalBills - unpaid} max={totalBills} tone="green" /><ProgressRow label="Unpaid" value={unpaid} max={totalBills} tone="red" /></Panel></div><div className="panel-grid two"><Panel title="Member Usage Table"><SimpleTable headers={['Member','Desk','Used','Remaining','%']} rows={data.members.map((m) => { const u = calculateUsage(m, data.attendanceLogs, currentMonthKey()); return [m.fullName, data.desks.find((d) => d.id === m.deskId)?.code || '—', `${u.totalHours}h`, `${u.remainingHours}h`, `${Math.round((u.totalHours / Math.max(1, m.usageLimitHours)) * 100)}%`]; })} /></Panel><BillListPanel data={data} actions={actions} /></div></>;
}

function BillingPage({ data, actions }: { data: AppData; actions: any }) { return <BillListPanel data={data} actions={actions} full />; }

function BillListPanel({ data, actions, full = false }: { data: AppData; actions: any; full?: boolean }) {
  const [show, setShow] = useState(false);
  const [form, setForm] = useState<Bill>({ id: uid('bill'), billCode: `BL-${200 + data.bills.length + 1}`, memberId: data.members[0]?.id || '', type: 'Membership', amount: 12000, date: todayKey(), status: 'Unpaid' });
  return <Panel title="Bill List" action={<button className="primary small" onClick={() => setShow(!show)}>+ Add Bill</button>}><>{show && <div className="inline-form"><select value={form.memberId} onChange={(e) => setForm({ ...form, memberId: e.target.value })}>{data.members.map((m) => <option key={m.id} value={m.id}>{m.fullName}</option>)}</select><input value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} placeholder="Type" /><input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} /><button onClick={() => { actions.saveBill(form); setShow(false); }}>Save</button></div>}<SimpleTable headers={['ID','Member','Type','Amount','Date','Status','Action']} rows={data.bills.slice(0, full ? 999 : 8).map((b) => [b.billCode, memberName(b.memberId, data), b.type, money(b.amount), dateLabel(b.date), b.status, <button onClick={() => actions.saveBill({ ...b, status: b.status === 'Paid' ? 'Unpaid' : 'Paid' })}>{b.status === 'Paid' ? 'Mark Unpaid' : 'Mark Paid'}</button>])} /></></Panel>;
}

function BookingsPage({ data, actions }: { data: AppData; actions: any }) {
  const [show, setShow] = useState(false);
  const [form, setForm] = useState<Booking>({ id: uid('book'), bookingCode: `BK-${300 + data.bookings.length + 1}`, memberId: data.members[0]?.id || '', roomName: 'Meeting Rm 1', date: todayKey(), startTime: '10:00', durationHours: 2, price: 1500, status: 'Confirmed' });
  return <div className="panel-grid two uneven"><Panel title="Today Schedule"><div className="calendar-card"><h3>{monthName(currentMonthKey())}</h3><div className="calendar-grid">{Array.from({ length: 30 }, (_, i) => <span key={i} className={i + 1 === new Date().getDate() ? 'today' : data.bookings.some((b) => Number(b.date.slice(-2)) === i + 1) ? 'has-booking' : ''}>{i + 1}</span>)}</div></div></Panel><Panel title="All Bookings" action={<button className="primary small" onClick={() => setShow(!show)}>+ Create Booking</button>}><>{show && <div className="inline-form booking"><select value={form.memberId} onChange={(e) => setForm({ ...form, memberId: e.target.value })}>{data.members.map((m) => <option key={m.id} value={m.id}>{m.fullName}</option>)}</select><select value={form.roomName} onChange={(e) => setForm({ ...form, roomName: e.target.value })}><option>Meeting Rm 1</option><option>Meeting Rm 2</option><option>Board Room</option></select><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /><input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} /><button onClick={() => { actions.saveBooking(form); setShow(false); }}>Confirm</button></div>}<SimpleTable headers={['ID','Member','Room','Date','Time','Duration','Status']} rows={data.bookings.map((b) => [b.bookingCode, memberName(b.memberId, data), b.roomName, dateLabel(b.date), b.startTime, `${b.durationHours}h`, b.status])} /></></Panel></div>;
}

function ContentPage({ data, actions }: { data: AppData; actions: any }) {
  const [type, setType] = useState<'notice' | 'event' | 'news'>('notice');
  const [show, setShow] = useState(false);
  const [form, setForm] = useState<ContentItem>({ id: uid('cnt'), type: 'notice', title: '', description: '', date: todayKey(), status: 'Published', tag: 'General Notice', author: 'Admin Host' });
  const items = data.content.filter((c) => c.type === type);
  return <><div className="toolbar"><div className="tabs">{(['notice','event','news'] as const).map((t) => <button key={t} className={type === t ? 'selected' : ''} onClick={() => setType(t)}>{t === 'news' ? 'News / Vlog' : t[0].toUpperCase() + t.slice(1)}</button>)}</div><button className="primary" onClick={() => { setForm({ ...form, id: uid('cnt'), type }); setShow(!show); }}>+ Add Content</button></div><div className="alert-box info">Preview: Published content will appear on the member home screen automatically.</div>{show && <Panel title="Add Content"><div className="inline-form content-form"><input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /><input placeholder="Short description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ContentItem['status'] })}><option>Published</option><option>Draft</option></select><button onClick={() => { actions.saveContent(form); setShow(false); }}>Publish</button></div></Panel>}<Panel title={`${type === 'news' ? 'News / Vlog' : type}s`}><SimpleTable headers={['ID','Title','Type','Status','Date','Author']} rows={items.map((c) => [c.id, c.title, c.tag || c.type, c.status, dateLabel(c.date), c.author || 'Admin Host'])} /></Panel><div className="content-cards">{items.map((item) => <SmallContent key={item.id} item={item} />)}</div></>;
}

function SettingsPage({ actions }: { actions: any }) {
  return <div className="settings-grid"><Panel title="Firebase Setup"><p>This app works in Firebase live mode after you add .env values and deploy Firestore/Storage rules.</p><button className="primary" onClick={actions.seedFirebase}>Seed Firebase Demo Data</button></Panel><Panel title="Demo Tools"><p>Local demo mode stores data in your browser only.</p><button className="secondary" onClick={actions.resetDemo}>Reset Local Demo Data</button></Panel><Panel title="Access Logic"><p>Host/Admin controls member information, desk assignment, billing, bookings, and content. Members can check in/out, view usage by month, and upload profile photo.</p></Panel></div>;
}

function MemberApp({ data, profile, actions }: { data: AppData; profile: Profile; actions: any }) {
  const [tab, setTab] = useState<MemberTab>('home');
  const [monthKey, setMonthKey] = useState(currentMonthKey());
  const member = data.members.find((m) => m.id === profile.memberId) || data.members.find((m) => m.email.toLowerCase() === profile.email.toLowerCase()) || data.members[0];
  const stats = calculateUsage(member, data.attendanceLogs, monthKey);
  const branch = member ? branchName(member.branchId, data.branches) : '—';
  const desk = data.desks.find((d) => d.id === member?.deskId);
  if (!member) return <div className="phone-shell"><p>No member data found for this account. Ask Host/Admin to add the member first.</p><button onClick={actions.logout}>Logout</button></div>;
  return <div className="member-stage"><div className="phone-shell"><div className="phone-status"><b>9:41</b><span>⌁ ◔</span></div><div className="phone-content">{tab === 'home' && <MemberHome member={member} branch={branch} desk={desk} stats={stats} data={data} actions={actions} setTab={setTab} monthKey={monthKey} setMonthKey={setMonthKey} />}{tab === 'orders' && <MemberOrders member={member} data={data} />}{tab === 'dashboard' && <MemberDashboard member={member} branch={branch} desk={desk} stats={stats} data={data} monthKey={monthKey} setMonthKey={setMonthKey} />}{tab === 'profile' && <MemberProfile member={member} branch={branch} desk={desk} data={data} actions={actions} />}</div><BottomNav tab={tab} setTab={setTab} /></div><button className="secondary logout-mobile" onClick={actions.logout}>Logout</button></div>;
}

function MemberHome({ member, branch, desk, stats, data, actions, setTab, monthKey, setMonthKey }: any) {
  const active = stats.activeLog;
  const latestNews = data.content.filter((c: ContentItem) => c.status === 'Published');
  return <><div className="mobile-head"><div><p className="location">⌖ {branch} <span>Active</span></p><h2>Good Morning, {member.fullName.split(' ')[0]} 👋</h2></div><button className="bell">🔔</button></div><div className="membership-card"><div><small>MEMBERSHIP</small><h3>{member.membershipType} · {desk?.code || 'No Desk'}</h3></div><span>{member.status}</span><div className="member-meta"><p><small>Member ID</small><b>{member.memberCode}</b></p><p><small>Branch</small><b>{branch}</b></p><p><small>Valid till</small><b>{dateLabel(member.renewalDate)}</b></p></div></div><div className="mobile-row"><div className="check-card"><b>Today's Check-in</b><div className="check-actions"><button disabled={!!active} onClick={() => actions.checkIn(member.id)}>← Check In</button><button disabled={!active} onClick={() => actions.checkOut(active)}>→ Check Out</button></div></div><div className="renew-card"><b>⚠ Renewal Notice</b><p>Expires {dateLabel(member.renewalDate)}. Renew to avoid interruption.</p><button>Renew Now</button></div></div><UsageAnalytics stats={stats} monthKey={monthKey} setMonthKey={setMonthKey} member={member} /><p className="quick-title">Quick Actions</p><div className="quick-grid"><button onClick={() => setTab('orders')}>📅<span>Book a Space</span></button><button>ⓘ<span>Raise Issue</span></button><button>👥<span>Community</span></button><button>⋯<span>Others</span></button></div><div className="upcoming-mini"><span>📅</span><div><b>{data.bookings.find((b: Booking) => b.memberId === member.id)?.roomName || 'No upcoming booking'}</b><p>{data.bookings.find((b: Booking) => b.memberId === member.id)?.date ? dateLabel(data.bookings.find((b: Booking) => b.memberId === member.id).date) : 'Book from host/admin'}</p></div><em>Upcoming</em></div><p className="quick-title">Moor News</p>{latestNews.slice(0,1).map((n: ContentItem) => <div className="news-banner" key={n.id}><h3>{n.title}</h3><p>{n.description}</p><button>Read More</button></div>)}</>;
}

function UsageAnalytics({ stats, monthKey, setMonthKey, member }: any) {
  return <div className="usage-analytics"><div className="usage-head"><b>Usage Analytics</b><input type="month" value={monthKey} onChange={(e) => setMonthKey(e.target.value)} /></div><div className="usage-boxes"><div><b>{stats.daysUsed}/{member.usageLimitDays}</b><span>Total Days</span></div><div><b>{stats.avgHours} hrs</b><span>Avg Hours</span></div><div><b>{stats.weekDaysUsed}/5</b><span>This Week</span></div></div></div>;
}

function MemberOrders({ member, data }: { member: Member; data: AppData }) {
  const bills = data.bills.filter((b) => b.memberId === member.id);
  const bookings = data.bookings.filter((b) => b.memberId === member.id);
  const orders = [...bills.map((b) => ({ id: b.billCode, title: b.type, sub: b.date, type: 'Bill', amount: b.amount, status: b.status })), ...bookings.map((b) => ({ id: b.bookingCode, title: b.roomName, sub: b.date, type: 'Booking', amount: b.price, status: b.status }))];
  return <><h2>My Orders</h2><div className="order-stats"><div><b>{orders.length}</b><span>Total</span></div><div><b>{orders.filter((o) => o.status === 'Paid' || o.status === 'Confirmed').length}</b><span>Active</span></div><div><b>{orders.filter((o) => o.status === 'Pending' || o.status === 'Unpaid').length}</b><span>Pending</span></div></div><div className="order-list">{orders.map((o) => <div className="order-card" key={o.id}><div><b>{o.title}</b><p>{o.id} · {dateLabel(o.sub)}</p></div><span>{o.status}</span><div className="order-bottom"><em>{o.type}</em><b>{money(o.amount)}</b><button>View</button></div></div>)}</div></>;
}

function MemberDashboard({ member, branch, desk, stats, data, monthKey, setMonthKey }: any) {
  return <><h2>Dashboard</h2><div className="dash-overview"><p><span>Plan</span><b>{member.membershipType}</b></p><p><span>Branch</span><b>{branch}</b></p><p><span>Till</span><b>{dateLabel(member.renewalDate)}</b></p><p><span>Status</span><b>{member.status}</b></p></div><UsageAnalytics stats={stats} monthKey={monthKey} setMonthKey={setMonthKey} member={member} /><div className="mobile-row"><div className="mini-chart"><b>Attendance</b><div className="donut" style={{ ['--pct' as any]: `${Math.min(100, (stats.daysUsed / Math.max(1, member.usageLimitDays)) * 100)}%` }}><span>{Math.round((stats.daysUsed / Math.max(1, member.usageLimitDays)) * 100)}%</span></div><p>{stats.daysUsed} of {member.usageLimitDays} days</p></div><div className="mini-chart"><b>Usage</b><div className="donut green" style={{ ['--pct' as any]: `${Math.min(100, (stats.totalHours / Math.max(1, member.usageLimitHours)) * 100)}%` }}><span>{Math.round(stats.totalHours)}h</span></div><p>{stats.remainingHours}h remaining</p></div></div><Panel title="Recent Activity"><div className="activity-list">{data.attendanceLogs.filter((l: AttendanceLog) => l.memberId === member.id).slice(-4).map((l: AttendanceLog) => <p key={l.id}>● Checked in on {dateLabel(l.dateKey)} · {l.durationHours || 'running'}h</p>)}</div></Panel></>;
}

function MemberProfile({ member, branch, desk, data, actions }: { member: Member; branch: string; desk?: Desk; data: AppData; actions: any }) {
  return <><h2>My Profile</h2><div className="profile-top"><label className="photo-upload"><input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && actions.uploadProfilePhoto(member, e.target.files[0])} />{member.profilePhotoUrl ? <img src={member.profilePhotoUrl} /> : <span>{initials(member.fullName)}</span>}<em>+</em></label><div><h3>{member.fullName}</h3><p>{member.memberCode} · Member since {dateLabel(member.memberSince)}</p><span className="status-pill">{member.status}</span><span className="status-pill blue">{member.membershipType}</span></div></div><ProfileSection title="Contact" rows={[['Email', member.email], ['Phone', member.phone], ['Company', member.company]]} /><ProfileSection title="Identity & Documents" rows={[['Member ID', member.memberCode], ['NID', member.nid], ['Contract', member.contractUrl ? 'View Contract →' : 'Not uploaded by admin']]} /><ProfileSection title="Membership" rows={[['Branch', branch], ['Assigned Desk', desk?.code || '—'], ['Renewal Date', dateLabel(member.renewalDate)], ['Date of Birth', member.dob ? dateLabel(member.dob) : '—']]} /><div className="alert-box info">Profile details are managed by MOAR Host Admin. You can only upload/change your profile picture.</div></>;
}

function ProfileSection({ title, rows }: { title: string; rows: [string, string][] }) { return <div className="profile-section"><h4>{title}</h4>{rows.map(([a,b]) => <p key={a}><span>{a}</span><b>{b}</b></p>)}</div>; }
function BottomNav({ tab, setTab }: { tab: MemberTab; setTab: (tab: MemberTab) => void }) { return <div className="bottom-nav">{(['home','orders','dashboard','profile'] as MemberTab[]).map((id) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}><span>{id === 'home' ? '⌂' : id === 'orders' ? '▱' : id === 'dashboard' ? '▦' : '♙'}</span>{id}</button>)}</div>; }

function Panel({ title, children, action }: { title: string; children: any; action?: any }) { return <section className="panel"><div className="panel-head"><h3>{title}</h3>{typeof action === 'string' ? <button>{action}</button> : action}</div>{children}</section>; }
function SimpleTable({ headers, rows }: { headers: string[]; rows: any[][] }) { return <div className="table-wrap"><table><thead><tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody></table></div>; }
function BarBlocks({ items }: { items: { label: string; value: number; max: number }[] }) { return <div className="barblocks">{items.map((it) => <div key={it.label}><span>{it.value}</span><div><i style={{ height: `${Math.max(6, (it.value / Math.max(1, it.max)) * 100)}%` }} /></div><small>{it.label}</small></div>)}</div>; }
function ProgressRow({ label, value, max, tone }: { label: string; value: number; max: number; tone: string }) { return <div className="progress-row"><p><span>{label}</span><b>{money(value)}</b></p><div><i className={tone} style={{ width: `${(value / Math.max(1, max)) * 100}%` }} /></div></div>; }
function LineLike({ value }: { value: string }) { return <div className="line-like"><span>{value}</span><svg viewBox="0 0 400 120"><path d="M0,70 C90,55 120,35 220,42 C300,48 340,55 400,60" /></svg></div>; }
function SmallContent({ item }: { item: ContentItem }) { return <div className="small-content"><span>{item.tag || item.type}</span><h4>{item.title}</h4><p>{item.description}</p><small>{dateLabel(item.date)} · {item.status}</small></div>; }
function memberName(memberId: string, data: AppData) { return data.members.find((m) => m.id === memberId)?.fullName || '—'; }

export default App;
