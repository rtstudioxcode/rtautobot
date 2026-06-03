import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/session.js';
import { ensureInit } from '../../../../lib/setup.js';
import { User } from '../../../../models/User.js';
import { BonustimeUser } from '../../../../models/BonustimeUser.js';
import { config } from '../../../../config.js';
import { bonustimeTenantLookup, bonustimeSharedServiceName } from '../../../../services/bonustimeMultiTenant.js';

const RAILWAY_API_URLS = ['https://backboard.railway.app/graphql/v2', 'https://backbone.railway.app/graphql/v2'];

function railwayAuthHeader(token, mode) {
  if (mode === 'project') return { 'Project-Access-Token': token };
  return { Authorization: `Bearer ${token}` };
}

async function railwayQuery(query, variables = {}) {
  const token = String(config?.railway?.apiToken || '').trim();
  if (!token) throw new Error('Railway API token ยังไม่ได้ตั้งค่า');
  const preferred = String(config?.railway?.tokenType || '').trim().toLowerCase();
  const authModes = preferred === 'project' ? ['project', 'bearer'] : ['bearer', 'project'];
  const errors = [];
  for (const url of RAILWAY_API_URLS) {
    for (const mode of authModes) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...railwayAuthHeader(token, mode) },
          body: JSON.stringify({ query, variables }),
        });
        const text = await res.text();
        let data = {};
        try { data = text ? JSON.parse(text) : {}; } catch { data = { message: text }; }
        if (res.ok && !data?.errors) return data;
        errors.push(`${mode}@${url}: HTTP ${res.status}`);
      } catch (err) {
        errors.push(`${mode}@${url}: ${err?.message}`);
      }
    }
  }
  throw new Error(`Railway API error: ${errors.slice(-2).join(' || ')}`);
}

async function fetchRailwayServices() {
  const projectId = config?.railway?.projectId;
  if (!projectId) throw new Error('Railway Project ID ยังไม่ได้ตั้งค่า');
  const result = await railwayQuery(`
    query GetProjectServices($projectId: String!) {
      project(id: $projectId) {
        services { edges { node { id name serviceInstances { edges { node { environmentId } } } deployments(first: 5) { edges { node { id status } } } } } }
      }
    }
  `, { projectId });
  return result.data?.project?.services?.edges?.map((e) => e.node).filter(Boolean) || [];
}

export async function POST(request) {
  try {
    const session = await getSession();
    if (!session.user?._id) return NextResponse.json({ ok: false }, { status: 401 });

    await ensureInit();

    const { serviceId, environmentId, tenantId, deploymentId } = await request.json();
    if (!serviceId || !environmentId)
      return NextResponse.json({ ok: false, message: 'ข้อมูลไม่ครบถ้วน (Missing Service ID / Environment ID)' }, { status: 400 });

    const isAdmin = session.user.role === 'admin';

    if (!isAdmin) {
      const services = await fetchRailwayServices();
      const sharedName = bonustimeSharedServiceName();
      const service = services.find((node) => {
        const name = String(node?.name || '').trim();
        if (String(node.id) === serviceId) return true;
        if (sharedName && name === sharedName) return true;
        return false;
      });
      if (!service) return NextResponse.json({ ok: false, message: 'ไม่พบ Service นี้ใน Railway' }, { status: 404 });

      const bt = tenantId ? await BonustimeUser.findOne(bonustimeTenantLookup(tenantId)).lean() : null;
      const user = await User.findById(session.user._id).select('serial_key');
      if (!user?.serial_key) return NextResponse.json({ ok: false, message: 'กรุณาลงทะเบียน Serial Key' }, { status: 403 });
      if (!bt || String(bt.serial_key || '').trim() !== user.serial_key.trim())
        return NextResponse.json({ ok: false, message: 'คุณไม่มีสิทธิ์ Restart Service นี้' }, { status: 403 });
    }

    // Get deployment ID if not provided
    let did = String(deploymentId || '').trim();
    if (!did) {
      const services = await fetchRailwayServices();
      const service = services.find((node) => String(node.id) === serviceId);
      did = service?.deployments?.edges?.[0]?.node?.id || '';
    }
    if (!did) return NextResponse.json({ ok: false, message: 'ไม่พบ Deployment ID สำหรับ Restart' }, { status: 400 });

    let lastErr = null;
    for (const q of [
      { label: 'deploymentRestart(id)', query: `mutation RestartDeployment($deploymentId: String!) { deploymentRestart(id: $deploymentId) }`, variables: { deploymentId: did } },
      { label: 'deploymentRestart(deploymentId)', query: `mutation RestartDeployment($deploymentId: String!) { deploymentRestart(deploymentId: $deploymentId) }`, variables: { deploymentId: did } },
    ]) {
      try {
        const result = await railwayQuery(q.query, q.variables);
        return NextResponse.json({ ok: true, action: 'restart', mutation: q.label, deploymentId: did, data: result.data || result });
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr;
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
