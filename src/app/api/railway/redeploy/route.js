import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/session.js';
import { ensureInit } from '../../../../lib/setup.js';
import { config } from '../../../../config.js';

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

export async function POST(request) {
  try {
    const session = await getSession();
    if (!session.user?._id) return NextResponse.json({ ok: false }, { status: 401 });
    if (session.user.role !== 'admin')
      return NextResponse.json({ ok: false, message: 'เฉพาะผู้ดูแลระบบเท่านั้นที่สามารถสั่ง ReDeploy ได้' }, { status: 403 });

    await ensureInit();

    const { serviceId, environmentId, deploymentId } = await request.json();
    if (!serviceId || !environmentId)
      return NextResponse.json({ ok: false, message: 'ข้อมูล ID ไม่ครบถ้วน' }, { status: 400 });

    const did = String(deploymentId || '').trim();
    const candidates = [
      { label: 'serviceInstanceRedeploy', query: `mutation ServiceInstanceRedeploy($serviceId: String!, $environmentId: String!) { serviceInstanceRedeploy(serviceId: $serviceId, environmentId: $environmentId) }`, variables: { serviceId, environmentId } },
      ...(did ? [
        { label: 'deploymentRedeploy(id)', query: `mutation RedeployDeployment($deploymentId: String!) { deploymentRedeploy(id: $deploymentId) }`, variables: { deploymentId: did } },
        { label: 'deploymentRedeploy(deploymentId)', query: `mutation RedeployDeployment($deploymentId: String!) { deploymentRedeploy(deploymentId: $deploymentId) }`, variables: { deploymentId: did } },
      ] : []),
    ];

    let lastErr = null;
    for (const c of candidates) {
      try {
        const result = await railwayQuery(c.query, c.variables);
        return NextResponse.json({ ok: true, action: 'redeploy', mutation: c.label, deploymentId: did || null, data: result.data || result });
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr;
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
