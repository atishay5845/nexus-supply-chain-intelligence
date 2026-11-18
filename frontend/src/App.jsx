import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Activity, AlertCircle, AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight,
  Boxes, BrainCircuit, Check, CheckCircle2, ChevronDown, ChevronRight, CircleDot,
  Clock3, Command, Cpu, Database, Download, FileClock, Gauge, GitBranch,
  Globe2, Layers3, LayoutDashboard, LifeBuoy, Menu, Network, PackageCheck,
  Play, Radio, RefreshCw, Route, Search, Settings2, ShieldCheck, Sparkles,
  Truck, Warehouse, Workflow, X, Zap,
} from 'lucide-react'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { api, money, number } from './api.js'

const NAV_ITEMS = [
  { id: 'overview', label: 'Command center', icon: LayoutDashboard, group: 'WORKSPACE' },
  { id: 'mission', label: 'Mission control', icon: Workflow, group: 'WORKSPACE' },
  { id: 'network', label: 'Supply network', icon: Network, group: 'INTELLIGENCE' },
  { id: 'history', label: 'Run history', icon: FileClock, group: 'INTELLIGENCE' },
  { id: 'audit', label: 'System trace', icon: Database, group: 'SYSTEM' },
]

const AGENT_META = [
  { name: 'Monitor Agent', short: '01', role: 'Signal detection', icon: Radio, tint: 'cyan', detail: 'Parses the disruption and resolves the affected item.' },
  { name: 'Inventory Agent', short: '02', role: 'Stock intelligence', icon: Warehouse, tint: 'violet', detail: 'Checks on-hand stock, safety stock and demand coverage.' },
  { name: 'Supplier Agent', short: '03', role: 'Supplier discovery', icon: Boxes, tint: 'lime', detail: 'Finds alternate suppliers and calculates capacity coverage.' },
  { name: 'Route Agent', short: '04', role: 'Route optimisation', icon: Route, tint: 'orange', detail: 'Filters blocked routes and ranks viable alternatives.' },
  { name: 'Coordinator Agent', short: '05', role: 'Decision authority', icon: BrainCircuit, tint: 'blue', detail: 'Compares posted evidence and publishes the mitigation.' },
]

const PAGE_TITLES = {
  overview: ['Command center', 'A live view of the network. One shared picture of what matters.'],
  mission: ['Mission control', 'Inject a disruption. Watch five specialist agents work the problem.'],
  network: ['Supply network', 'The suppliers, stock positions and routes behind every decision.'],
  history: ['Run history', 'Every simulation, decision and recovery path in one place.'],
  audit: ['System trace', 'An append-only record of what each agent saw and posted.'],
}

function cx(...parts) { return parts.filter(Boolean).join(' ') }

function StatusPill({ children, tone = 'neutral', pulse = false }) {
  return <span className={cx('status-pill', `tone-${tone}`)}>{pulse && <i className="pulse-dot" />}{children}</span>
}

function Eyebrow({ children, dot = false }) {
  return <div className="eyebrow">{dot && <i className="eyebrow-dot" />}{children}</div>
}

function PanelHeading({ eyebrow, title, action }) {
  return <div className="panel-heading"><div>{eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}<h3>{title}</h3></div>{action}</div>
}

function MetricCard({ label, value, delta, icon: Icon, tone = 'cyan', foot }) {
  return (
    <motion.div className={`metric-card metric-${tone}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .35 }}>
      <div className="metric-top"><span>{label}</span><div className="metric-icon"><Icon size={17} /></div></div>
      <div className="metric-value">{value}</div>
      <div className="metric-bottom"><span>{delta}</span>{foot && <span className="metric-foot">{foot}</span>}</div>
      <div className="metric-sheen" />
    </motion.div>
  )
}

function AgentPipeline({ run, compact = false }) {
  const posted = new Set((run?.posts || []).map((post) => post.agent))
  const decisionReady = Boolean(run?.decision)
  return (
    <div className={cx('agent-pipeline', compact && 'pipeline-compact')}>
      {AGENT_META.map((agent, index) => {
        const Icon = agent.icon
        const complete = posted.has(agent.name)
        const active = !complete && run && index === posted.size
        return (
          <div className="pipeline-slot" key={agent.name}>
            <motion.div className={cx('agent-node', `agent-${agent.tint}`, complete && 'agent-complete', active && 'agent-active')} layout>
              <div className="agent-node-top"><span className="agent-index">{agent.short}</span>{complete ? <CheckCircle2 size={14} /> : <CircleDot size={14} />}</div>
              <div className="agent-node-icon"><Icon size={19} strokeWidth={1.7} /></div>
              <div className="agent-node-name">{agent.name.replace(' Agent', '')}</div>
              <div className="agent-node-role">{agent.role}</div>
              <div className="agent-node-state">{complete ? 'POSTED TO BOARD' : active ? 'WORKING' : 'STANDBY'}</div>
            </motion.div>
            {index < AGENT_META.length - 1 && <div className={cx('pipeline-connector', complete && 'connector-lit')}><span /></div>}
          </div>
        )
      })}
      {decisionReady && <div className="pipeline-result"><Check size={13} /> DECISION SEALED</div>}
    </div>
  )
}

function EventStream({ events = [], limit = 7, emptyLabel = 'The event stream is quiet. Run a scenario to wake the agents.' }) {
  const visible = events.slice(0, limit)
  return (
    <div className="event-stream">
      {visible.length === 0 ? <div className="empty-inline"><Activity size={18} /><span>{emptyLabel}</span></div> : visible.map((event, index) => (
        <motion.div className="event-row" key={`${event.event_id || event.timestamp}-${index}`} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * .025 }}>
          <div className={cx('event-marker', `event-${event.kind || 'info'}`)}><span /></div>
          <div className="event-copy"><div className="event-title-row"><strong>{event.agent}</strong><time>{event.timestamp ? new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'JUST NOW'}</time></div><p>{event.message}</p></div>
        </motion.div>
      ))}
    </div>
  )
}

function BlackboardPosts({ posts = [] }) {
  return (
    <div className="blackboard-list">
      {posts.length === 0 ? <div className="empty-board"><div className="empty-board-icon"><Database size={22} /></div><strong>Blackboard is waiting</strong><span>Agent findings will appear here as structured, timestamped posts.</span></div> : posts.map((post, index) => (
        <details className="blackboard-post" key={post.post_id} open={index === posts.length - 1}>
          <summary><span className="post-id">{post.post_id}</span><span className="post-agent">{post.agent}</span><span className="post-summary">{post.summary}</span><ChevronDown size={14} /></summary>
          <pre>{JSON.stringify(post.payload, null, 2)}</pre>
        </details>
      ))}
    </div>
  )
}

function DecisionCard({ decision }) {
  if (!decision) return <div className="decision-empty"><div className="decision-orbit"><BrainCircuit size={30} /></div><Eyebrow>AWAITING ORCHESTRATION</Eyebrow><h3>No decision on the board yet.</h3><p>Choose a disruption scenario and run the five-agent workflow to generate an evidence-backed mitigation.</p></div>
  const tone = decision.action === 'HOLD' ? 'orange' : 'lime'
  return (
    <motion.div className={`decision-card decision-${tone}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <div className="decision-topline"><StatusPill tone={decision.action === 'HOLD' ? 'warning' : 'success'} pulse>{decision.status.replaceAll('_', ' ')}</StatusPill><span className="decision-mode"><ShieldCheck size={13} /> EVIDENCE-LOCKED DECISION</span></div>
      <div className="decision-main"><div><Eyebrow>RECOMMENDED MITIGATION</Eyebrow><h2>{decision.action}</h2><p>{decision.rationale}</p></div><div className="decision-glyph"><div className="glyph-ring"><Zap size={30} /></div></div></div>
      <div className="decision-stats">
        <div><span>Estimated recovery</span><strong>{decision.estimated_recovery_days} <small>days</small></strong></div>
        <div><span>Estimated cost</span><strong>{money(decision.estimated_total_cost_inr)}</strong></div>
        <div><span>Supplier plan</span><strong>{decision.selected_supplier_plan?.length || 0} <small>supplier(s)</small></strong></div>
      </div>
      {decision.selected_route && <div className="selected-route"><div className="route-icon"><Route size={15} /></div><div><span>SELECTED ROUTE</span><strong>{decision.selected_route.route_id} · {decision.selected_route.origin} → {decision.selected_route.destination}</strong></div><span className="route-days">{decision.selected_route.transit_days}d transit</span></div>}
    </motion.div>
  )
}

function ScenarioRunner({ scenarios, selectedScenario, setSelectedScenario, requiredQty, setRequiredQty, onRun, running, aiAvailable, useLocalAI, setUseLocalAI }) {
  const current = scenarios.find((item) => item.scenario_id === selectedScenario)
  return (
    <div className="runner-card">
      <div className="runner-card-head"><div><Eyebrow dot>SCENARIO INJECTION</Eyebrow><h3>What broke in the network?</h3><p>Pick a disruption and let the agents coordinate a response.</p></div><div className="runner-icon"><Zap size={20} /></div></div>
      <label className="field-label" htmlFor="scenario-select">DISRUPTION SCENARIO</label>
      <div className="select-wrap"><select id="scenario-select" value={selectedScenario} onChange={(e) => setSelectedScenario(e.target.value)}>{scenarios.map((item) => <option key={item.scenario_id} value={item.scenario_id}>{item.title}</option>)}</select><ChevronDown size={16} /></div>
      {current && <div className="scenario-preview"><div className="scenario-tags"><StatusPill tone={current.severity === 'CRITICAL' ? 'danger' : 'warning'}>{current.severity}</StatusPill><span>{current.tag}</span><span>{current.destination}</span></div><p>{current.description}</p><div className="scenario-ref"><span>SCENARIO ID</span><strong>{current.scenario_id}</strong><span>SKU</span><strong>{current.sku_id}</strong></div></div>}
      <div className="field-row"><div className="field-group"><label className="field-label" htmlFor="required-qty">REQUIRED QUANTITY</label><div className="input-wrap"><input id="required-qty" type="number" min="1" max="100000" value={requiredQty} onChange={(e) => setRequiredQty(e.target.value)} /><span>UNITS</span></div></div><div className="field-group field-group-side"><label className="field-label">EXECUTION MODE</label><div className="mode-selector"><span className="mode-dot" /> {useLocalAI ? 'Local AI review' : 'Deterministic'}</div></div></div>
      <div className="ai-mode-row"><div><strong>Optional local AI annotations</strong><span>{aiAvailable ? 'Microsoft Agent Framework connector detected' : 'Install the optional Ollama connector to enable'}</span></div><button type="button" className={cx('toggle-switch', useLocalAI && 'toggle-on')} disabled={!aiAvailable} onClick={() => setUseLocalAI(!useLocalAI)} aria-pressed={useLocalAI}><i /></button></div>
      <button className="button-primary run-button" onClick={onRun} disabled={running || !current || Number(requiredQty) < 1}><span>{running ? <RefreshCw size={17} className="spin" /> : <Play size={16} fill="currentColor" />}</span>{running ? 'Orchestrating agents…' : 'Run disruption simulation'}<ArrowRight size={17} /></button>
      <div className="runner-foot"><ShieldCheck size={13} /><span>Rule-based decisions · Local CSV data · No API key required</span>{aiAvailable && <span className="ai-ready">FRAMEWORK READY</span>}</div>
    </div>
  )
}

function StockChart({ data = [] }) {
  const chartData = data.map((row) => ({ name: row.warehouse.replace(' Hub', ''), onHand: row.stock, safety: row.safety }))
  return (
    <div className="chart-box">
      <div className="chart-legend"><span><i className="legend-cyan" /> On hand</span><span><i className="legend-muted" /> Safety stock</span></div>
      <ResponsiveContainer width="100%" height={210}>
        <BarChart data={chartData} margin={{ top: 8, right: 2, left: -20, bottom: 0 }} barGap={5}>
          <CartesianGrid stroke="#202a39" strokeDasharray="3 5" vertical={false} />
          <XAxis dataKey="name" tick={{ fill: '#7e8b9d', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#667488', fontSize: 10 }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{ background: '#101926', border: '1px solid #2a3849', borderRadius: 10, color: '#eef4f8', fontSize: 12 }} cursor={{ fill: 'rgba(105, 220, 230, .05)' }} />
          <Bar dataKey="onHand" name="On hand" fill="#65d8df" radius={[4, 4, 0, 0]} maxBarSize={23} />
          <Bar dataKey="safety" name="Safety stock" fill="#415067" radius={[4, 4, 0, 0]} maxBarSize={23} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function SupplierReliabilityChart({ suppliers = [] }) {
  const data = suppliers.filter((row) => row.status === 'ACTIVE').slice(0, 6).map((row) => ({ name: row.supplier_name.split(' ')[0], reliability: row.reliability_pct }))
  return <ResponsiveContainer width="100%" height={210}><AreaChart data={data} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}><defs><linearGradient id="relFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a3e86c" stopOpacity={.22} /><stop offset="100%" stopColor="#a3e86c" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="#202a39" strokeDasharray="3 5" vertical={false} /><XAxis dataKey="name" tick={{ fill: '#7e8b9d', fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis domain={[80, 100]} tick={{ fill: '#667488', fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ background: '#101926', border: '1px solid #2a3849', borderRadius: 10, color: '#eef4f8', fontSize: 12 }} /><Area type="monotone" dataKey="reliability" name="Reliability %" stroke="#a3e86c" strokeWidth={2} fill="url(#relFill)" /></AreaChart></ResponsiveContainer>
}

function OverviewPage({ overview, network, scenarios, selectedScenario, setSelectedScenario, requiredQty, setRequiredQty, onRun, running, run, aiAvailable, useLocalAI, setUseLocalAI, onNavigate }) {
  const metrics = overview?.metrics || {}
  const stockHealth = overview?.stock_health || []
  const latest = run || overview?.latest_run
  return (
    <div className="page-content">
      <div className="hero-grid">
        <div className="hero-copy"><div className="hero-orb orb-one" /><div className="hero-orb orb-two" /><Eyebrow dot>NETWORK INTELLIGENCE / LOCAL SIMULATION</Eyebrow><h1>Disruptions happen.<br /><em>Blind spots</em> don't have to.</h1><p>Five specialised agents. One shared operational picture. A mitigation decision you can actually trace.</p><div className="hero-actions"><button className="button-primary" onClick={() => onNavigate('mission')}>Open mission control <ArrowRight size={16} /></button><span className="hero-micro"><i /> SYSTEM OPERATIONAL</span></div><div className="hero-watermark">NEXUS<span> / 01</span></div></div>
        <div className="hero-side"><div className="hero-side-head"><span>NETWORK PULSE</span><span className="live-label"><i /> LOCAL SNAPSHOT</span></div><div className="pulse-graphic"><div className="pulse-circle pulse-c1" /><div className="pulse-circle pulse-c2" /><div className="pulse-circle pulse-c3" /><div className="pulse-core"><Network size={28} /><span>NX</span></div><div className="pulse-node pulse-n1"><Warehouse size={14} /></div><div className="pulse-node pulse-n2"><Truck size={14} /></div><div className="pulse-node pulse-n3"><Boxes size={14} /></div><div className="pulse-node pulse-n4"><Route size={14} /></div></div><div className="hero-side-foot"><span><i className="legend-cyan" /> 04 INVENTORY NODES</span><span><i className="legend-lime" /> {metrics.open_routes || 0} OPEN ROUTES</span></div></div>
      </div>
      <div className="metric-grid">
        <MetricCard label="Inventory SKUs" value={number(metrics.inventory_skus)} delta="Tracked across 4 hubs" icon={Boxes} tone="cyan" foot="DEMO DATA" />
        <MetricCard label="Safety stock exposure" value={number(metrics.at_risk_skus)} delta="SKUs below buffer" icon={AlertTriangle} tone="orange" foot="NEEDS ATTENTION" />
        <MetricCard label="Active suppliers" value={number(metrics.active_suppliers)} delta={`${metrics.supplier_reliability || 0}% average reliability`} icon={Truck} tone="lime" foot="SUPPLIER HEALTH" />
        <MetricCard label="Open routes" value={number(metrics.open_routes)} delta="Capacity-screened corridors" icon={Route} tone="violet" foot="LOGISTICS NETWORK" />
      </div>
      <div className="section-line"><span>OPERATIONAL WORKSPACE</span><span>01 / CONTROL & OBSERVABILITY</span></div>
      <div className="dashboard-grid dashboard-grid-main">
        <ScenarioRunner scenarios={scenarios} selectedScenario={selectedScenario} setSelectedScenario={setSelectedScenario} requiredQty={requiredQty} setRequiredQty={setRequiredQty} onRun={onRun} running={running} aiAvailable={aiAvailable} useLocalAI={useLocalAI} setUseLocalAI={setUseLocalAI} />
        <div className="decision-panel panel"><PanelHeading eyebrow="LATEST OUTCOME" title="Decision brief" action={<button className="text-action" onClick={() => onNavigate('mission')}>View trace <ArrowUpRight size={14} /></button>} /><DecisionCard decision={latest?.decision} />{latest?.run_id && <div className="run-stamp"><span>RUN ID</span><strong>{latest.run_id}</strong><span>·</span><span>{new Date(latest.created_at).toLocaleString()}</span></div>}</div>
      </div>
      <div className="section-line"><span>AGENTIC WORKFLOW</span><span>02 / FAN-OUT SIGNALS → FAN-IN DECISION</span></div>
      <div className="panel pipeline-panel"><div className="pipeline-heading"><div><Eyebrow>FIVE SPECIALISTS · SHARED BLACKBOARD</Eyebrow><h3>From disruption to decision</h3></div><StatusPill tone={latest ? 'success' : 'neutral'} pulse={Boolean(latest)}>{latest ? 'LAST RUN COMPLETE' : 'READY TO ORCHESTRATE'}</StatusPill></div><AgentPipeline run={latest} /><div className="pipeline-caption"><span>Each worker posts its findings to the same shared state.</span><span>Coordinator reads the board, never assumptions.</span></div></div>
      <div className="section-line"><span>NETWORK TELEMETRY</span><span>03 / CURRENT DATASET SNAPSHOT</span></div>
      <div className="dashboard-grid dashboard-grid-lower">
        <div className="panel chart-panel"><PanelHeading eyebrow="STOCK POSITION" title="Inventory vs safety buffer" action={<span className="chart-caption">UNITS / SKU</span>} /><StockChart data={stockHealth} /></div>
        <div className="panel chart-panel"><PanelHeading eyebrow="SUPPLIER SIGNAL" title="Reliability index" action={<span className="chart-caption">PERCENT</span>} /><SupplierReliabilityChart suppliers={network?.suppliers || []} /></div>
        <div className="panel event-panel"><PanelHeading eyebrow="TRACE FEED" title="Latest agent activity" action={<button className="icon-action" onClick={() => onNavigate('audit')}><ArrowUpRight size={16} /></button>} /><EventStream events={latest?.events || []} limit={6} /></div>
      </div>
      <div className="footer-note"><span><ShieldCheck size={13} /> DECISIONS ARE COMPUTED FROM DATASET EVIDENCE</span><span>DEMO DATA · NOT CONNECTED TO LIVE SUPPLIERS OR CARRIERS</span></div>
    </div>
  )
}

function MissionPage({ scenarios, selectedScenario, setSelectedScenario, requiredQty, setRequiredQty, onRun, running, run, aiAvailable, useLocalAI, setUseLocalAI }) {
  const events = run?.events || []
  return (
    <div className="page-content">
      <div className="mission-intro"><div><Eyebrow dot>MISSION CONTROL / DISRUPTION SIMULATOR</Eyebrow><h1>Put the network<br /><em>under pressure.</em></h1><p>Trigger a scenario. Follow every specialist. Inspect the exact evidence that shaped the final call.</p></div><div className="mission-status-card"><div className="status-orbit"><Activity size={21} /></div><div><span>ORCHESTRATOR STATUS</span><strong>{running ? 'PROCESSING SIGNALS' : run ? 'READY / LAST RUN SEALED' : 'STANDING BY'}</strong></div><StatusPill tone={running ? 'warning' : 'success'} pulse>{running ? 'RUNNING' : 'READY'}</StatusPill></div></div>
      <div className="mission-grid">
        <div className="mission-left"><ScenarioRunner scenarios={scenarios} selectedScenario={selectedScenario} setSelectedScenario={setSelectedScenario} requiredQty={requiredQty} setRequiredQty={setRequiredQty} onRun={onRun} running={running} aiAvailable={aiAvailable} useLocalAI={useLocalAI} setUseLocalAI={setUseLocalAI} /><div className="panel mission-pipeline"><PanelHeading eyebrow="ORCHESTRATION TOPOLOGY" title="Worker status" /><AgentPipeline run={run} compact /><div className="agent-legend"><span><i className="legend-lime" /> Posted findings</span><span><i className="legend-muted" /> Awaiting execution</span></div></div></div>
        <div className="mission-right"><div className="panel decision-panel"><PanelHeading eyebrow="FINAL MITIGATION" title="Decision brief" action={run?.run_id && <span className="run-token">{run.run_id}</span>} /><DecisionCard decision={run?.decision} /></div><div className="panel"><PanelHeading eyebrow="SHARED MEMORY / BLACKBOARD" title="Agent evidence posts" action={<span className="post-count">{run?.posts?.length || 0} POSTS</span>} /><BlackboardPosts posts={run?.posts || []} /></div></div>
      </div>
      <div className="panel mission-timeline"><PanelHeading eyebrow="EXECUTION TRACE" title="What happened, in order" action={<StatusPill tone={run ? 'success' : 'neutral'}>{run ? 'APPEND-ONLY TRACE' : 'NO RUN SELECTED'}</StatusPill>} /><EventStream events={events} limit={30} /></div>
      {run?.ai_annotations && <div className="panel ai-annotation-panel"><PanelHeading eyebrow="OPTIONAL LOCAL MODEL REVIEW" title="Agent commentary" action={<StatusPill tone="success">ANNOTATIONS ONLY</StatusPill>} />{Object.entries(run.ai_annotations).map(([agent, note]) => <div className="ai-annotation-row" key={agent}><strong>{agent}</strong><p>{note}</p></div>)}</div>}
      {run?.ai_warning && <div className="notice warning-notice"><AlertCircle size={16} /><span>{run.ai_warning}</span></div>}
    </div>
  )
}

function DataTable({ columns, rows, empty = 'No records found.' }) {
  return <div className="table-wrap"><table><thead><tr>{columns.map((col) => <th key={col.key}>{col.label}</th>)}</tr></thead><tbody>{rows.length === 0 ? <tr><td colSpan={columns.length} className="table-empty">{empty}</td></tr> : rows.map((row, index) => <tr key={row.id || row.supplier_id || row.route_id || row.sku_id || index}>{columns.map((col) => <td key={col.key}>{col.render ? col.render(row[col.key], row) : row[col.key]}</td>)}</tr>)}</tbody></table></div>
}

function NetworkPage({ network }) {
  const [tab, setTab] = useState('inventory')
  const inventory = network?.inventory || []
  const suppliers = network?.suppliers || []
  const routes = network?.routes || []
  return <div className="page-content"><div className="page-intro-row"><div><Eyebrow dot>NETWORK GRAPH / DATA REGISTRY</Eyebrow><h1>Every node has a<br /><em>place in the plan.</em></h1><p>Explore the local dataset that powers NEXUS decisions. All figures are synthetic demo records.</p></div><div className="data-counts"><div><strong>{inventory.length}</strong><span>SKUs</span></div><div><strong>{suppliers.length}</strong><span>SUPPLIERS</span></div><div><strong>{routes.length}</strong><span>ROUTES</span></div></div></div>
    <div className="panel network-panel"><div className="tab-row"><button className={tab === 'inventory' ? 'tab-active' : ''} onClick={() => setTab('inventory')}><Warehouse size={15} /> Inventory</button><button className={tab === 'suppliers' ? 'tab-active' : ''} onClick={() => setTab('suppliers')}><Truck size={15} /> Suppliers</button><button className={tab === 'routes' ? 'tab-active' : ''} onClick={() => setTab('routes')}><Route size={15} /> Routes</button></div>
    {tab === 'inventory' && <DataTable rows={inventory} columns={[{ key: 'sku_id', label: 'SKU' }, { key: 'product_name', label: 'Product' }, { key: 'warehouse', label: 'Warehouse' }, { key: 'current_stock', label: 'On hand', render: (v) => number(v) }, { key: 'safety_stock', label: 'Safety stock', render: (v) => number(v) }, { key: 'unit_cost_inr', label: 'Unit value', render: (v) => money(v) }, { key: 'current_stock', label: 'Signal', render: (_, row) => <StatusPill tone={row.current_stock < row.safety_stock ? 'danger' : 'success'}>{row.current_stock < row.safety_stock ? 'BELOW BUFFER' : 'HEALTHY'}</StatusPill> }]} />}
    {tab === 'suppliers' && <DataTable rows={suppliers} columns={[{ key: 'supplier_id', label: 'Supplier ID' }, { key: 'supplier_name', label: 'Supplier' }, { key: 'sku_id', label: 'SKU' }, { key: 'available_qty', label: 'Available', render: (v) => number(v) }, { key: 'lead_time_days', label: 'Lead time', render: (v) => `${v} days` }, { key: 'reliability_pct', label: 'Reliability', render: (v) => <span className="reliability-value">{v}%</span> }, { key: 'status', label: 'Status', render: (v) => <StatusPill tone={v === 'ACTIVE' ? 'success' : 'warning'}>{v}</StatusPill> }]} />}
    {tab === 'routes' && <DataTable rows={routes} columns={[{ key: 'route_id', label: 'Route ID' }, { key: 'origin', label: 'Origin' }, { key: 'destination', label: 'Destination' }, { key: 'transit_days', label: 'Transit', render: (v) => `${v} days` }, { key: 'freight_cost_inr', label: 'Freight', render: (v) => money(v) }, { key: 'capacity_units', label: 'Capacity', render: (v) => number(v) }, { key: 'status', label: 'Status', render: (v) => <StatusPill tone={v === 'OPEN' ? 'success' : 'danger'}>{v}</StatusPill> }]} />}
    <div className="table-foot"><span><Database size={13} /> SOURCE: BACKEND / APP / DATA / CSV</span><span>READ-ONLY DEMO DATA</span></div></div>
  </div>
}

function HistoryPage({ runs, onSelectRun }) {
  return <div className="page-content"><div className="page-intro-row"><div><Eyebrow dot>SIMULATION ARCHIVE</Eyebrow><h1>Decisions leave<br /><em>a trail.</em></h1><p>Every completed run is stored as a readable snapshot and an append-only event sequence.</p></div><div className="archive-stat"><FileClock size={22} /><strong>{runs.length}</strong><span>RECORDED RUNS</span></div></div><div className="panel history-panel"><PanelHeading eyebrow="RUN REGISTRY" title="Recent simulations" action={<span className="post-count">LATEST FIRST</span>} />{runs.length === 0 ? <div className="empty-board"><div className="empty-board-icon"><FileClock size={22} /></div><strong>No runs recorded</strong><span>Head to Mission Control to launch your first disruption simulation.</span></div> : <div className="history-list">{runs.map((item) => <button className="history-row" key={item.run_id} onClick={() => onSelectRun(item.run_id)}><div className="history-run-icon"><Activity size={17} /></div><div className="history-run-main"><strong>{item.scenario}</strong><span>{item.run_id} · {item.sku_id} · {item.created_at ? new Date(item.created_at).toLocaleString() : 'Timestamp unavailable'}</span></div><StatusPill tone={item.action === 'HOLD' ? 'warning' : 'success'}>{item.action}</StatusPill><ChevronRight size={17} /></button>)}</div>}</div></div>
}

function AuditPage({ audit }) {
  return <div className="page-content"><div className="page-intro-row"><div><Eyebrow dot>OBSERVABILITY / IMMUTABLE TRACE</Eyebrow><h1>Nothing happens<br /><em>off the record.</em></h1><p>The audit stream captures agent starts, findings, warnings and final decisions.</p></div><div className="archive-stat audit-stat"><ShieldCheck size={22} /><strong>APPEND</strong><span>ONLY LOG</span></div></div><div className="audit-grid"><div className="panel audit-feed"><PanelHeading eyebrow="AUDIT LOG / JSONL" title="Recent system events" action={<StatusPill tone="success" pulse>WRITE ENABLED</StatusPill>} /><EventStream events={audit} limit={100} emptyLabel="No audit events yet. Run a simulation to write the first records." /></div><div className="panel audit-info"><div className="audit-lock"><ShieldCheck size={24} /></div><Eyebrow>TRACE INTEGRITY</Eyebrow><h3>Built for explainability.</h3><p>Every worker post is saved with the run ID, role, timestamp and message. The log is appended to, never rewritten during normal runs.</p><div className="integrity-item"><CheckCircle2 size={15} /><span>Agent-by-agent activity</span></div><div className="integrity-item"><CheckCircle2 size={15} /><span>Shared Blackboard post references</span></div><div className="integrity-item"><CheckCircle2 size={15} /><span>Decision and mitigation record</span></div><div className="integrity-item"><CheckCircle2 size={15} /><span>Local JSONL persistence</span></div></div></div></div>
}

export default function App() {
  const [page, setPage] = useState('overview')
  const [overview, setOverview] = useState(null)
  const [network, setNetwork] = useState(null)
  const [scenarios, setScenarios] = useState([])
  const [runs, setRuns] = useState([])
  const [audit, setAudit] = useState([])
  const [health, setHealth] = useState(null)
  const [selectedScenario, setSelectedScenario] = useState('SCN-001')
  const [requiredQty, setRequiredQty] = useState('500')
  const [run, setRun] = useState(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [mobileNav, setMobileNav] = useState(false)
  const [useLocalAI, setUseLocalAI] = useState(false)

  const refreshAll = useCallback(async () => {
    const [overviewData, networkData, scenarioData, runData, auditData, healthData] = await Promise.all([
      api.overview(), api.network(), api.scenarios(), api.runs(), api.audit(), api.health(),
    ])
    setOverview(overviewData); setNetwork(networkData); setScenarios(scenarioData); setRuns(runData); setAudit(auditData); setHealth(healthData)
    if (!run && overviewData.latest_run) setRun(overviewData.latest_run)
  }, [run])

  useEffect(() => {
    refreshAll().catch((err) => setError(`Backend connection unavailable. Start the FastAPI service on port 8000. ${err.message}`))
  }, [])

  const currentScenario = scenarios.find((item) => item.scenario_id === selectedScenario)
  useEffect(() => { if (currentScenario) setRequiredQty(String(currentScenario.required_qty)) }, [selectedScenario])

  const handleRun = async () => {
    if (Number(requiredQty) < 1) { setError('Required quantity must be greater than zero.'); return }
    setRunning(true); setError(''); setToast('');
    try {
      const result = await api.run({ scenario_id: selectedScenario, required_qty: Number(requiredQty), use_local_ai: useLocalAI })
      setRun(result); setPage('mission');
      const [overviewData, runData, auditData] = await Promise.all([api.overview(), api.runs(), api.audit()])
      setOverview(overviewData); setRuns(runData); setAudit(auditData)
      setToast(`${result.decision.action} recommendation sealed · ${result.run_id}`)
    } catch (err) { setError(err.message || 'Simulation failed.'); }
    finally { setRunning(false) }
  }

  const handleSelectRun = async (runId) => {
    try {
      const detail = await api.runDetail(runId)
      if (detail.detail) throw new Error(detail.detail)
      setRun(detail); setPage('mission');
    } catch (err) { setError(err.message) }
  }

  const navTo = (nextPage) => { setPage(nextPage); setMobileNav(false); setError(''); setToast('') }
  const title = PAGE_TITLES[page] || PAGE_TITLES.overview

  return (
    <div className="app-shell">
      <div className="ambient ambient-a" /><div className="ambient ambient-b" />
      <aside className={cx('sidebar', mobileNav && 'sidebar-open')}>
        <div className="brand-lockup"><div className="brand-mark"><span /><span /><span /><span /></div><div><strong>NEXUS</strong><small>SUPPLY CHAIN INTELLIGENCE</small></div><button className="mobile-close" onClick={() => setMobileNav(false)}><X size={17} /></button></div>
        <div className="workspace-switch"><div className="workspace-avatar">NX</div><div><strong>Northstar Operations</strong><span>Simulation workspace</span></div><ChevronDown size={14} /></div>
        <div className="sidebar-nav">{['WORKSPACE', 'INTELLIGENCE', 'SYSTEM'].map((group) => <div className="nav-group" key={group}><div className="nav-label">{group}</div>{NAV_ITEMS.filter((item) => item.group === group).map((item) => { const Icon = item.icon; return <button key={item.id} className={cx('nav-link', page === item.id && 'nav-link-active')} onClick={() => navTo(item.id)}><Icon size={17} strokeWidth={1.8} /><span>{item.label}</span>{item.id === 'audit' && <i className="nav-live-dot" />}</button>})}</div>)}</div>
        <div className="sidebar-bottom"><div className="sidebar-status"><div className="status-orb-small"><Activity size={13} /></div><div><strong>Core systems normal</strong><span>5 workers registered</span></div><i className="green-led" /></div><div className="sidebar-foot"><span>BUILD 1.0.0</span><span>Q6 / BLACKBOARD</span></div></div>
      </aside>
      {mobileNav && <button className="mobile-scrim" onClick={() => setMobileNav(false)} aria-label="Close navigation" />}
      <main className="main-shell">
        <header className="topbar"><div className="topbar-left"><button className="mobile-menu" onClick={() => setMobileNav(true)}><Menu size={19} /></button><div className="breadcrumbs"><span>WORKSPACE</span><ChevronRight size={13} /><strong>{title[0]}</strong></div></div><div className="topbar-right"><div className="topbar-system"><i /> API {health?.status === 'operational' ? 'CONNECTED' : 'CONNECTING'}</div><div className="topbar-divider" /><div className="topbar-env"><span>ENVIRONMENT</span><strong>LOCAL SIMULATION</strong></div><div className="user-chip"><span>AS</span></div></div></header>
        <div className="page-heading"><div><h2>{title[0]}</h2><p>{title[1]}</p></div><div className="page-heading-actions"><span className="data-time"><Clock3 size={13} /> {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span><button className="button-quiet" onClick={() => refreshAll().catch((err) => setError(err.message))}><RefreshCw size={14} /> Refresh</button></div></div>
        {error && <div className="notice error-notice"><AlertCircle size={16} /><span>{error}</span><button onClick={() => setError('')}><X size={14} /></button></div>}
        <AnimatePresence>{toast && <motion.div className="toast" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}><CheckCircle2 size={15} />{toast}<button onClick={() => setToast('')}><X size={13} /></button></motion.div>}</AnimatePresence>
        {!overview && !error ? <div className="loading-screen"><div className="loader-mark"><span /><span /><span /><span /></div><strong>Synchronising network intelligence…</strong><span>Connecting to local control plane</span></div> : <AnimatePresence mode="wait"><motion.div key={page} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: .2 }}>
          {page === 'overview' && <OverviewPage overview={overview} network={network} scenarios={scenarios} selectedScenario={selectedScenario} setSelectedScenario={setSelectedScenario} requiredQty={requiredQty} setRequiredQty={setRequiredQty} onRun={handleRun} running={running} run={run} aiAvailable={health?.agent_framework_installed && health?.ollama_connector_installed} useLocalAI={useLocalAI} setUseLocalAI={setUseLocalAI} onNavigate={navTo} />}
          {page === 'mission' && <MissionPage scenarios={scenarios} selectedScenario={selectedScenario} setSelectedScenario={setSelectedScenario} requiredQty={requiredQty} setRequiredQty={setRequiredQty} onRun={handleRun} running={running} run={run} aiAvailable={health?.agent_framework_installed && health?.ollama_connector_installed} useLocalAI={useLocalAI} setUseLocalAI={setUseLocalAI} />}
          {page === 'network' && <NetworkPage network={network} />}
          {page === 'history' && <HistoryPage runs={runs} onSelectRun={handleSelectRun} />}
          {page === 'audit' && <AuditPage audit={audit} />}
        </motion.div></AnimatePresence>}
        <footer className="app-footer"><span>© 2026 NEXUS INTELLIGENCE</span><span>BUILT ON SHARED STATE <b>·</b> POWERED BY SPECIALIST AGENTS</span><span><i /> ALL SYSTEMS NOMINAL</span></footer>
      </main>
    </div>
  )
}
